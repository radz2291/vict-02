import type {
  BranchResultRecord,
  DurableAttemptState,
  DurableTokenState,
  DurableWaitState,
  OutputSummary,
} from '@vict/kernel';
import type { VictError } from '@vict/contracts';
import type {
  ApplyCancellationCommand,
  ClaimDueTimersCommand,
  ClaimDueTimersResult,
  ClaimedAttempt,
  ClaimReadyTokenCommand,
  ClaimReadyTokenResult,
  CompleteAttemptCommand,
  CompleteAttemptResult,
  CreateOrchestrationRunCommand,
  DueTimerRecord,
  OrchestrationEventInput,
  OrchestrationFaultHooks,
  OrchestrationRunQuery,
  OrchestrationSnapshotView,
  OrchestrationStore,
  RecoverableClaim,
  RecoverAttemptCommand,
  RecoverOrchestrationCommand,
  CancellationResult,
  RequestCancellationCommand,
  ResolveBlockedCommand,
  ResolveBlockedResult,
  ResolveDueTimerCommand,
  ResolveDueTimerResult,
  SignalDeliveryResult,
  SignalWaitCommand,
  StoredOrchestrationRun,
  TimerRecord,
} from '@vict/runtime';
import {
  canonicalJoinOutput,
  canTransitionAttempt,
  canTransitionRun,
  canTransitionToken,
  type KernelEvent,
} from '@vict/kernel';
import {
  RUN_EVENT_SCHEMA,
  VictStoreError,
  assertEventMatchesRun,
  canonicalPersistedValue,
  toCanonicalJson,
} from '@vict/runtime';
import { inTransaction, safeRun } from './driver.js';
import type { OpenDatabase } from './driver.js';

/**
 * SQLite implementation of the Stage 03 durable orchestration store port.
 *
 * Semantics mirror the in-memory adapter exactly (shared conformance suite):
 * every command is one IMMEDIATE transaction, guarded by optimistic
 * revisions (run record revision, token revision, wait revision, attempt
 * fence, timer revision) and by caller-supplied idempotency deduplication
 * (signal receipts, cancellation requests, operator resolutions).
 *
 * - Timestamps persist as ISO-8601 UTC strings; public records carry epoch
 *   milliseconds.
 * - Ready-work selection is deterministic: creation instant, then token id.
 * - Due-timer selection is deterministic: due time, then timer id. Database
 *   row order is never the scheduler order.
 * - The private operational checkpoint payload rides in `vict_token.checkpoint`
 *   and branch outputs in `vict_branch_result.output`; both are stripped from
 *   every public read model. Terminal cleanup tombstones them to NULL.
 */

const TOKEN_STATUSES = ['ready', 'claimed', 'waiting', 'completed', 'joined', 'cancelled', 'blocked'] as const;
const ATTEMPT_STATES = ['ready', 'claimed', 'started', 'completed', 'failed', 'timed_out', 'cancelled', 'outcome_unknown'] as const;
const EFFECT_CLASSES = ['pure', 'read', 'write', 'irreversible'] as const;
const RUN_STATUSES = ['running', 'waiting', 'blocked', 'completed', 'failed', 'cancelled'] as const;

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

function fromIso(value: string | null, context: string, runId?: string): number | null {
  if (value === null) {
    return null;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new VictStoreError(
      'VICT_STORE_INVALID_RECORD',
      'A stored timestamp is not a valid ISO-8601 instant.',
      { operation: context, runId },
    );
  }
  return parsed;
}

function requireIso(value: string | null, context: string, runId?: string): number {
  const parsed = fromIso(value, context, runId);
  if (parsed === null) {
    throw new VictStoreError('VICT_STORE_INVALID_RECORD', 'A required timestamp is missing.', {
      operation: context,
      runId,
    });
  }
  return parsed;
}

