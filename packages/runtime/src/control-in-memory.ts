import { createHash } from 'node:crypto';
import { InMemoryActorDirectory, isDurableStreamKind } from './control-types.js';
export { InMemoryActorDirectory };
import type {
  AgentApprovalRecord,
  AgentStreamLedgerEvent,
  AgentApprovalStore,
  AgentStreamLedgerStore,
  AgentToolInvocationRecord,
  AgentToolInvocationStore,
  AgentTurnRecord,
  AgentTurnStore,
  ApplicationReleaseRecord,
  ChangeSetApprovalDecision,
  ChangeSetOperationReceipt,
  ChangeSetRecord,
  ChangeSetStatus,
  CommandIdempotencyReceipt,
  CommandIdempotencyStore,
  CommandIdempotencyName,
  ControlAuditEvent,
  ControlPlaneStore,
  ControlRunRecord,
  ReleaseSelectionRecord,
} from './control-types.js';
import {
  VictControlError,
  CHANGESET_BASE_NONE,
  validateStreamLedgerAppend,
} from './control-types.js';

/**
 * Stage 06B in-memory reference implementations of the neutral control
 * plane and agent-execution store ports. The SQLite adapter implements the
 * SAME semantics in `@vict/store-sqlite`; the shared conformance suite
 * (`control-conformance.ts`) proves the adapters cannot diverge.
 *
 * In-memory durability model: process-local maps guarded by a single
 * synchronous critical section per mutation (compare-and-set semantics are
 * enforced inside each mutation, so concurrent callers see one truthful
 * winner).
 */

/** Deterministic test-stability digest (ids are derived, never random). */
function digest(payload: string): string {
  return createHash('sha256').update(payload, 'utf8').digest('hex').slice(0, 24);
}

// ---- Control plane (ChangeSets, releases, audit) ----------------------------

interface StoredChangeSet {
  record: ChangeSetRecord;
}

/** In-memory ControlPlaneStore. */
export class InMemoryControlPlaneStore implements ControlPlaneStore {
  readonly #changesets = new Map<string, StoredChangeSet>();
  readonly #approvals = new Map<string, ChangeSetApprovalDecision>();
  readonly #approvalsByChangeset = new Map<string, string[]>();
  readonly #releases = new Map<string, ApplicationReleaseRecord>();
  readonly #selections = new Map<string, ReleaseSelectionRecord[]>();
  readonly #audit: ControlAuditEvent[] = [];
  readonly #controlRuns = new Map<string, ControlRunRecord>();
  readonly #operationReceipts = new Map<string, ChangeSetOperationReceipt>();

  async saveChangeSet(record: ChangeSetRecord): Promise<void> {
    if (this.#changesets.has(record.changesetId)) {
      throw new VictControlError(
        'VICT_CONTROL_CHANGESET_EXISTS',
        'A ChangeSet with this id already exists; propose a distinct changesetId.',
      );
    }
    this.#changesets.set(record.changesetId, { record: structuredCloneControl(record) });
  }

  async getChangeSet(changesetId: string): Promise<ChangeSetRecord | undefined> {
    const found = this.#changesets.get(changesetId);
    return found === undefined ? undefined : structuredCloneControl(found.record);
  }

