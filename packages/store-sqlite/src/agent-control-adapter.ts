import { createHash } from 'node:crypto';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import {
  assertDeletionReceiptStep,
  InMemoryActorDirectory,
  isDurableStreamKind,
  VictControlError,
  VICT_IDEMPOTENCY_FENCE_CONFLICT,
  commandIdempotencyFenceToken,
  validateAgentActivationRecord,
  validateStreamLedgerAppend,
  type ActorDirectory,
  type AgentActivationRecord,
  type AgentApprovalRecord,
  type AgentApprovalStore,
  type AgentControlStores,
  type AgentDeletionStep,
  type AgentGovernanceStore,
  type AgentStreamLedgerEvent,
  type AgentStreamLedgerStore,
  type AgentToolInvocationRecord,
  type AgentToolInvocationStore,
  type AgentTurnRecord,
  type AgentTurnStore,
  type ApplicationReleaseRecord,
  type ChangeSetApprovalDecision,
  type ChangeSetOperationReceipt,
  type ChangeSetRecord,
  type ChangeSetStatus,
  type CommandIdempotencyName,
  type CommandIdempotencyReceipt,
  type CommandIdempotencyStore,
  type CommandIdempotencyLeaseTakeover,
  type TurnToolSlotAllocation,
  type ControlAuditEvent,
  type ControlPlaneStore,
  type ControlRunRecord,
  type ReleaseSelectionRecord,
} from '@victframework/runtime';
import { inTransaction, openDatabase, safeRun, type OpenDatabase } from './driver.js';
import { runMigrations } from './migrations.js';

/**
 * SQLite adapter for the Stage 06B control-plane and agent-execution
 * stores (same operational database domain, additive `vict_agent_*` /
 * `vict_*` tables from migration 5).
 *
 * Semantics are SHARED with the in-memory implementations through the same
 * behavioral conformance suite (`runAgentControlConformanceSuite`):
 * - ChangeSets are immutable-content records; raw updates enforce the
 *   content hash; approval decisions use a UNIQUE(changeset, approver)
 *   CAS so the first durable decision always stands;
 * - releases are immutable; selections are monotonic and attributable;
 * - turns obey the forward-only state machine with terminal fencing;
 * - tool invocations enforce durable-before-invocation and idempotency-key
 *   digest binding;
 * - approval records bind the exact capability/argument/turn identity and
 *   allow exactly one decision;
 * - the stream ledger assigns strictly monotonic sequences and persists
 *   durable kinds only.
 */

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

function fromIso(value: string): number {
  return Date.parse(value);
}

function optionalIso(value: string | null): number | undefined {
  return value === null ? undefined : fromIso(value);
}

interface ChangeSetRow {
  changeset_id: string;
  schema: string;
  author_actor_id: string;
  created_at: string;
  base_json: string;
  operations_json: string;
  rationale: string;
  risk_class: string;
  required_approver_count: number;
  expires_at: string;
  validation_json: string | null;
  simulation_json: string | null;
  content_hash: string;
  status: string;
}

function rowToChangeSet(row: ChangeSetRow): ChangeSetRecord {
  return {
    changesetId: row.changeset_id,
    schema: row.schema as ChangeSetRecord['schema'],
    authorActorId: row.author_actor_id,
    createdAt: fromIso(row.created_at),
    base: JSON.parse(row.base_json) as ChangeSetRecord['base'],
    operations: JSON.parse(row.operations_json) as ChangeSetRecord['operations'],
    rationale: row.rationale,
    riskClass: row.risk_class as ChangeSetRecord['riskClass'],
    requiredApproverCount: row.required_approver_count,
    expiresAt: fromIso(row.expires_at),
    validation:
      row.validation_json === null
        ? undefined
        : (JSON.parse(row.validation_json) as ChangeSetRecord['validation']),
    simulation:
      row.simulation_json === null
        ? undefined
        : (JSON.parse(row.simulation_json) as ChangeSetRecord['simulation']),
    contentHash: row.content_hash,
    status: row.status as ChangeSetRecord['status'],
  };
}

interface ControlRunRow {
  run_id: string;
  kind: string;
  changeset_id: string;
  content_hash: string;
  base_json: string;
  operations_json: string;
  runner_profile: string;
  actor_id: string;
  outcome: string;
  created_at: string;
  detail_json: string | null;
  observed_base_json: string | null;
}

function rowToControlRun(row: ControlRunRow): ControlRunRecord {
  return {
    runId: row.run_id,
    kind: row.kind as ControlRunRecord['kind'],
    changesetId: row.changeset_id,
    contentHash: row.content_hash,
    base: JSON.parse(row.base_json) as ControlRunRecord['base'],
    operations: JSON.parse(row.operations_json) as ControlRunRecord['operations'],
    runnerProfile: row.runner_profile,
    actorId: row.actor_id,
    outcome: row.outcome as ControlRunRecord['outcome'],
    createdAt: fromIso(row.created_at),
    detail:
      row.detail_json === null
        ? undefined
        : (JSON.parse(row.detail_json) as ControlRunRecord['detail']),
    observedBase:
      row.observed_base_json === null || row.observed_base_json === undefined
        ? undefined
        : (JSON.parse(row.observed_base_json) as ControlRunRecord['observedBase']),
  };
}

interface OperationReceiptRow {
  changeset_id: string;
  operation_index: number;
  operation_kind: string;
  operation_digest: string;
  effect_ref: string;
  actor_id: string;
  applied_at: string;
  state: string;
  guard_json: string | null;
}

function rowToOperationReceipt(row: OperationReceiptRow): ChangeSetOperationReceipt {
  return {
    changesetId: row.changeset_id,
    operationIndex: row.operation_index,
    operationKind: row.operation_kind as ChangeSetOperationReceipt['operationKind'],
    operationDigest: row.operation_digest,
    effectRef: row.effect_ref,
    actorId: row.actor_id,
    appliedAt: fromIso(row.applied_at),
    state: row.state as ChangeSetOperationReceipt['state'],
    guardJson: row.guard_json ?? undefined,
  };
}

interface IdempotencyRow {
  actor_id: string;
  command: string;
  idempotency_key: string;
  request_digest: string;
  status: string;
  response_code: string | null;
  result_json: string | null;
  created_at: string;
  settled_at: string | null;
  owner: string | null;
  lease_until: string | null;
  attempts: number;
  fence_token: string | null;
}

function rowToIdempotencyReceipt(row: IdempotencyRow): CommandIdempotencyReceipt {
  return {
    idempotencyKey: row.idempotency_key,
    actorId: row.actor_id,
    command: row.command,
    requestDigest: row.request_digest,
    status: row.status as CommandIdempotencyReceipt['status'],
    responseCode: row.response_code ?? undefined,
    resultJson: row.result_json ?? undefined,
    createdAt: fromIso(row.created_at),
    settledAt: optionalIso(row.settled_at),
    owner: row.owner ?? undefined,
    leaseUntil: optionalIso(row.lease_until),
    attempts: row.attempts,
    fenceToken: row.fence_token ?? undefined,
  };
}

interface TurnRow {
  turn_id: string;
  stream_id: string;
  thread_id: string;
  actor_id: string;
  agent_profile_version: string;
  activation_version: string | null;
  application_release_version: string | null;
  input_summary: string;
  status: string;
  created_at: string;
  updated_at: string;
  terminal_at: string | null;
  error_code: string | null;
  trace_id: string | null;
  vict_run_id: string | null;
  mastra_run_id: string | null;
}

function rowToTurn(row: TurnRow): AgentTurnRecord {
  return {
    turnId: row.turn_id,
    streamId: row.stream_id,
    threadId: row.thread_id,
    actorId: row.actor_id,
    agentProfileVersion: row.agent_profile_version,
    activationVersion: row.activation_version ?? undefined,
    applicationReleaseVersion: row.application_release_version ?? undefined,
    inputSummary: row.input_summary,
    status: row.status as AgentTurnRecord['status'],
    createdAt: fromIso(row.created_at),
    updatedAt: fromIso(row.updated_at),
    terminalAt: optionalIso(row.terminal_at),
    errorCode: row.error_code ?? undefined,
    traceId: row.trace_id ?? undefined,
    victRunId: row.vict_run_id ?? undefined,
    mastraRunId: row.mastra_run_id ?? undefined,
  };
}

interface InvocationRow {
  invocation_id: string;
  turn_id: string;
  tool_call_id: string;
  tool_name: string;
  capability_id: string;
  capability_revision: string;
  effect: string;
  idempotency_key: string;
  actor_id: string;
  arg_digest: string;
  argument_summary: string;
  status: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  result_summary: string | null;
  error_code: string | null;
  run_fence_token: string | null;
  run_fence_at: string | null;
  run_owner_identity: string | null;
  run_generation: number | null;
}

function rowToInvocation(row: InvocationRow): AgentToolInvocationRecord {
  return {
    invocationId: row.invocation_id,
    turnId: row.turn_id,
    toolCallId: row.tool_call_id,
    toolName: row.tool_name,
    capabilityId: row.capability_id,
    capabilityRevision: row.capability_revision,
    effect: row.effect as AgentToolInvocationRecord['effect'],
    idempotencyKey: row.idempotency_key,
    actorId: row.actor_id,
    argDigest: row.arg_digest,
    argumentSummary: row.argument_summary,
    status: row.status as AgentToolInvocationRecord['status'],
    createdAt: fromIso(row.created_at),
    updatedAt: fromIso(row.updated_at),
    completedAt: optionalIso(row.completed_at),
    resultSummary: row.result_summary ?? undefined,
    errorCode: row.error_code ?? undefined,
    // Attempt-fence members stay ABSENT for unclaimed rows (generation 0)
    // so stored/returned records remain shape-stable with earlier adapters.
    ...(row.run_fence_token !== null && row.run_fence_token !== undefined
      ? { runFenceToken: row.run_fence_token }
      : {}),
    ...(row.run_fence_at !== null && row.run_fence_at !== undefined
      ? { runFenceAt: fromIso(row.run_fence_at) }
      : {}),
    ...(row.run_owner_identity !== null && row.run_owner_identity !== undefined
      ? { runOwnerIdentity: row.run_owner_identity }
      : {}),
    ...(row.run_generation !== null && row.run_generation !== undefined && row.run_generation !== 0
      ? { runGeneration: row.run_generation }
      : {}),
  };
}

interface ApprovalRow {
  approval_id: string;
  kind: string;
  turn_id: string;
  invocation_id: string;
  tool_call_id: string;
  tool_name: string;
  capability_id: string;
  capability_revision: string;
  effect: string;
  actor_id: string;
  agent_profile_version: string;
  arg_digest: string;
  environment: string;
  required_approver_role: string;
  status: string;
  created_at: string;
  expires_at: string;
  decided_at: string | null;
  approver_actor_id: string | null;
  decision_reason: string | null;
}

