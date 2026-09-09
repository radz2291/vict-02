import type { DatabaseSync } from 'node:sqlite';
import { VictStoreError } from '@victframework/runtime';

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
  {
    // Stage 06B: control plane and governed remote execution. New
    // operational tables for actors, ChangeSets + their approval decisions,
    // Application Releases + selections, audit events, agent turns (with
    // cancel-intent dedup), protected tool invocations (durable
    // -before-invocation), VICT approval records, and the durable agent
    // -stream ledger. Additive only; disjoint from every existing table.
    version: 5,
    name: 'agent-control-plane',
    statements: [
      `CREATE TABLE vict_actor (
        actor_id TEXT PRIMARY KEY,
        status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
        roles TEXT NOT NULL,
        created_at TEXT NOT NULL
      );`,
      `CREATE TABLE vict_changeset (
        changeset_id TEXT PRIMARY KEY,
        schema TEXT NOT NULL,
        author_actor_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        base_json TEXT NOT NULL,
        operations_json TEXT NOT NULL,
        rationale TEXT NOT NULL,
        risk_class TEXT NOT NULL CHECK (risk_class IN ('low', 'medium', 'high')),
        required_approver_count INTEGER NOT NULL,
        expires_at TEXT NOT NULL,
        validation_json TEXT,
        simulation_json TEXT,
        content_hash TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('draft', 'approved', 'committed', 'declined', 'expired'))
      );`,
      `CREATE INDEX idx_vict_changeset_status ON vict_changeset (status);`,
      `CREATE TABLE vict_changeset_approval (
        approval_id TEXT PRIMARY KEY,
        changeset_id TEXT NOT NULL REFERENCES vict_changeset(changeset_id),
        content_hash TEXT NOT NULL,
        approver_actor_id TEXT NOT NULL,
        decision TEXT NOT NULL CHECK (decision IN ('approved', 'declined')),
        decided_at TEXT NOT NULL,
        UNIQUE (changeset_id, approver_actor_id)
      );`,
      `CREATE TABLE vict_release (
        release_version TEXT PRIMARY KEY,
        application_id TEXT NOT NULL,
        application_version TEXT NOT NULL,
        renderer_identity TEXT NOT NULL,
        component_registry_identity TEXT NOT NULL,
        data_adapter_identity TEXT NOT NULL,
        activation_binding TEXT NOT NULL,
        published_by_actor_id TEXT NOT NULL,
        published_at TEXT NOT NULL,
        content_hash TEXT NOT NULL
      );`,
      `CREATE INDEX idx_vict_release_app ON vict_release (application_id);`,
      `CREATE TABLE vict_release_selection (
        application_id TEXT NOT NULL,
        selection_revision INTEGER NOT NULL,
        release_version TEXT NOT NULL REFERENCES vict_release(release_version),
        actor_id TEXT NOT NULL,
        at TEXT NOT NULL,
        reason TEXT NOT NULL CHECK (reason IN ('select', 'rollback')),
        PRIMARY KEY (application_id, selection_revision)
      );`,
      `CREATE TABLE vict_audit_event (
        audit_id TEXT PRIMARY KEY,
        at TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        action TEXT NOT NULL,
        subject_type TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        summary TEXT NOT NULL
      );`,
      `CREATE INDEX idx_vict_audit_subject ON vict_audit_event (subject_type, subject_id);`,
      `CREATE TABLE vict_agent_turn (
        turn_id TEXT PRIMARY KEY,
        stream_id TEXT NOT NULL,
        thread_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        agent_profile_version TEXT NOT NULL,
        activation_version TEXT,
        application_release_version TEXT,
        input_summary TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('intent', 'running', 'awaiting-approval', 'completed', 'failed', 'cancelled', 'blocked')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        terminal_at TEXT,
        error_code TEXT,
        trace_id TEXT,
        vict_run_id TEXT,
        mastra_run_id TEXT
      );`,
      `CREATE INDEX idx_vict_agent_turn_status ON vict_agent_turn (status);`,
      `CREATE TABLE vict_agent_turn_cancel (
        turn_id TEXT NOT NULL REFERENCES vict_agent_turn(turn_id),
        cancel_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        reason_code TEXT NOT NULL,
        at TEXT NOT NULL,
        PRIMARY KEY (turn_id, cancel_id)
      );`,
      `CREATE TABLE vict_agent_tool_invocation (
        invocation_id TEXT PRIMARY KEY,
        turn_id TEXT NOT NULL REFERENCES vict_agent_turn(turn_id),
        tool_call_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        capability_id TEXT NOT NULL,
        capability_revision TEXT NOT NULL,
        effect TEXT NOT NULL CHECK (effect IN ('pure', 'read', 'write', 'irreversible')),
        idempotency_key TEXT NOT NULL UNIQUE,
        actor_id TEXT NOT NULL,
        arg_digest TEXT NOT NULL,
        argument_summary TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('intent', 'approved', 'running', 'completed', 'failed', 'declined', 'cancelled')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        result_summary TEXT,
        error_code TEXT
      );`,
      `CREATE INDEX idx_vict_invocation_turn ON vict_agent_tool_invocation (turn_id);`,
      `CREATE TABLE vict_agent_approval (
        approval_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL CHECK (kind = 'tool-invocation'),
        turn_id TEXT NOT NULL REFERENCES vict_agent_turn(turn_id),
        invocation_id TEXT NOT NULL UNIQUE,
        tool_call_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        capability_id TEXT NOT NULL,
        capability_revision TEXT NOT NULL,
        effect TEXT NOT NULL CHECK (effect IN ('pure', 'read', 'write', 'irreversible')),
        actor_id TEXT NOT NULL,
        agent_profile_version TEXT NOT NULL,
        arg_digest TEXT NOT NULL,
        environment TEXT NOT NULL,
        required_approver_role TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'declined', 'expired')),
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        decided_at TEXT,
        approver_actor_id TEXT,
        decision_reason TEXT
      );`,
      `CREATE INDEX idx_vict_approval_status ON vict_agent_approval (status);`,
      `CREATE TABLE vict_agent_stream (
        stream_id TEXT PRIMARY KEY,
        last_seq INTEGER NOT NULL
      );`,
      `CREATE TABLE vict_agent_stream_event (
        stream_id TEXT NOT NULL REFERENCES vict_agent_stream(stream_id),
        seq INTEGER NOT NULL,
        kind TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (stream_id, seq)
      );`,
    ],
  },
  {
    version: 6,
    name: 'control-plane-corrective',
    statements: [
      // Preserve the approval child rows before the parent rebuild (the
      // child REFERENCES vict_changeset, so the parent cannot be dropped
      // while child rows exist under PRAGMA foreign_keys = ON).
      `CREATE TABLE vict_changeset_approval_preserved AS
      SELECT approval_id, changeset_id, content_hash, approver_actor_id, decision, decided_at
      FROM vict_changeset_approval;`,
      `DROP TABLE vict_changeset_approval;`,
      // The ChangeSet status vocabulary gains the DURABLE, non-final
      // `applying` state (commit saga). SQLite CHECK constraints cannot be
      // altered in place, so the table is rebuilt under a transaction with
      // every row preserved byte-identically.
      `CREATE TABLE vict_changeset_new (
        changeset_id TEXT PRIMARY KEY,
        schema TEXT NOT NULL,
        author_actor_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        base_json TEXT NOT NULL,
        operations_json TEXT NOT NULL,
        rationale TEXT NOT NULL,
        risk_class TEXT NOT NULL CHECK (risk_class IN ('low', 'medium', 'high')),
        required_approver_count INTEGER NOT NULL,
        expires_at TEXT NOT NULL,
        validation_json TEXT,
        simulation_json TEXT,
        content_hash TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('draft', 'approved', 'applying', 'committed', 'declined', 'expired'))
      );`,
      `INSERT INTO vict_changeset_new
        (changeset_id, schema, author_actor_id, created_at, base_json, operations_json,
         rationale, risk_class, required_approver_count, expires_at, validation_json,
         simulation_json, content_hash, status)
      SELECT changeset_id, schema, author_actor_id, created_at, base_json, operations_json,
         rationale, risk_class, required_approver_count, expires_at, validation_json,
         simulation_json, content_hash, status
      FROM vict_changeset;`,
      `DROP TABLE vict_changeset;`,
      `ALTER TABLE vict_changeset_new RENAME TO vict_changeset;`,
      `CREATE INDEX idx_vict_changeset_status ON vict_changeset (status);`,
      // Recreate the approval child table and restore its rows exactly.
      `CREATE TABLE vict_changeset_approval (
        approval_id TEXT PRIMARY KEY,
        changeset_id TEXT NOT NULL REFERENCES vict_changeset(changeset_id),
        content_hash TEXT NOT NULL,
        approver_actor_id TEXT NOT NULL,
        decision TEXT NOT NULL CHECK (decision IN ('approved', 'declined')),
        decided_at TEXT NOT NULL,
        UNIQUE (changeset_id, approver_actor_id)
      );`,
      `INSERT INTO vict_changeset_approval
        (approval_id, changeset_id, content_hash, approver_actor_id, decision, decided_at)
      SELECT approval_id, changeset_id, content_hash, approver_actor_id, decision, decided_at
      FROM vict_changeset_approval_preserved;`,
      `DROP TABLE vict_changeset_approval_preserved;`,
      // The tool-invocation status vocabulary gains the truthful terminal
      // `outcome_unknown` state; same rebuild discipline.
      `CREATE TABLE vict_agent_tool_invocation_new (
        invocation_id TEXT PRIMARY KEY,
        turn_id TEXT NOT NULL REFERENCES vict_agent_turn(turn_id),
        tool_call_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        capability_id TEXT NOT NULL,
        capability_revision TEXT NOT NULL,
        effect TEXT NOT NULL CHECK (effect IN ('pure', 'read', 'write', 'irreversible')),
        idempotency_key TEXT NOT NULL UNIQUE,
        actor_id TEXT NOT NULL,
        arg_digest TEXT NOT NULL,
        argument_summary TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('intent', 'approved', 'running', 'completed', 'failed', 'declined', 'cancelled', 'outcome_unknown')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        result_summary TEXT,
        error_code TEXT
      );`,
      `INSERT INTO vict_agent_tool_invocation_new
        (invocation_id, turn_id, tool_call_id, tool_name, capability_id, capability_revision,
         effect, idempotency_key, actor_id, arg_digest, argument_summary, status,
         created_at, updated_at, completed_at, result_summary, error_code)
      SELECT invocation_id, turn_id, tool_call_id, tool_name, capability_id, capability_revision,
         effect, idempotency_key, actor_id, arg_digest, argument_summary, status,
         created_at, updated_at, completed_at, result_summary, error_code
      FROM vict_agent_tool_invocation;`,
      `DROP TABLE vict_agent_tool_invocation;`,
      `ALTER TABLE vict_agent_tool_invocation_new RENAME TO vict_agent_tool_invocation;`,
      `CREATE INDEX idx_vict_invocation_turn ON vict_agent_tool_invocation (turn_id);`,
      // Authoritative governance runs (trusted executed VICT boundary).
      `CREATE TABLE vict_control_run (
        run_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL CHECK (kind IN ('validation', 'simulation')),
        changeset_id TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        base_json TEXT NOT NULL,
        operations_json TEXT NOT NULL,
        runner_profile TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        outcome TEXT NOT NULL CHECK (outcome IN ('passed', 'failed', 'blocked')),
        created_at TEXT NOT NULL
      );`,
      `CREATE INDEX idx_vict_control_run_subject ON vict_control_run (changeset_id, kind);`,
      // Durable saga receipts for applied ChangeSet operations.
      `CREATE TABLE vict_changeset_operation_receipt (
        changeset_id TEXT NOT NULL,
        operation_index INTEGER NOT NULL,
        operation_kind TEXT NOT NULL,
        operation_digest TEXT NOT NULL,
        effect_ref TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        applied_at TEXT NOT NULL,
        PRIMARY KEY (changeset_id, operation_index)
      );`,
      // Durable command idempotency receipts (one winner per key).
      `CREATE TABLE vict_command_idempotency (
        idempotency_key TEXT PRIMARY KEY,
        actor_id TEXT NOT NULL,
        command TEXT NOT NULL,
        request_digest TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
        response_code TEXT,
        result_json TEXT,
        created_at TEXT NOT NULL,
        settled_at TEXT
      );`,
    ],
  },
  {
    // Stage 06B final audit-readiness correction (migration 7):
    // - operation receipts become a TWO-STATE protocol record (prepared
    //   intent -> applied) with the serialized subject guard;
    // - command idempotency receipts are NAMESPACED by (actor, command,
    //   key) and carry the crash-recovery lease (owner, lease_until,
    //   attempts);
    // - release selections carry the ChangeSet operation identity
    //   (idempotency/fencing anchor);
    // - governance runs carry the safe simulation detail record.
    version: 7,
    name: 'stage-06b-final-audit-readiness-correction',
    statements: [
      `CREATE TABLE vict_changeset_operation_receipt_v7 (
        changeset_id TEXT NOT NULL,
        operation_index INTEGER NOT NULL,
        operation_kind TEXT NOT NULL,
        operation_digest TEXT NOT NULL,
        effect_ref TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        applied_at TEXT NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('prepared', 'applied')),
        guard_json TEXT,
        PRIMARY KEY (changeset_id, operation_index)
      );`,
      // Historical receipts are all `applied` (the v6 table only recorded
      // post-effect receipts).
      `INSERT INTO vict_changeset_operation_receipt_v7
        (changeset_id, operation_index, operation_kind, operation_digest, effect_ref, actor_id, applied_at, state, guard_json)
      SELECT changeset_id, operation_index, operation_kind, operation_digest, effect_ref, actor_id, applied_at, 'applied', NULL
      FROM vict_changeset_operation_receipt;`,
      `DROP TABLE vict_changeset_operation_receipt;`,
      `ALTER TABLE vict_changeset_operation_receipt_v7 RENAME TO vict_changeset_operation_receipt;`,
      `CREATE TABLE vict_command_idempotency_v7 (
        actor_id TEXT NOT NULL,
        command TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        request_digest TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
        response_code TEXT,
        result_json TEXT,
        created_at TEXT NOT NULL,
        settled_at TEXT,
        owner TEXT,
        lease_until TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (actor_id, command, idempotency_key)
      );`,
      // Historical receipts migrate into their (actor, command, key)
      // namespace with a settled (expired) lease profile.
      `INSERT INTO vict_command_idempotency_v7
        (actor_id, command, idempotency_key, request_digest, status, response_code, result_json, created_at, settled_at, owner, lease_until, attempts)
      SELECT actor_id, command, idempotency_key, request_digest, status, response_code, result_json, created_at, settled_at, NULL, NULL, 1
      FROM vict_command_idempotency;`,
      `DROP TABLE vict_command_idempotency;`,
      `ALTER TABLE vict_command_idempotency_v7 RENAME TO vict_command_idempotency;`,
      `ALTER TABLE vict_release_selection ADD COLUMN operation_id TEXT;`,
      `CREATE UNIQUE INDEX idx_vict_release_selection_operation
        ON vict_release_selection (application_id, operation_id)
        WHERE operation_id IS NOT NULL;`,
      `ALTER TABLE vict_control_run ADD COLUMN detail_json TEXT;`,
    ],
  },
  {
    // Stage 06B final reliability correction (migration 8):
    // - activation selections carry the ChangeSet operation identity
    //   (idempotency/fencing anchor, matching release selections);
    // - command idempotency receipts carry the settlement FENCE token of
    //   the current claim generation;
    // - governance runs carry the observed (verified) subject base.
    version: 8,
    name: 'stage-06b-final-reliability-correction',
    statements: [
      `ALTER TABLE vict_activation_selection ADD COLUMN operation_id TEXT;`,
      `CREATE UNIQUE INDEX idx_vict_activation_selection_operation
        ON vict_activation_selection (graph_id, operation_id)
        WHERE operation_id IS NOT NULL;`,
      `ALTER TABLE vict_command_idempotency ADD COLUMN fence_token TEXT;`,
      `ALTER TABLE vict_control_run ADD COLUMN observed_base_json TEXT;`,
      `CREATE TABLE vict_agent_turn_tool_slot (
        turn_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        arg_digest TEXT NOT NULL,
        slot INTEGER NOT NULL,
        tool_call_id TEXT NOT NULL,
        PRIMARY KEY (turn_id, tool_name, arg_digest)
      );`,
    ],
  },
  {
    // Stage 06B final boundary correction (migration 9):
    // - tool invocations carry the LIVE-OWNER attempt fence (token, claim
    //   time, owner identity, monotonic generation) stamped by the claim
    //   command, carried through `running`, and required as EXACT BINDING
    //   on every fenced terminal settlement and reconciliation;
    // - forward-only: columns are ADDED; existing rows default to
    //   generation 0 with no fence (unclaimed), and the migration-8
    //   turn-tool-slot table is intentionally PRESERVED (forward-compatible
    //   durable allocation surface even though the bridge no longer needs
    //   its ambiguous digest-only fallback).
    version: 9,
    name: 'stage-06b-final-boundary-correction',
    statements: [
      `ALTER TABLE vict_agent_tool_invocation ADD COLUMN run_fence_token TEXT;`,
      `ALTER TABLE vict_agent_tool_invocation ADD COLUMN run_fence_at TEXT;`,
      `ALTER TABLE vict_agent_tool_invocation ADD COLUMN run_owner_identity TEXT;`,
      `ALTER TABLE vict_agent_tool_invocation ADD COLUMN run_generation INTEGER NOT NULL DEFAULT 0;`,
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
