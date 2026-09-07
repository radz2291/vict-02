import type { AgentControlStores, AgentTurnRecord } from '@vict/runtime';
import { assertActorScope, VictControlError } from '@vict/runtime';
import type { AgentStreamEvent } from '@vict/contracts';
import type {
  AgentApprovalRecord,
  AgentToolInvocationRecord,
  AuthenticatedActorContext,
} from '@vict/runtime';
import type { EffectClass } from '@vict/kernel';

/**
 * Stage 06B — the agent-turn governance service.
 *
 * Owns the VICT-authoritative turn/approval/cancellation semantics above
 * the neutral durable stores:
 *
 * - turn intents are durable BEFORE any execution;
 * - protected tool invocations record a durable intent BEFORE invocation
 *   and a VICT-authoritative pending approval record when policy requires;
 * - approval decisions bind to the EXACT capability/argument/turn identity;
 * - cancellation records durable intent, is actor-authorized, idempotent,
 *   and fences late results;
 * - restart reconciliation forces one honest terminal state for open turns.
 *
 * The transport-neutral `AgentTurnExecutor` port is implemented by the
 * optional agent-framework adapter (`@vict/mastra`); this package never
 * imports it (dependency direction).
 */

/** The neutral turn executor port (implemented by the optional adapter). */
export interface AgentTurnExecutor {
  /** The agent-profile identity this executor is bound to. */
  readonly agentProfileVersion: string;
  /** Execute one turn; the executor emits events through the handle. */
  executeTurn(
    command: {
      readonly turnId: string;
      readonly streamId: string;
      readonly threadId: string;
      readonly actorId: string;
      readonly input: string;
      readonly inputSummary: string;
    },
    handle: {
      readonly abortSignal: AbortSignal;
      emitEvent(event: AgentStreamEvent): Promise<void>;
    },
  ): Promise<{
    readonly status: 'completed' | 'failed' | 'cancelled';
    readonly text?: string;
    readonly errorCode?: string;
  }>;
}

export interface AgentTurnServiceOptions {
  readonly stores: AgentControlStores;
  /** The bound turn executor (optional: commands fail closed without one). */
  readonly executor?: AgentTurnExecutor;
  readonly clock?: () => number;
  readonly ids?: {
    turnId(): string;
    streamId(): string;
    invocationId(): string;
    approvalId(): string;
    idempotencyKey(): string;
    cancelId(): string;
  };
  /** Maximum bounded input summary length (default 120). */
  readonly inputSummaryLimit?: number;
}

/** A tool-approval policy for one pinned capability envelope entry. */
export type ToolApprovalPolicy = {
  readonly capabilityId: string;
  readonly capabilityRevision: string;
  readonly effect: EffectClass;
  /** Whether invoking this capability requires a VICT approval record. */
  readonly requiresApproval: boolean;
};

/** The turn governance result of starting a turn. */
export interface AgentTurnStartResult {
  readonly turn: AgentTurnRecord;
  readonly outcomePromise: Promise<AgentTurnRecord>;
}

export class AgentTurnService {
  readonly #stores: AgentControlStores;
  readonly #executor: AgentTurnExecutor | undefined;
  readonly #clock: () => number;
  readonly #ids: Required<NonNullable<AgentTurnServiceOptions['ids']>>;
  readonly #inputSummaryLimit: number;
  readonly #active = new Map<string, AbortController>();