  async listChangeSets(): Promise<readonly ChangeSetRecord[]> {
    return [...this.#changesets.values()]
      .map((entry) => entry.record)
      .sort((a, b) => (a.changesetId < b.changesetId ? -1 : 1))
      .map((record) => structuredCloneControl(record));
  }

  async updateChangeSet(
    changesetId: string,
    update: (record: ChangeSetRecord) => ChangeSetRecord,
  ): Promise<ChangeSetRecord> {
    const entry = this.#changesets.get(changesetId);
    if (entry === undefined) {
      throw new VictControlError('VICT_CONTROL_CHANGESET_MISSING', 'The ChangeSet does not exist.');
    }
    const updated = update(structuredCloneControl(entry.record));
    if (updated.changesetId !== changesetId) {
      throw new VictControlError(
        'VICT_CONTROL_CHANGESET_IMMUTABLE_ID',
        'A ChangeSet update may not change its changesetId.',
      );
    }
    if (updated.contentHash !== entry.record.contentHash) {
      // Content mutation is a distinct service-level operation (revise) that
      // must reset evidence/approvals; the raw store update enforces the
      // content identity invariant.
      throw new VictControlError(
        'VICT_CONTROL_CONTENT_HASH_MISMATCH',
        'A ChangeSet update may not change its immutable content identity.',
      );
    }
    entry.record = structuredCloneControl(updated);
    return structuredCloneControl(updated);
  }

  async reviseChangeSetContent(
    changesetId: string,
    revise: (record: ChangeSetRecord) => ChangeSetRecord,
  ): Promise<ChangeSetRecord> {
    const entry = this.#changesets.get(changesetId);
    if (entry === undefined) {
      throw new VictControlError('VICT_CONTROL_CHANGESET_MISSING', 'The ChangeSet does not exist.');
    }
    const updated = revise(structuredCloneControl(entry.record));
    if (updated.changesetId !== changesetId) {
      throw new VictControlError(
        'VICT_CONTROL_CHANGESET_IMMUTABLE_ID',
        'A ChangeSet update may not change its changesetId.',
      );
    }
    if (updated.contentHash === entry.record.contentHash) {
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
    entry.record = structuredCloneControl(updated);
    return structuredCloneControl(updated);
  }

  async recordChangeSetApproval(decision: ChangeSetApprovalDecision): Promise<void> {
    const key = `${decision.changesetId}\u0000${decision.approverActorId}`;
    const existing = this.#approvals.get(key);
    if (existing !== undefined) {
      if (
        existing.decision !== decision.decision ||
        existing.contentHash !== decision.contentHash
      ) {
        throw new VictControlError(
          'VICT_CONTROL_APPROVAL_CONFLICT',
          'A competing decision already exists for this ChangeSet and approver; the first durable decision stands.',
        );
      }
      return; // idempotent identical decision
    }
    this.#approvals.set(key, structuredCloneControl(decision));
    const list = this.#approvalsByChangeset.get(decision.changesetId) ?? [];
    list.push(key);
    this.#approvalsByChangeset.set(decision.changesetId, list);
  }

  async listChangeSetApprovals(changesetId: string): Promise<readonly ChangeSetApprovalDecision[]> {
    const keys = this.#approvalsByChangeset.get(changesetId) ?? [];
    return keys
      .map((key) => this.#approvals.get(key))
      .filter((entry): entry is ChangeSetApprovalDecision => entry !== undefined)
      .map((decision) => structuredCloneControl(decision));
  }

  async recordControlRun(record: ControlRunRecord): Promise<void> {
    const existing = this.#controlRuns.get(record.runId);
    if (existing !== undefined) {
      if (JSON.stringify(existing) !== JSON.stringify(record)) {
        throw new VictControlError(
          'VICT_CONTROL_RUN_COLLISION',
          'A governance run with this id already exists with different content.',
        );
      }
      return; // idempotent re-record
    }
    this.#controlRuns.set(record.runId, structuredCloneControl(record));
  }

  async getControlRun(runId: string): Promise<ControlRunRecord | undefined> {
    const found = this.#controlRuns.get(runId);
    return found === undefined ? undefined : structuredCloneControl(found);
  }

  async recordOperationIntent(receipt: ChangeSetOperationReceipt): Promise<'recorded' | 'exists'> {
    const key = `${receipt.changesetId}\u0000${receipt.operationIndex}`;
    const existing = this.#operationReceipts.get(key);
    if (existing !== undefined) {
      if (existing.operationDigest !== receipt.operationDigest) {
        throw new VictControlError(
          'VICT_CONTROL_OPERATION_IDENTITY_CONFLICT',
          'The operation identity already exists with different content; conflicting content fails closed.',
        );
      }
      return 'exists'; // idempotent re-intent
    }
    this.#operationReceipts.set(key, structuredCloneControl(receipt));
    return 'recorded';
  }

  async markOperationApplied(input: {
    changesetId: string;
    operationIndex: number;
    at: number;
  }): Promise<ChangeSetOperationReceipt> {
    const key = `${input.changesetId}\u0000${input.operationIndex}`;
    const existing = this.#operationReceipts.get(key);
    if (existing === undefined) {
      throw new VictControlError(
        'VICT_CONTROL_OPERATION_RECEIPT_MISSING',
        'No prepared operation intent exists for this operation index.',
      );
    }
    if (existing.state === 'applied') {
      return structuredCloneControl(existing); // idempotent
    }
    const updated: ChangeSetOperationReceipt = {
      ...existing,
      state: 'applied',
      appliedAt: input.at,
    };
    this.#operationReceipts.set(key, updated);
    return structuredCloneControl(updated);
  }

  async recordOperationReceipt(receipt: ChangeSetOperationReceipt): Promise<void> {
    const key = `${receipt.changesetId}\u0000${receipt.operationIndex}`;
    const existing = this.#operationReceipts.get(key);
    if (existing !== undefined) {
      if (JSON.stringify(existing) !== JSON.stringify(receipt)) {
        throw new VictControlError(
          'VICT_CONTROL_OPERATION_RECEIPT_COLLISION',
          'An operation receipt already exists with different content.',
        );
      }
      return; // idempotent re-record
    }
    this.#operationReceipts.set(key, structuredCloneControl(receipt));
  }

  async listOperationReceipts(changesetId: string): Promise<readonly ChangeSetOperationReceipt[]> {
    return [...this.#operationReceipts.values()]
      .filter((receipt) => receipt.changesetId === changesetId)
      .sort((a, b) => a.operationIndex - b.operationIndex)
      .map((receipt) => structuredCloneControl(receipt));
  }

  async compareAndSetChangeSetStatus(input: {
    changesetId: string;
    expectedStatus: ChangeSetStatus;
    nextStatus: ChangeSetStatus;
  }): Promise<ChangeSetRecord> {
    const entry = this.#changesets.get(input.changesetId);
    if (entry === undefined) {
      throw new VictControlError('VICT_CONTROL_CHANGESET_MISSING', 'The ChangeSet does not exist.');
    }
    if (entry.record.status !== input.expectedStatus) {
      throw new VictControlError(
        'VICT_CONTROL_CHANGESET_STATUS_CONFLICT',
        `The ChangeSet is not in the expected status; one concurrent transition already won.`,
      );
    }
    const updated: ChangeSetRecord = {
      ...structuredCloneControl(entry.record),
      status: input.nextStatus,
    };
    entry.record = structuredCloneControl(updated);
    return structuredCloneControl(updated);
  }

  async publishRelease(record: ApplicationReleaseRecord): Promise<void> {
    const existing = this.#releases.get(record.releaseVersion);
    if (existing !== undefined) {
      if (JSON.stringify(existing) !== JSON.stringify(record)) {
        throw new VictControlError(
          'VICT_CONTROL_RELEASE_COLLISION',
          'A release with this version exists with different content (immutability guard).',
        );
      }
      return; // idempotent republish
    }
    this.#releases.set(record.releaseVersion, structuredCloneControl(record));
  }

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
    // In-memory composition: the three steps run inside ONE synchronous
    // critical section (no await between effect and receipt), so the
    // effect/receipt dual-write window cannot interleave.
    await this.publishRelease(input.release);
    const selection = await this.selectRelease(input.selection);
    await this.markOperationApplied({
      changesetId: input.receipt.changesetId,
      operationIndex: input.receipt.operationIndex,
      at: input.receipt.appliedAt,
    });
    return selection;
  }

  async getRelease(releaseVersion: string): Promise<ApplicationReleaseRecord | undefined> {
    const found = this.#releases.get(releaseVersion);
    return found === undefined ? undefined : structuredCloneControl(found);
  }

  async listReleases(applicationId: string): Promise<readonly ApplicationReleaseRecord[]> {
    return [...this.#releases.values()]
      .filter((record) => record.applicationId === applicationId)
      .sort((a, b) => (a.releaseVersion < b.releaseVersion ? -1 : 1))
      .map((record) => structuredCloneControl(record));
  }

  async selectRelease(command: {
    applicationId: string;
    releaseVersion: string;
    actorId: string;
    at: number;
    reason: 'select' | 'rollback';
    readonly operationId?: string;
    readonly expectedBaseVersion?: string;
  }): Promise<{ selectionRevision: number }> {
    const existing = this.#releases.get(command.releaseVersion);
    if (existing === undefined || existing.applicationId !== command.applicationId) {
      throw new VictControlError(
        'VICT_CONTROL_RELEASE_MISSING',
        'The release version does not exist for this application.',
      );
    }
    // Operation-identity idempotency: re-application returns the ORIGINAL
    // selection revision without adding another one; conflicting content
    // under the same identity fails closed.
    if (command.operationId !== undefined) {
      const selections = this.#selections.get(command.applicationId) ?? [];
      const existingOp = selections.find(
        (selection) =>
          selection.operationId !== undefined &&
          selection.operationId === command.operationId &&
          selection.reason === command.reason,
      );
      if (existingOp !== undefined) {
        if (existingOp.releaseVersion !== command.releaseVersion) {
          throw new VictControlError(
            'VICT_CONTROL_OPERATION_IDENTITY_CONFLICT',
            'The operation identity already applied a different release; conflicting content fails closed.',
          );
        }
        return { selectionRevision: existingOp.selectionRevision };
      }
    }
    // SUBJECT-LEVEL base guard, evaluated in the same synchronous critical
    // section as the append (two racing ChangeSets on one base: exactly one
    // winner; the loser receives the stable stale-base conflict).
    if (command.expectedBaseVersion !== undefined) {
      const selected = await this.getSelectedRelease(command.applicationId);
      const selectedVersion = selected?.releaseVersion;
      const expected =
        command.expectedBaseVersion === CHANGESET_BASE_NONE
          ? undefined
          : command.expectedBaseVersion;
      if (selectedVersion !== expected) {
        throw new VictControlError(
          'VICT_CONTROL_BASE_STALE',
          'The subject base changed before the selection was applied; exactly one concurrent ChangeSet may win the base.',
        );
      }
    }
    const selections = this.#selections.get(command.applicationId) ?? [];
    const selectionRevision = selections.length + 1;
    const record: ReleaseSelectionRecord = {
      ...structuredCloneControl(command),
      selectionRevision,
    };
    selections.push(record);
    this.#selections.set(command.applicationId, selections);
    return { selectionRevision };
  }

  async getSelectedRelease(applicationId: string): Promise<ApplicationReleaseRecord | undefined> {
    const selections = this.#selections.get(applicationId) ?? [];
    const latest = selections.at(-1);
    if (latest === undefined) {
      return undefined;
    }
    return this.getRelease(latest.releaseVersion);
  }

  async listReleaseSelections(applicationId: string): Promise<readonly ReleaseSelectionRecord[]> {
    return (this.#selections.get(applicationId) ?? []).map((record) =>
      structuredCloneControl(record),
    );
  }

  async appendAuditEvent(event: ControlAuditEvent): Promise<void> {
    if (this.#audit.some((entry) => entry.auditId === event.auditId)) {
      return; // idempotent append (idempotent by auditId)
    }
    this.#audit.push(structuredCloneControl(event));
  }

  async listAuditEvents(subject: {
    subjectType?: string;
    subjectId?: string;
  }): Promise<readonly ControlAuditEvent[]> {
    return this.#audit
      .filter(
        (event) =>
          (subject.subjectType === undefined || event.subjectType === subject.subjectType) &&
          (subject.subjectId === undefined || event.subjectId === subject.subjectId),
      )
      .map((event) => structuredCloneControl(event));
  }
}

// ---- Turns ------------------------------------------------------------------

/** In-memory AgentTurnStore with compare-and-set state machine enforcement. */
export class InMemoryAgentTurnStore implements AgentTurnStore {
  readonly #turns = new Map<string, AgentTurnRecord>();
  readonly #cancels = new Map<
    string,
    { cancelId: string; actorId: string; reasonCode: string; at: number }[]
  >();

  async createTurnIntent(record: AgentTurnRecord): Promise<void> {
    const existing = this.#turns.get(record.turnId);
    if (existing !== undefined) {
      if (JSON.stringify(existing) !== JSON.stringify(record)) {
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
    this.#turns.set(record.turnId, structuredCloneControl(record));
  }

  async getTurn(turnId: string): Promise<AgentTurnRecord | undefined> {
    const record = this.#turns.get(turnId);
    return record === undefined ? undefined : structuredCloneControl(record);
  }

  async listTurns(): Promise<readonly AgentTurnRecord[]> {
    return [...this.#turns.values()]
      .sort((a, b) => (a.turnId < b.turnId ? -1 : 1))
      .map((record) => structuredCloneControl(record));
  }

  async listOpenTurns(): Promise<readonly AgentTurnRecord[]> {
    return (await this.listTurns()).filter(
      (record) =>
        record.status !== 'completed' &&
        record.status !== 'failed' &&
        record.status !== 'cancelled' &&
        record.status !== 'blocked',
    );
  }

  async startTurn(turnId: string, at: number): Promise<AgentTurnRecord> {
    return this.#transition(turnId, at, (status) => (status === 'intent' ? 'running' : undefined));
  }

  async awaitApproval(turnId: string, at: number, approvalId: string): Promise<AgentTurnRecord> {
    return this.#transition(
      turnId,
      at,
      (status) => (status === 'running' ? 'awaiting-approval' : undefined),
      { approvalId },
    );
  }

  async resumeTurn(turnId: string, at: number): Promise<AgentTurnRecord> {
    return this.#transition(turnId, at, (status) =>
      status === 'awaiting-approval' ? 'running' : undefined,
    );
  }

  async recordTurnCorrelation(
    turnId: string,
    correlation: { traceId?: string; victRunId?: string; mastraRunId?: string },
  ): Promise<void> {
    const record = this.#turns.get(turnId);
    if (record === undefined) {
      throw new VictControlError('VICT_CONTROL_TURN_MISSING', 'The turn does not exist.');
    }
    this.#turns.set(turnId, {
      ...record,
      traceId: correlation.traceId ?? record.traceId,
      victRunId: correlation.victRunId ?? record.victRunId,
      mastraRunId: correlation.mastraRunId ?? record.mastraRunId,
      updatedAt: record.updatedAt,
    });
  }

  async completeTurn(command: {
    turnId: string;
    status: 'completed' | 'failed' | 'cancelled' | 'blocked';
    at: number;
    errorCode?: string;
  }): Promise<AgentTurnRecord> {
    return this.#transition(
      command.turnId,
      command.at,
      (status) =>
        status === 'running' || status === 'awaiting-approval' || status === 'intent'
          ? command.status
          : undefined,
      { errorCode: command.errorCode },
    );
  }

  async recordCancelIntent(command: {
    turnId: string;
    cancelId: string;
    actorId: string;
    reasonCode: string;
    at: number;
  }): Promise<{ accepted: boolean; duplicate: boolean }> {
    const list = this.#cancels.get(command.turnId) ?? [];
    if (list.some((entry) => entry.cancelId === command.cancelId)) {
      return { accepted: false, duplicate: true };
    }
    list.push({
      cancelId: command.cancelId,
      actorId: command.actorId,
      reasonCode: command.reasonCode,
      at: command.at,
    });
    this.#cancels.set(command.turnId, list);
    return { accepted: true, duplicate: false };
  }

  async hasCancelIntent(turnId: string): Promise<boolean> {
    return (this.#cancels.get(turnId) ?? []).length > 0;
  }

  async reconcileTurn(command: {
    turnId: string;
    status: 'failed' | 'cancelled' | 'blocked';
    reasonCode: string;
    at: number;
  }): Promise<AgentTurnRecord | undefined> {
    const record = this.#turns.get(command.turnId);
    if (record === undefined) {
      return undefined;
    }
    if (
      record.status === 'completed' ||
      record.status === 'failed' ||
      record.status === 'cancelled' ||
      record.status === 'blocked'
    ) {
      return structuredCloneControl(record); // already terminal
    }
    const updated: AgentTurnRecord = {
      ...record,
      status: command.status,
      errorCode: command.reasonCode,
      terminalAt: command.at,
      updatedAt: command.at,
    };
    this.#turns.set(command.turnId, updated);
    return structuredCloneControl(updated);
  }

  async listCancelIntents(
    turnId: string,
  ): Promise<readonly { cancelId: string; actorId: string; reasonCode: string; at: number }[]> {
    return [...(this.#cancels.get(turnId) ?? [])];
  }

  #transition(
    turnId: string,
    at: number,
    allowed: (status: AgentTurnRecord['status']) => AgentTurnRecord['status'] | undefined,
    extra: { approvalId?: string; errorCode?: string } = {},
  ): AgentTurnRecord {
    const record = this.#turns.get(turnId);
    if (record === undefined) {
      throw new VictControlError('VICT_CONTROL_TURN_MISSING', 'The turn does not exist.');
    }
    const next = allowed(record.status);
    if (next === undefined) {
      throw new VictControlError(
        'VICT_CONTROL_TURN_INVALID_TRANSITION',
        `The turn status '${record.status}' cannot transition as requested.`,
      );
    }
    const updated: AgentTurnRecord = {
      ...record,
      status: next,
      updatedAt: at,
      ...(next === 'completed' || next === 'failed' || next === 'cancelled' || next === 'blocked'
        ? { terminalAt: at }
        : {}),
      ...(extra.errorCode !== undefined ? { errorCode: extra.errorCode } : {}),
    };
    this.#turns.set(turnId, updated);
    return structuredCloneControl(updated);
  }
}

// ---- Tool invocations ---------------------------------------------------------

/** In-memory AgentToolInvocationStore (durable-before-invocation semantics). */
export class InMemoryAgentToolInvocationStore implements AgentToolInvocationStore {
  readonly #invocations = new Map<string, AgentToolInvocationRecord>();
  readonly #byKey = new Map<string, string>();

  async recordInvocationIntent(
    record: AgentToolInvocationRecord,
  ): Promise<AgentToolInvocationRecord> {
    const existingByKey = this.#byKey.get(record.idempotencyKey);
    if (existingByKey !== undefined) {
      const existing: AgentToolInvocationRecord | undefined = this.#invocations.get(existingByKey);
      if (existing !== undefined && existing.argDigest !== record.argDigest) {
        throw new VictControlError(
          'VICT_CONTROL_INVOCATION_KEY_COLLISION',
          'The idempotency key exists with a different canonical argument digest.',
        );
      }
      if (existing !== undefined) {
        return structuredCloneControl(existing); // idempotent retry
      }
    }
    const existing = this.#invocations.get(record.invocationId);
    if (existing !== undefined) {
      if (JSON.stringify(existing) !== JSON.stringify(record)) {
        throw new VictControlError(
          'VICT_CONTROL_INVOCATION_COLLISION',
          'An invocation with this id already exists with different content.',
        );
      }
      return structuredCloneControl(existing);
    }
    if (record.status !== 'intent') {
      throw new VictControlError(
        'VICT_CONTROL_INVOCATION_INVALID_STATE',
        'A new invocation must be recorded as intent (durable-before-invocation).',
      );
    }
    this.#invocations.set(record.invocationId, structuredCloneControl(record));
    this.#byKey.set(record.idempotencyKey, record.invocationId);
    return structuredCloneControl(record);
  }

  async getInvocation(invocationId: string): Promise<AgentToolInvocationRecord | undefined> {
    const record = this.#invocations.get(invocationId);
    return record === undefined ? undefined : structuredCloneControl(record);
  }

  async getInvocationByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<AgentToolInvocationRecord | undefined> {
    const invocationId = this.#byKey.get(idempotencyKey);
    return invocationId === undefined ? undefined : this.getInvocation(invocationId);
  }

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
    const record = this.#invocations.get(command.invocationId);
    if (record === undefined) {
      throw new VictControlError(
        'VICT_CONTROL_INVOCATION_MISSING',
        'The invocation does not exist.',
      );
    }
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
    if (orderOf(command.status) < orderOf(record.status)) {
      throw new VictControlError(
        'VICT_CONTROL_INVOCATION_REGRESSION',
        'An invocation status may only move forward.',
      );
    }
    if (orderOf(record.status) >= 3 && command.status !== record.status) {
      throw new VictControlError(
        'VICT_CONTROL_INVOCATION_TERMINAL',
        'The invocation is already terminal; late results are fenced.',
      );
    }
    const updated: AgentToolInvocationRecord = {
      ...record,
      status: command.status,
      updatedAt: command.at,
      completedAt: orderOf(command.status) >= 3 ? command.at : record.completedAt,
      ...(command.resultSummary !== undefined ? { resultSummary: command.resultSummary } : {}),
      ...(command.errorCode !== undefined ? { errorCode: command.errorCode } : {}),
    };
    this.#invocations.set(command.invocationId, updated);
    return structuredCloneControl(updated);
  }

  async listInvocationsForTurn(turnId: string): Promise<readonly AgentToolInvocationRecord[]> {
    return [...this.#invocations.values()]
      .filter((record) => record.turnId === turnId)
      .sort((a, b) => (a.invocationId < b.invocationId ? -1 : 1))
      .map((record) => structuredCloneControl(record));
  }
}

// ---- Approvals ---------------------------------------------------------------

/** In-memory AgentApprovalStore (first decision wins; exact binding). */
export class InMemoryAgentApprovalStore implements AgentApprovalStore {
  readonly #approvals = new Map<string, AgentApprovalRecord>();
  readonly #byInvocation = new Map<string, string>();

  async createPendingApproval(record: AgentApprovalRecord): Promise<AgentApprovalRecord> {
    if (this.#approvals.has(record.approvalId)) {
      const existing = this.#approvals.get(record.approvalId);
      if (JSON.stringify(existing) !== JSON.stringify(record)) {
        throw new VictControlError(
          'VICT_CONTROL_APPROVAL_COLLISION',
          'An approval with this id already exists with different content.',
        );
      }
      return structuredCloneControl(existing as AgentApprovalRecord);
    }
    if (this.#byInvocation.has(record.invocationId)) {
      // One pending approval per invocation: a duplicate request for the
      // same logical invocation reuses the existing record.
      const existingId = this.#byInvocation.get(record.invocationId) as string;
      const existing = this.#approvals.get(existingId);
      if (existing !== undefined && existing.status === 'pending') {
        return structuredCloneControl(existing);
      }
    }
    if (record.status !== 'pending') {
      throw new VictControlError(
        'VICT_CONTROL_APPROVAL_INVALID_STATE',
        'A new approval record must be pending.',
      );
    }
    this.#approvals.set(record.approvalId, structuredCloneControl(record));
    this.#byInvocation.set(record.invocationId, record.approvalId);
    return structuredCloneControl(record);
  }

  async getApproval(approvalId: string): Promise<AgentApprovalRecord | undefined> {
    const record = this.#approvals.get(approvalId);
    return record === undefined ? undefined : structuredCloneControl(record);
  }

  async listOpenApprovals(): Promise<readonly AgentApprovalRecord[]> {
    return [...this.#approvals.values()]
      .filter((record) => record.status === 'pending')
      .sort((a, b) => (a.approvalId < b.approvalId ? -1 : 1))
      .map((record) => structuredCloneControl(record));
  }

  async listApprovalsForInvocation(invocationId: string): Promise<readonly AgentApprovalRecord[]> {
    const approvalId = this.#byInvocation.get(invocationId);
    if (approvalId === undefined) {
      return [];
    }
    const record = this.#approvals.get(approvalId);
    return record === undefined ? [] : [structuredCloneControl(record)];
  }

  async decideApproval(command: {
    approvalId: string;
    approverActorId: string;
    decision: 'approved' | 'declined';
    decidedAt: number;
    decisionReason?: string;
  }): Promise<AgentApprovalRecord> {
    const record = this.#approvals.get(command.approvalId);
    if (record === undefined) {
      throw new VictControlError(
        'VICT_CONTROL_APPROVAL_MISSING',
        'The approval record does not exist.',
      );
    }
    if (record.status === 'approved' || record.status === 'declined') {
      if (record.status === command.decision) {
        return structuredCloneControl(record); // idempotent identical decision
      }
      throw new VictControlError(
        'VICT_CONTROL_APPROVAL_CONFLICT',
        'A competing decision already stands; the first durable decision is the winner.',
      );
    }
    if (record.status === 'expired') {
      throw new VictControlError(
        'VICT_CONTROL_APPROVAL_EXPIRED',
        'The approval request expired and cannot be decided.',
      );
    }
    const updated: AgentApprovalRecord = {
      ...record,
      status: command.decision,
      decidedAt: command.decidedAt,
      approverActorId: command.approverActorId,
      ...(command.decisionReason !== undefined ? { decisionReason: command.decisionReason } : {}),
    };
    this.#approvals.set(command.approvalId, updated);
    return structuredCloneControl(updated);
  }

  async expireApproval(command: { approvalId: string; at: number }): Promise<AgentApprovalRecord> {
    const record = this.#approvals.get(command.approvalId);
    if (record === undefined) {
      throw new VictControlError(
        'VICT_CONTROL_APPROVAL_MISSING',
        'The approval record does not exist.',
      );
    }
    if (record.status === 'expired') {
      return structuredCloneControl(record); // idempotent
    }
    if (record.status !== 'pending') {
      throw new VictControlError(
        'VICT_CONTROL_APPROVAL_INVALID_STATE',
        'Only a pending approval can expire.',
      );
    }
    const updated: AgentApprovalRecord = { ...record, status: 'expired', decidedAt: command.at };
    this.#approvals.set(command.approvalId, updated);
    return structuredCloneControl(updated);
  }
}

// ---- Stream ledger -----------------------------------------------------------

/** In-memory AgentStreamLedgerStore (per-stream monotonic sequences).
 *
 * The RAW ledger port enforces the final `vict.agent-stream@1` schema at
 * the store boundary: plain-JS callers cannot persist unknown kinds,
 * non-canonical payloads, or mismatched content. Validation happens
 * BEFORE any sequence state or storage mutates, so a rejected write
 * leaves the stream exactly as before.
 */
export class InMemoryAgentStreamLedgerStore implements AgentStreamLedgerStore {
  readonly #streams = new Map<string, number>();
  readonly #events = new Map<string, AgentStreamLedgerEvent[]>();

  async appendEvent(command: {
    streamId: string;
    kind: import('@vict/contracts').AgentStreamEventKind;
    payload: string;
    at: number;
  }): Promise<{ seq: number; persisted: boolean }> {
    // The gate: compute the sequence that WOULD be assigned and validate
    // the full event BEFORE incrementing any state.
    const next = (this.#streams.get(command.streamId) ?? 0) + 1;
    validateStreamLedgerAppend({
      streamId: command.streamId,
      kind: command.kind,
      payload: command.payload,
      assignedSeq: next,
    });
    this.#streams.set(command.streamId, next);
    const persisted = isDurableStreamKind(command.kind);
    if (persisted) {
      const list = this.#events.get(command.streamId) ?? [];
      list.push({
        streamId: command.streamId,
        seq: next,
        kind: command.kind,
        payload: command.payload,
        createdAt: command.at,
      });
      this.#events.set(command.streamId, list);
    }
    return { seq: next, persisted };
  }

  async latestSeq(streamId: string): Promise<number> {
    return this.#streams.get(streamId) ?? 0;
  }

  async listEventsFrom(
    streamId: string,
    afterSeq: number,
    limit?: number,
  ): Promise<readonly AgentStreamLedgerEvent[]> {
    const matched = (this.#events.get(streamId) ?? []).filter((event) => event.seq > afterSeq);
    const bounded = limit !== undefined ? matched.slice(0, Math.max(0, limit)) : matched;
    return bounded.map((event) => structuredCloneControl(event));
  }

  async listStreamIds(): Promise<readonly string[]> {
    return [...this.#streams.keys()].sort();
  }
}

// ---- Command idempotency ------------------------------------------------------

// ---- Command idempotency ------------------------------------------------------

/**
 * In-memory CommandIdempotencyStore. Receipts are NAMESPACED by
 * (actor, command, key); `pending` receipts carry a durable lease
 * (owner + expiry + attempts) so a crashed claimer never sticks the key:
 * a retrying caller takes the expired lease over. Deterministic failures
 * settle `failed` (replayed); retryable failures RELEASE the claim.
 */
export class InMemoryCommandIdempotencyStore implements CommandIdempotencyStore {
  readonly #receipts = new Map<string, CommandIdempotencyReceipt>();

  static #name(receipt: { actorId: string; command: string; idempotencyKey: string }): string {
    return `${receipt.actorId}\u0000${receipt.command}\u0000${receipt.idempotencyKey}`;
  }

  async claimReceipt(record: CommandIdempotencyReceipt): Promise<'claimed' | 'exists'> {
    const key = InMemoryCommandIdempotencyStore.#name(record);
    const existing = this.#receipts.get(key);
    if (existing !== undefined) {
      return 'exists';
    }
    this.#receipts.set(key, structuredCloneControl(record));
    return 'claimed';
  }

  async getReceipt(name: CommandIdempotencyName): Promise<CommandIdempotencyReceipt | undefined> {
    const found = this.#receipts.get(InMemoryCommandIdempotencyStore.#name(name));
    return found === undefined ? undefined : structuredCloneControl(found);
  }

  async findReceiptByActorKey(input: {
    actorId: string;
    idempotencyKey: string;
  }): Promise<CommandIdempotencyReceipt | undefined> {
    for (const receipt of this.#receipts.values()) {
      if (receipt.actorId === input.actorId && receipt.idempotencyKey === input.idempotencyKey) {
        return structuredCloneControl(receipt);
      }
    }
    return undefined;
  }

  async completeReceipt(input: {
    actorId: string;
    command: string;
    idempotencyKey: string;
    resultJson: string;
    at: number;
  }): Promise<void> {
    const key = InMemoryCommandIdempotencyStore.#name(input);
    const found = this.#receipts.get(key);
    if (found === undefined) {
      throw new VictControlError(
        'VICT_IDEMPOTENCY_RECEIPT_MISSING',
        'No idempotency receipt exists for this key namespace.',
      );
    }
    if (found.status === 'pending') {
      const updated: CommandIdempotencyReceipt = {
        ...found,
        status: 'completed',
        resultJson: input.resultJson,
        settledAt: input.at,
        owner: undefined,
        leaseUntil: undefined,
      };
      this.#receipts.set(key, structuredCloneControl(updated));
    }
  }

  async failReceipt(input: {
    actorId: string;
    command: string;
    idempotencyKey: string;
    responseCode: string;
    at: number;
  }): Promise<void> {
    const key = InMemoryCommandIdempotencyStore.#name(input);
    const found = this.#receipts.get(key);
    if (found === undefined) {
      throw new VictControlError(
        'VICT_IDEMPOTENCY_RECEIPT_MISSING',
        'No idempotency receipt exists for this key namespace.',
      );
    }
    if (found.status === 'pending') {
      const updated: CommandIdempotencyReceipt = {
        ...found,
        status: 'failed',
        responseCode: input.responseCode,
        settledAt: input.at,
        owner: undefined,
        leaseUntil: undefined,
      };
      this.#receipts.set(key, structuredCloneControl(updated));
    }
  }

  async releaseReceipt(input: {
    actorId: string;
    command: string;
    idempotencyKey: string;
    at: number;
  }): Promise<void> {
    const key = InMemoryCommandIdempotencyStore.#name(input);
    const found = this.#receipts.get(key);
    if (found === undefined) {
      return;
    }
    if (found.status === 'pending') {
      this.#receipts.delete(key); // claimable again (retryable failure)
    }
  }

  async takeOverExpiredLease(input: {
    actorId: string;
    command: string;
    idempotencyKey: string;
    owner: string;
    leaseUntil: number;
    at: number;
  }): Promise<'taken' | 'not-expired' | 'missing'> {
    const key = InMemoryCommandIdempotencyStore.#name(input);
    const found = this.#receipts.get(key);
    if (found === undefined) {
      return 'missing';
    }
    if (found.status !== 'pending') {
      return 'not-expired'; // settled: replay path handles it
    }
    if ((found.leaseUntil ?? 0) > input.at) {
      return 'not-expired'; // the previous owner may still be executing
    }
    const updated: CommandIdempotencyReceipt = {
      ...found,
      owner: input.owner,
      leaseUntil: input.leaseUntil,
      attempts: found.attempts + 1,
    };
    this.#receipts.set(key, structuredCloneControl(updated));
    return 'taken';
  }
}

/** The in-memory Stage 06B store set. */
export function createInMemoryAgentControlStores() {
  return {
    actors: new InMemoryActorDirectory(),
    control: new InMemoryControlPlaneStore(),
    turns: new InMemoryAgentTurnStore(),
    invocations: new InMemoryAgentToolInvocationStore(),
    approvals: new InMemoryAgentApprovalStore(),
    streamLedger: new InMemoryAgentStreamLedgerStore(),
    commandIdempotency: new InMemoryCommandIdempotencyStore(),
  };
}

/** Structured clone that preserves plain canonical records. */
function structuredCloneControl<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Deterministic id helper for in-memory fixtures. */
export function deterministicId(prefix: string, seed: string): string {
  return `${prefix}_${digest(seed)}`;
}
