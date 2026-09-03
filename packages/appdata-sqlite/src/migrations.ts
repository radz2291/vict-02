import type { ResourceDefinition } from '@vict/sdk';
import {
  VictApplicationDataError,
  inTransaction,
  safeDriver,
  type OpenAppDatabase,
} from './driver.js';

/**
 * Application-domain migrations (OPEN-014 decision, Stage 05).
 *
 * The migration contract is a versioned, EXPLICIT, transactional,
 * forward-ordered API that is structurally separate from Vict operational
 * migrations:
 *
 * - Each migration has a stable string `id` and an integer `version`
 *   (positive, strictly ascending). The physical schema version space is
 *   INDEPENDENT of application revisions, resource revisions, and
 *   applicationVersion: no definition revision is ever interpreted as a
 *   schema migration version.
 * - Every migration runs inside one transaction together with its
 *   bookkeeping row, so an injected failure rolls back cleanly and the
 *   recorded history stays truthful.
 * - Migration identifiers must be unique; versions must be unique;
 *   migrations must arrive in ascending version order. Conflicts fail with
 *   `APPDATA_MIGRATION_CONFLICT` before anything is applied.
 * - A database recorded at a version the adapter does not know
 *   (future/incompatible schema) fails closed with `APPDATA_FUTURE_SCHEMA`
 *   before any statement runs.
 * - There is no down-migration and no destructive inference from
 *   Application Definition diffs: resource-definition changes never
 *   silently rewrite physical tables. Callers publish a new explicit
 *   migration (helpers such as `migrationsFromResources` exist for the
 *   common bootstrap).
 *
 * Physical naming: application-domain tables are prefixed `appdata_` and
 * migration bookkeeping lives in `vict_appdata_migrations` — both
 * namespaces are disjoint from Vict operational tables (`vict_activation`,
 * `vict_run`, `vict_event`, `vict_schema_migration`, ...), so the two
 * migration histories can never be confused even inside one file.
 */

/** The bookkeeping table is created outside versioned migrations. */
const MIGRATION_BOOKKEEPING_DDL = `
CREATE TABLE IF NOT EXISTS vict_appdata_migrations (
  version INTEGER PRIMARY KEY,
  id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS vict_appdata_idempotency (
  scope_key TEXT PRIMARY KEY,
  identity TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  applied_at TEXT NOT NULL
);
`;

/** One explicit application-domain schema migration. */
export interface ApplicationDataMigration {
  /** Stable migration identity (unique across the deployment's history). */
  readonly id: string;
  /** Physical schema version: positive, strictly ascending, never reused. */
  readonly version: number;
  readonly name: string;
  readonly statements: readonly string[];
}

/** One applied migration as recorded in the inspectable history. */
export interface AppliedApplicationDataMigration {
  readonly id: string;
  readonly version: number;
  readonly name: string;
  readonly appliedAt: string;
}

/** A safe physical identifier for resource tables: lowercase snake_case. */
const PHYSICAL_IDENTIFIER = /^[a-z][a-z0-9_]*$/;

/** The physical table name of a resource (validated mapping, never raw author text). */
export function physicalTableName(resourceId: string): string {
  if (typeof resourceId !== 'string' || !PHYSICAL_IDENTIFIER.test(resourceId)) {
    throw new VictApplicationDataError(
      'APPDATA_INVALID_RESOURCE',
      'Resource ids must be lowercase snake_case identifiers to receive a safe physical table mapping.',
      'physicalTableName',
    );
  }
  return `appdata_${resourceId}`;
}

/**
 * Generate the bootstrap migration that creates the physical tables of the
 * given resources. Rows are stored as `identity TEXT PRIMARY KEY` plus a
 * canonical JSON `data` column; filters, sorting, search, and pagination
 * cross validated catalogue fields only and reach SQL exclusively as
 * parameterized `json_extract` expressions — no hostile string ever
 * becomes SQL text.
 */
export function migrationsFromResources(
  resources: readonly ResourceDefinition[],
  version: number,
  name = 'create-application-domain-resource-tables',
): ApplicationDataMigration {
  const statements: string[] = [];
  for (const resource of resources) {
    const table = physicalTableName(resource.id);
    statements.push(
      `CREATE TABLE IF NOT EXISTS ${table} (\n  identity TEXT PRIMARY KEY,\n  data TEXT NOT NULL\n);`,
    );
  }
  return { id: `appdata-bootstrap-v${version}`, version, name, statements };
}