function rowToApproval(row: ApprovalRow): AgentApprovalRecord {
  return {
    approvalId: row.approval_id,
    kind: row.kind as AgentApprovalRecord['kind'],
    turnId: row.turn_id,
    invocationId: row.invocation_id,
    toolCallId: row.tool_call_id,
    toolName: row.tool_name,
    capabilityId: row.capability_id,
    capabilityRevision: row.capability_revision,
    effect: row.effect as AgentApprovalRecord['effect'],
    actorId: row.actor_id,
    agentProfileVersion: row.agent_profile_version,
    argDigest: row.arg_digest,
    environment: row.environment,
    requiredApproverRole: row.required_approver_role as AgentApprovalRecord['requiredApproverRole'],
    status: row.status as AgentApprovalRecord['status'],
    createdAt: fromIso(row.created_at),
    expiresAt: fromIso(row.expires_at),
    decidedAt: optionalIso(row.decided_at),
    approverActorId: row.approver_actor_id ?? undefined,
    decisionReason: row.decision_reason ?? undefined,
  };
}

interface ReleaseRow {
  release_version: string;
  application_id: string;
  application_version: string;
  renderer_identity: string;
  component_registry_identity: string;
  data_adapter_identity: string;
  activation_binding: string;
  published_by_actor_id: string;
  published_at: string;
  content_hash: string;
}

function rowToRelease(row: ReleaseRow): ApplicationReleaseRecord {
  return {
    releaseVersion: row.release_version,
    applicationId: row.application_id,
    applicationVersion: row.application_version,
    rendererIdentity: row.renderer_identity,
    componentRegistryIdentity: row.component_registry_identity,
    dataAdapterIdentity: row.data_adapter_identity,
    activationBinding: row.activation_binding,
    publishedByActorId: row.published_by_actor_id,
    publishedAt: fromIso(row.published_at),
    contentHash: row.content_hash,
  };
}

interface StreamEventRow {
  stream_id: string;
  seq: number;
  kind: string;
  payload: string;
  created_at: string;
}

function rowToLedgerEvent(row: StreamEventRow): AgentStreamLedgerEvent {
  return {
    streamId: row.stream_id,
    seq: row.seq,
    kind: row.kind as AgentStreamLedgerEvent['kind'],
    payload: row.payload,
    createdAt: fromIso(row.created_at),
  };
}

export interface SqliteAgentControlOptions {
  readonly path?: string;
  readonly database?: DatabaseSync;
  readonly migrations?: Parameters<typeof runMigrations>[1];
}

/** The SQLite control-store set with a sync close. */
export interface SqliteAgentControlStoreSet extends AgentControlStores {
  close(): void;
}