interface RunRow {
  run_id: string;
  graph_id: string;
  graph_version: string;
  capability_set_version: string;
  activation_version: string;
  status: string;
  mode: string;
  retention: string;
  steps: number;
  current_node_id: string | null;
  output_summary: string | null;
  output: string | null;
  error: string | null;
  record_revision: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

function validateRunRow(
  row: RunRow,
  cancellation: { requestId: string; reasonCode: string } | null,
): StoredOrchestrationRun {
  const context = 'orchestration.readRun';
  if (typeof row.run_id !== 'string' || typeof row.graph_id !== 'string') {
    throw new VictStoreError('VICT_STORE_INVALID_RECORD', 'A stored run row is incomplete.', {
      operation: context,
    });
  }
  if (!RUN_STATUSES.includes(row.status as (typeof RUN_STATUSES)[number])) {
    throw new VictStoreError('VICT_STORE_INVALID_RECORD', 'A stored run carries an unknown status.', {
      operation: context,
      runId: row.run_id,
    });
  }
  if (!Number.isInteger(row.record_revision) || row.record_revision < 1) {
    throw new VictStoreError(
      'VICT_STORE_INVALID_RECORD',
      'A stored run carries an invalid record revision.',
      { operation: context, runId: row.run_id },
    );
  }
  if (!Number.isInteger(row.steps) || row.steps < 0) {
    throw new VictStoreError('VICT_STORE_INVALID_RECORD', 'A stored run carries an invalid step count.', {
      operation: context,
      runId: row.run_id,
    });
  }
  return {
    runId: row.run_id,
    graphId: row.graph_id,
    graphVersion: row.graph_version,
    capabilitySetVersion: row.capability_set_version,
    activationVersion: row.activation_version,
    status: row.status as StoredOrchestrationRun['status'],
    mode: row.mode as StoredOrchestrationRun['mode'],
    retention: row.retention as StoredOrchestrationRun['retention'],
    steps: row.steps,
    currentNodeId: row.current_node_id,
    recordRevision: row.record_revision,
    cancellation,
    createdAt: requireIso(row.created_at, context, row.run_id),
    updatedAt: requireIso(row.updated_at, context, row.run_id),
    completedAt: fromIso(row.completed_at, context, row.run_id),
    ...(row.output_summary !== null
      ? { outputSummary: parseJson(row.output_summary, context, row.run_id) as OutputSummary }
      : {}),
    ...(row.output !== null ? { output: parseJson(row.output, context, row.run_id) } : {}),
    ...(row.error !== null ? { error: parseJson(row.error, context, row.run_id) as VictError } : {}),
  };
}

interface TokenRow {
  token_id: string;
  run_id: string;
  activation_version: string;
  node_id: string;
  status: string;
  parent_token_id: string | null;
  lineage: string | null;
  fork_id: string | null;
  branch_key: string | null;
  revision: number;
  checkpoint: string | null;
  created_at: string;
  updated_at: string;
}

function validateTokenRow(row: TokenRow, context: string): DurableTokenState {
  if (!TOKEN_STATUSES.includes(row.status as (typeof TOKEN_STATUSES)[number])) {
    throw new VictStoreError('VICT_STORE_INVALID_RECORD', 'A stored token carries an unknown status.', {
      operation: context,
      runId: row.run_id,
      tokenId: row.token_id,
    });
  }
  if (!Number.isInteger(row.revision) || row.revision < 1) {
    throw new VictStoreError('VICT_STORE_INVALID_RECORD', 'A stored token carries an invalid revision.', {
      operation: context,
      tokenId: row.token_id,
    });
  }
  return {
    tokenId: row.token_id,
    runId: row.run_id,
    activationVersion: row.activation_version,
    nodeId: row.node_id,
    status: row.status as DurableTokenState['status'],
    parentTokenId: row.parent_token_id,
    lineage: row.lineage ?? '',
    forkId: row.fork_id,
    branchKey: row.branch_key,
    revision: row.revision,
    createdAt: requireIso(row.created_at, context, row.run_id),
    updatedAt: requireIso(row.updated_at, context, row.run_id),
  };
}

interface AttemptRow {
  attempt_id: string;
  invocation_id: string;
  run_id: string;
  token_id: string;
  node_id: string;
  capability_id: string;
  attempt_number: number;
  effect_class: string;
  idempotency_key: string | null;
  state: string;
  owner_id: string | null;
  lease_expires_at: string | null;
  deadline_at: string | null;
  fence: number;
  retry_due_at: string | null;
  created_at: string;
  updated_at: string;
}

function validateAttemptRow(row: AttemptRow, context: string): DurableAttemptState {
  if (!ATTEMPT_STATES.includes(row.state as (typeof ATTEMPT_STATES)[number])) {
    throw new VictStoreError('VICT_STORE_INVALID_RECORD', 'A stored attempt carries an unknown state.', {
      operation: context,
      runId: row.run_id,
      attemptId: row.attempt_id,
    });
  }
  if (!EFFECT_CLASSES.includes(row.effect_class as (typeof EFFECT_CLASSES)[number])) {
    throw new VictStoreError(
      'VICT_STORE_INVALID_RECORD',
      'A stored attempt carries an unknown effect class.',
      { operation: context, attemptId: row.attempt_id },
    );
  }
  return {
    attemptId: row.attempt_id,
    invocationId: row.invocation_id,
    runId: row.run_id,
    tokenId: row.token_id,
    nodeId: row.node_id,
    capabilityId: row.capability_id,
    attemptNumber: row.attempt_number,
    effectClass: row.effect_class as DurableAttemptState['effectClass'],
    idempotencyKey: row.idempotency_key,
    state: row.state as DurableAttemptState['state'],
    ownerId: row.owner_id,
    leaseExpiresAt: fromIso(row.lease_expires_at, context, row.run_id),
    deadlineAt: fromIso(row.deadline_at, context, row.run_id),
    fence: row.fence,
    retryDueAt: fromIso(row.retry_due_at, context, row.run_id),
    createdAt: requireIso(row.created_at, context, row.run_id),
    updatedAt: requireIso(row.updated_at, context, row.run_id),
  };
}

interface WaitRow {
  wait_id: string;
  run_id: string;
  token_id: string;
  node_id: string;
  activation_version: string;
  kind: string;
  signal_name: string | null;
  contract_id: string | null;
  contract_revision: string | null;
  due_at: string | null;
  timeout_at: string | null;
  status: string;
  revision: number;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

function validateWaitRow(row: WaitRow, context: string): DurableWaitState {
  if (!['open', 'resolved', 'cancelled'].includes(row.status)) {
    throw new VictStoreError('VICT_STORE_INVALID_RECORD', 'A stored wait carries an unknown status.', {
      operation: context,
      runId: row.run_id,
      waitId: row.wait_id,
    });
  }
  return {
    waitId: row.wait_id,
    runId: row.run_id,
    tokenId: row.token_id,
    nodeId: row.node_id,
    activationVersion: row.activation_version,
    kind: row.kind as DurableWaitState['kind'],
    signalName: row.signal_name,
    contractId: row.contract_id,
    contractRevision: row.contract_revision,
    dueAt: fromIso(row.due_at, context, row.run_id),
    timeoutAt: fromIso(row.timeout_at, context, row.run_id),
    status: row.status as DurableWaitState['status'],
    revision: row.revision,
    createdAt: requireIso(row.created_at, context, row.run_id),
    resolvedAt: fromIso(row.resolved_at, context, row.run_id),
    resolvedBy: row.resolved_by,
  };
}

interface TimerRow {
  timer_id: string;
  run_id: string;
  kind: string;
  wait_id: string | null;
  attempt_id: string | null;
  token_id: string | null;
  due_at: string;
  status: string;
  owner_id: string | null;
  lease_expires_at: string | null;
  revision: number;
  created_at: string;
}

function validateTimerRow(row: TimerRow, context: string): TimerRecord {
  if (!['scheduled', 'firing', 'fired', 'cancelled'].includes(row.status)) {
    throw new VictStoreError('VICT_STORE_INVALID_RECORD', 'A stored timer carries an unknown status.', {
      operation: context,
      runId: row.run_id,
      timerId: row.timer_id,
    });
  }
  return {
    timerId: row.timer_id,
    runId: row.run_id,
    kind: row.kind as TimerRecord['kind'],
    waitId: row.wait_id,
    attemptId: row.attempt_id,
    tokenId: row.token_id,
    dueAt: requireIso(row.due_at, context, row.run_id),
    status: row.status as TimerRecord['status'],
    ownerId: row.owner_id,
    leaseExpiresAt: fromIso(row.lease_expires_at, context, row.run_id),
    revision: row.revision,
    createdAt: requireIso(row.created_at, context, row.run_id),
  };
}

function parseJson(text: string, context: string, runId?: string): unknown {
  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new VictStoreError(
      'VICT_STORE_INVALID_RECORD',
      'A stored private operational payload is not valid JSON.',
      { operation: 'orchestration.readPrivatePayload', runId },
      cause,
    );
  }
}

function immutable<T>(value: T) {
  if (value !== null && typeof value === 'object') {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      immutable((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

/** Create the SQLite orchestration store over an opened database handle. */
export function createSqliteOrchestrationStore(
  handle: OpenDatabase,
  faults?: OrchestrationFaultHooks,
): OrchestrationStore {
  const { db } = handle;

  const runRow = (runId: string): RunRow | undefined =>
    db.prepare('SELECT * FROM vict_run WHERE run_id = ?;').get(runId) as RunRow | undefined;

  const cancellationOf = (runId: string): { requestId: string; reasonCode: string } | null => {
    const row = db
      .prepare(
        'SELECT request_id, reason_code FROM vict_cancellation_request WHERE run_id = ? ORDER BY created_at DESC, request_id DESC LIMIT 1;',
      )
      .get(runId) as { request_id: string; reason_code: string } | undefined;
    return row ? { requestId: row.request_id, reasonCode: row.reason_code } : null;
  };

  const readRun = (runId: string, context: string): StoredOrchestrationRun => {
    const row = runRow(runId);
    if (!row) {
      throw new VictStoreError('VICT_STORE_RUN_NOT_FOUND', 'Run not found.', { operation: context, runId });
    }
    return validateRunRow(row, cancellationOf(runId));
  };

  const nextEventSeqOf = (runId: string): number => {
    const row = db
      .prepare('SELECT COALESCE(MAX(seq), -1) AS maxSeq FROM vict_run_event WHERE run_id = ?;')
      .get(runId) as { maxSeq: number };
    return row.maxSeq + 1;
  };

  const insertEvent = (event: KernelEvent, run: RunRow): void => {
    if (!event || typeof event.type !== 'string' || !Number.isInteger(event.seq) || event.seq < 0) {
      throw new VictStoreError(
        'VICT_STORE_EVENT_SEQUENCE_CONFLICT',
        'An event requires a non-negative integer sequence number and a string type.',
        { operation: 'orchestration.appendEvents', runId: run.run_id },
      );
    }
    assertEventMatchesRun(event, {
      runId: run.run_id,
      graphId: run.graph_id,
      graphVersion: run.graph_version,
      capabilitySetVersion: run.capability_set_version,
      activationVersion: run.activation_version,
    });
    db.prepare(
      `INSERT INTO vict_run_event
        (run_id, seq, event_schema, type, graph_id, graph_version, capability_set_version, activation_version, node_id, capability_id, payload, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    ).run(
      event.runId,
      event.seq,
      RUN_EVENT_SCHEMA,
      event.type,
      event.graphId,
      event.graphVersion,
      event.capabilitySetVersion,
      event.activationVersion,
      'nodeId' in event ? ((event as { nodeId?: string }).nodeId ?? null) : null,
      'capabilityId' in event ? ((event as { capabilityId?: string }).capabilityId ?? null) : null,
      toCanonicalJson(event),
      toIso(event.timestamp),
    );
  };

  /** Append an ordered safe-event batch with dense sequence numbers. Returns the next sequence. */
  const appendEvents = (runId: string, events: readonly OrchestrationEventInput[]): number => {
    const run = runRow(runId) as RunRow;
    let seq = nextEventSeqOf(runId);
    for (const event of events) {
      insertEvent({ ...event, seq } as KernelEvent, run);
      seq += 1;
    }
    return seq;
  };

  const stageCheckpoint = (runId: string, tokenId: string, payload: unknown): void => {
    // Private operational boundary: validate against the persisted-value
    // domain and canonicalize before it becomes durable.
    const validated = canonicalPersistedValue(payload);
    const updated = db
      .prepare('UPDATE vict_token SET checkpoint = ?, updated_at = ? WHERE token_id = ? AND run_id = ?;')
      .run(toCanonicalJson(validated), toIso(Date.now()), tokenId, runId);
    if (updated.changes !== 1) {
      throw new VictStoreError('VICT_STORE_INVALID_COMMAND', 'A checkpoint references an unknown token.', {
        operation: 'orchestration.checkpoint',
        runId,
        tokenId,
      });
    }
  };

  const tombstoneCheckpoints = (tokenIds: readonly string[]): void => {
    const update = db.prepare('UPDATE vict_token SET checkpoint = NULL WHERE token_id = ?;');
    for (const tokenId of tokenIds) {
      update.run(tokenId);
    }
  };

  const store: OrchestrationStore = {
    async createOrchestrationRun(command): Promise<StoredOrchestrationRun> {
      return safeRun('orchestration.createRun', () =>
        inTransaction(db, () => {
          const existing = db.prepare('SELECT run_id FROM vict_run WHERE run_id = ?;').get(command.runId);
          if (existing) {
            throw new VictStoreError('VICT_STORE_RUN_CONFLICT', 'A run with this id already exists.', {
              operation: 'orchestration.createRun',
              runId: command.runId,
            });
          }
          try {
            db.prepare(
              `INSERT INTO vict_run
                (run_id, graph_id, graph_version, capability_set_version, activation_version, status, mode, retention,
                 steps, current_node_id, record_revision, created_at, updated_at, completed_at)
              VALUES (?, ?, ?, ?, ?, 'running', ?, ?, 0, ?, 1, ?, ?, NULL);`,
            ).run(
              command.runId,
              command.graphId,
              command.graphVersion,
              command.capabilitySetVersion,
              command.activationVersion,
              command.mode,
              command.retention,
              command.entryNodeId,
              toIso(command.now),
              toIso(command.now),
            );
            db.prepare(
              `INSERT INTO vict_token
                (token_id, run_id, activation_version, node_id, status, parent_token_id, lineage, fork_id, branch_key, revision, checkpoint, created_at, updated_at)
              VALUES (?, ?, ?, ?, 'ready', NULL, '', NULL, NULL, 1, ?, ?, ?);`,
            ).run(
              command.rootTokenId,
              command.runId,
              command.activationVersion,
              command.entryNodeId,
              toCanonicalJson(canonicalPersistedValue(command.checkpoint)),
              toIso(command.now),
              toIso(command.now),
            );
          } catch (cause) {
            throw new VictStoreError(
              'VICT_STORE_INVALID_COMMAND',
              'The orchestration run could not be created.',
              { operation: 'orchestration.createRun', runId: command.runId },
              cause,
            );
          }
          faults?.afterStateStage?.('orchestration.createRun');
          const row = runRow(command.runId) as RunRow;
          insertEvents(row, command.events);
          faults?.beforeCommit?.('orchestration.createRun');
          return readRun(command.runId, 'orchestration.createRun');
        }),
      );
    },

    async getOrchestrationRun(runId) {
      return safeRun('orchestration.getRun', () => {
        const row = runRow(runId);
        return row ? validateRunRow(row, cancellationOf(runId)) : undefined;
      });
    },

    async listOrchestrationRuns(query: OrchestrationRunQuery = {}) {
      return safeRun('orchestration.listRuns', () => {
        const clauses: string[] = [];
        const params: string[] = [];
        if (query.graphId !== undefined) {
          clauses.push('graph_id = ?');
          params.push(query.graphId);
        }
        if (query.activationVersion !== undefined) {
          clauses.push('activation_version = ?');
          params.push(query.activationVersion);
        }
        if (query.status !== undefined) {
          clauses.push('status = ?');
          params.push(query.status);
        }
        const limit = query.limit !== undefined ? ` LIMIT ${Math.max(0, Math.floor(query.limit))}` : '';
        const where = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '';
        const rows = db
          .prepare(`SELECT * FROM vict_run${where} ORDER BY created_at ASC, run_id ASC${limit};`)
          .all(...params) as unknown as RunRow[];
        return rows.map((row) => validateRunRow(row, cancellationOf(row.run_id)));
      });
    },

    async getOrchestrationSnapshot(runId): Promise<OrchestrationSnapshotView | undefined> {
      return safeRun('orchestration.getSnapshot', () => {
        const row = runRow(runId);
        if (!row) {
          return undefined;
        }
        const context = 'orchestration.readSnapshot';
        const tokens = (
          db.prepare('SELECT * FROM vict_token WHERE run_id = ? ORDER BY created_at ASC, token_id ASC;').all(runId) as unknown as TokenRow[]
        ).map((tokenRow) => validateTokenRow(tokenRow, context));
        const attempts = (
          db.prepare('SELECT * FROM vict_attempt WHERE run_id = ? ORDER BY created_at ASC;').all(runId) as unknown as AttemptRow[]
        ).map((attemptRow) => validateAttemptRow(attemptRow, context));
        const waits = (
          db.prepare('SELECT * FROM vict_wait WHERE run_id = ? ORDER BY created_at ASC;').all(runId) as unknown as WaitRow[]
        ).map((waitRow) => validateWaitRow(waitRow, context));
        const timers = (
          db.prepare('SELECT * FROM vict_timer WHERE run_id = ? ORDER BY created_at ASC;').all(runId) as unknown as TimerRow[]
        ).map((timerRow) => validateTimerRow(timerRow, context));
        const branchRows = db
          .prepare('SELECT * FROM vict_branch_result WHERE run_id = ? ORDER BY fork_id ASC, branch_key ASC;')
          .all(runId) as unknown as {
          run_id: string;
          fork_id: string;
          join_id: string;
          branch_key: string;
          token_id: string;
          failed: number;
          output: string | null;
          created_at: string;
        }[];
        const branchResults: BranchResultRecord[] = branchRows.map((row) => ({
          runId: row.run_id,
          forkId: row.fork_id,
          joinId: row.join_id,
          branchKey: row.branch_key,
          tokenId: row.token_id,
          failed: row.failed === 1,
          createdAt: requireIso(row.created_at, context, runId),
        }));
        const branchOutputs: Record<string, Record<string, unknown>> = {};
        for (const row of branchRows) {
          if (row.output !== null) {
            (branchOutputs[row.fork_id] ??= {})[row.branch_key] = parseJson(row.output, context, runId);
          }
        }
        return {
          run: validateRunRow(row, cancellationOf(runId)),
          tokens,
          attempts,
          waits,
          timers,
          branchResults,
          branchOutputs,
          nextEventSeq: nextEventSeqOf(runId),
        };
      });
    },

    async claimReadyToken(command: ClaimReadyTokenCommand): Promise<ClaimReadyTokenResult> {
      return safeRun('orchestration.claimReadyToken', () =>
        inTransaction(db, () => {
          const row = runRow(command.runId);
          if (!row) {
            throw new VictStoreError('VICT_STORE_RUN_NOT_FOUND', 'Run not found.', {
              operation: 'orchestration.claimReadyToken',
              runId: command.runId,
            });
          }
          if (row.status !== 'running' && row.status !== 'waiting') {
            return { claimed: false as const, reason: row.status === 'blocked' ? ('quiescent' as const) : ('terminal' as const) };
          }
          const cancellation = db
            .prepare('SELECT request_id FROM vict_cancellation_request WHERE run_id = ? LIMIT 1;')
            .get(command.runId);
          if (cancellation) {
            return { claimed: false as const, reason: 'cancelled' as const };
          }
          const tokenRow = db
            .prepare(
              "SELECT * FROM vict_token WHERE run_id = ? AND status = 'ready' ORDER BY created_at ASC, token_id ASC LIMIT 1;",
            )
            .get(command.runId) as unknown as TokenRow | undefined;
          if (!tokenRow) {
            return { claimed: false as const, reason: 'quiescent' as const };
          }
          const token = validateTokenRow(tokenRow, 'orchestration.claimReadyToken');
          if (!canTransitionToken(token.status, 'claimed')) {
            return { claimed: false as const, reason: 'conflict' as const };
          }
          const plan = command.planner.planFor(token);
          const invocationId = command.planner.invocationIdFor(token);
          const priorCount = (
            db.prepare('SELECT COUNT(*) AS c FROM vict_attempt WHERE invocation_id = ?;').get(invocationId) as {
              c: number;
            }
          ).c;
          const attemptNumber = priorCount + 1;
          const attemptId = command.planner.attemptIdFor(token, attemptNumber);
          const checkpointText = tokenRow.checkpoint;
          const checkpoint = checkpointText === null ? undefined : parseJson(checkpointText, "orchestration.claimReadyToken", command.runId);

          // Claim + attempt intent + node.started: one atomic transition.
          db.prepare(
            "UPDATE vict_token SET status = 'claimed', revision = revision + 1, updated_at = ? WHERE token_id = ? AND revision = ?;",
          ).run(toIso(command.now), token.tokenId, token.revision);
          db.prepare(
            `INSERT INTO vict_attempt
              (attempt_id, invocation_id, run_id, token_id, node_id, capability_id, attempt_number, effect_class,
               idempotency_key, state, owner_id, lease_expires_at, deadline_at, fence, retry_due_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'started', ?, ?, ?, ?, NULL, ?, ?);`,
          ).run(
            attemptId,
            invocationId,
            command.runId,
            token.tokenId,
            token.nodeId,
            plan.capabilityId,
            attemptNumber,
            plan.effectClass,
            plan.idempotencyKey,
            command.ownerId,
            toIso(command.leaseExpiresAt),
            plan.deadlineAt === null ? null : toIso(plan.deadlineAt),
            attemptNumber,
            toIso(command.now),
            toIso(command.now),
          );
          db.prepare(
            "UPDATE vict_run SET status = 'running', steps = steps + 1, current_node_id = ?, record_revision = record_revision + 1, updated_at = ? WHERE run_id = ?;",
          ).run(token.nodeId, toIso(command.now), command.runId);
          const updatedRun = runRow(command.runId) as RunRow;
          const seq = nextEventSeqOf(command.runId);
          insertEvent(
            {
              type: 'node.started',
              seq,
              nodeId: token.nodeId,
              capabilityId: plan.capabilityId,
              runId: command.runId,
              graphId: row.graph_id,
              graphVersion: row.graph_version,
              capabilitySetVersion: row.capability_set_version,
              activationVersion: row.activation_version,
              timestamp: command.now,
            } as KernelEvent,
            row,
          );
          faults?.afterStateStage?.('orchestration.claimReadyToken');
          faults?.beforeCommit?.('orchestration.claimReadyToken');
          const claimed: ClaimedAttempt = {
            token,
            attempt: {
              attemptId,
              invocationId,
              runId: command.runId,
              tokenId: token.tokenId,
              nodeId: token.nodeId,
              capabilityId: plan.capabilityId,
              attemptNumber,
              effectClass: plan.effectClass,
              idempotencyKey: plan.idempotencyKey,
              state: 'started',
              ownerId: command.ownerId,
              leaseExpiresAt: command.leaseExpiresAt,
              deadlineAt: plan.deadlineAt,
              fence: attemptNumber,
              retryDueAt: null,
              createdAt: command.now,
              updatedAt: command.now,
            },
            invocationId,
            checkpoint,
            deadlineAt: plan.deadlineAt,
            idempotencyKey: plan.idempotencyKey,
            runRecordRevision: (runRow(command.runId) as RunRow).record_revision,
            runNextEventSeq: seq + 1,
          };
          return { claimed: true as const, claim: claimed };
        }),
      );
    },

    async completeAttempt(command): Promise<CompleteAttemptResult> {
      return safeRun('orchestration.completeAttempt', () =>
        inTransaction(db, () => {
          const run = runRow(command.runId);
          if (!run) {
            throw new VictStoreError('VICT_STORE_RUN_NOT_FOUND', 'Run not found.', {
              operation: 'orchestration.completeAttempt',
              runId: command.runId,
            });
          }
          const attemptRow = db
            .prepare('SELECT * FROM vict_attempt WHERE attempt_id = ?;')
            .get(command.attemptId) as unknown as AttemptRow | undefined;
          if (!attemptRow) {
            throw new VictStoreError('VICT_STORE_INVALID_COMMAND', 'Unknown attempt.', {
              operation: 'orchestration.completeAttempt',
              runId: command.runId,
              attemptId: command.attemptId,
            });
          }
          const attempt = validateAttemptRow(attemptRow, 'orchestration.completeAttempt');
          if (attempt.fence !== command.expectedAttemptFence || attempt.ownerId !== command.ownerId) {
            throw new VictStoreError(
              'VICT_STORE_ATTEMPT_FENCE_CONFLICT',
              'The attempt completion carries a stale owner or fence.',
              {
                operation: 'orchestration.completeAttempt',
                runId: command.runId,
                attemptId: command.attemptId,
                expectedFence: command.expectedAttemptFence,
                actualFence: attempt.fence,
              },
            );
          }
          const outcomeState =
            command.outcome.kind === 'completed'
              ? 'completed'
              : command.outcome.kind === 'failed'
                ? 'failed'
                : command.outcome.kind === 'timed_out'
                  ? 'timed_out'
                  : command.outcome.kind === 'cancelled'
                    ? 'cancelled'
                    : 'outcome_unknown';
          if (!canTransitionAttempt(attempt.state, outcomeState)) {
            throw new VictStoreError(
              'VICT_STORE_ATTEMPT_STATE_CONFLICT',
              `Attempt '${attempt.attemptId}' is in state '${attempt.state}' and cannot accept this outcome.`,
              {
                operation: 'orchestration.completeAttempt',
                runId: command.runId,
                attemptId: attempt.attemptId,
                state: attempt.state,
              },
            );
          }
          const tokenRow = db.prepare('SELECT * FROM vict_token WHERE token_id = ?;').get(attempt.tokenId) as unknown as
            TokenRow | undefined;
          if (!tokenRow) {
            throw new VictStoreError(
              'VICT_STORE_INVALID_COMMAND',
              'The attempt references an unknown token.',
              { operation: 'orchestration.completeAttempt', runId: command.runId, attemptId: attempt.attemptId },
            );
          }
          const token = validateTokenRow(tokenRow, 'orchestration.completeAttempt');
          if (command.run.status !== undefined && !canTransitionRun(run.status, command.run.status)) {
            throw new VictStoreError(
              'VICT_STORE_RUN_CONFLICT',
              `Run status '${run.status}' cannot transition to '${String(command.run.status)}'.`,
              { operation: 'orchestration.completeAttempt', runId: command.runId },
            );
          }

          const nowIso = toIso(command.now);
          let joinFired = false;
          const continuation = command.continuation;

          // 1. Attempt outcome.
          db.prepare('UPDATE vict_attempt SET state = ?, updated_at = ? WHERE attempt_id = ?;').run(
            outcomeState,
            nowIso,
            attempt.attemptId,
          );

          // 2. Token movement.
          if (continuation.kind === 'advance') {
            db.prepare(
              "UPDATE vict_token SET node_id = ?, status = 'ready', revision = revision + 1, updated_at = ? WHERE token_id = ?;",
            ).run(continuation.toNodeId, nowIso, token.tokenId);
          } else if (continuation.kind === 'wait') {
            if (!canTransitionToken(token.status, 'waiting')) {
              throw new VictStoreError(
                'VICT_STORE_TOKEN_CONFLICT',
                `Token '${token.tokenId}' cannot wait from state '${token.status}'.`,
                { operation: 'orchestration.completeAttempt', runId: command.runId },
              );
            }
            const wait = continuation.wait;
            db.prepare(
              `INSERT INTO vict_wait
                (wait_id, run_id, token_id, node_id, activation_version, kind, signal_name, contract_id, contract_revision, due_at, timeout_at, status, revision, created_at, resolved_at, resolved_by)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', 1, ?, NULL, NULL);`,
            ).run(
              wait.waitId,
              command.runId,
              token.tokenId,
              token.nodeId,
              run.activation_version,
              wait.kind,
              wait.signalName,
              wait.contractId,
              wait.contractRevision,
              wait.dueAt === null ? null : toIso(wait.dueAt),
              wait.timeoutAt === null ? null : toIso(wait.timeoutAt),
              nowIso,
            );
            if (wait.dueAt !== null) {
              db.prepare(
                `INSERT INTO vict_timer (timer_id, run_id, kind, wait_id, attempt_id, token_id, due_at, status, owner_id, lease_expires_at, revision, created_at)
                 VALUES (?, ?, 'wait', ?, NULL, ?, ?, 'scheduled', NULL, NULL, 1, ?);`,
              ).run(`timer_${wait.waitId}`, command.runId, wait.waitId, token.tokenId, toIso(wait.dueAt), nowIso);
            }
            if (wait.timeoutAt !== null) {
              db.prepare(
                `INSERT INTO vict_timer (timer_id, run_id, kind, wait_id, attempt_id, token_id, due_at, status, owner_id, lease_expires_at, revision, created_at)
                 VALUES (?, ?, 'wait-timeout', ?, NULL, ?, ?, 'scheduled', NULL, NULL, 1, ?);`,
              ).run(`timer_timeout_${wait.waitId}`, command.runId, wait.waitId, token.tokenId, toIso(wait.timeoutAt), nowIso);
            }
            db.prepare(
              "UPDATE vict_token SET status = 'waiting', revision = revision + 1, updated_at = ? WHERE token_id = ?;",
            ).run(nowIso, token.tokenId);
          } else if (continuation.kind === 'fork') {
            db.prepare(
              "UPDATE vict_token SET status = 'completed', revision = revision + 1, updated_at = ? WHERE token_id = ?;",
            ).run(nowIso, token.tokenId);
            for (const child of continuation.children) {
              db.prepare(
                `INSERT INTO vict_token
                  (token_id, run_id, activation_version, node_id, status, parent_token_id, lineage, fork_id, branch_key, revision, checkpoint, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'ready', ?, ?, ?, ?, 1, NULL, ?, ?);`,
              ).run(child.tokenId, command.runId, run.activation_version, child.toNodeId, token.tokenId, child.lineage, continuation.joinId, child.branchKey, nowIso, nowIso);
            }
          } else if (continuation.kind === 'branchArrival') {
            const arrival = continuation;
            db.prepare(
              "UPDATE vict_token SET status = 'completed', revision = revision + 1, updated_at = ? WHERE token_id = ?;",
            ).run(nowIso, token.tokenId);
            db.prepare(
              `INSERT INTO vict_branch_result (run_id, fork_id, join_id, branch_key, token_id, failed, output, created_at)
               VALUES (?, ?, ?, ?, ?, 0, ?, ?);`,
            ).run(
              command.runId,
              arrival.forkId,
              arrival.joinId,
              arrival.branchKey,
              token.tokenId,
              command.branchOutput === undefined ? null : toCanonicalJson(canonicalPersistedValue(command.branchOutput)),
              nowIso,
            );
            const completed = db
              .prepare('SELECT branch_key FROM vict_branch_result WHERE run_id = ? AND fork_id = ? AND failed = 0;')
              .all(command.runId, arrival.forkId) as unknown as { branch_key: string }[];
            const completedKeys = new Set(completed.map((entry) => entry.branch_key));
            const declared = command.declaredBranchKeys ?? [];
            if (declared.length > 0 && declared.every((key) => completedKeys.has(key))) {
              joinFired = true;
              if (arrival.joinContinuation !== undefined) {
                const outputRows = db
                  .prepare('SELECT branch_key, output FROM vict_branch_result WHERE run_id = ? AND fork_id = ?;')
                  .all(command.runId, arrival.forkId) as unknown as { branch_key: string; output: string | null }[];
                const byKey: Record<string, unknown> = {};
                for (const outputRow of outputRows) {
                  byKey[outputRow.branch_key] = outputRow.output === null ? null : parseJson(outputRow.output, "orchestration.readPrivatePayload", command.runId);
                }
                const joinPayload = canonicalJoinOutput(byKey);
                db.prepare(
                  `INSERT INTO vict_token
                    (token_id, run_id, activation_version, node_id, status, parent_token_id, lineage, fork_id, branch_key, revision, checkpoint, created_at, updated_at)
                  VALUES (?, ?, ?, ?, 'ready', NULL, ?, NULL, NULL, 1, ?, ?, ?);`,
                ).run(
                  arrival.joinContinuation.tokenId,
                  command.runId,
                  run.activation_version,
                  arrival.joinContinuation.toNodeId,
                  arrival.joinContinuation.lineage,
                  toCanonicalJson(joinPayload),
                  nowIso,
                  nowIso,
                );
              }
            }
          } else if (continuation.kind === 'branchFailure') {
            db.prepare(
              "UPDATE vict_token SET status = 'completed', revision = revision + 1, updated_at = ? WHERE token_id = ?;",
            ).run(nowIso, token.tokenId);
            db.prepare(
              `UPDATE vict_token SET status = 'cancelled', revision = revision + 1, updated_at = ?
               WHERE run_id = ? AND token_id != ? AND status IN ('ready', 'claimed', 'waiting');`,
            ).run(nowIso, command.runId, token.tokenId);
            db.prepare(
              "UPDATE vict_wait SET status = 'cancelled', revision = revision + 1, resolved_at = ?, resolved_by = ? WHERE run_id = ? AND status = 'open';",
            ).run(nowIso, attempt.attemptId, command.runId);
            db.prepare(
              "UPDATE vict_timer SET status = 'cancelled', revision = revision + 1 WHERE run_id = ? AND status = 'scheduled';",
            ).run(command.runId);
          } else if (continuation.kind === 'retry') {
            // The token stays claimed (ineligible) until its durable retry
            // timer fires; the timer resolution makes it ready again.
            if (token.status !== 'claimed') {
              throw new VictStoreError(
                'VICT_STORE_TOKEN_CONFLICT',
                `Token '${token.tokenId}' cannot be rescheduled from state '${token.status}'.`,
                { operation: 'orchestration.completeAttempt', runId: command.runId },
              );
            }
            db.prepare(
              `INSERT INTO vict_timer (timer_id, run_id, kind, wait_id, attempt_id, token_id, due_at, status, owner_id, lease_expires_at, revision, created_at)
               VALUES (?, ?, 'retry', NULL, ?, ?, ?, 'scheduled', NULL, NULL, 1, ?);`,
            ).run(`timer_retry_${attempt.attemptId}`, command.runId, attempt.attemptId, token.tokenId, toIso(continuation.dueAt), nowIso);
          } else if (continuation.kind === 'block') {
            db.prepare(
              "UPDATE vict_token SET status = 'blocked', revision = revision + 1, updated_at = ? WHERE token_id = ?;",
            ).run(nowIso, token.tokenId);
          } else if (command.outcome.kind === 'completed') {
            db.prepare(
              "UPDATE vict_token SET status = 'completed', revision = revision + 1, updated_at = ? WHERE token_id = ?;",
            ).run(nowIso, token.tokenId);
          }

          // 3. Run state.
          const nextStatus = command.run.status ?? 'running';
          if (!canTransitionRun(run.status, nextStatus)) {
            throw new VictStoreError(
              'VICT_STORE_RUN_CONFLICT',
              `Run status '${run.status}' cannot transition to '${nextStatus}'.`,
              { operation: 'orchestration.completeAttempt', runId: command.runId },
            );
          }
          const completedAt =
            command.run.completedAt !== undefined
              ? command.run.completedAt === null
                ? null
                : toIso(command.run.completedAt)
              : nextStatus === 'running' || nextStatus === 'waiting' || nextStatus === 'blocked'
                ? run.completed_at
                : nowIso;
          db.prepare(
            `UPDATE vict_run SET
              status = ?,
              steps = ?,
              current_node_id = ?,
              output_summary = ?,
              output = ?,
              error = ?,
              record_revision = record_revision + 1,
              updated_at = ?,
              completed_at = ?
            WHERE run_id = ?;`,
          ).run(
            nextStatus,
            command.run.steps ?? run.steps,
            command.run.currentNodeId !== undefined ? command.run.currentNodeId : run.current_node_id,
            command.run.outputSummary !== undefined
              ? toCanonicalJson(canonicalPersistedValue(command.run.outputSummary))
              : run.output_summary,
            command.run.output !== undefined
              ? toCanonicalJson(canonicalPersistedValue(command.run.output))
              : run.output,
            command.run.error !== undefined ? toCanonicalJson(canonicalPersistedValue(command.run.error)) : run.error,
            nowIso,
            completedAt,
            command.runId,
          );

          // 4. Checkpoint lifecycle.
          if (command.checkpoint !== undefined && command.checkpoint !== null) {
            stageCheckpoint(command.runId, command.checkpoint.tokenId, command.checkpoint.payload);
          }
          for (const child of command.childCheckpoints ?? []) {
            stageCheckpoint(command.runId, child.tokenId, child.payload);
          }
          for (const tokenId of command.removeCheckpoints ?? []) {
            db.prepare('UPDATE vict_token SET checkpoint = NULL WHERE token_id = ?;').run(tokenId);
          }
          if (['completed', 'failed', 'cancelled'].includes(nextStatus)) {
            // Terminal cleanup: no private operational payload survives a
            // terminal transition (tested lifecycle rule).
            db.prepare('UPDATE vict_token SET checkpoint = NULL WHERE run_id = ?;').run(command.runId);
          }
          faults?.afterStateStage?.('orchestration.completeAttempt');

          // 5. Events (dense, atomic with the state). A fired join appends
          // its join.completed fact in the same atomic transition.
          let commandEvents: readonly OrchestrationEventInput[] = command.events;
          if (joinFired && continuation.kind === 'branchArrival') {
            commandEvents = [
              ...command.events,
              {
                type: 'join.completed',
                forkId: continuation.forkId,
                joinId: continuation.joinId,
                branchKeys: [...(command.declaredBranchKeys ?? [])],
                runId: command.runId,
                graphId: run.graph_id,
                graphVersion: run.graph_version,
                capabilitySetVersion: run.capability_set_version,
                activationVersion: run.activation_version,
                timestamp: command.now,
              } as unknown as OrchestrationEventInput,
            ];
          }
          const updatedRun = runRow(command.runId) as RunRow;
          const seq = appendEvents(command.runId, commandEvents);
          faults?.beforeCommit?.('orchestration.completeAttempt');

          const branchResult: BranchResultRecord | null =
            continuation.kind === 'branchArrival'
              ? {
                  runId: command.runId,
                  forkId: continuation.forkId,
                  joinId: continuation.joinId,
                  branchKey: continuation.branchKey,
                  tokenId: token.tokenId,
                  failed: false,
                  createdAt: command.now,
                }
              : null;
          return {
            attempt: { ...attempt, state: outcomeState, updatedAt: command.now },
            token: { ...token },
            branchResult,
            joinFired,
            runRecordRevision: updatedRun.record_revision,
            runNextEventSeq: seq,
          };
        }),
      );
    },

    async signalWait(command): Promise<SignalDeliveryResult> {
      return safeRun('orchestration.signalWait', () =>
        inTransaction(db, () => {
          const run = runRow(command.runId);
          if (!run) {
            throw new VictStoreError('VICT_STORE_RUN_NOT_FOUND', 'Run not found.', {
              operation: 'orchestration.signalWait',
              runId: command.runId,
            });
          }
          const receipt = db
            .prepare('SELECT wait_id, command_hash FROM vict_signal_receipt WHERE signal_id = ?;')
            .get(command.signalId) as { wait_id: string | null; command_hash: string } | undefined;
          if (receipt) {
            if (receipt.command_hash === command.commandHash) {
              return {
                status: 'duplicate' as const,
                signalId: command.signalId,
                waitId: receipt.wait_id ?? command.waitId,
              };
            }
            return { status: 'conflict' as const, signalId: command.signalId };
          }
          const waitRow = db.prepare('SELECT * FROM vict_wait WHERE wait_id = ?;').get(command.waitId) as unknown as
            WaitRow | undefined;
          if (!waitRow) {
            throw new VictStoreError('VICT_STORE_WAIT_NOT_FOUND', 'Wait not found.', {
              operation: 'orchestration.signalWait',
              runId: command.runId,
              waitId: command.waitId,
            });
          }
          if (waitRow.status !== 'open') {
            return { status: 'already_resolved' as const, waitId: waitRow.wait_id };
          }
          if (
            command.signalName !== undefined &&
            waitRow.signal_name !== null &&
            waitRow.signal_name !== command.signalName
          ) {
            throw new VictStoreError(
              'VICT_STORE_SIGNAL_NAME_MISMATCH',
              'The signal name does not match the open wait.',
              { operation: 'orchestration.signalWait', runId: command.runId, waitId: command.waitId },
            );
          }
          if (
            command.expectedWaitRevision !== undefined &&
            waitRow.revision !== command.expectedWaitRevision
          ) {
            return { status: 'already_resolved' as const, waitId: waitRow.wait_id };
          }
          const nowIso = toIso(command.now);
          db.prepare(
            "UPDATE vict_wait SET status = 'resolved', revision = revision + 1, resolved_at = ?, resolved_by = ? WHERE wait_id = ? AND revision = ?;",
          ).run(nowIso, command.signalId, command.waitId, waitRow.revision);
          const tokenRow = db.prepare('SELECT * FROM vict_token WHERE token_id = ?;').get(waitRow.token_id) as unknown as
            TokenRow | undefined;
          if (!tokenRow) {
            throw new VictStoreError('VICT_STORE_INVALID_RECORD', 'The wait references an unknown token.', {
              operation: 'orchestration.signalWait',
              runId: command.runId,
              waitId: command.waitId,
            });
          }
          if (tokenRow.status !== 'waiting') {
            throw new VictStoreError(
              'VICT_STORE_WAIT_CONFLICT',
              'The wait lost the race against a concurrent resolution.',
              { operation: 'orchestration.signalWait', runId: command.runId, waitId: command.waitId },
            );
          }
          db.prepare(
            "UPDATE vict_token SET status = 'ready', revision = revision + 1, updated_at = ?, checkpoint = ? WHERE token_id = ?;",
          ).run(
            nowIso,
            toCanonicalJson(canonicalPersistedValue(command.payload)),
            tokenRow.token_id,
          );
          db.prepare(
            "UPDATE vict_timer SET status = 'cancelled', revision = revision + 1 WHERE wait_id = ? AND status = 'scheduled';",
          ).run(command.waitId);
          db.prepare(
            `INSERT INTO vict_signal_receipt (signal_id, run_id, wait_id, signal_name, command_hash, status, event_seq, created_at)
             VALUES (?, ?, ?, ?, ?, 'accepted', NULL, ?);`,
          ).run(command.signalId, command.runId, command.waitId, waitRow.signal_name, command.commandHash, nowIso);
          db.prepare(
            "UPDATE vict_run SET status = 'running', record_revision = record_revision + 1, updated_at = ? WHERE run_id = ?;",
          ).run(nowIso, command.runId);
          faults?.afterStateStage?.('orchestration.signalWait');
          const updatedRun = runRow(command.runId) as RunRow;
          const seq = appendEvents(command.runId, command.events);
          faults?.beforeCommit?.('orchestration.signalWait');
          const token = validateTokenRow(
            db.prepare('SELECT * FROM vict_token WHERE token_id = ?;').get(tokenRow.token_id) as unknown as TokenRow,
            'orchestration.signalWait',
          );
          return {
            status: 'accepted' as const,
            waitId: command.waitId,
            token,
            runRecordRevision: (runRow(command.runId) as RunRow).record_revision,
            runNextEventSeq: seq,
            waitRevision: (
              db.prepare('SELECT revision FROM vict_wait WHERE wait_id = ?;').get(command.waitId) as unknown as {
                revision: number;
              }
            ).revision,
          };
        }),
      );
    },

    async claimDueTimers(command: ClaimDueTimersCommand): Promise<ClaimDueTimersResult> {
      return safeRun('orchestration.claimDueTimers', () =>
        inTransaction(db, () => {
          const limit = Math.max(1, Math.floor(command.limit));
          const runClause = command.runId !== undefined ? ' AND run_id = ?' : '';
          const rows = (
            command.runId !== undefined
              ? db
                  .prepare(
                    `SELECT * FROM vict_timer WHERE status = 'scheduled' AND due_at <= ?${runClause} ORDER BY due_at ASC, timer_id ASC LIMIT ?;`,
                  )
                  .all(toIso(command.now), command.runId, limit)
              : db
                  .prepare(
                    "SELECT * FROM vict_timer WHERE status = 'scheduled' AND due_at <= ? ORDER BY due_at ASC, timer_id ASC LIMIT ?;",
                  )
                  .all(toIso(command.now), limit)
          ) as unknown as TimerRow[];
          const due: DueTimerRecord[] = [];
          for (const row of rows) {
            db.prepare(
              "UPDATE vict_timer SET status = 'firing', owner_id = ?, lease_expires_at = ?, revision = revision + 1 WHERE timer_id = ? AND revision = ?;",
            ).run(command.ownerId, toIso(command.leaseExpiresAt), row.timer_id, row.revision);
            const timer = validateTimerRow(row, 'orchestration.claimDueTimers');
            due.push({
              timerId: timer.timerId,
              runId: timer.runId,
              kind: timer.kind,
              waitId: timer.waitId,
              attemptId: timer.attemptId,
              tokenId: timer.tokenId,
              dueAt: timer.dueAt,
              revision: timer.revision + 1,
            });
          }
          return { timers: due };
        }),
      );
    },

    async resolveDueTimer(command: ResolveDueTimerCommand): Promise<ResolveDueTimerResult> {
      return safeRun('orchestration.resolveDueTimer', () =>
        inTransaction(db, () => {
          const run = runRow(command.runId);
          if (!run) {
            throw new VictStoreError('VICT_STORE_RUN_NOT_FOUND', 'Run not found.', {
              operation: 'orchestration.resolveDueTimer',
              runId: command.runId,
            });
          }
          const timerRow = db.prepare('SELECT * FROM vict_timer WHERE timer_id = ?;').get(command.timerId) as unknown as
            TimerRow | undefined;
          if (!timerRow) {
            throw new VictStoreError('VICT_STORE_TIMER_NOT_FOUND', 'Timer not found.', {
              operation: 'orchestration.resolveDueTimer',
              runId: command.runId,
              timerId: command.timerId,
            });
          }
          if (timerRow.revision !== command.expectedTimerFence || timerRow.owner_id !== command.ownerId) {
            return {
              runRecordRevision: run.record_revision,
              runNextEventSeq: nextEventSeqOf(command.runId),
              applied: false,
            };
          }
          if (timerRow.status !== 'firing') {
            return {
              runRecordRevision: run.record_revision,
              runNextEventSeq: nextEventSeqOf(command.runId),
              applied: false,
            };
          }
          const nowIso = toIso(command.now);
          const result: ResolveDueTimerResult = {
            runRecordRevision: run.record_revision,
            runNextEventSeq: 0,
            applied: true,
          };
          if (command.resolution.kind === 'wake' || command.resolution.kind === 'waitTimeout') {
            const waitRow = db.prepare('SELECT * FROM vict_wait WHERE wait_id = ?;').get(timerRow.wait_id) as unknown as
              WaitRow | undefined;
            if (!waitRow || waitRow.status !== 'open') {
              return { runRecordRevision: run.record_revision, runNextEventSeq: 0, applied: false };
            }
            const tokenRow = db.prepare('SELECT * FROM vict_token WHERE token_id = ?;').get(waitRow.token_id) as
              TokenRow | undefined;
            if (!tokenRow) {
              throw new VictStoreError('VICT_STORE_INVALID_RECORD', 'A wait references an unknown token.', {
                operation: 'orchestration.resolveDueTimer',
                runId: command.runId,
              });
            }
            db.prepare(
              "UPDATE vict_wait SET status = 'resolved', revision = revision + 1, resolved_at = ?, resolved_by = ? WHERE wait_id = ?;",
            ).run(nowIso, timerRow.timer_id, waitRow.wait_id);
            if (command.resolution.kind === 'wake') {
              db.prepare(
                "UPDATE vict_token SET status = 'ready', revision = revision + 1, updated_at = ? WHERE token_id = ?;",
              ).run(nowIso, tokenRow.token_id);
            } else if (command.resolution.toNodeId !== null) {
              db.prepare(
                "UPDATE vict_token SET node_id = ?, status = 'ready', revision = revision + 1, updated_at = ? WHERE token_id = ?;",
              ).run(command.resolution.toNodeId, nowIso, tokenRow.token_id);
            } else {
              db.prepare(
                "UPDATE vict_token SET status = 'blocked', revision = revision + 1, updated_at = ? WHERE token_id = ?;",
              ).run(nowIso, tokenRow.token_id);
            }
          } else if (command.resolution.kind === 'retry') {
            if (timerRow.token_id === null) {
              return { runRecordRevision: run.record_revision, runNextEventSeq: 0, applied: false };
            }
            const tokenRow = db.prepare('SELECT * FROM vict_token WHERE token_id = ?;').get(timerRow.token_id) as unknown as
              TokenRow | undefined;
            if (!tokenRow || (tokenRow.status !== 'claimed' && tokenRow.status !== 'blocked')) {
              return { runRecordRevision: run.record_revision, runNextEventSeq: 0, applied: false };
            }
            db.prepare(
              "UPDATE vict_token SET status = 'ready', revision = revision + 1, updated_at = ? WHERE token_id = ?;",
            ).run(nowIso, tokenRow.token_id);
          }
          db.prepare('UPDATE vict_timer SET status = ?, revision = revision + 1 WHERE timer_id = ?;').run(
            command.resolution.kind === 'cancel' ? 'cancelled' : 'fired',
            timerRow.timer_id,
          );
          if (command.checkpoint !== undefined && command.checkpoint !== null) {
            stageCheckpoint(command.runId, command.checkpoint.tokenId, command.checkpoint.payload);
          }
          const runUpdate = command.run ?? {};
          db.prepare(
            'UPDATE vict_run SET status = ?, current_node_id = ?, steps = ?, error = ?, record_revision = record_revision + 1, updated_at = ? WHERE run_id = ?;',
          ).run(
            runUpdate.status ?? run.status,
            runUpdate.currentNodeId !== undefined ? runUpdate.currentNodeId : run.current_node_id,
            runUpdate.steps ?? run.steps,
            command.error !== undefined ? toCanonicalJson(canonicalPersistedValue(command.error)) : run.error,
            nowIso,
            command.runId,
          );
          faults?.afterStateStage?.('orchestration.resolveDueTimer');
          const updatedRun = runRow(command.runId) as RunRow;
          const seq = appendEvents(command.runId, command.events);
          faults?.beforeCommit?.('orchestration.resolveDueTimer');
          return { runRecordRevision: updatedRun.record_revision, runNextEventSeq: seq, applied: true };
        }),
      );
    },

    async requestCancellation(command: RequestCancellationCommand): Promise<CancellationResult> {
      return safeRun('orchestration.requestCancellation', () =>
        inTransaction(db, () => {
          const run = runRow(command.runId);
          if (!run) {
            return { status: 'unknown_run' as const, runId: command.runId };
          }
          const existing = db
            .prepare('SELECT command_hash FROM vict_cancellation_request WHERE run_id = ? AND request_id = ?;')
            .get(command.runId, command.requestId) as { command_hash: string } | undefined;
          if (existing) {
            if (existing.command_hash === command.commandHash) {
              return {
                status: 'duplicate' as const,
                runId: command.runId,
                runCancelledNow: false,
                runRecordRevision: run.record_revision,
                runNextEventSeq: nextEventSeqOf(command.runId),
              };
            }
            return { status: 'conflict' as const, requestId: command.requestId };
          }
          if (run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled') {
            return { status: 'already_terminal' as const, runId: command.runId, runStatus: run.status };
          }
          const nowIso = toIso(command.now);
          db.prepare(
            `INSERT INTO vict_cancellation_request (run_id, request_id, reason_code, command_hash, created_at)
             VALUES (?, ?, ?, ?, ?);`,
          ).run(command.runId, command.requestId, command.reasonCode, command.commandHash, nowIso);
          db.prepare(
            "UPDATE vict_wait SET status = 'cancelled', revision = revision + 1, resolved_at = ?, resolved_by = ? WHERE run_id = ? AND status = 'open';",
          ).run(nowIso, command.requestId, command.runId);
          db.prepare(
            "UPDATE vict_timer SET status = 'cancelled', revision = revision + 1 WHERE run_id = ? AND status = 'scheduled';",
          ).run(command.runId);
          db.prepare(
            "UPDATE vict_token SET status = 'cancelled', revision = revision + 1, updated_at = ? WHERE run_id = ? AND status = 'ready';",
          ).run(nowIso, command.runId);
          const inFlight = db
            .prepare("SELECT COUNT(*) AS c FROM vict_token WHERE run_id = ? AND status = 'claimed';")
            .get(command.runId) as { c: number };
          let runCancelledNow = false;
          if (inFlight.c === 0) {
            db.prepare(
              "UPDATE vict_run SET status = 'cancelled', completed_at = ?, record_revision = record_revision + 1, updated_at = ? WHERE run_id = ?;",
            ).run(nowIso, nowIso, command.runId);
            runCancelledNow = true;
          } else {
            db.prepare(
              'UPDATE vict_run SET record_revision = record_revision + 1, updated_at = ? WHERE run_id = ?;',
            ).run(nowIso, command.runId);
          }
          faults?.afterStateStage?.('orchestration.requestCancellation');
          const updatedRun = runRow(command.runId) as RunRow;
          const seq = appendEvents(
            command.runId,
            runCancelledNow && command.terminalCancelEvent !== undefined
              ? [...command.events, command.terminalCancelEvent]
              : command.events,
          );
          faults?.beforeCommit?.('orchestration.requestCancellation');
          return {
            status: 'accepted' as const,
            runId: command.runId,
            runCancelledNow,
            runRecordRevision: (runRow(command.runId) as RunRow).record_revision,
            runNextEventSeq: seq,
          };
        }),
      );
    },

    async applyCancellation(command): Promise<{ runRecordRevision: number; runNextEventSeq: number }> {
      return safeRun('orchestration.applyCancellation', () =>
        inTransaction(db, () => {
          const run = runRow(command.runId);
          if (!run) {
            throw new VictStoreError('VICT_STORE_RUN_NOT_FOUND', 'Run not found.', {
              operation: 'orchestration.applyCancellation',
              runId: command.runId,
            });
          }
          const nowIso = toIso(command.now);
          db.prepare(
            "UPDATE vict_token SET status = 'cancelled', revision = revision + 1, updated_at = ? WHERE run_id = ? AND status IN ('ready','claimed','waiting','blocked');",
          ).run(nowIso, command.runId);
          db.prepare(
            "UPDATE vict_wait SET status = 'cancelled', revision = revision + 1, resolved_at = ?, resolved_by = ? WHERE run_id = ? AND status = 'open';",
          ).run(nowIso, command.requestId, command.runId);
          db.prepare(
            "UPDATE vict_timer SET status = 'cancelled', revision = revision + 1 WHERE run_id = ? AND status IN ('scheduled','firing');",
          ).run(command.runId);
          if (run.status === 'cancelled') {
            // Already finalized: idempotent.
            return {
              runRecordRevision: run.record_revision,
              runNextEventSeq: nextEventSeqOf(command.runId),
            };
          }
          if (!canTransitionRun(run.status, 'cancelled')) {
            throw new VictStoreError(
              'VICT_STORE_RUN_CONFLICT',
              'The run cannot be cancelled from its current status.',
              { operation: 'orchestration.applyCancellation', runId: command.runId, status: run.status },
            );
          }
          db.prepare(
            "UPDATE vict_run SET status = 'cancelled', completed_at = ?, record_revision = record_revision + 1, updated_at = ? WHERE run_id = ?;",
          ).run(nowIso, nowIso, command.runId);
          faults?.afterStateStage?.('orchestration.applyCancellation');
          const updatedRun = runRow(command.runId) as RunRow;
          const seq = appendEvents(command.runId, command.events);
          // Terminal cleanup: tombstone every private operational payload.
          db.prepare('UPDATE vict_token SET checkpoint = NULL WHERE run_id = ?;').run(command.runId);
          faults?.beforeCommit?.('orchestration.applyCancellation');
          return { runRecordRevision: (runRow(command.runId) as RunRow).record_revision, runNextEventSeq: seq };
        }),
      );
    },

    async findRecoverableClaims(_command: RecoverOrchestrationCommand): Promise<readonly RecoverableClaim[]> {
      return safeRun('orchestration.findRecoverableClaims', () => {
        const rows = db
          .prepare(
            `SELECT t.*, a.attempt_id AS a_attempt_id, a.fence AS a_fence, a.lease_expires_at AS a_lease
             FROM vict_token t
             JOIN vict_attempt a ON a.token_id = t.token_id
             WHERE t.status = 'claimed' AND a.state = 'started'
             ORDER BY a.lease_expires_at ASC, t.token_id ASC;`,
          )
          .all() as unknown as (TokenRow & { a_attempt_id: string; a_fence: number; a_lease: string | null })[];
        const claims: RecoverableClaim[] = [];
        for (const row of rows) {
          const token = validateTokenRow(row, 'orchestration.findRecoverableClaims');
          const attemptRow = db
            .prepare('SELECT * FROM vict_attempt WHERE attempt_id = ?;')
            .get(row.a_attempt_id) as unknown as AttemptRow;
          const attempt = validateAttemptRow(attemptRow, 'orchestration.findRecoverableClaims');
          if (attempt.leaseExpiresAt === null) {
            continue;
          }
          claims.push({
            runId: token.runId,
            token,
            attempt,
            leaseExpiresAt: attempt.leaseExpiresAt,
          });
        }
        return claims;
      });
    },

    async recoverAttempt(command): Promise<{ runRecordRevision: number; runNextEventSeq: number }> {
      return safeRun('orchestration.recoverAttempt', () =>
        inTransaction(db, () => {
          const run = runRow(command.runId);
          if (!run) {
            throw new VictStoreError('VICT_STORE_RUN_NOT_FOUND', 'Run not found.', {
              operation: 'orchestration.recoverAttempt',
              runId: command.runId,
            });
          }
          const attemptRow = db.prepare('SELECT * FROM vict_attempt WHERE attempt_id = ?;').get(command.attemptId) as unknown as
            AttemptRow | undefined;
          if (!attemptRow) {
            throw new VictStoreError('VICT_STORE_INVALID_COMMAND', 'Unknown attempt.', {
              operation: 'orchestration.recoverAttempt',
              runId: command.runId,
              attemptId: command.attemptId,
            });
          }
          const attempt = validateAttemptRow(attemptRow, 'orchestration.recoverAttempt');
          if (attempt.fence !== command.expectedAttemptFence) {
            throw new VictStoreError(
              'VICT_STORE_ATTEMPT_FENCE_CONFLICT',
              'The recovery carries a stale fence.',
              { operation: 'orchestration.recoverAttempt', runId: command.runId, attemptId: command.attemptId },
            );
          }
          if (!canTransitionAttempt(attempt.state, 'outcome_unknown')) {
            throw new VictStoreError(
              'VICT_STORE_ATTEMPT_STATE_CONFLICT',
              `Attempt '${attempt.attemptId}' is in state '${attempt.state}' and cannot be recovered.`,
              { operation: 'orchestration.recoverAttempt', runId: command.runId, attemptId: command.attemptId },
            );
          }
          const nowIso = toIso(command.now);
          db.prepare('UPDATE vict_attempt SET state = ?, updated_at = ? WHERE attempt_id = ?;').run(
            'outcome_unknown',
            nowIso,
            attempt.attemptId,
          );
          const nextTokenStatus = command.action.kind === 'reclaim' ? 'ready' : 'blocked';
          const updated = db
            .prepare(
              'UPDATE vict_token SET status = ?, revision = revision + 1, updated_at = ? WHERE token_id = ? AND status = ?;',
            )
            .run(nextTokenStatus, nowIso, attempt.tokenId, 'claimed');
          if (updated.changes !== 1) {
            throw new VictStoreError(
              'VICT_STORE_TOKEN_CONFLICT',
              'The claimed token changed since it was read; recovery was rejected.',
              { operation: 'orchestration.recoverAttempt', runId: command.runId },
            );
          }
          const runStatus = command.action.kind === 'block' ? 'blocked' : 'running';
          if (!canTransitionRun(run.status, runStatus)) {
            throw new VictStoreError(
              'VICT_STORE_RUN_CONFLICT',
              `Run status '${run.status}' cannot transition to '${runStatus}'.`,
              { operation: 'orchestration.recoverAttempt', runId: command.runId },
            );
          }
          db.prepare(
            'UPDATE vict_run SET status = ?, error = ?, record_revision = record_revision + 1, updated_at = ? WHERE run_id = ?;',
          ).run(
            runStatus,
            command.run?.error !== undefined ? toCanonicalJson(canonicalPersistedValue(command.run.error)) : run.error,
            nowIso,
            command.runId,
          );
          faults?.afterStateStage?.('orchestration.recoverAttempt');
          const updatedRun = runRow(command.runId) as RunRow;
          const seq = appendEvents(command.runId, command.events);
          faults?.beforeCommit?.('orchestration.recoverAttempt');
          return { runRecordRevision: (runRow(command.runId) as RunRow).record_revision, runNextEventSeq: seq };
        }),
      );
    },

    async resolveBlocked(command: ResolveBlockedCommand): Promise<ResolveBlockedResult> {
      return safeRun('orchestration.resolveBlocked', () =>
        inTransaction(db, () => {
          const run = runRow(command.runId);
          if (!run) {
            return { status: 'unknown_run' as const };
          }
          const existing = db
            .prepare('SELECT command_hash FROM vict_operator_resolution WHERE run_id = ? AND resolution_id = ?;')
            .get(command.runId, command.resolutionId) as { command_hash: string } | undefined;
          if (existing) {
            if (existing.command_hash === command.commandHash) {
              return {
                status: 'duplicate' as const,
                runRecordRevision: run.record_revision,
                runNextEventSeq: nextEventSeqOf(command.runId),
                runStatus: run.status,
              };
            }
            return { status: 'conflict' as const, resolutionId: command.resolutionId };
          }
          if (run.status !== 'blocked') {
            return { status: 'not_blocked' as const, runId: command.runId, runStatus: run.status };
          }
          if (run.record_revision !== command.expectedRunRevision) {
            return {
              status: 'stale_revision' as const,
              runId: command.runId,
              actualRunRevision: run.record_revision,
            };
          }
          const nowIso = toIso(command.now);
          db.prepare(
            `INSERT INTO vict_operator_resolution (run_id, resolution_id, action, reason_code, command_hash, created_at)
             VALUES (?, ?, ?, ?, ?, ?);`,
          ).run(command.runId, command.resolutionId, command.action, command.reasonCode, command.commandHash, nowIso);
          if (command.action === 'cancel') {
            if (!canTransitionRun(run.status, 'cancelled')) {
              throw new VictStoreError(
                'VICT_STORE_RUN_CONFLICT',
                'The run cannot be cancelled from its status.',
                { operation: 'orchestration.resolveBlocked', runId: command.runId },
              );
            }
            db.prepare(
              "UPDATE vict_run SET status = 'cancelled', completed_at = ?, record_revision = record_revision + 1, updated_at = ? WHERE run_id = ?;",
            ).run(nowIso, nowIso, command.runId);
            db.prepare(
              "UPDATE vict_token SET status = 'cancelled', revision = revision + 1 WHERE run_id = ? AND status IN ('blocked','ready','claimed','waiting');",
            ).run(command.runId);
          } else if (command.action === 'fail') {
            if (!canTransitionRun(run.status, 'failed')) {
              throw new VictStoreError(
                'VICT_STORE_RUN_CONFLICT',
                'The run cannot fail from its status.',
                { operation: 'orchestration.resolveBlocked', runId: command.runId },
              );
            }
            db.prepare(
              "UPDATE vict_run SET status = 'failed', completed_at = ?, record_revision = record_revision + 1, updated_at = ? WHERE run_id = ?;",
            ).run(nowIso, nowIso, command.runId);
            db.prepare(
              "UPDATE vict_token SET status = 'cancelled', revision = revision + 1 WHERE run_id = ? AND status = 'blocked';",
            ).run(command.runId);
          } else {
            const blocked = db
              .prepare("SELECT * FROM vict_token WHERE run_id = ? AND status = 'blocked' ORDER BY token_id ASC LIMIT 1;")
              .get(command.runId) as unknown as TokenRow | undefined;
            if (!blocked) {
              throw new VictStoreError(
                'VICT_STORE_INVALID_COMMAND',
                'The run is blocked without a blocked token.',
                { operation: 'orchestration.resolveBlocked', runId: command.runId },
              );
            }
            if (!canTransitionRun(run.status, 'running')) {
              throw new VictStoreError(
                'VICT_STORE_RUN_CONFLICT',
                'The run cannot resume from its status.',
                { operation: 'orchestration.resolveBlocked', runId: command.runId },
              );
            }
            db.prepare(
              "UPDATE vict_run SET status = 'running', record_revision = record_revision + 1, updated_at = ? WHERE run_id = ?;",
            ).run(nowIso, command.runId);
            if (command.action === 'retry') {
              db.prepare(
                "UPDATE vict_token SET status = 'ready', revision = revision + 1, updated_at = ? WHERE token_id = ?;",
              ).run(nowIso, blocked.token_id);
            } else if (command.continuation && command.continuation.kind === 'advance') {
              db.prepare(
                "UPDATE vict_token SET node_id = ?, status = 'ready', revision = revision + 1, updated_at = ? WHERE token_id = ?;",
              ).run(command.continuation.toNodeId, nowIso, blocked.token_id);
              if (command.checkpoint) {
                stageCheckpoint(command.runId, command.checkpoint.tokenId, command.checkpoint.payload);
              }
            } else if (command.continuation && command.continuation.kind === 'complete') {
              db.prepare(
                "UPDATE vict_token SET status = 'completed', revision = revision + 1, updated_at = ? WHERE token_id = ?;",
              ).run(nowIso, blocked.token_id);
              db.prepare(
                "UPDATE vict_run SET status = 'completed', completed_at = ?, output_summary = ?, output = ?, record_revision = record_revision + 1, updated_at = ? WHERE run_id = ?;",
              ).run(
                nowIso,
                command.continuation.outputSummary !== undefined
                  ? toCanonicalJson(canonicalPersistedValue(command.continuation.outputSummary))
                  : null,
                command.continuation.output !== undefined
                  ? toCanonicalJson(canonicalPersistedValue(command.continuation.output))
                  : null,
                nowIso,
                command.runId,
              );
            }
          }
          faults?.afterStateStage?.('orchestration.resolveBlocked');
          const updatedRun = runRow(command.runId) as RunRow;
          const seq = appendEvents(command.runId, command.events);
          faults?.beforeCommit?.('orchestration.resolveBlocked');
          return {
            status: 'accepted' as const,
            runRecordRevision: (runRow(command.runId) as RunRow).record_revision,
            runNextEventSeq: seq,
            runStatus: (runRow(command.runId) as RunRow).status,
          };
        }),
      );
    },

    async listWaits(runId) {
      return safeRun('orchestration.listWaits', () => {
        const rows = db
          .prepare('SELECT * FROM vict_wait WHERE run_id = ? ORDER BY created_at ASC, wait_id ASC;')
          .all(runId) as unknown as WaitRow[];
        return rows.map((row) => validateWaitRow(row, 'orchestration.listWaits'));
      });
    },

    async listOrchestrationEvents(runId) {
      return safeRun('orchestration.listEvents', () => {
        const run = runRow(runId);
        if (!run) {
          throw new VictStoreError('VICT_STORE_RUN_NOT_FOUND', 'Run not found.', {
            operation: 'orchestration.listEvents',
            runId,
          });
        }
        const rows = db
          .prepare('SELECT payload FROM vict_run_event WHERE run_id = ? ORDER BY seq ASC;')
          .all(runId) as unknown as { payload: string }[];
        return rows.map((row) => parseJson(row.payload, 'orchestration.listEvents', runId) as KernelEvent);
      });
    },

    async listSignalReceipts(runId) {
      return safeRun('orchestration.listSignalReceipts', () => {
        const rows = db
          .prepare(
            'SELECT signal_id, run_id, wait_id, signal_name, command_hash, status, event_seq, created_at FROM vict_signal_receipt WHERE run_id = ? ORDER BY created_at ASC, signal_id ASC;',
          )
          .all(runId) as unknown as {
          signal_id: string;
          run_id: string;
          wait_id: string | null;
          signal_name: string | null;
          command_hash: string;
          status: string;
          event_seq: number | null;
          created_at: string;
        }[];
        return rows.map((row) => ({
          signalId: row.signal_id,
          runId: row.run_id,
          waitId: row.wait_id,
          signalName: row.signal_name,
          commandHash: row.command_hash,
          status: row.status as 'accepted' | 'duplicate' | 'conflict' | 'rejected',
          eventSeq: row.event_seq,
          createdAt: requireIso(row.created_at, 'orchestration.listSignalReceipts', row.run_id),
        }));
      });
    },
  };

  function insertEvents(run: RunRow, events: readonly OrchestrationEventInput[]): number {
    let seq = nextEventSeqOf(run.run_id);
    for (const event of events) {
      insertEvent({ ...event, seq } as KernelEvent, run);
      seq += 1;
    }
    return seq;
  }

  return store;
}