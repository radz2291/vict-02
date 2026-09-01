import type { DatabaseSync } from 'node:sqlite';
import { VictStoreError } from '@vict/runtime';

/**
 * Forward-only schema migrations for the Vict SQLite store.
 *
 * Policy (Stage 02):
 * - the schema begins at explicit integer version 1;
 * - migrations are ordered, forward-only, and each has an automated
 *   fresh-database test;
 * - every migration runs inside one transaction together with its version
 *   bookkeeping row, so a partially applied migration can never leave a
 *   falsely advanced version;
 * - reopening an up-to-date database is a no-op;
 * - a database written by a NEWER, unsupported schema version fails closed
 *   before any mutation;
 * - there is no production down-migration. To discard a disposable local
 *   development database, delete its file (documented in the architecture
 *   notes); Vict never deletes databases automatically.
 *
 * Note: the SQLite schema version is independent of the activation-manifest
 * schema and the run-event schema, which are recorded per row.
 */

export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly statements: readonly string[];
}

/** The migration table itself is created outside versioned migrations. */
const MIGRATION_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS vict_schema_migration (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);
`;

export const SCHEMA_MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: 'create-activation-selection-run-event-tables',
    statements: [
      `CREATE TABLE vict_activation (
        activation_version TEXT PRIMARY KEY,
        manifest_schema TEXT NOT NULL,
        graph_id TEXT NOT NULL,
        graph_version TEXT NOT NULL,
        capability_set_version TEXT NOT NULL,
        canonical_manifest TEXT NOT NULL,
        created_at TEXT NOT NULL
      );`,
      `CREATE TABLE vict_activation_selection (
        graph_id TEXT PRIMARY KEY,
        activation_version TEXT NOT NULL REFERENCES vict_activation(activation_version),
        selection_revision INTEGER NOT NULL,
        selected_at TEXT NOT NULL
      );`,
      `CREATE TABLE vict_run (
        run_id TEXT PRIMARY KEY,
        graph_id TEXT NOT NULL,
        graph_version TEXT NOT NULL,
        capability_set_version TEXT NOT NULL,
        activation_version TEXT NOT NULL REFERENCES vict_activation(activation_version),
        status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'blocked')),
        mode TEXT NOT NULL CHECK (mode IN ('normal', 'simulate', 'test')),
        retention TEXT NOT NULL CHECK (retention IN ('none', 'summary', 'full')),
        steps INTEGER NOT NULL,
        current_node_id TEXT,
        output_summary TEXT,
        output TEXT,
        error TEXT,
        record_revision INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT
      );`,
      `CREATE INDEX idx_vict_run_graph ON vict_run (graph_id, created_at);`,
      `CREATE INDEX idx_vict_run_status ON vict_run (status);`,
      `CREATE TABLE vict_run_event (
        run_id TEXT NOT NULL REFERENCES vict_run(run_id),
        seq INTEGER NOT NULL,
        event_schema TEXT NOT NULL,
        type TEXT NOT NULL,
        graph_id TEXT NOT NULL,
        graph_version TEXT NOT NULL,
        capability_set_version TEXT NOT NULL,
        activation_version TEXT NOT NULL,
        node_id TEXT,
        capability_id TEXT,
        payload TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        PRIMARY KEY (run_id, seq)
      );`,
    ],
  },
];

/** The highest schema version this adapter understands. */
export const CURRENT_SCHEMA_VERSION: number = SCHEMA_MIGRATIONS.at(-1)?.version ?? 0;

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

/**
 * Bring an opened database to the current schema version.
 *
 * Fail-closed behavior: a database with a newer, unsupported schema version
 * raises `VICT_STORE_UNSUPPORTED_SCHEMA` before any statement mutates it.
 * Each migration and its version row commit atomically, so an interrupted
 * migration cannot leave a falsely advanced version.
 */
export function runMigrations(
  db: DatabaseSync,
  options: { migrations?: readonly Migration[]; now?: () => number } = {},
): { fromVersion: number; toVersion: number; applied: number[] } {
  const migrations = options.migrations ?? SCHEMA_MIGRATIONS;
  const now = options.now ?? Date.now;
  // The supported ceiling always comes from the SHIPPED migration set, so an
  // injected (older) list can never rewind or bypass the fail-closed check.
  const highestKnown = SCHEMA_MIGRATIONS.at(-1)?.version ?? 0;
  const shippedCurrent = CURRENT_SCHEMA_VERSION;

  db.exec(MIGRATION_TABLE_DDL);
  const row = db.prepare('SELECT MAX(version) AS version FROM vict_schema_migration;').get() as
    { version: number | null } | undefined;
  const current = row?.version ?? 0;
  if (current > highestKnown) {
    throw new VictStoreError(
      'VICT_STORE_UNSUPPORTED_SCHEMA',
      'The database was written by a newer, unsupported Vict storage schema. It was not modified.',
      { operation: 'store.migrate', schemaVersion: current },
    );
  }

  const applied: number[] = [];
  for (const migration of migrations) {
    if (migration.version <= current || migration.version > shippedCurrent) {
      continue;
    }
    // Migration statements plus the version row commit together or not at all.
    db.exec('BEGIN IMMEDIATE;');
    try {
      for (const statement of migration.statements) {
        db.exec(statement);
      }
      db.prepare(
        'INSERT INTO vict_schema_migration (version, name, applied_at) VALUES (?, ?, ?);',
      ).run(migration.version, migration.name, toIso(now()));
      db.exec('COMMIT;');
      applied.push(migration.version);
    } catch (cause) {
      try {
        db.exec('ROLLBACK;');
      } catch {
        /* a broken transaction may already be rolled back */
      }
      throw new VictStoreError(
        'VICT_STORE_MIGRATION_FAILED',
        `Migration '${migration.name}' failed; the database was left at its previous schema version.`,
        { operation: 'store.migrate', schemaVersion: current },
        cause,
      );
    }
  }
  const toVersion = applied.length > 0 ? Math.max(...applied) : current;
  return { fromVersion: current, toVersion, applied };
}

/** Read the current schema version without mutating anything. */
export function readSchemaVersion(db: DatabaseSync): number | undefined {
  try {
    const row = db.prepare('SELECT MAX(version) AS version FROM vict_schema_migration;').get() as
      { version: number | null } | undefined;
    return row?.version ?? undefined;
  } catch {
    return undefined;
  }
}
