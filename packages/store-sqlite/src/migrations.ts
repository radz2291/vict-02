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
  {
    // Stage 03 durable orchestration. The vict_run table is REBUILT (SQLite
    // cannot widen a CHECK constraint) with the extended run lifecycle
    // ('waiting', 'cancelled'); every historical row, foreign key and index
    // is preserved exactly. New tables cover tokens (with the private
    // operational checkpoint column), attempts, waits, timers, signal
    // receipts, cancellation and operator-resolution deduplication, and
    // branch/join membership with the private branch-output payloads.
    version: 2,
    name: 'durable-orchestration',
    statements: [
      // 1. Rebuild vict_run with the extended status domain.
      `CREATE TABLE vict_run_v3 (
        run_id TEXT PRIMARY KEY,
        graph_id TEXT NOT NULL,
        graph_version TEXT NOT NULL,
        capability_set_version TEXT NOT NULL,
        activation_version TEXT NOT NULL REFERENCES vict_activation(activation_version),
        status TEXT NOT NULL CHECK (status IN ('running', 'waiting', 'blocked', 'completed', 'failed', 'cancelled')),
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
      `INSERT INTO vict_run_v3
        (run_id, graph_id, graph_version, capability_set_version, activation_version, status, mode, retention,
         steps, current_node_id, output_summary, output, error, record_revision, created_at, updated_at, completed_at)
      SELECT run_id, graph_id, graph_version, capability_set_version, activation_version, status, mode, retention,
             steps, current_node_id, output_summary, output, error, record_revision, created_at, updated_at, completed_at
      FROM vict_run;`,
      `DROP TABLE vict_run;`,
      `ALTER TABLE vict_run_v3 RENAME TO vict_run;`,
      `CREATE INDEX idx_vict_run_graph ON vict_run (graph_id, created_at);`,
      `CREATE INDEX idx_vict_run_status ON vict_run (status);`,
      // 2. Durable continuation tokens (with the private operational checkpoint payload).
      `CREATE TABLE vict_token (
        token_id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES vict_run(run_id),
        activation_version TEXT NOT NULL,
        node_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('ready', 'claimed', 'waiting', 'completed', 'joined', 'cancelled', 'blocked')),
        parent_token_id TEXT,
        lineage TEXT NOT NULL DEFAULT '',
        fork_id TEXT,
        branch_key TEXT,
        revision INTEGER NOT NULL,
        checkpoint TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
      `CREATE INDEX idx_vict_token_ready ON vict_token (run_id, status, created_at, token_id);`,
      `CREATE INDEX idx_vict_token_run ON vict_token (run_id);`,
      // 3. Logical invocations and node attempts (ownership, leases, fences).
      `CREATE TABLE vict_attempt (
        attempt_id TEXT PRIMARY KEY,
        invocation_id TEXT NOT NULL,
        run_id TEXT NOT NULL REFERENCES vict_run(run_id),
        token_id TEXT NOT NULL REFERENCES vict_token(token_id),
        node_id TEXT NOT NULL,
        capability_id TEXT NOT NULL,
        attempt_number INTEGER NOT NULL,
        effect_class TEXT NOT NULL CHECK (effect_class IN ('pure', 'read', 'write', 'irreversible')),
        idempotency_key TEXT,
        state TEXT NOT NULL CHECK (state IN ('ready', 'claimed', 'started', 'completed', 'failed', 'timed_out', 'cancelled', 'outcome_unknown')),
        owner_id TEXT,
        lease_expires_at TEXT,
        deadline_at TEXT,
        fence INTEGER NOT NULL,
        retry_due_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (invocation_id, attempt_number)
      );`,
      `CREATE INDEX idx_vict_attempt_invocation ON vict_attempt (invocation_id);`,
      `CREATE INDEX idx_vict_attempt_token ON vict_attempt (run_id, token_id, state);`,
      `CREATE INDEX idx_vict_attempt_lease ON vict_attempt (state, lease_expires_at);`,
      // 4. Durable waits (signal + timer).
      `CREATE TABLE vict_wait (
        wait_id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES vict_run(run_id),
        token_id TEXT NOT NULL REFERENCES vict_token(token_id),
        node_id TEXT NOT NULL,
        activation_version TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('signal', 'timer')),
        signal_name TEXT,
        contract_id TEXT,
        contract_revision TEXT,
        due_at TEXT,
        timeout_at TEXT,
        status TEXT NOT NULL CHECK (status IN ('open', 'resolved', 'cancelled')),
        revision INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        resolved_at TEXT,
        resolved_by TEXT
      );`,
      `CREATE INDEX idx_vict_wait_open ON vict_wait (run_id, status);`,
      `CREATE INDEX idx_vict_wait_token ON vict_wait (token_id);`,
      // 5. Due-time scheduling (timer waits, wait timeouts, retry backoff).
      `CREATE TABLE vict_timer (
        timer_id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES vict_run(run_id),
        kind TEXT NOT NULL CHECK (kind IN ('wait', 'wait-timeout', 'retry')),
        wait_id TEXT,
        attempt_id TEXT,
        token_id TEXT,
        due_at TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('scheduled', 'firing', 'fired', 'cancelled')),
        owner_id TEXT,
        lease_expires_at TEXT,
        revision INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );`,
      `CREATE INDEX idx_vict_timer_due ON vict_timer (status, due_at, timer_id);`,
      `CREATE INDEX idx_vict_timer_run ON vict_timer (run_id, status);`,
      // 6. Signal receipts and deduplication (safe identity/hash metadata only).
      `CREATE TABLE vict_signal_receipt (
        signal_id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES vict_run(run_id),
        wait_id TEXT,
        signal_name TEXT,
        command_hash TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('accepted', 'duplicate', 'conflict', 'rejected')),
        event_seq INTEGER,
        created_at TEXT NOT NULL
      );`,
      `CREATE INDEX idx_vict_signal_run ON vict_signal_receipt (run_id);`,
      // 7. Cancellation request deduplication.
      `CREATE TABLE vict_cancellation_request (
        run_id TEXT NOT NULL REFERENCES vict_run(run_id),
        request_id TEXT NOT NULL,
        reason_code TEXT NOT NULL,
        command_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (run_id, request_id)
      );`,
      // 8. Operator resolution deduplication.
      `CREATE TABLE vict_operator_resolution (
        run_id TEXT NOT NULL REFERENCES vict_run(run_id),
        resolution_id TEXT NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('retry', 'confirm_applied', 'fail', 'cancel')),
        reason_code TEXT NOT NULL,
        command_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (run_id, resolution_id)
      );`,
      // 9. Branch/join membership and private branch-output payloads.
      `CREATE TABLE vict_branch_result (
        run_id TEXT NOT NULL REFERENCES vict_run(run_id),
        fork_id TEXT NOT NULL,
        join_id TEXT NOT NULL,
        branch_key TEXT NOT NULL,
        token_id TEXT NOT NULL,
        failed INTEGER NOT NULL CHECK (failed IN (0, 1)),
        output TEXT,
        created_at TEXT NOT NULL,
        PRIMARY KEY (run_id, fork_id, branch_key)
      );`,
      `CREATE INDEX idx_vict_branch_join ON vict_branch_result (run_id, fork_id);`,
    ],
  },
  {
    version: 3,
    name: 'agent-governance',
    statements: [
      // Stage 06A agent-governance records. These tables live in the SAME
      // operational database (deletion intents and activation identity are
      // VICT operational audit data), remain disjoint from every existing
      // operational table, and are additive only: no existing table or row
      // is touched.
      `CREATE TABLE vict_agent_activation (
        activation_version TEXT PRIMARY KEY,
        agent_profile_version TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        agent_revision TEXT NOT NULL,
        canonical_manifest TEXT NOT NULL,
        artifacts TEXT NOT NULL,
        created_at TEXT NOT NULL
      );`,
      `CREATE INDEX idx_vict_agent_activation_agent ON vict_agent_activation (agent_id, agent_revision);`,
      `CREATE TABLE vict_agent_deletion_intent (
        intent_id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('pending', 'application-domain-deleted', 'completed')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
      `CREATE INDEX idx_vict_agent_deletion_state ON vict_agent_deletion_intent (state);`,
      `CREATE TABLE vict_agent_deletion_receipt (
        intent_id TEXT NOT NULL REFERENCES vict_agent_deletion_intent(intent_id),
        step TEXT NOT NULL CHECK (step IN ('application-domain', 'mastra-memory')),
        at TEXT NOT NULL,
        PRIMARY KEY (intent_id, step)
      );`,
    ],
  },
  {
    // Stage 06A Linux-closure correction: the deletion-step data literal
    // 'mastra-memory' was renamed to the implementation-neutral
    // 'memory-store' in every neutral type and emitted declaration. This
    // is a DELIBERATE, DOCUMENTED one-time migration of pre-verification
    // Stage 06A records — persisted receipt values are never silently
    // reinterpreted: the rebuild copies every row exactly once, rewriting
    // ONLY the step literal ('mastra-memory' → 'memory-store'), and
    // preserves receipt identity (intent_id, step) and deterministic
    // receipt ordering (ORDER BY step ASC keeps 'application-domain' first
    // before and after the rename). A receipt value is never dropped or
    // re-typed; databases that never stored the old literal are unchanged.
    version: 4,
    name: 'agent-governance-neutral-memory-store-step',
    statements: [
      `CREATE TABLE vict_agent_deletion_receipt_new (
        intent_id TEXT NOT NULL REFERENCES vict_agent_deletion_intent(intent_id),
        step TEXT NOT NULL CHECK (step IN ('application-domain', 'memory-store')),
        at TEXT NOT NULL,
        PRIMARY KEY (intent_id, step)
      );`,
      `INSERT INTO vict_agent_deletion_receipt_new (intent_id, step, at)
        SELECT intent_id, CASE step WHEN 'mastra-memory' THEN 'memory-store' ELSE step END, at
        FROM vict_agent_deletion_receipt;`,
      `DROP TABLE vict_agent_deletion_receipt;`,
      `ALTER TABLE vict_agent_deletion_receipt_new RENAME TO vict_agent_deletion_receipt;`,
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
    // Migration statements plus the version row commit together or not at
    // all. Foreign keys are relaxed for the duration of the transaction so
    // table rebuilds (e.g. the Stage 03 vict_run rebuild) can drop and
    // recreate a referenced table; integrity is re-verified afterwards.
    safeDisableForeignKeys(db);
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
      restoreForeignKeys(db);
      throw new VictStoreError(
        'VICT_STORE_MIGRATION_FAILED',
        `Migration '${migration.name}' failed; the database was left at its previous schema version.`,
        { operation: 'store.migrate', schemaVersion: current },
        cause,
      );
    }
    restoreForeignKeys(db);
    verifyForeignKeys(db);
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

function safeDisableForeignKeys(db: DatabaseSync): void {
  try {
    db.exec('PRAGMA foreign_keys = OFF;');
  } catch {
    /* some embedded builds disallow pragma changes; rebuilds then rely on
       consistent data, which the copy statement guarantees */
  }
}

function restoreForeignKeys(db: DatabaseSync): void {
  try {
    db.exec('PRAGMA foreign_keys = ON;');
  } catch {
    /* ignore */
  }
}

/** Fail closed when a rebuild left dangling references. */
function verifyForeignKeys(db: DatabaseSync): void {
  try {
    const violations = db.prepare('PRAGMA foreign_key_check;').all();
    if (Array.isArray(violations) && violations.length > 0) {
      throw new VictStoreError(
        'VICT_STORE_MIGRATION_FAILED',
        'A migration left the database with foreign-key violations; the database was not modified further.',
        { operation: 'store.migrate' },
      );
    }
  } catch (cause) {
    if (cause instanceof VictStoreError) {
      throw cause;
    }
    /* pragma unavailable: skip */
  }
}