/** Validate the declared migration list; conflicts and disorder fail closed. */
function validateMigrations(migrations: readonly ApplicationDataMigration[]): void {
  const versions = new Set<number>();
  const ids = new Set<string>();
  let previous = 0;
  for (const migration of migrations) {
    if (
      typeof migration.version !== 'number' ||
      !Number.isSafeInteger(migration.version) ||
      migration.version <= 0
    ) {
      throw new VictApplicationDataError(
        'APPDATA_MIGRATION_CONFLICT',
        'Migration versions must be positive safe integers.',
        'validateMigrations',
      );
    }
    if (migration.version <= previous) {
      throw new VictApplicationDataError(
        'APPDATA_MIGRATION_CONFLICT',
        'Migrations must be declared in strictly ascending version order.',
        'validateMigrations',
      );
    }
    previous = migration.version;
    if (typeof migration.id !== 'string' || migration.id.length === 0) {
      throw new VictApplicationDataError(
        'APPDATA_MIGRATION_CONFLICT',
        'Migration ids must be non-empty strings.',
        'validateMigrations',
      );
    }
    if (ids.has(migration.id)) {
      throw new VictApplicationDataError(
        'APPDATA_MIGRATION_CONFLICT',
        'Migration ids must be unique.',
        'validateMigrations',
      );
    }
    ids.add(migration.id);
    if (versions.has(migration.version)) {
      throw new VictApplicationDataError(
        'APPDATA_MIGRATION_CONFLICT',
        'Migration versions must be unique.',
        'validateMigrations',
      );
    }
    versions.add(migration.version);
    if (!Array.isArray(migration.statements)) {
      throw new VictApplicationDataError(
        'APPDATA_MIGRATION_CONFLICT',
        'Migration statements must be an array of SQL strings.',
        'validateMigrations',
      );
    }
  }
}

/**
 * Apply all pending migrations, newest-last, each in its own transaction.
 * Returns the full inspectable applied history (ordered by version).
 */
export function applyApplicationDataMigrations(
  open: OpenAppDatabase,
  migrations: readonly ApplicationDataMigration[],
  now: () => string,
): readonly AppliedApplicationDataMigration[] {
  validateMigrations(migrations);
  const { db } = open;
  safeDriver('migrations.bookkeeping', () => db.exec(MIGRATION_BOOKKEEPING_DDL));

  const appliedRows = safeDriver(
    'migrations.history',
    () =>
      db
        .prepare(
          'SELECT version, id, name, applied_at FROM vict_appdata_migrations ORDER BY version;',
        )
        .all() as { version: number; id: string; name: string; applied_at: string }[],
  );
  const appliedById = new Map(appliedRows.map((row) => [row.id, row]));
  const appliedVersions = new Set(appliedRows.map((row) => Number(row.version)));
  const knownMax = migrations.reduce((max, m) => Math.max(max, m.version), 0);
  for (const version of appliedVersions) {
    if (version > knownMax) {
      throw new VictApplicationDataError(
        'APPDATA_FUTURE_SCHEMA',
        'The database was written by a newer, unsupported application-domain schema version; refusing to open it.',
        'applyApplicationDataMigrations',
      );
    }
  }

  for (const migration of migrations) {
    if (appliedVersions.has(migration.version)) {
      // Idempotent safe rerun: already applied. Verify the identity matches
      // what was recorded; a reused version with a different id conflicts.
      const recorded = appliedRows.find((row) => Number(row.version) === migration.version);
      if (recorded !== undefined && recorded.id !== migration.id) {
        throw new VictApplicationDataError(
          'APPDATA_MIGRATION_CONFLICT',
          'A different migration identity is already recorded at this schema version.',
          'applyApplicationDataMigrations',
        );
      }
      if (appliedById.has(migration.id) && appliedById.get(migration.id)?.name !== migration.name) {
        throw new VictApplicationDataError(
          'APPDATA_MIGRATION_CONFLICT',
          'A migration identity is already applied under a different name.',
          'applyApplicationDataMigrations',
        );
      }
      continue;
    }
    if (appliedById.has(migration.id)) {
      throw new VictApplicationDataError(
        'APPDATA_MIGRATION_CONFLICT',
        'A migration with this identity is already applied at a different version.',
        'applyApplicationDataMigrations',
      );
    }
    inTransaction(db, () => {
      for (const statement of migration.statements) {
        try {
          db.exec(statement);
        } catch {
          // Translated INSIDE the transaction so the rollback keeps a clean
          // boundary; the raw SQL text never reaches the public error.
          throw new VictApplicationDataError(
            'APPDATA_MIGRATION_FAILED',
            'A migration statement failed and was rolled back; the recorded schema history is unchanged.',
            `migration:${migration.id}`,
          );
        }
      }
      try {
        db.prepare(
          'INSERT INTO vict_appdata_migrations (version, id, name, applied_at) VALUES (?, ?, ?, ?);',
        ).run(migration.version, migration.id, migration.name, now());
      } catch {
        throw new VictApplicationDataError(
          'APPDATA_MIGRATION_CONFLICT',
          'Recording the applied migration failed; the migration was rolled back.',
          `migration:${migration.id}`,
        );
      }
    });
  }

  return safeDriver(
    'migrations.history',
    () =>
      db
        .prepare(
          'SELECT version, id, name, applied_at FROM vict_appdata_migrations ORDER BY version;',
        )
        .all() as { version: number; id: string; name: string; applied_at: string }[],
  ).map((row) => ({
    id: row.id,
    version: Number(row.version),
    name: row.name,
    appliedAt: row.applied_at,
  }));
}