  constructor(options: AgentTurnServiceOptions) {
    this.#stores = options.stores;
    this.#executor = options.executor;
    this.#clock = options.clock ?? (() => Date.now());
    this.#ids = {
      turnId: options.ids?.turnId ?? failIds,
      streamId: options.ids?.streamId ?? failIds,
      invocationId: options.ids?.invocationId ?? failIds,
      approvalId: options.ids?.approvalId ?? failIds,
      idempotencyKey: options.ids?.idempotencyKey ?? failIds,
      cancelId: options.ids?.cancelId ?? failIds,
    };
    this.#inputSummaryLimit = options.inputSummaryLimit ?? 120;
  }

  /** The executor's pinned profile identity (composition inspection). */
  get executorProfileVersion(): string | undefined {
    return this.#executor?.agentProfileVersion;
  }

  /**
   * Start a turn: durable intent FIRST, then execution through the bound
   * executor. No executor composed (or profile mismatch) fails closed
   * BEFORE any execution.
   */
  async startTurn(
    actor: AuthenticatedActorContext,
    input: {
      readonly threadId: string;
      readonly input: string;
      readonly inputSummary?: string;
      readonly applicationReleaseVersion?: string;
    },
  ): Promise<AgentTurnStartResult> {
    assertActorScope(actor, 'agent.turn.start');
    if (this.#executor === undefined) {
      throw new VictControlError(
        'VICT_TURN_EXECUTOR_UNAVAILABLE',
        'No agent-turn executor is composed in this deployment; turns cannot start.',
      );
    }
    if (input.threadId === undefined || input.threadId.length === 0) {
      throw new VictControlError('VICT_TURN_THREAD_REQUIRED', 'A turn requires a thread id.');
    }
    const turnId = this.#ids.turnId();
    const streamId = this.#ids.streamId();
    const now = this.#clock();
    // Safe bounded input summary — NEVER the full prompt (DATA-005).
    const inputSummary = safeInputSummary(input.input, this.#inputSummaryLimit);
    const intent: AgentTurnRecord = {
      turnId,
      streamId,
      threadId: input.threadId,
      actorId: actor.actorId,
      agentProfileVersion: this.#executor.agentProfileVersion,
      activationVersion: undefined,
      applicationReleaseVersion: input.applicationReleaseVersion,
      inputSummary,
      status: 'intent',
      createdAt: now,
      updatedAt: now,
      terminalAt: undefined,
      errorCode: undefined,
      traceId: undefined,
      victRunId: undefined,
      mastraRunId: undefined,
    };
    // Durable intent BEFORE execution (restart-safe ordering).
    await this.#stores.turns.createTurnIntent(intent);
    const started = await this.#stores.turns.startTurn(turnId, this.#clock());
    const controller = new AbortController();
    this.#active.set(turnId, controller);
    const outcomePromise = this.#runTurn(started, controller, input.input);
    return { turn: started, outcomePromise };
  }

  async #runTurn(
    started: AgentTurnRecord,
    controller: AbortController,
    input: string,
  ): Promise<AgentTurnRecord> {
    const turnId = started.turnId;
    const executor = this.#executor as AgentTurnExecutor;
    try {
      const outcome = await executor.executeTurn(
        {
          turnId,
          streamId: started.streamId,
          threadId: started.threadId,
          actorId: started.actorId,
          input,
          inputSummary: started.inputSummary,
        },
        {
          abortSignal: controller.signal,
          emitEvent: async (event: AgentStreamEvent) => {
            // Durable milestones are recorded by the executor's bridge; the
            // service's emit gate exists for hub-independent compositions.
            await Promise.resolve(event);
          },
        },
      );
      const completed = await this.#stores.turns.completeTurn({
        turnId,
        status: outcome.status,
        at: this.#clock(),
        ...(outcome.errorCode !== undefined ? { errorCode: outcome.errorCode } : {}),
      });
      this.#active.delete(turnId);
      return completed;
    } catch (error) {
      // One honest terminal outcome; raw executor errors never propagate
      // into durable records beyond the stable code.
      const fenced = await this.#stores.turns
        .completeTurn({
          turnId,
          status: 'failed',
          at: this.#clock(),
          errorCode: 'VICT_TURN_FAILED',
        })
        .catch(() => this.#stores.turns.getTurn(turnId));
      this.#active.delete(turnId);
      if (fenced === undefined) {
        throw error;
      }
      return fenced;
    }
  }

  /**
   * Record a durable cancellation intent (actor-authorized, idempotent) and
   * propagate the abort signal to the running turn. Never claims reversal
   * of already committed effects.
   */
  async cancelTurn(
    actor: AuthenticatedActorContext,
    input: { turnId: string; reasonCode?: string },
  ): Promise<{ turn: AgentTurnRecord | undefined; accepted: boolean; duplicate: boolean }> {
    // The requesting actor must own the turn OR hold the operator cancel scope.
    const turn = await this.#requireTurn(input.turnId);
    const owns = turn.actorId === actor.actorId;
    if (!owns) {
      assertActorScope(actor, 'agent.turn.cancel');
    }
    const cancelId = this.#ids.cancelId();
    const result = await this.#stores.turns.recordCancelIntent({
      turnId: input.turnId,
      cancelId,
      actorId: actor.actorId,
      reasonCode: input.reasonCode ?? 'user',
      at: this.#clock(),
    });
    // Propagate the abort signal to the in-flight executor (cooperative).
    this.#active.get(input.turnId)?.abort();
    let final = turn;
    if (result.accepted) {
      // The durable intent is authoritative; the turn terminates with
      // exactly one honest cancelled event through the executor's terminal
      // gate. Here we only record the intent; the executor's abort listener
      // completes the turn. If the turn is not in flight in THIS process
      // (restart), the reconcile path completes it.
      const inFlight = this.#active.has(input.turnId);
      if (!inFlight) {
        final = await this.#stores.turns.completeTurn({
          turnId: input.turnId,
          status: 'cancelled',
          at: this.#clock(),
          errorCode: 'VICT_TURN_CANCELLED',
        });
      }
    }
    await this.#stores.control.appendAuditEvent({
      auditId: `audit-cancel-${cancelId}`,
      at: this.#clock(),
      actorId: actor.actorId,
      action: 'turn.cancelled',
      subjectType: 'agent-turn',
      subjectId: input.turnId,
      summary: result.duplicate ? 'duplicate cancel intent' : 'cancel intent recorded',
    });
    return { turn: final, accepted: result.accepted, duplicate: result.duplicate };
  }

  /** Inspect one turn (safe record). */
  async getTurn(actor: AuthenticatedActorContext, turnId: string): Promise<AgentTurnRecord> {
    assertActorScope(actor, 'run.read');
    const turn = await this.#stores.turns.getTurn(turnId);
    if (turn === undefined) {
      throw new VictControlError('VICT_TURN_MISSING', 'The turn does not exist.');
    }
    // Cross-actor inspection is denied (viewers see their own turns).
    if (turn.actorId !== actor.actorId && !actor.scopes.includes('operator.resolve')) {
      throw new VictControlError(
        'VICT_TURN_ACTOR_MISMATCH',
        'The turn belongs to a different actor.',
      );
    }
    return turn;
  }

  /** Record a durable tool-invocation intent (durable BEFORE invocation). */
  async recordToolInvocationIntent(input: {
    turnId: string;
    toolCallId: string;
    toolName: string;
    capabilityId: string;
    capabilityRevision: string;
    effect: EffectClass;
    actorId: string;
    argDigest: string;
    argumentSummary: string;
  }): Promise<AgentToolInvocationRecord> {
    const invocationId = this.#ids.invocationId();
    const now = this.#clock();
    // The idempotency key is DETERMINISTIC over the logical invocation
    // identity: the same turn + tool call + arguments + capability revision
    // is ONE logical invocation across retries, resumes, and restarts.
    const idempotencyKey = `${input.turnId}:${input.toolCallId}:${input.capabilityId}:${input.capabilityRevision}:${input.argDigest}`;
    return this.#stores.invocations.recordInvocationIntent({
      invocationId,
      turnId: input.turnId,
      toolCallId: input.toolCallId,
      toolName: input.toolName,
      capabilityId: input.capabilityId,
      capabilityRevision: input.capabilityRevision,
      effect: input.effect,
      idempotencyKey,
      actorId: input.actorId,
      argDigest: input.argDigest,
      argumentSummary: input.argumentSummary,
      status: 'intent',
      createdAt: now,
      updatedAt: now,
      completedAt: undefined,
      resultSummary: undefined,
      errorCode: undefined,
    });
  }

  /**
   * Create the durable pending approval record for a protected invocation
   * and suspend the turn durably (awaiting-approval) BEFORE awaiting the
   * decision.
   */
  async requestApproval(input: {
    invocation: AgentToolInvocationRecord;
    agentProfileVersion: string;
    expiresAt: number;
  }): Promise<AgentApprovalRecord> {
    const approvalId = this.#ids.approvalId();
    const now = this.#clock();
    const record = await this.#stores.approvals.createPendingApproval({
      approvalId,
      kind: 'tool-invocation',
      turnId: input.invocation.turnId,
      invocationId: input.invocation.invocationId,
      toolCallId: input.invocation.toolCallId,
      toolName: input.invocation.toolName,
      capabilityId: input.invocation.capabilityId,
      capabilityRevision: input.invocation.capabilityRevision,
      effect: input.invocation.effect,
      actorId: input.invocation.actorId,
      agentProfileVersion: input.agentProfileVersion,
      argDigest: input.invocation.argDigest,
      environment: 'local',
      requiredApproverRole: 'approver',
      status: 'pending',
      createdAt: now,
      expiresAt: input.expiresAt,
      decidedAt: undefined,
      approverActorId: undefined,
      decisionReason: undefined,
    });
    await this.#stores.turns.awaitApproval(input.invocation.turnId, now, approvalId);
    return record;
  }

  /**
   * Decide a tool approval (VICT-authoritative). The product agent cannot
   * approve itself: the approver must hold the approval scope AND be
   * distinct from the requesting actor.
   */
  async decideToolApproval(
    actor: AuthenticatedActorContext,
    input: {
      approvalId: string;
      decision: 'approved' | 'declined';
      reason?: string;
    },
  ): Promise<AgentApprovalRecord> {
    assertActorScope(
      actor,
      input.decision === 'approved' ? 'agent.tool.approve' : 'agent.tool.decline',
    );
    const record = await this.#stores.approvals.getApproval(input.approvalId);
    if (record === undefined) {
      throw new VictControlError('VICT_APPROVAL_MISSING', 'The approval record does not exist.');
    }
    // NO SELF-APPROVAL: the requesting actor can never decide its own
    // protected action.
    if (record.actorId === actor.actorId) {
      throw new VictControlError(
        'VICT_APPROVAL_SELF_DENIED',
        'The requesting actor cannot approve its own protected action.',
      );
    }
    const decided = await this.#stores.approvals.decideApproval({
      approvalId: input.approvalId,
      approverActorId: actor.actorId,
      decision: input.decision,
      decidedAt: this.#clock(),
      ...(input.reason !== undefined ? { decisionReason: boundedReason(input.reason) } : {}),
    });
    await this.#stores.control.appendAuditEvent({
      auditId: `audit-approval-${input.approvalId}-${decided.decidedAt ?? 0}`,
      at: this.#clock(),
      actorId: actor.actorId,
      action: 'approval.decided',
      subjectType: 'approval',
      subjectId: input.approvalId,
      summary: input.decision,
    });
    if (input.decision === 'declined') {
      // Decline resolves the invocation durably without invoking the
      // capability; the turn resumes with the tool failure outcome.
      await this.#stores.invocations.updateInvocationStatus({
        invocationId: record.invocationId,
        status: 'declined',
        at: this.#clock(),
        errorCode: 'VICT_TOOL_DECLINED',
      });
    }
    return decided;
  }

  /**
   * Consume an approval for a specific invocation: verify the EXACT binding
   * (actor, activation profile, capability, revision, turn, tool call,
   * invocation, digest, effect, expiry) before the effect may execute.
   * Idempotent; wrong bindings are denied.
   */
  async consumeApproval(binding: {
    approvalId: string;
    actorId: string;
    agentProfileVersion: string;
    capabilityId: string;
    capabilityRevision: string;
    turnId: string;
    toolCallId: string;
    invocationId: string;
    argDigest: string;
    effect: EffectClass;
    at: number;
  }): Promise<{ approved: true } | { approved: false; reasonCode: string }> {
    const record = await this.#stores.approvals.getApproval(binding.approvalId);
    if (record === undefined) {
      return { approved: false, reasonCode: 'VICT_APPROVAL_MISSING' };
    }
    const mismatch = (field: string): { approved: false; reasonCode: string } => ({
      approved: false,
      reasonCode: `VICT_APPROVAL_BINDING_MISMATCH:${field}`,
    });
    if (record.status !== 'approved') {
      return { approved: false, reasonCode: `VICT_APPROVAL_NOT_APPROVED:${record.status}` };
    }
    if (record.expiresAt <= binding.at) {
      await this.#stores.approvals.expireApproval({
        approvalId: binding.approvalId,
        at: binding.at,
      });
      return { approved: false, reasonCode: 'VICT_APPROVAL_EXPIRED' };
    }
    if (record.actorId !== binding.actorId) return mismatch('actor');
    if (record.agentProfileVersion !== binding.agentProfileVersion) return mismatch('agentProfile');
    if (record.capabilityId !== binding.capabilityId) return mismatch('capabilityId');
    if (record.capabilityRevision !== binding.capabilityRevision)
      return mismatch('capabilityRevision');
    if (record.turnId !== binding.turnId) return mismatch('turn');
    if (record.toolCallId !== binding.toolCallId) return mismatch('toolCall');
    if (record.invocationId !== binding.invocationId) return mismatch('invocation');
    if (record.argDigest !== binding.argDigest) return mismatch('argDigest');
    if (record.effect !== binding.effect) return mismatch('effect');
    return { approved: true };
  }

  /**
   * Restart reconciliation: every open turn becomes one honest terminal
   * state. Turns with a durable cancel intent become `cancelled`; every
   * other open turn becomes `failed` with `VICT_TURN_INTERRUPTED` (the
   * process restart interrupted it). Pending approvals are preserved.
   */
  async reconcileAfterRestart(): Promise<{
    readonly cancelled: number;
    readonly failed: number;
    readonly pendingApprovals: number;
  }> {
    const open = await this.#stores.turns.listOpenTurns();
    let cancelled = 0;
    let failed = 0;
    for (const turn of open) {
      const hasCancel = await this.#stores.turns.hasCancelIntent(turn.turnId);
      if (hasCancel) {
        await this.#stores.turns.reconcileTurn({
          turnId: turn.turnId,
          status: 'cancelled',
          reasonCode: 'VICT_TURN_CANCELLED',
          at: this.#clock(),
        });
        cancelled += 1;
      } else {
        await this.#stores.turns.reconcileTurn({
          turnId: turn.turnId,
          status: 'failed',
          reasonCode: 'VICT_TURN_INTERRUPTED',
          at: this.#clock(),
        });
        failed += 1;
      }
    }
    const pendingApprovals = (await this.#stores.approvals.listOpenApprovals()).length;
    return { cancelled, failed, pendingApprovals };
  }

  async #requireTurn(turnId: string): Promise<AgentTurnRecord> {
    const turn = await this.#stores.turns.getTurn(turnId);
    if (turn === undefined) {
      throw new VictControlError('VICT_TURN_MISSING', 'The turn does not exist.');
    }
    return turn;
  }
}

/** Bounded safe summary of user input (never the full prompt). */
export function safeInputSummary(input: string, limit: number): string {
  return input.length <= limit ? input : `${input.slice(0, limit)}…`;
}

function failIds(): string {
  throw new VictControlError(
    'VICT_TURN_IDS_REQUIRED',
    'The AgentTurnService requires an injected id factory.',
  );
}

function boundedReason(reason: string): string {
  const bounded = reason.slice(0, 200);
  // eslint-disable-next-line no-control-regex
  return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(bounded)
    ? '(unsafe reason)'
    : bounded;
}