/** Create the durable SQLite AgentControlStores (migration 5 schema). */
export function createSqliteAgentControlStores(
  options: SqliteAgentControlOptions = {},
): SqliteAgentControlStoreSet {
  const handle: OpenDatabase =
    options.database !== undefined
      ? { db: options.database, close: () => undefined }
      : openDatabase(options);
  const { db } = handle;
  try {
    safeRun('store.migrate', () => {
      runMigrations(db, options.migrations as Parameters<typeof runMigrations>[1]);
    });
  } catch (cause) {
    if (options.database === undefined) {
      handle.close();
    }
    throw cause;
  }

  const actors: ActorDirectory = new InMemoryActorDirectoryFallback();

  /**
   * The guarded release selection executed inside an ALREADY-ACTIVE
   * transaction (no nested BEGIN): operation-identity idempotency, the
   * subject-level base CAS, and the monotonic revision append.
   */
  function selectReleaseInTransaction(command: {
    applicationId: string;
    releaseVersion: string;
    actorId: string;
    at: number;
    reason: 'select' | 'rollback';
    readonly operationId?: string;
    readonly expectedBaseVersion?: string;
  }): { selectionRevision: number } {
    const release = db
      .prepare('SELECT application_id FROM vict_release WHERE release_version = ?;')
      .get(command.releaseVersion) as { application_id: string } | undefined;
    if (release === undefined || release.application_id !== command.applicationId) {
      throw new VictControlError(
        'VICT_CONTROL_RELEASE_MISSING',
        'The release version does not exist for this application.',
      );
    }
    // Operation-identity idempotency: re-application returns the ORIGINAL
    // selection revision without adding another one; conflicting content
    // under the same identity fails closed.
    if (command.operationId !== undefined) {
      const existingOp = db
        .prepare(
          'SELECT release_version, selection_revision FROM vict_release_selection WHERE application_id = ? AND operation_id = ? AND reason = ?;',
        )
        .get(command.applicationId, command.operationId, command.reason) as
        { release_version: string; selection_revision: number } | undefined;
      if (existingOp !== undefined) {
        if (existingOp.release_version !== command.releaseVersion) {
          throw new VictControlError(
            'VICT_CONTROL_OPERATION_IDENTITY_CONFLICT',
            'The operation identity already applied a different release; conflicting content fails closed.',
          );
        }
        return { selectionRevision: existingOp.selection_revision };
      }
    }
    // SUBJECT-LEVEL base guard, evaluated in the SAME transaction as the
    // append: two ChangeSets racing on one base produce exactly one winner;
    // the loser receives the stable stale-base conflict with NO effects.
    if (command.expectedBaseVersion !== undefined) {
      const current = db
        .prepare(
          'SELECT release_version FROM vict_release_selection WHERE application_id = ? ORDER BY selection_revision DESC LIMIT 1;',
        )
        .get(command.applicationId) as { release_version: string } | undefined;
      const selectedVersion = current?.release_version;
      const expected =
        command.expectedBaseVersion === 'none' ? undefined : command.expectedBaseVersion;
      if (selectedVersion !== expected) {
        throw new VictControlError(
          'VICT_CONTROL_BASE_STALE',
          'The subject base changed before the selection was applied; exactly one concurrent ChangeSet may win the base.',
        );
      }
    }
    const latest = db
      .prepare(
        'SELECT MAX(selection_revision) AS revision FROM vict_release_selection WHERE application_id = ?;',
      )
      .get(command.applicationId) as { revision: number | null };
    const selectionRevision = (latest.revision ?? 0) + 1;
    db.prepare(
      'INSERT INTO vict_release_selection (application_id, selection_revision, release_version, actor_id, at, reason, operation_id) VALUES (?, ?, ?, ?, ?, ?, ?);',
    ).run(
      command.applicationId,
      selectionRevision,
      command.releaseVersion,
      command.actorId,
      toIso(command.at),
      command.reason,
      command.operationId ?? null,
    );
    return { selectionRevision };
  }

  const control: ControlPlaneStore = {
    async saveChangeSet(record: ChangeSetRecord): Promise<void> {
      safeRun('control.saveChangeSet', () =>
        inTransaction(db, () => {
          const existing = db
            .prepare('SELECT changeset_id FROM vict_changeset WHERE changeset_id = ?;')
            .get(record.changesetId);
          if (existing !== undefined) {
            throw new VictControlError(
              'VICT_CONTROL_CHANGESET_EXISTS',
              'A ChangeSet with this id already exists; propose a distinct changesetId.',
            );
          }
          db.prepare(
            `INSERT INTO vict_changeset
              (changeset_id, schema, author_actor_id, created_at, base_json, operations_json, rationale,
               risk_class, required_approver_count, expires_at, validation_json, simulation_json, content_hash, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          ).run(
            record.changesetId,
            record.schema,
            record.authorActorId,
            toIso(record.createdAt),
            JSON.stringify(record.base),
            JSON.stringify(record.operations),
            record.rationale,
            record.riskClass,
            record.requiredApproverCount,
            toIso(record.expiresAt),
            record.validation === undefined ? null : JSON.stringify(record.validation),
            record.simulation === undefined ? null : JSON.stringify(record.simulation),
            record.contentHash,
            record.status,
          );
        }),
      );
    },

    async getChangeSet(changesetId: string): Promise<ChangeSetRecord | undefined> {
      return safeRun('control.getChangeSet', () => {
        const row = db
          .prepare('SELECT * FROM vict_changeset WHERE changeset_id = ?;')
          .get(changesetId) as ChangeSetRow | undefined;
        return row === undefined ? undefined : rowToChangeSet(row);
      });
    },

    async listChangeSets(): Promise<readonly ChangeSetRecord[]> {
      return safeRun('control.listChangeSets', () => {
        const rows = db
          .prepare('SELECT * FROM vict_changeset ORDER BY changeset_id ASC;')
          .all() as unknown as ChangeSetRow[];
        return rows.map((row) => rowToChangeSet(row));
      });
    },

    async compareAndSetChangeSetStatus(input: {
      changesetId: string;
      expectedStatus: ChangeSetStatus;
      nextStatus: ChangeSetStatus;
    }): Promise<ChangeSetRecord> {
      return safeRun('control.compareAndSetChangeSetStatus', () =>
        inTransaction(db, () => {
          const row = db
            .prepare('SELECT * FROM vict_changeset WHERE changeset_id = ?;')
            .get(input.changesetId) as ChangeSetRow | undefined;
          if (row === undefined) {
            throw new VictControlError(
              'VICT_CONTROL_CHANGESET_MISSING',
              'The ChangeSet does not exist.',
            );
          }
          if (row.status !== input.expectedStatus) {
            throw new VictControlError(
              'VICT_CONTROL_CHANGESET_STATUS_CONFLICT',
              'The ChangeSet is not in the expected status; one concurrent transition already won.',
            );
          }
          db.prepare(
            'UPDATE vict_changeset SET status = ? WHERE changeset_id = ? AND status = ?;',
          ).run(input.nextStatus, input.changesetId, input.expectedStatus);
          const refreshed = db
            .prepare('SELECT * FROM vict_changeset WHERE changeset_id = ?;')
            .get(input.changesetId) as unknown as ChangeSetRow;
          return rowToChangeSet(refreshed);
        }),
      );
    },

    async recordControlRun(record: ControlRunRecord): Promise<void> {
      safeRun('control.recordControlRun', () =>
        inTransaction(db, () => {
          const existing = db
            .prepare('SELECT * FROM vict_control_run WHERE run_id = ?;')
            .get(record.runId) as ControlRunRow | undefined;
          if (existing !== undefined) {
            const same =
              existing.kind === record.kind &&
              existing.changeset_id === record.changesetId &&
              existing.content_hash === record.contentHash &&
              existing.operations_json === JSON.stringify(record.operations) &&
              existing.runner_profile === record.runnerProfile &&
              existing.actor_id === record.actorId &&
              existing.outcome === record.outcome &&
              existing.base_json === JSON.stringify(record.base) &&
              existing.observed_base_json ===
                (record.observedBase === undefined ? null : JSON.stringify(record.observedBase)) &&
              fromIso(existing.created_at) === record.createdAt;
            if (!same) {
              throw new VictControlError(
                'VICT_CONTROL_RUN_COLLISION',
                'A governance run with this id already exists with different content.',
              );
            }
            return;
          }
          db.prepare(
            `INSERT INTO vict_control_run
              (run_id, kind, changeset_id, content_hash, base_json, operations_json,
               runner_profile, actor_id, outcome, created_at, detail_json, observed_base_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          ).run(
            record.runId,
            record.kind,
            record.changesetId,
            record.contentHash,
            JSON.stringify(record.base),
            JSON.stringify(record.operations),
            record.runnerProfile,
            record.actorId,
            record.outcome,
            toIso(record.createdAt),
            record.detail === undefined ? null : JSON.stringify(record.detail),
            record.observedBase === undefined ? null : JSON.stringify(record.observedBase),
          );
        }),
      );
    },

    async getControlRun(runId: string): Promise<ControlRunRecord | undefined> {
      return safeRun('control.getControlRun', () => {
        const row = db.prepare('SELECT * FROM vict_control_run WHERE run_id = ?;').get(runId) as
          ControlRunRow | undefined;
        if (row === undefined) {
          return undefined;
        }
        return rowToControlRun(row);
      });
    },

    async recordOperationIntent(
      receipt: ChangeSetOperationReceipt,
    ): Promise<'recorded' | 'exists'> {
      return safeRun('control.recordOperationIntent', () =>
        inTransaction(db, () => {
          const existing = db
            .prepare(
              'SELECT * FROM vict_changeset_operation_receipt WHERE changeset_id = ? AND operation_index = ?;',
            )
            .get(receipt.changesetId, receipt.operationIndex) as OperationReceiptRow | undefined;
          if (existing !== undefined) {
            if (existing.operation_digest !== receipt.operationDigest) {
              throw new VictControlError(
                'VICT_CONTROL_OPERATION_IDENTITY_CONFLICT',
                'The operation identity already exists with different content; conflicting content fails closed.',
              );
            }
            return 'exists' as const; // idempotent re-intent
          }
          db.prepare(
            `INSERT INTO vict_changeset_operation_receipt
              (changeset_id, operation_index, operation_kind, operation_digest, effect_ref, actor_id, applied_at, state, guard_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          ).run(
            receipt.changesetId,
            receipt.operationIndex,
            receipt.operationKind,
            receipt.operationDigest,
            receipt.effectRef,
            receipt.actorId,
            toIso(receipt.appliedAt),
            receipt.state,
            receipt.guardJson ?? null,
          );
          return 'recorded' as const;
        }),
      );
    },

    async markOperationApplied(input: {
      changesetId: string;
      operationIndex: number;
      at: number;
    }): Promise<ChangeSetOperationReceipt> {
      return safeRun('control.markOperationApplied', () =>
        inTransaction(db, () => {
          const existing = db
            .prepare(
              'SELECT * FROM vict_changeset_operation_receipt WHERE changeset_id = ? AND operation_index = ?;',
            )
            .get(input.changesetId, input.operationIndex) as OperationReceiptRow | undefined;
          if (existing === undefined) {
            throw new VictControlError(
              'VICT_CONTROL_OPERATION_RECEIPT_MISSING',
              'No prepared operation intent exists for this operation index.',
            );
          }
          if (existing.state === 'applied') {
            return rowToOperationReceipt(existing); // idempotent
          }
          db.prepare(
            "UPDATE vict_changeset_operation_receipt SET state = 'applied', applied_at = ? WHERE changeset_id = ? AND operation_index = ?;",
          ).run(toIso(input.at), input.changesetId, input.operationIndex);
          const updated = db
            .prepare(
              'SELECT * FROM vict_changeset_operation_receipt WHERE changeset_id = ? AND operation_index = ?;',
            )
            .get(input.changesetId, input.operationIndex) as unknown as OperationReceiptRow;
          return rowToOperationReceipt(updated);
        }),
      );
    },

    async recordOperationReceipt(receipt: ChangeSetOperationReceipt): Promise<void> {
      safeRun('control.recordOperationReceipt', () =>
        inTransaction(db, () => {
          const existing = db
            .prepare(
              'SELECT * FROM vict_changeset_operation_receipt WHERE changeset_id = ? AND operation_index = ?;',
            )
            .get(receipt.changesetId, receipt.operationIndex) as OperationReceiptRow | undefined;
          if (existing !== undefined) {
            const same =
              existing.operation_kind === receipt.operationKind &&
              existing.operation_digest === receipt.operationDigest &&
              existing.effect_ref === receipt.effectRef &&
              existing.actor_id === receipt.actorId &&
              existing.state === receipt.state &&
              fromIso(existing.applied_at) === receipt.appliedAt;
            if (!same) {
              throw new VictControlError(
                'VICT_CONTROL_OPERATION_RECEIPT_COLLISION',
                'An operation receipt already exists with different content.',
              );
            }
            return; // idempotent re-record
          }
          db.prepare(
            `INSERT INTO vict_changeset_operation_receipt
              (changeset_id, operation_index, operation_kind, operation_digest, effect_ref, actor_id, applied_at, state, guard_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          ).run(
            receipt.changesetId,
            receipt.operationIndex,
            receipt.operationKind,
            receipt.operationDigest,
            receipt.effectRef,
            receipt.actorId,
            toIso(receipt.appliedAt),
            receipt.state,
            receipt.guardJson ?? null,
          );
        }),
      );
    },

    async listOperationReceipts(
      changesetId: string,
    ): Promise<readonly ChangeSetOperationReceipt[]> {
      return safeRun('control.listOperationReceipts', () => {
        const rows = db
          .prepare(
            'SELECT * FROM vict_changeset_operation_receipt WHERE changeset_id = ? ORDER BY operation_index ASC;',
          )
          .all(changesetId) as unknown as OperationReceiptRow[];
        return rows.map((row) => rowToOperationReceipt(row));
      });
    },

    async updateChangeSet(
      changesetId: string,
      update: (record: ChangeSetRecord) => ChangeSetRecord,
    ): Promise<ChangeSetRecord> {
      return safeRun('control.updateChangeSet', () =>
        inTransaction(db, () => {
          const row = db
            .prepare('SELECT * FROM vict_changeset WHERE changeset_id = ?;')
            .get(changesetId) as ChangeSetRow | undefined;
          if (row === undefined) {
            throw new VictControlError(
              'VICT_CONTROL_CHANGESET_MISSING',
              'The ChangeSet does not exist.',
            );
          }
          const current = rowToChangeSet(row);
          const updated = update(current);
          if (updated.changesetId !== changesetId) {
            throw new VictControlError(
              'VICT_CONTROL_CHANGESET_IMMUTABLE_ID',
              'A ChangeSet update may not change its changesetId.',
            );
          }
          if (updated.contentHash !== current.contentHash) {
            throw new VictControlError(
              'VICT_CONTROL_CONTENT_HASH_MISMATCH',
              'A ChangeSet update may not change its immutable content identity.',
            );
          }
          db.prepare(
            'UPDATE vict_changeset SET status = ?, validation_json = ?, simulation_json = ? WHERE changeset_id = ?;',
          ).run(
            updated.status,
            updated.validation === undefined ? null : JSON.stringify(updated.validation),
            updated.simulation === undefined ? null : JSON.stringify(updated.simulation),
            changesetId,
          );
          return updated;
        }),
      );
    },

    async reviseChangeSetContent(
      changesetId: string,
      revise: (record: ChangeSetRecord) => ChangeSetRecord,
    ): Promise<ChangeSetRecord> {
      return safeRun('control.reviseChangeSetContent', () =>
        inTransaction(db, () => {
          const row = db
            .prepare('SELECT * FROM vict_changeset WHERE changeset_id = ?;')
            .get(changesetId) as unknown as ChangeSetRow | undefined;
          if (row === undefined) {
            throw new VictControlError(
              'VICT_CONTROL_CHANGESET_MISSING',
              'The ChangeSet does not exist.',
            );
          }
          const current = rowToChangeSet(row);
          const updated = revise(current);
          if (updated.changesetId !== changesetId) {
            throw new VictControlError(
              'VICT_CONTROL_CHANGESET_IMMUTABLE_ID',
              'A ChangeSet update may not change its changesetId.',
            );
          }
          if (updated.contentHash === current.contentHash) {
            throw new VictControlError(
              'VICT_CONTROL_REVISION_NOT_CHANGED',
              'A content revision must change the immutable content identity.',
            );
          }
          if (updated.validation !== undefined || updated.simulation !== undefined) {
            throw new VictControlError(
              'VICT_CONTROL_EVIDENCE_NOT_INVALIDATED',
              'A content revision must reset validation and simulation evidence.',
            );
          }
          if (updated.status !== 'draft' && updated.status !== 'approved') {
            throw new VictControlError(
              'VICT_CONTROL_CHANGESET_NOT_DRAFT',
              'Only a draft or approved ChangeSet may be revised.',
            );
          }
          db.prepare(
            `UPDATE vict_changeset SET base_json = ?, operations_json = ?, rationale = ?, risk_class = ?,
             required_approver_count = ?, expires_at = ?, validation_json = NULL, simulation_json = NULL,
             content_hash = ?, status = ? WHERE changeset_id = ?;`,
          ).run(
            JSON.stringify(updated.base),
            JSON.stringify(updated.operations),
            updated.rationale,
            updated.riskClass,
            updated.requiredApproverCount,
            toIso(updated.expiresAt),
            updated.contentHash,
            'draft',
            changesetId,
          );
          const refreshed = db
            .prepare('SELECT * FROM vict_changeset WHERE changeset_id = ?;')
            .get(changesetId) as unknown as ChangeSetRow;
          return rowToChangeSet(refreshed);
        }),
      );
    },

    async recordChangeSetApproval(decision: ChangeSetApprovalDecision): Promise<void> {
      safeRun('control.recordChangeSetApproval', () =>
        inTransaction(db, () => {
          const existing = db
            .prepare(
              'SELECT approval_id, content_hash, decision FROM vict_changeset_approval WHERE changeset_id = ? AND approver_actor_id = ?;',
            )
            .get(decision.changesetId, decision.approverActorId) as
            { approval_id: string; content_hash: string; decision: string } | undefined;
          if (existing !== undefined) {
            if (
              existing.decision !== decision.decision ||
              existing.content_hash !== decision.contentHash
            ) {
              throw new VictControlError(
                'VICT_CONTROL_APPROVAL_CONFLICT',
                'A competing decision already exists for this ChangeSet and approver; the first durable decision stands.',
              );
            }
            return; // idempotent identical decision
          }
          try {
            db.prepare(
              `INSERT INTO vict_changeset_approval
                (approval_id, changeset_id, content_hash, approver_actor_id, decision, decided_at)
              VALUES (?, ?, ?, ?, ?, ?);`,
            ).run(
              decision.approvalId,
              decision.changesetId,
              decision.contentHash,
              decision.approverActorId,
              decision.decision,
              toIso(decision.decidedAt),
            );
          } catch (cause) {
            // The UNIQUE(changeset, approver) constraint enforces the CAS
            // winner under concurrency.
            if (cause instanceof Error && cause.message.includes('UNIQUE')) {
              throw new VictControlError(
                'VICT_CONTROL_APPROVAL_CONFLICT',
                'A competing decision already exists for this ChangeSet and approver; the first durable decision stands.',
              );
            }
            throw cause;
          }
        }),
      );
    },

    async listChangeSetApprovals(
      changesetId: string,
    ): Promise<readonly ChangeSetApprovalDecision[]> {
      return safeRun('control.listChangeSetApprovals', () => {
        const rows = db
          .prepare(
            'SELECT * FROM vict_changeset_approval WHERE changeset_id = ? ORDER BY decided_at ASC, approval_id ASC;',
          )
          .all(changesetId) as unknown as {
          approval_id: string;
          changeset_id: string;
          content_hash: string;
          approver_actor_id: string;
          decision: string;
          decided_at: string;
        }[];
        return rows.map((row) => ({
          approvalId: row.approval_id,
          changesetId: row.changeset_id,
          contentHash: row.content_hash,
          approverActorId: row.approver_actor_id,
          decision: row.decision as ChangeSetApprovalDecision['decision'],
          decidedAt: fromIso(row.decided_at),
        }));
      });
    },

    async publishRelease(record: ApplicationReleaseRecord): Promise<void> {
      safeRun('control.publishRelease', () =>
        inTransaction(db, () => {
          const existing = db
            .prepare('SELECT * FROM vict_release WHERE release_version = ?;')
            .get(record.releaseVersion) as ReleaseRow | undefined;
          if (existing !== undefined) {
            const matches = JSON.stringify(rowToRelease(existing)) === JSON.stringify(record);
            if (!matches) {
              throw new VictControlError(
                'VICT_CONTROL_RELEASE_COLLISION',
                'A release with this version exists with different content (immutability guard).',
              );
            }
            return; // idempotent republish
          }
          db.prepare(
            `INSERT INTO vict_release
              (release_version, application_id, application_version, renderer_identity,
               component_registry_identity, data_adapter_identity, activation_binding,
               published_by_actor_id, published_at, content_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          ).run(
            record.releaseVersion,
            record.applicationId,
            record.applicationVersion,
            record.rendererIdentity,
            record.componentRegistryIdentity,
            record.dataAdapterIdentity,
            record.activationBinding,
            record.publishedByActorId,
            toIso(record.publishedAt),
            record.contentHash,
          );
        }),
      );
    },

    async getRelease(releaseVersion: string): Promise<ApplicationReleaseRecord | undefined> {
      return safeRun('control.getRelease', () => {
        const row = db
          .prepare('SELECT * FROM vict_release WHERE release_version = ?;')
          .get(releaseVersion) as ReleaseRow | undefined;
        return row === undefined ? undefined : rowToRelease(row);
      });
    },

    async listReleases(applicationId: string): Promise<readonly ApplicationReleaseRecord[]> {
      return safeRun('control.listReleases', () => {
        const rows = db
          .prepare(
            'SELECT * FROM vict_release WHERE application_id = ? ORDER BY release_version ASC;',
          )
          .all(applicationId) as unknown as ReleaseRow[];
        return rows.map((row) => rowToRelease(row));
      });
    },

    async selectRelease(command: {
      applicationId: string;
      releaseVersion: string;
      actorId: string;
      at: number;
      reason: 'select' | 'rollback';
      readonly operationId?: string;
      readonly expectedBaseVersion?: string;
    }): Promise<{ selectionRevision: number }> {
      return safeRun('control.selectRelease', () =>
        inTransaction(db, () => selectReleaseInTransaction(command)),
      );
    },

    async applyReleaseOperation(input: {
      release: ApplicationReleaseRecord;
      selection: {
        applicationId: string;
        releaseVersion: string;
        actorId: string;
        at: number;
        reason: 'select' | 'rollback';
        operationId: string;
        expectedBaseVersion?: string;
      };
      receipt: ChangeSetOperationReceipt;
    }): Promise<{ selectionRevision: number }> {
      // The publication, the guarded selection, AND the applied operation
      // receipt commit in ONE durable transaction: a crash between the
      // external effect and the receipt is structurally impossible here.
      return safeRun('control.applyReleaseOperation', () =>
        inTransaction(db, () => {
          const existingRelease = db
            .prepare('SELECT * FROM vict_release WHERE release_version = ?;')
            .get(input.release.releaseVersion) as ReleaseRow | undefined;
          if (existingRelease !== undefined) {
            const matches =
              JSON.stringify(rowToRelease(existingRelease)) === JSON.stringify(input.release);
            if (!matches) {
              throw new VictControlError(
                'VICT_CONTROL_RELEASE_COLLISION',
                'A release with this version exists with different content (immutability guard).',
              );
            }
          } else {
            db.prepare(
              `INSERT INTO vict_release
                (release_version, application_id, application_version, renderer_identity,
                 component_registry_identity, data_adapter_identity, activation_binding,
                 published_by_actor_id, published_at, content_hash)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            ).run(
              input.release.releaseVersion,
              input.release.applicationId,
              input.release.applicationVersion,
              input.release.rendererIdentity,
              input.release.componentRegistryIdentity,
              input.release.dataAdapterIdentity,
              input.release.activationBinding,
              input.release.publishedByActorId,
              toIso(input.release.publishedAt),
              input.release.contentHash,
            );
          }
          const intent = db
            .prepare(
              'SELECT operation_digest FROM vict_changeset_operation_receipt WHERE changeset_id = ? AND operation_index = ?;',
            )
            .get(input.receipt.changesetId, input.receipt.operationIndex) as
            { operation_digest: string } | undefined;
          if (intent === undefined) {
            throw new VictControlError(
              'VICT_CONTROL_OPERATION_RECEIPT_MISSING',
              'The prepared operation intent must exist before the effect is applied.',
            );
          }
          if (intent.operation_digest !== input.receipt.operationDigest) {
            throw new VictControlError(
              'VICT_CONTROL_OPERATION_IDENTITY_CONFLICT',
              'The prepared operation intent carries different content; conflicting content fails closed.',
            );
          }
          // The guarded selection runs inside THIS transaction (no nested
          // transaction), then the receipt is marked applied — one durable
          // commit for publication + selection + receipt.
          const selection = selectReleaseInTransaction(input.selection);
          db.prepare(
            "UPDATE vict_changeset_operation_receipt SET state = 'applied', applied_at = ? WHERE changeset_id = ? AND operation_index = ?;",
          ).run(
            toIso(input.receipt.appliedAt),
            input.receipt.changesetId,
            input.receipt.operationIndex,
          );
          return selection;
        }),
      );
    },

    async getSelectedRelease(applicationId: string): Promise<ApplicationReleaseRecord | undefined> {
      return safeRun('control.getSelectedRelease', () => {
        const row = db
          .prepare(
            `SELECT release_version FROM vict_release_selection
             WHERE application_id = ? ORDER BY selection_revision DESC LIMIT 1;`,
          )
          .get(applicationId) as { release_version: string } | undefined;
        if (row === undefined) {
          return undefined;
        }
        const release = db
          .prepare('SELECT * FROM vict_release WHERE release_version = ?;')
          .get(row.release_version) as ReleaseRow | undefined;
        return release === undefined ? undefined : rowToRelease(release);
      });
    },

    async listReleaseSelections(applicationId: string): Promise<readonly ReleaseSelectionRecord[]> {
      return safeRun('control.listReleaseSelections', () => {
        const rows = db
          .prepare(
            'SELECT * FROM vict_release_selection WHERE application_id = ? ORDER BY selection_revision ASC;',
          )
          .all(applicationId) as unknown as {
          application_id: string;
          selection_revision: number;
          release_version: string;
          actor_id: string;
          at: string;
          reason: string;
          operation_id: string | null;
        }[];
        return rows.map((row) => ({
          applicationId: row.application_id,
          releaseVersion: row.release_version,
          selectionRevision: row.selection_revision,
          actorId: row.actor_id,
          at: fromIso(row.at),
          reason: row.reason as ReleaseSelectionRecord['reason'],
          operationId: row.operation_id ?? undefined,
        }));
      });
    },

    async appendAuditEvent(event: ControlAuditEvent): Promise<void> {
      safeRun('control.appendAuditEvent', () =>
        inTransaction(db, () => {
          const existing = db
            .prepare('SELECT audit_id FROM vict_audit_event WHERE audit_id = ?;')
            .get(event.auditId);
          if (existing !== undefined) {
            return; // idempotent append
          }
          db.prepare(
            `INSERT INTO vict_audit_event (audit_id, at, actor_id, action, subject_type, subject_id, summary)
             VALUES (?, ?, ?, ?, ?, ?, ?);`,
          ).run(
            event.auditId,
            toIso(event.at),
            event.actorId,
            event.action,
            event.subjectType,
            event.subjectId,
            event.summary,
          );
        }),
      );
    },

    async listAuditEvents(subject: {
      subjectType?: string;
      subjectId?: string;
    }): Promise<readonly ControlAuditEvent[]> {
      return safeRun('control.listAuditEvents', () => {
        const conditions: string[] = [];
        const params: SQLInputValue[] = [];
        if (subject.subjectType !== undefined) {
          conditions.push('subject_type = ?');
          params.push(subject.subjectType);
        }
        if (subject.subjectId !== undefined) {
          conditions.push('subject_id = ?');
          params.push(subject.subjectId);
        }
        const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
        const rows = db
          .prepare(
            `SELECT audit_id, at, actor_id, action, subject_type, subject_id, summary
             FROM vict_audit_event${where} ORDER BY at ASC, audit_id ASC;`,
          )
          .all(...params) as unknown as {
          audit_id: string;
          at: string;
          actor_id: string;
          action: string;
          subject_type: string;
          subject_id: string;
          summary: string;
        }[];
        return rows.map((row) => ({
          auditId: row.audit_id,
          at: fromIso(row.at),
          actorId: row.actor_id,
          action: row.action as ControlAuditEvent['action'],
          subjectType: row.subject_type,
          subjectId: row.subject_id,
          summary: row.summary,
        }));
      });
    },
  };

  const turns: AgentTurnStore = {
    async createTurnIntent(record: AgentTurnRecord): Promise<void> {
      safeRun('turns.createIntent', () =>
        inTransaction(db, () => {
          const existing = db
            .prepare('SELECT * FROM vict_agent_turn WHERE turn_id = ?;')
            .get(record.turnId) as TurnRow | undefined;
          if (existing !== undefined) {
            if (JSON.stringify(rowToTurn(existing)) !== JSON.stringify(record)) {
              throw new VictControlError(
                'VICT_CONTROL_TURN_COLLISION',
                'A turn intent with this id already exists with different content.',
              );
            }
            return; // idempotent re-intent
          }
          if (record.status !== 'intent') {
            throw new VictControlError(
              'VICT_CONTROL_TURN_INVALID_STATE',
              'A new turn must be recorded as intent.',
            );
          }
          db.prepare(
            `INSERT INTO vict_agent_turn
              (turn_id, stream_id, thread_id, actor_id, agent_profile_version, activation_version,
               application_release_version, input_summary, status, created_at, updated_at,
               terminal_at, error_code, trace_id, vict_run_id, mastra_run_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          ).run(
            record.turnId,
            record.streamId,
            record.threadId,
            record.actorId,
            record.agentProfileVersion,
            record.activationVersion ?? null,
            record.applicationReleaseVersion ?? null,
            record.inputSummary,
            record.status,
            toIso(record.createdAt),
            toIso(record.updatedAt),
            record.terminalAt === undefined ? null : toIso(record.terminalAt),
            record.errorCode ?? null,
            record.traceId ?? null,
            record.victRunId ?? null,
            record.mastraRunId ?? null,
          );
        }),
      );
    },

    async getTurn(turnId: string): Promise<AgentTurnRecord | undefined> {
      return safeRun('turns.getTurn', () => {
        const row = db
          .prepare('SELECT * FROM vict_agent_turn WHERE turn_id = ?;')
          .get(turnId) as unknown as TurnRow | undefined;
        return row === undefined ? undefined : rowToTurn(row);
      });
    },

    async listTurns(): Promise<readonly AgentTurnRecord[]> {
      return safeRun('turns.listTurns', () => {
        const rows = db
          .prepare('SELECT * FROM vict_agent_turn ORDER BY turn_id ASC;')
          .all() as unknown as TurnRow[];
        return rows.map((row) => rowToTurn(row));
      });
    },

    async listOpenTurns(): Promise<readonly AgentTurnRecord[]> {
      return safeRun('turns.listOpenTurns', () => {
        const rows = db
          .prepare(
            "SELECT * FROM vict_agent_turn WHERE status IN ('intent', 'running', 'awaiting-approval') ORDER BY turn_id ASC;",
          )
          .all() as unknown as TurnRow[];
        return rows.map((row) => rowToTurn(row));
      });
    },

    async startTurn(turnId: string, at: number): Promise<AgentTurnRecord> {
      return transitionTurn(turnId, at, (status) => (status === 'intent' ? 'running' : undefined));
    },

    async awaitApproval(turnId: string, at: number, _approvalId: string): Promise<AgentTurnRecord> {
      return transitionTurn(turnId, at, (status) =>
        status === 'running' ? 'awaiting-approval' : undefined,
      );
    },

    async resumeTurn(turnId: string, at: number): Promise<AgentTurnRecord> {
      return transitionTurn(turnId, at, (status) =>
        status === 'awaiting-approval' ? 'running' : undefined,
      );
    },

    async recordTurnCorrelation(
      turnId: string,
      correlation: { traceId?: string; victRunId?: string; mastraRunId?: string },
    ): Promise<void> {
      safeRun('turns.correlation', () =>
        inTransaction(db, () => {
          const row = db
            .prepare(
              'SELECT trace_id, vict_run_id, mastra_run_id FROM vict_agent_turn WHERE turn_id = ?;',
            )
            .get(turnId) as
            | { trace_id: string | null; vict_run_id: string | null; mastra_run_id: string | null }
            | undefined;
          if (row === undefined) {
            throw new VictControlError('VICT_CONTROL_TURN_MISSING', 'The turn does not exist.');
          }
          db.prepare(
            'UPDATE vict_agent_turn SET trace_id = ?, vict_run_id = ?, mastra_run_id = ? WHERE turn_id = ?;',
          ).run(
            correlation.traceId ?? row.trace_id,
            correlation.victRunId ?? row.vict_run_id,
            correlation.mastraRunId ?? row.mastra_run_id,
            turnId,
          );
        }),
      );
    },

    async completeTurn(command: {
      turnId: string;
      status: 'completed' | 'failed' | 'cancelled' | 'blocked';
      at: number;
      errorCode?: string;
    }): Promise<AgentTurnRecord> {
      return transitionTurn(
        command.turnId,
        command.at,
        (status) =>
          status === 'running' || status === 'awaiting-approval' || status === 'intent'
            ? command.status
            : undefined,
        command.errorCode,
      );
    },

    async recordCancelIntent(command: {
      turnId: string;
      cancelId: string;
      actorId: string;
      reasonCode: string;
      at: number;
    }): Promise<{ accepted: boolean; duplicate: boolean }> {
      return safeRun('turns.cancelIntent', () =>
        inTransaction(db, () => {
          const intentRow = db
            .prepare('SELECT turn_id FROM vict_agent_turn WHERE turn_id = ?;')
            .get(command.turnId);
          if (intentRow === undefined) {
            throw new VictControlError('VICT_CONTROL_TURN_MISSING', 'The turn does not exist.');
          }
          const existing = db
            .prepare(
              'SELECT cancel_id FROM vict_agent_turn_cancel WHERE turn_id = ? AND cancel_id = ?;',
            )
            .get(command.turnId, command.cancelId);
          if (existing !== undefined) {
            return { accepted: false, duplicate: true };
          }
          db.prepare(
            'INSERT INTO vict_agent_turn_cancel (turn_id, cancel_id, actor_id, reason_code, at) VALUES (?, ?, ?, ?, ?);',
          ).run(
            command.turnId,
            command.cancelId,
            command.actorId,
            command.reasonCode,
            toIso(command.at),
          );
          return { accepted: true, duplicate: false };
        }),
      );
    },

    async hasCancelIntent(turnId: string): Promise<boolean> {
      return safeRun('turns.hasCancelIntent', () => {
        const row = db
          .prepare('SELECT 1 AS one FROM vict_agent_turn_cancel WHERE turn_id = ? LIMIT 1;')
          .get(turnId);
        return row !== undefined;
      });
    },

    async reconcileTurn(command: {
      turnId: string;
      status: 'failed' | 'cancelled' | 'blocked';
      reasonCode: string;
      at: number;
    }): Promise<AgentTurnRecord | undefined> {
      return safeRun('turns.reconcile', () =>
        inTransaction(db, () => {
          const row = db
            .prepare('SELECT * FROM vict_agent_turn WHERE turn_id = ?;')
            .get(command.turnId) as TurnRow | undefined;
          if (row === undefined) {
            return undefined;
          }
          const current = rowToTurn(row);
          if (
            current.status === 'completed' ||
            current.status === 'failed' ||
            current.status === 'cancelled' ||
            current.status === 'blocked'
          ) {
            return current; // already terminal
          }
          db.prepare(
            'UPDATE vict_agent_turn SET status = ?, error_code = ?, terminal_at = ?, updated_at = ? WHERE turn_id = ?;',
          ).run(
            command.status,
            command.reasonCode,
            toIso(command.at),
            toIso(command.at),
            command.turnId,
          );
          return {
            ...current,
            status: command.status,
            errorCode: command.reasonCode,
            terminalAt: command.at,
            updatedAt: command.at,
          };
        }),
      );
    },

    async listCancelIntents(
      turnId: string,
    ): Promise<readonly { cancelId: string; actorId: string; reasonCode: string; at: number }[]> {
      return safeRun('turns.listCancelIntents', () => {
        const rows = db
          .prepare(
            'SELECT cancel_id, actor_id, reason_code, at FROM vict_agent_turn_cancel WHERE turn_id = ? ORDER BY at ASC, cancel_id ASC;',
          )
          .all(turnId) as unknown as {
          cancel_id: string;
          actor_id: string;
          reason_code: string;
          at: string;
        }[];
        return rows.map((row) => ({
          cancelId: row.cancel_id,
          actorId: row.actor_id,
          reasonCode: row.reason_code,
          at: fromIso(row.at),
        }));
      });
    },
  };

  /** Shared turn-transition helper (atomic read-validate-update). */
  function transitionTurn(
    turnId: string,
    at: number,
    allowed: (status: AgentTurnRecord['status']) => AgentTurnRecord['status'] | undefined,
    errorCode?: string,
  ): AgentTurnRecord {
    return safeRun('turns.transition', () =>
      inTransaction(db, () => {
        const row = db
          .prepare('SELECT * FROM vict_agent_turn WHERE turn_id = ?;')
          .get(turnId) as unknown as TurnRow | undefined;
        if (row === undefined) {
          throw new VictControlError('VICT_CONTROL_TURN_MISSING', 'The turn does not exist.');
        }
        const current = rowToTurn(row);
        const next = allowed(current.status);
        if (next === undefined) {
          throw new VictControlError(
            'VICT_CONTROL_TURN_INVALID_TRANSITION',
            `The turn status '${current.status}' cannot transition as requested.`,
          );
        }
        const terminal =
          next === 'completed' || next === 'failed' || next === 'cancelled' || next === 'blocked';
        db.prepare(
          'UPDATE vict_agent_turn SET status = ?, updated_at = ?, terminal_at = ?, error_code = ? WHERE turn_id = ?;',
        ).run(
          next,
          toIso(at),
          terminal ? toIso(at) : row.terminal_at,
          errorCode ?? row.error_code,
          turnId,
        );
        const updated = db
          .prepare('SELECT * FROM vict_agent_turn WHERE turn_id = ?;')
          .get(turnId) as unknown as TurnRow;
        return rowToTurn(updated);
      }),
    );
  }

  const invocations: AgentToolInvocationStore = {
    async allocateTurnToolSlot(input: {
      turnId: string;
      toolName: string;
      argDigest: string;
    }): Promise<TurnToolSlotAllocation> {
      return safeRun('invocations.allocateSlot', () =>
        inTransaction(db, () => {
          // Allocation and reuse happen in ONE transaction: the same
          // logical request (same turn, tool, digest) re-reads its exact
          // persisted slot; a fresh request takes the next monotonic slot
          // (a persisted allocation, never a row count, never a clock).
          const existing = db
            .prepare(
              'SELECT slot, tool_call_id FROM vict_agent_turn_tool_slot WHERE turn_id = ? AND tool_name = ? AND arg_digest = ?;',
            )
            .get(input.turnId, input.toolName, input.argDigest) as
            { slot: number; tool_call_id: string } | undefined;
          if (existing !== undefined) {
            return {
              slot: existing.slot,
              toolCallId: existing.tool_call_id,
              turnId: input.turnId,
              toolName: input.toolName,
              argDigest: input.argDigest,
            };
          }
          const maxRow = db
            .prepare(
              'SELECT MAX(slot) AS max_slot FROM vict_agent_turn_tool_slot WHERE turn_id = ?;',
            )
            .get(input.turnId) as { max_slot: number | null };
          const slot = (maxRow.max_slot ?? 0) + 1;
          const toolCallId = `slot-${slot}-${createHash('sha256').update(input.turnId, 'utf8').digest('hex').slice(0, 12)}`;
          db.prepare(
            'INSERT INTO vict_agent_turn_tool_slot (turn_id, tool_name, arg_digest, slot, tool_call_id) VALUES (?, ?, ?, ?, ?);',
          ).run(input.turnId, input.toolName, input.argDigest, slot, toolCallId);
          return {
            slot,
            toolCallId,
            turnId: input.turnId,
            toolName: input.toolName,
            argDigest: input.argDigest,
          };
        }),
      );
    },

    async recordInvocationIntent(
      record: AgentToolInvocationRecord,
    ): Promise<AgentToolInvocationRecord> {
      return safeRun('invocations.recordIntent', () =>
        inTransaction(db, () => {
          const byKey = db
            .prepare(
              'SELECT invocation_id FROM vict_agent_tool_invocation WHERE idempotency_key = ?;',
            )
            .get(record.idempotencyKey) as { invocation_id: string } | undefined;
          if (byKey !== undefined) {
            const existing = db
              .prepare('SELECT * FROM vict_agent_tool_invocation WHERE invocation_id = ?;')
              .get(byKey.invocation_id) as unknown as InvocationRow;
            const existingRecord = rowToInvocation(existing);
            if (existingRecord.argDigest !== record.argDigest) {
              throw new VictControlError(
                'VICT_CONTROL_INVOCATION_KEY_COLLISION',
                'The idempotency key exists with a different canonical argument digest.',
              );
            }
            return existingRecord; // idempotent retry
          }
          const existing = db
            .prepare('SELECT * FROM vict_agent_tool_invocation WHERE invocation_id = ?;')
            .get(record.invocationId) as unknown as InvocationRow | undefined;
          if (existing !== undefined) {
            if (JSON.stringify(rowToInvocation(existing)) !== JSON.stringify(record)) {
              throw new VictControlError(
                'VICT_CONTROL_INVOCATION_COLLISION',
                'An invocation with this id already exists with different content.',
              );
            }
            return rowToInvocation(existing);
          }
          if (record.status !== 'intent') {
            throw new VictControlError(
              'VICT_CONTROL_INVOCATION_INVALID_STATE',
              'A new invocation must be recorded as intent (durable-before-invocation).',
            );
          }
          db.prepare(
            `INSERT INTO vict_agent_tool_invocation
              (invocation_id, turn_id, tool_call_id, tool_name, capability_id, capability_revision, effect,
               idempotency_key, actor_id, arg_digest, argument_summary, status, created_at, updated_at,
               completed_at, result_summary, error_code)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          ).run(
            record.invocationId,
            record.turnId,
            record.toolCallId,
            record.toolName,
            record.capabilityId,
            record.capabilityRevision,
            record.effect,
            record.idempotencyKey,
            record.actorId,
            record.argDigest,
            record.argumentSummary,
            record.status,
            toIso(record.createdAt),
            toIso(record.updatedAt),
            record.completedAt === undefined ? null : toIso(record.completedAt),
            record.resultSummary ?? null,
            record.errorCode ?? null,
          );
          return record;
        }),
      );
    },

    async getInvocation(invocationId: string): Promise<AgentToolInvocationRecord | undefined> {
      return safeRun('invocations.get', () => {
        const row = db
          .prepare('SELECT * FROM vict_agent_tool_invocation WHERE invocation_id = ?;')
          .get(invocationId) as InvocationRow | undefined;
        return row === undefined ? undefined : rowToInvocation(row);
      });
    },

    async getInvocationByIdempotencyKey(
      idempotencyKey: string,
    ): Promise<AgentToolInvocationRecord | undefined> {
      return safeRun('invocations.getByKey', () => {
        const row = db
          .prepare('SELECT * FROM vict_agent_tool_invocation WHERE idempotency_key = ?;')
          .get(idempotencyKey) as InvocationRow | undefined;
        return row === undefined ? undefined : rowToInvocation(row);
      });
    },

    async updateInvocationStatus(command: {
      invocationId: string;
      status:
        | 'approved'
        | 'running'
        | 'completed'
        | 'failed'
        | 'declined'
        | 'cancelled'
        | 'outcome_unknown';
      at: number;
      resultSummary?: string;
      errorCode?: string;
    }): Promise<AgentToolInvocationRecord> {
      return safeRun('invocations.updateStatus', () =>
        inTransaction(db, () => {
          const row = db
            .prepare('SELECT * FROM vict_agent_tool_invocation WHERE invocation_id = ?;')
            .get(command.invocationId) as unknown as InvocationRow | undefined;
          if (row === undefined) {
            throw new VictControlError(
              'VICT_CONTROL_INVOCATION_MISSING',
              'The invocation does not exist.',
            );
          }
          const current = rowToInvocation(row);
          const ORDER: Readonly<Record<string, number>> = {
            intent: 0,
            approved: 1,
            running: 2,
            completed: 3,
            failed: 3,
            declined: 3,
            cancelled: 3,
            outcome_unknown: 3,
          };
          const orderOf = (status: string): number => ORDER[status] ?? 0;
          if (orderOf(command.status) < orderOf(current.status)) {
            throw new VictControlError(
              'VICT_CONTROL_INVOCATION_REGRESSION',
              'An invocation status may only move forward.',
            );
          }
          if (orderOf(current.status) >= 3 && command.status !== current.status) {
            throw new VictControlError(
              'VICT_CONTROL_INVOCATION_TERMINAL',
              'The invocation is already terminal; late results are fenced.',
            );
          }
          const terminal = orderOf(command.status) >= 3;
          db.prepare(
            `UPDATE vict_agent_tool_invocation
             SET status = ?, updated_at = ?, completed_at = ?, result_summary = ?, error_code = ?
             WHERE invocation_id = ?;`,
          ).run(
            command.status,
            toIso(command.at),
            terminal ? toIso(command.at) : row.completed_at,
            command.resultSummary ?? row.result_summary,
            command.errorCode ?? row.error_code,
            command.invocationId,
          );
          const updated = db
            .prepare('SELECT * FROM vict_agent_tool_invocation WHERE invocation_id = ?;')
            .get(command.invocationId) as unknown as InvocationRow;
          return rowToInvocation(updated);
        }),
      );
    },

    async claimInvocationRun(command: {
      invocationId: string;
      fenceToken: string;
      ownerIdentity: string;
      at: number;
    }): Promise<AgentToolInvocationRecord> {
      return safeRun('invocations.claimRun', () =>
        inTransaction(db, () => {
          const row = db
            .prepare('SELECT * FROM vict_agent_tool_invocation WHERE invocation_id = ?;')
            .get(command.invocationId) as unknown as InvocationRow | undefined;
          if (row === undefined) {
            throw new VictControlError(
              'VICT_CONTROL_INVOCATION_MISSING',
              'The invocation does not exist.',
            );
          }
          const current = rowToInvocation(row);
          if (current.status === 'running') {
            // Exactly one live owner: a second claim is the duplicate of
            // the current owner and NEVER mutates the row.
            throw new VictControlError(
              'VICT_CONTROL_INVOCATION_OWNER_ACTIVE',
              'The invocation attempt is already claimed by a live owner.',
            );
          }
          if (current.status !== 'intent' && current.status !== 'approved') {
            throw new VictControlError(
              'VICT_CONTROL_INVOCATION_TERMINAL',
              'The invocation is already terminal; no new attempt can be claimed.',
            );
          }
          db.prepare(
            `UPDATE vict_agent_tool_invocation
             SET status = 'running', updated_at = ?, run_fence_token = ?, run_fence_at = ?,
                 run_owner_identity = ?, run_generation = run_generation + 1
             WHERE invocation_id = ?;`,
          ).run(
            toIso(command.at),
            command.fenceToken,
            toIso(command.at),
            command.ownerIdentity,
            command.invocationId,
          );
          const updated = db
            .prepare('SELECT * FROM vict_agent_tool_invocation WHERE invocation_id = ?;')
            .get(command.invocationId) as unknown as InvocationRow;
          return rowToInvocation(updated);
        }),
      );
    },

    async settleInvocationRun(command: {
      invocationId: string;
      fenceToken: string;
      status: 'completed' | 'failed' | 'outcome_unknown';
      at: number;
      resultSummary?: string;
      errorCode?: string;
    }): Promise<AgentToolInvocationRecord> {
      return safeRun('invocations.settleRun', () =>
        inTransaction(db, () => {
          const row = db
            .prepare('SELECT * FROM vict_agent_tool_invocation WHERE invocation_id = ?;')
            .get(command.invocationId) as unknown as InvocationRow | undefined;
          if (row === undefined) {
            throw new VictControlError(
              'VICT_CONTROL_INVOCATION_MISSING',
              'The invocation does not exist.',
            );
          }
          const current = rowToInvocation(row);
          // The EXACT attempt binding comes first: a stale owner (an
          // earlier fence token, e.g. after reconciliation re-fenced the
          // record) can never settle — not even idempotently — a later
          // generation.
          if ((current.runFenceToken ?? undefined) !== command.fenceToken) {
            throw new VictControlError(
              'VICT_CONTROL_INVOCATION_FENCE_MISMATCH',
              'The settlement fence does not bind the current attempt owner.',
            );
          }
          if (current.status === 'running') {
            db.prepare(
              `UPDATE vict_agent_tool_invocation
               SET status = ?, updated_at = ?, completed_at = ?, result_summary = ?, error_code = ?
               WHERE invocation_id = ?;`,
            ).run(
              command.status,
              toIso(command.at),
              toIso(command.at),
              command.resultSummary ?? row.result_summary,
              command.errorCode ?? row.error_code,
              command.invocationId,
            );
            const updated = db
              .prepare('SELECT * FROM vict_agent_tool_invocation WHERE invocation_id = ?;')
              .get(command.invocationId) as unknown as InvocationRow;
            return rowToInvocation(updated);
          }
          // Terminal idempotency ONLY on the exact requested state + binding.
          if (
            current.status === command.status &&
            current.errorCode === command.errorCode &&
            current.resultSummary === command.resultSummary
          ) {
            return current;
          }
          throw new VictControlError(
            'VICT_CONTROL_INVOCATION_TERMINAL',
            'The invocation is already terminal with a different settlement.',
          );
        }),
      );
    },

    async settleInvocationPending(command: {
      invocationId: string;
      status: 'failed' | 'declined' | 'cancelled';
      at: number;
      errorCode?: string;
    }): Promise<AgentToolInvocationRecord> {
      return safeRun('invocations.settlePending', () =>
        inTransaction(db, () => {
          const row = db
            .prepare('SELECT * FROM vict_agent_tool_invocation WHERE invocation_id = ?;')
            .get(command.invocationId) as unknown as InvocationRow | undefined;
          if (row === undefined) {
            throw new VictControlError(
              'VICT_CONTROL_INVOCATION_MISSING',
              'The invocation does not exist.',
            );
          }
          const current = rowToInvocation(row);
          if (current.status === 'running') {
            // A claimed (live-owned) attempt is never touched by a late
            // pre-running settlement.
            throw new VictControlError(
              'VICT_CONTROL_INVOCATION_OWNER_ACTIVE',
              'The invocation attempt is claimed by a live owner.',
            );
          }
          if (current.status === 'intent' || current.status === 'approved') {
            db.prepare(
              `UPDATE vict_agent_tool_invocation
               SET status = ?, updated_at = ?, completed_at = ?, error_code = ?
               WHERE invocation_id = ?;`,
            ).run(
              command.status,
              toIso(command.at),
              toIso(command.at),
              command.errorCode ?? row.error_code,
              command.invocationId,
            );
            const updated = db
              .prepare('SELECT * FROM vict_agent_tool_invocation WHERE invocation_id = ?;')
              .get(command.invocationId) as unknown as InvocationRow;
            return rowToInvocation(updated);
          }
          // Terminal idempotency ONLY on the exact requested state + binding.
          if (current.status === command.status && current.errorCode === command.errorCode) {
            return current;
          }
          throw new VictControlError(
            'VICT_CONTROL_INVOCATION_TERMINAL',
            'The invocation is already terminal with a different disposition.',
          );
        }),
      );
    },

    async reconcileAbandonedRun(command: {
      invocationId: string;
      observedFenceToken: string;
      reconciledFenceToken: string;
      at: number;
    }): Promise<AgentToolInvocationRecord> {
      return safeRun('invocations.reconcileAbandoned', () =>
        inTransaction(db, () => {
          const row = db
            .prepare('SELECT * FROM vict_agent_tool_invocation WHERE invocation_id = ?;')
            .get(command.invocationId) as unknown as InvocationRow | undefined;
          if (row === undefined) {
            throw new VictControlError(
              'VICT_CONTROL_INVOCATION_MISSING',
              'The invocation does not exist.',
            );
          }
          const current = rowToInvocation(row);
          // Exact observed-state binding: only a genuinely running attempt
          // under the exact observed fence is reconciled (conservative,
          // never a state-changing guess; the effect is never re-executed).
          if (
            current.status !== 'running' ||
            (current.runFenceToken ?? '') !== command.observedFenceToken
          ) {
            throw new VictControlError(
              'VICT_CONTROL_INVOCATION_FENCE_MISMATCH',
              'The observed durable state is not the abandoned attempt requested.',
            );
          }
          db.prepare(
            `UPDATE vict_agent_tool_invocation
             SET status = 'outcome_unknown', updated_at = ?, completed_at = ?, error_code = ?,
                 run_fence_token = ?, run_fence_at = ?, run_generation = run_generation + 1
             WHERE invocation_id = ?;`,
          ).run(
            toIso(command.at),
            toIso(command.at),
            'VICT_CONTROL_INVOCATION_RUN_RECONCILED',
            command.reconciledFenceToken,
            toIso(command.at),
            command.invocationId,
          );
          const updated = db
            .prepare('SELECT * FROM vict_agent_tool_invocation WHERE invocation_id = ?;')
            .get(command.invocationId) as unknown as InvocationRow;
          return rowToInvocation(updated);
        }),
      );
    },

    async listInvocationsForTurn(turnId: string): Promise<readonly AgentToolInvocationRecord[]> {
      return safeRun('invocations.listForTurn', () => {
        const rows = db
          .prepare(
            'SELECT * FROM vict_agent_tool_invocation WHERE turn_id = ? ORDER BY invocation_id ASC;',
          )
          .all(turnId) as unknown as InvocationRow[];
        return rows.map((row) => rowToInvocation(row));
      });
    },
  };

  const approvals: AgentApprovalStore = {
    async createPendingApproval(record: AgentApprovalRecord): Promise<AgentApprovalRecord> {
      return safeRun('approvals.createPending', () =>
        inTransaction(db, () => {
          const existing = db
            .prepare('SELECT * FROM vict_agent_approval WHERE approval_id = ?;')
            .get(record.approvalId) as unknown as ApprovalRow | undefined;
          if (existing !== undefined) {
            if (JSON.stringify(rowToApproval(existing)) !== JSON.stringify(record)) {
              throw new VictControlError(
                'VICT_CONTROL_APPROVAL_COLLISION',
                'An approval with this id already exists with different content.',
              );
            }
            return rowToApproval(existing);
          }
          // One approval record per invocation: reuse an existing pending one.
          const byInvocation = db
            .prepare('SELECT * FROM vict_agent_approval WHERE invocation_id = ?;')
            .get(record.invocationId) as unknown as ApprovalRow | undefined;
          if (byInvocation !== undefined) {
            const reused = rowToApproval(byInvocation);
            if (reused.status === 'pending') {
              return reused;
            }
            throw new VictControlError(
              'VICT_CONTROL_APPROVAL_INVALID_STATE',
              'The invocation already has a decided approval record.',
            );
          }
          if (record.status !== 'pending') {
            throw new VictControlError(
              'VICT_CONTROL_APPROVAL_INVALID_STATE',
              'A new approval record must be pending.',
            );
          }
          db.prepare(
            `INSERT INTO vict_agent_approval
              (approval_id, kind, turn_id, invocation_id, tool_call_id, tool_name, capability_id,
               capability_revision, effect, actor_id, agent_profile_version, arg_digest, environment,
               required_approver_role, status, created_at, expires_at, decided_at, approver_actor_id, decision_reason)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          ).run(
            record.approvalId,
            record.kind,
            record.turnId,
            record.invocationId,
            record.toolCallId,
            record.toolName,
            record.capabilityId,
            record.capabilityRevision,
            record.effect,
            record.actorId,
            record.agentProfileVersion,
            record.argDigest,
            record.environment,
            record.requiredApproverRole,
            record.status,
            toIso(record.createdAt),
            toIso(record.expiresAt),
            record.decidedAt === undefined ? null : toIso(record.decidedAt),
            record.approverActorId ?? null,
            record.decisionReason ?? null,
          );
          return record;
        }),
      );
    },

    async getApproval(approvalId: string): Promise<AgentApprovalRecord | undefined> {
      return safeRun('approvals.get', () => {
        const row = db
          .prepare('SELECT * FROM vict_agent_approval WHERE approval_id = ?;')
          .get(approvalId) as ApprovalRow | undefined;
        return row === undefined ? undefined : rowToApproval(row);
      });
    },

    async listOpenApprovals(): Promise<readonly AgentApprovalRecord[]> {
      return safeRun('approvals.listOpen', () => {
        const rows = db
          .prepare(
            "SELECT * FROM vict_agent_approval WHERE status = 'pending' ORDER BY approval_id ASC;",
          )
          .all() as unknown as ApprovalRow[];
        return rows.map((row) => rowToApproval(row));
      });
    },

    async listApprovalsForInvocation(
      invocationId: string,
    ): Promise<readonly AgentApprovalRecord[]> {
      return safeRun('approvals.listForInvocation', () => {
        const rows = db
          .prepare('SELECT * FROM vict_agent_approval WHERE invocation_id = ?;')
          .all(invocationId) as unknown as ApprovalRow[];
        return rows.map((row) => rowToApproval(row));
      });
    },

    async decideApproval(command: {
      approvalId: string;
      approverActorId: string;
      decision: 'approved' | 'declined';
      decidedAt: number;
      decisionReason?: string;
    }): Promise<AgentApprovalRecord> {
      return safeRun('approvals.decide', () =>
        inTransaction(db, () => {
          const row = db
            .prepare('SELECT * FROM vict_agent_approval WHERE approval_id = ?;')
            .get(command.approvalId) as unknown as ApprovalRow | undefined;
          if (row === undefined) {
            throw new VictControlError(
              'VICT_CONTROL_APPROVAL_MISSING',
              'The approval record does not exist.',
            );
          }
          const current = rowToApproval(row);
          if (current.status === 'approved' || current.status === 'declined') {
            if (current.status === command.decision) {
              return current; // idempotent identical decision
            }
            throw new VictControlError(
              'VICT_CONTROL_APPROVAL_CONFLICT',
              'A competing decision already stands; the first durable decision is the winner.',
            );
          }
          if (current.status === 'expired') {
            throw new VictControlError(
              'VICT_CONTROL_APPROVAL_EXPIRED',
              'The approval request expired and cannot be decided.',
            );
          }
          db.prepare(
            `UPDATE vict_agent_approval SET status = ?, decided_at = ?, approver_actor_id = ?, decision_reason = ?
             WHERE approval_id = ?;`,
          ).run(
            command.decision,
            toIso(command.decidedAt),
            command.approverActorId,
            command.decisionReason ?? row.decision_reason,
            command.approvalId,
          );
          const updated = db
            .prepare('SELECT * FROM vict_agent_approval WHERE approval_id = ?;')
            .get(command.approvalId) as unknown as ApprovalRow;
          return rowToApproval(updated);
        }),
      );
    },

    async expireApproval(command: {
      approvalId: string;
      at: number;
    }): Promise<AgentApprovalRecord> {
      return safeRun('approvals.expire', () =>
        inTransaction(db, () => {
          const row = db
            .prepare('SELECT * FROM vict_agent_approval WHERE approval_id = ?;')
            .get(command.approvalId) as unknown as ApprovalRow | undefined;
          if (row === undefined) {
            throw new VictControlError(
              'VICT_CONTROL_APPROVAL_MISSING',
              'The approval record does not exist.',
            );
          }
          const current = rowToApproval(row);
          if (current.status === 'expired') {
            return current; // idempotent
          }
          if (current.status !== 'pending') {
            throw new VictControlError(
              'VICT_CONTROL_APPROVAL_INVALID_STATE',
              'Only a pending approval can expire.',
            );
          }
          db.prepare(
            'UPDATE vict_agent_approval SET status = ?, decided_at = ? WHERE approval_id = ?;',
          ).run('expired', toIso(command.at), command.approvalId);
          return { ...current, status: 'expired' as const, decidedAt: command.at };
        }),
      );
    },
  };

  const streamLedger: AgentStreamLedgerStore = {
    async appendEvent(command: {
      streamId: string;
      kind: import('@victframework/contracts').AgentStreamEventKind;
      payload: string;
      at: number;
    }): Promise<{ seq: number; persisted: boolean }> {
      return safeRun('ledger.appendEvent', () =>
        inTransaction(db, () => {
          const current = db
            .prepare('SELECT last_seq FROM vict_agent_stream WHERE stream_id = ?;')
            .get(command.streamId) as { last_seq: number } | undefined;
          const next = (current?.last_seq ?? 0) + 1;
          // STORE-BOUNDARY SCHEMA GATE: the full vict.agent-stream@1 event is
          // validated BEFORE any sequence state or row is written. A rejected
          // write leaves the stream exactly as before (plain-JS callers
          // cannot bypass the schema through the raw ledger port).
          validateStreamLedgerAppend({
            streamId: command.streamId,
            kind: command.kind,
            payload: command.payload,
            assignedSeq: next,
          });
          if (current === undefined) {
            db.prepare('INSERT INTO vict_agent_stream (stream_id, last_seq) VALUES (?, 1);').run(
              command.streamId,
            );
          } else {
            db.prepare(
              'UPDATE vict_agent_stream SET last_seq = last_seq + 1 WHERE stream_id = ?;',
            ).run(command.streamId);
          }
          const persisted = isDurableStreamKind(command.kind);
          if (persisted) {
            db.prepare(
              `INSERT INTO vict_agent_stream_event (stream_id, seq, kind, payload, created_at)
               VALUES (?, ?, ?, ?, ?);`,
            ).run(command.streamId, next, command.kind, command.payload, toIso(command.at));
          }
          return { seq: next, persisted };
        }),
      );
    },

    async latestSeq(streamId: string): Promise<number> {
      return safeRun('ledger.latestSeq', () => {
        const row = db
          .prepare('SELECT last_seq FROM vict_agent_stream WHERE stream_id = ?;')
          .get(streamId) as { last_seq: number } | undefined;
        return row?.last_seq ?? 0;
      });
    },

    async listEventsFrom(
      streamId: string,
      afterSeq: number,
      limit?: number,
    ): Promise<readonly AgentStreamLedgerEvent[]> {
      return safeRun('ledger.listFrom', () => {
        const bounded =
          limit !== undefined && limit >= 0
            ? 'SELECT stream_id, seq, kind, payload, created_at FROM vict_agent_stream_event WHERE stream_id = ? AND seq > ? ORDER BY seq ASC LIMIT ?;'
            : 'SELECT stream_id, seq, kind, payload, created_at FROM vict_agent_stream_event WHERE stream_id = ? AND seq > ? ORDER BY seq ASC;';
        const rows = (limit !== undefined && limit >= 0
          ? db.prepare(bounded).all(streamId, afterSeq, limit)
          : db.prepare(bounded).all(streamId, afterSeq)) as unknown as StreamEventRow[];
        // Rows are validated against their declared kind on READ too: a
        // corrupted or foreign row fails closed instead of crossing the
        // boundary.
        return rows.map((row) => {
          const event = rowToLedgerEvent(row);
          validateStreamLedgerAppend({
            streamId: event.streamId,
            kind: event.kind,
            payload: event.payload,
            assignedSeq: event.seq,
          });
          return event;
        });
      });
    },

    async listStreamIds(): Promise<readonly string[]> {
      return safeRun('ledger.listStreams', () => {
        const rows = db
          .prepare('SELECT stream_id FROM vict_agent_stream ORDER BY stream_id ASC;')
          .all() as unknown as { stream_id: string }[];
        return rows.map((row) => row.stream_id);
      });
    },
  };

  const commandIdempotency: CommandIdempotencyStore = {
    async claimReceipt(record: CommandIdempotencyReceipt): Promise<'claimed' | 'exists'> {
      return safeRun('idempotency.claim', () =>
        inTransaction(db, () => {
          const existing = db
            .prepare(
              'SELECT * FROM vict_command_idempotency WHERE actor_id = ? AND command = ? AND idempotency_key = ?;',
            )
            .get(record.actorId, record.command, record.idempotencyKey) as
            IdempotencyRow | undefined;
          if (existing !== undefined) {
            return 'exists' as const;
          }
          db.prepare(
            `INSERT INTO vict_command_idempotency
              (actor_id, command, idempotency_key, request_digest, status, response_code, result_json, created_at, settled_at, owner, lease_until, attempts, fence_token)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          ).run(
            record.actorId,
            record.command,
            record.idempotencyKey,
            record.requestDigest,
            record.status,
            record.responseCode ?? null,
            record.resultJson ?? null,
            toIso(record.createdAt),
            record.settledAt === undefined ? null : toIso(record.settledAt),
            record.owner ?? null,
            record.leaseUntil === undefined ? null : toIso(record.leaseUntil),
            record.attempts,
            record.fenceToken ?? null,
          );
          return 'claimed' as const;
        }),
      );
    },

    async getReceipt(name: CommandIdempotencyName): Promise<CommandIdempotencyReceipt | undefined> {
      return safeRun('idempotency.get', () => {
        const row = db
          .prepare(
            'SELECT * FROM vict_command_idempotency WHERE actor_id = ? AND command = ? AND idempotency_key = ?;',
          )
          .get(name.actorId, name.command, name.idempotencyKey) as IdempotencyRow | undefined;
        if (row === undefined) {
          return undefined;
        }
        return rowToIdempotencyReceipt(row);
      });
    },

    async findReceiptByActorKey(input: {
      actorId: string;
      idempotencyKey: string;
    }): Promise<CommandIdempotencyReceipt | undefined> {
      return safeRun('idempotency.findByActorKey', () => {
        const row = db
          .prepare(
            'SELECT * FROM vict_command_idempotency WHERE actor_id = ? AND idempotency_key = ? LIMIT 1;',
          )
          .get(input.actorId, input.idempotencyKey) as IdempotencyRow | undefined;
        return row === undefined ? undefined : rowToIdempotencyReceipt(row);
      });
    },

    async completeReceipt(input: {
      actorId: string;
      command: string;
      idempotencyKey: string;
      resultJson: string;
      at: number;
      fenceToken: string;
    }): Promise<void> {
      safeRun('idempotency.complete', () =>
        inTransaction(db, () => {
          const row = db
            .prepare(
              'SELECT * FROM vict_command_idempotency WHERE actor_id = ? AND command = ? AND idempotency_key = ?;',
            )
            .get(input.actorId, input.command, input.idempotencyKey) as IdempotencyRow | undefined;
          if (row === undefined) {
            throw new VictControlError(
              'VICT_IDEMPOTENCY_RECEIPT_MISSING',
              'No idempotency receipt exists for this key namespace.',
            );
          }
          // FENCED settlement, compared and mutated in ONE transaction: a
          // stale owner's token never settles the current claim generation.
          if (row.status !== 'pending') {
            throw new VictControlError(
              VICT_IDEMPOTENCY_FENCE_CONFLICT,
              'VICT_IDEMPOTENCY_FENCE_CONFLICT: the idempotency claim is no longer pending; the presented fence token does not own it.',
            );
          }
          if ((row.fence_token ?? null) !== input.fenceToken) {
            throw new VictControlError(
              VICT_IDEMPOTENCY_FENCE_CONFLICT,
              'VICT_IDEMPOTENCY_FENCE_CONFLICT: the settlement fence token does not match the current claim generation; the claim is untouched.',
            );
          }
          db.prepare(
            "UPDATE vict_command_idempotency SET status = 'completed', result_json = ?, settled_at = ?, owner = NULL, lease_until = NULL, fence_token = NULL WHERE actor_id = ? AND command = ? AND idempotency_key = ?;",
          ).run(
            input.resultJson,
            toIso(input.at),
            input.actorId,
            input.command,
            input.idempotencyKey,
          );
        }),
      );
    },

    async failReceipt(input: {
      actorId: string;
      command: string;
      idempotencyKey: string;
      responseCode: string;
      at: number;
      fenceToken: string;
    }): Promise<void> {
      safeRun('idempotency.fail', () =>
        inTransaction(db, () => {
          const row = db
            .prepare(
              'SELECT * FROM vict_command_idempotency WHERE actor_id = ? AND command = ? AND idempotency_key = ?;',
            )
            .get(input.actorId, input.command, input.idempotencyKey) as IdempotencyRow | undefined;
          if (row === undefined) {
            throw new VictControlError(
              'VICT_IDEMPOTENCY_RECEIPT_MISSING',
              'No idempotency receipt exists for this key namespace.',
            );
          }
          // FENCED settlement, compared and mutated in ONE transaction.
          if (row.status !== 'pending') {
            throw new VictControlError(
              VICT_IDEMPOTENCY_FENCE_CONFLICT,
              'VICT_IDEMPOTENCY_FENCE_CONFLICT: the idempotency claim is no longer pending; the presented fence token does not own it.',
            );
          }
          if ((row.fence_token ?? null) !== input.fenceToken) {
            throw new VictControlError(
              VICT_IDEMPOTENCY_FENCE_CONFLICT,
              'VICT_IDEMPOTENCY_FENCE_CONFLICT: the settlement fence token does not match the current claim generation; the claim is untouched.',
            );
          }
          db.prepare(
            "UPDATE vict_command_idempotency SET status = 'failed', response_code = ?, settled_at = ?, owner = NULL, lease_until = NULL, fence_token = NULL WHERE actor_id = ? AND command = ? AND idempotency_key = ?;",
          ).run(
            input.responseCode,
            toIso(input.at),
            input.actorId,
            input.command,
            input.idempotencyKey,
          );
        }),
      );
    },

    async releaseReceipt(input: {
      actorId: string;
      command: string;
      idempotencyKey: string;
      at: number;
      fenceToken: string;
    }): Promise<void> {
      safeRun('idempotency.release', () =>
        inTransaction(db, () => {
          // FENCED release, compared and deleted in ONE transaction: only
          // the current claim generation may release the claim; a stale
          // owner receives a stable conflict and the live claim survives
          // byte-identically. A RETRYABLE infrastructure failure must not
          // be permanently confused with a deterministic command failure:
          // the pending claim is removed so a retry can re-execute
          // truthfully.
          const row = db
            .prepare(
              'SELECT * FROM vict_command_idempotency WHERE actor_id = ? AND command = ? AND idempotency_key = ?;',
            )
            .get(input.actorId, input.command, input.idempotencyKey) as IdempotencyRow | undefined;
          if (row === undefined) {
            return;
          }
          if (row.status !== 'pending' || (row.fence_token ?? null) !== input.fenceToken) {
            throw new VictControlError(
              VICT_IDEMPOTENCY_FENCE_CONFLICT,
              'VICT_IDEMPOTENCY_FENCE_CONFLICT: the settlement fence token does not match the current claim generation; the claim is untouched.',
            );
          }
          db.prepare(
            "DELETE FROM vict_command_idempotency WHERE actor_id = ? AND command = ? AND idempotency_key = ? AND status = 'pending';",
          ).run(input.actorId, input.command, input.idempotencyKey);
        }),
      );
    },

    async takeOverExpiredLease(input: {
      actorId: string;
      command: string;
      idempotencyKey: string;
      owner: string;
      leaseUntil: number;
      at: number;
    }): Promise<CommandIdempotencyLeaseTakeover> {
      return safeRun('idempotency.leaseTakeover', () =>
        inTransaction(db, () => {
          const row = db
            .prepare(
              'SELECT * FROM vict_command_idempotency WHERE actor_id = ? AND command = ? AND idempotency_key = ?;',
            )
            .get(input.actorId, input.command, input.idempotencyKey) as IdempotencyRow | undefined;
          if (row === undefined) {
            return { outcome: 'missing' } as const;
          }
          if (row.status !== 'pending') {
            return { outcome: 'not-expired' } as const; // settled: replay path handles it
          }
          const leaseUntil = optionalIso(row.lease_until) ?? 0;
          if (leaseUntil > input.at) {
            return { outcome: 'not-expired' } as const; // the previous owner may still run
          }
          // A takeover ALWAYS issues a NEW settlement fence token (the old
          // owner's generation becomes stale).
          const attempts = row.attempts + 1;
          const fenceToken = commandIdempotencyFenceToken({
            actorId: input.actorId,
            command: input.command,
            idempotencyKey: input.idempotencyKey,
            owner: input.owner,
            attempts,
          });
          db.prepare(
            'UPDATE vict_command_idempotency SET owner = ?, lease_until = ?, attempts = ?, fence_token = ? WHERE actor_id = ? AND command = ? AND idempotency_key = ?;',
          ).run(
            input.owner,
            toIso(input.leaseUntil),
            attempts,
            fenceToken,
            input.actorId,
            input.command,
            input.idempotencyKey,
          );
          return { outcome: 'taken', fenceToken } as const;
        }),
      );
    },
  };

  return {
    actors,
    control,
    turns,
    invocations,
    approvals,
    streamLedger,
    commandIdempotency,
    close(): void {
      handle.close();
    },
  };
}

/**
 * The actor directory is a small mutable registry; the SQLite actor table
 * exists for restart-safe local compositions, while the shipped conformance
 * and product compositions use the neutral in-memory directory seeded from
 * operator configuration (actor changes are administrative, audited, and
 * rare). The fallback reuses the neutral in-memory implementation.
 */
class InMemoryActorDirectoryFallback extends InMemoryActorDirectory {}

/** Unused-import guards for optional neutral integrations. */
export type SqliteAgentGovernanceStoreAlias = AgentGovernanceStore;
export type SqliteAgentActivationRecord = AgentActivationRecord;
export type SqliteAgentDeletionStep = AgentDeletionStep;
export const __agentControlGuards = {
  validateAgentActivationRecord,
  assertDeletionReceiptStep,
};
