import { createTool } from '@mastra/core/tools';
import { createHash } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { toCanonicalJson, VictControlError } from '@vict/runtime';
import type {
  AgentProfileActivation,
  AgentToolInvocationRecord,
  AgentApprovalRecord,
} from '@vict/runtime';
import type { AgentStreamEvent } from '@vict/contracts';
import type { CapabilityDefinition, CapabilityContext, EffectClass } from '@vict/sdk';

/**
 * Stage 06B — the VICT capability-to-Mastra tool bridge (AI-005/006,
 * MSTR-004/005, amendment §7).
 *
 * The bridge is the ONLY path from model tool selection to VICT-governed
 * execution. For every effectful tool request it enforces this exact
 * order:
 *
 * ```text
 * Mastra tool request
 * → closed tool-envelope validation
 * → resolve pinned capability ID and revision
 * → authenticated actor and authority check
 * → authoritative VICT input-contract validation
 * → effect and approval policy
 * → durable intent where required
 * → capability invocation
 * → authoritative output-contract validation
 * → sanitized result returned to Mastra
 * ```
 *
 * Hard rules enforced here:
 * - ONLY capabilities in the immutable activation authority envelope become
 *   model-facing tools; tool names/descriptions cannot widen authority;
 * - prompt injection, memory content, and model output cannot add tools,
 *   permissions, roles, or secrets (the tool set derives from the FROZEN
 *   snapshot and is never re-read from any live object);
 * - missing, extra, stale, wrong-revision, and ambiguous tools fail closed;
 * - VICT contract validation is authoritative even when the Mastra schema
 *   validation passed;
 * - durable intent precedes effect invocation; irreversible ambiguity is
 *   blocked; protected effects require a VICT approval record bound to the
 *   exact capability/revision/turn/tool-call/invocation identity and the
 *   canonical argument digest (MSTR-005) — Mastra suspension is a waiting
 *   mechanism, never authorization;
 * - a model can never approve its own action (the approving actor must be
 *   distinct from the requesting actor and hold the approval scope —
 *   enforced in the turn governance service);
 * - tool arguments/results/errors never leak beyond explicitly safe
 *   summaries; raw capability errors and secrets never re-enter the model.
 */

/** Stable sanitized bridge failure codes returned to the model (never raw content). */
export type CapabilityToolFailureCode =
  | 'VICT_CAPABILITY_INPUT_CONTRACT_REJECTED'
  | 'VICT_CAPABILITY_OUTPUT_CONTRACT_REJECTED'
  | 'VICT_CAPABILITY_INVOCATION_FAILED'
  | 'VICT_CAPABILITY_OUTCOME_UNKNOWN'
  | 'VICT_CAPABILITY_AUTHORITY_DENIED'
  | 'VICT_CAPABILITY_DECLINED'
  | 'VICT_CAPABILITY_AWAITING_APPROVAL_TIMED_OUT'
  | 'VICT_CAPABILITY_CANCELLED'
  | 'VICT_CAPABILITY_TOOL_LIMIT_EXCEEDED';

/** The structured safe result returned to the model. */
export interface CapabilityToolFailure {
  readonly victCapabilityFailure: CapabilityToolFailureCode;
}

/** The effect/approval policy derived for one pinned envelope entry. */
export interface BridgeCapabilityPolicy {
  readonly capabilityId: string;
  readonly capabilityRevision: string;
  readonly effect: EffectClass;
  /** Whether a VICT approval record is required before invocation. */
  readonly requiresApproval: boolean;
}

/**
 * Default policy: `irreversible` and `write` require VICT approval;
 * `read` and `pure` do not. A policy may be stricter, never weaker.
 */
export function defaultBridgePolicy(
  capabilityId: string,
  capabilityRevision: string,
  effect: EffectClass,
): BridgeCapabilityPolicy {
  return {
    capabilityId,
    capabilityRevision,
    effect,
    requiresApproval: effect === 'write' || effect === 'irreversible',
  };
}

/** Resolve one pinned envelope reference to the actual pinned definition. */
export type CapabilityResolver = (
  capabilityId: string,
  revision: string,
) => CapabilityDefinition<unknown, unknown> | undefined;

/** The capability invocation boundary (composition-supplied; least authority). */
export type CapabilityInvoker = (
  definition: CapabilityDefinition<unknown, unknown>,
  input: unknown,
  context: Partial<CapabilityContext>,
) => Promise<unknown>;

/** The durable ports the bridge drives (neutral runtime/control ports). */
export interface CapabilityBridgeDeps {
  /** Resolve pinned capability definitions (immutable registration). */
  readonly resolveCapability: CapabilityResolver;
  /** The capability invocation boundary (authority-gated). */
  readonly invoke: CapabilityInvoker;
  /** Durable-before-invocation intent recording. */
  recordInvocationIntent(input: {
    turnId: string;
    toolCallId: string;
    toolName: string;
    capabilityId: string;
    capabilityRevision: string;
    effect: EffectClass;
    actorId: string;
    argDigest: string;
    argumentSummary: string;
  }): Promise<AgentToolInvocationRecord>;
  /**
   * Durable count of invocations already recorded for the turn. Used for
   * the DETERMINISTIC tool-call identity fallback (turn context + ordinal
   * — never current time), stable across retries and restarts.
   */
  getTurnInvocationOrdinal(turnId: string): Promise<number>;
  /** Durable pending approval creation + turn suspension (awaiting-approval). */
  requestApproval(input: {
    invocation: AgentToolInvocationRecord;
    agentProfileVersion: string;
    expiresAt: number;
  }): Promise<AgentApprovalRecord>;
  /** Exact-binding approval consumption. */
  consumeApproval(binding: {
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
  }): Promise<{ approved: true } | { approved: false; reasonCode: string }>;
  /** Invocation status transitions (forward-only, terminal-fenced). */
  updateInvocationStatus(command: {
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
  }): Promise<AgentToolInvocationRecord>;
  /** Find the EXISTING approval record id for an invocation (retry/restart reuse). */
  findExistingApproval?(invocationId: string): Promise<string | undefined>;
  /** Poll one approval record's current durable status. */
  pollApprovalDecision?(
    approvalId: string,
  ): Promise<{ status: AgentApprovalRecord['status'] } | undefined>;
  /** Per-turn tool budget gate (adapter-supplied; see helper-tools). */
  readonly budgetGate?: () => 'allowed' | 'denied' | 'outside-turn';
  /** Event emission for the durable `tool.awaiting_approval` milestone. */
  readonly emitAwaitingApproval?: (event: AgentStreamEvent) => Promise<void>;
  readonly clock?: () => number;
  /** Approval wait expiry in ms (default 15 minutes). */
  readonly approvalExpiryMs?: number;
  /** Approval decision poll interval in ms (default 25 ms, bounded). */
  readonly pollIntervalMs?: number;
}

/** Turn-scoped identity for one tool execution. */
export interface BridgeTurnContext {
  readonly turnId: string;
  readonly streamId: string;
  readonly actorId: string;
  readonly agentProfileVersion: string;
  readonly abortSignal?: AbortSignal;
}

/** The canonical argument digest (deterministic, payload-safe). */
export function canonicalArgDigest(input: unknown): string {
  // The digest uses the STRICT canonical serialization (recursively
  // key-sorted, no whitespace, unsupported values REJECTED — never
  // insertion-order-sensitive JSON.stringify). Two structurally identical
  // argument objects therefore produce ONE digest regardless of key order,
  // and unsupported values fail closed instead of being silently coerced.
  return sha256Hex(toCanonicalJson(input));
}

function sha256Hex(payload: string): string {
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

/**
 * Framework-metadata-only argument summary (DATA-005). The summary carries
 * the structural shape of the arguments ONLY: container kinds, counts, and
 * JSON type names. Argument values, argument key names, authorization-like
 * field names, and serialized payload fragments are NEVER retained.
 */
export function safeArgumentSummary(input: unknown, _limit = 120): string {
  return shapeSummary(input, 0) ?? 'unsupported';
}

function shapeSummary(value: unknown, depth: number): string | undefined {
  if (depth > 2) {
    return '…';
  }
  if (value === null) {
    return 'null';
  }
  switch (typeof value) {
    case 'string':
      return `string(${value.length})`;
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'bigint':
    case 'symbol':
    case 'function':
    case 'undefined':
      return 'unsupported';
    case 'object': {
      if (Array.isArray(value)) {
        return `array(${value.length})`;
      }
      const proto = Object.getPrototypeOf(value) as object | null;
      if (proto !== Object.prototype && proto !== null) {
        return 'unsupported';
      }
      const fields = Object.keys(value as Record<string, unknown>).length;
      return `object(${fields} fields)`;
    }
    default:
      return 'unsupported';
  }
}

/**
 * Build the model-facing capability tools for one activation. ONLY the
 * pinned envelope entries become tools; the tool description is bounded
 * metadata derived from the capability declaration and can never widen
 * effect or permission semantics.
 */
export function buildCapabilityTools(
  activation: AgentProfileActivation,
  deps: CapabilityBridgeDeps,
): Record<string, unknown> {
  const tools: Record<string, unknown> = {};
  const nameOwner = new Map<string, string>();
  for (const reference of activation.capabilities) {
    const definition = deps.resolveCapability(reference.id, reference.revision);
    if (definition === undefined) {
      // A missing envelope resolution is a fail-closed activation error.
      throw new Error(
        `VICT_CAPABILITY_ENVELOPE_UNRESOLVED: capability '${reference.id}' revision '${reference.revision}' could not be resolved for the pinned activation.`,
      );
    }
    const toolName = sanitizeCapabilityToolName(definition.id);
    const previous = nameOwner.get(toolName);
    if (previous !== undefined) {
      throw new Error(
        `VICT_CAPABILITY_TOOL_NAME_COLLISION: capabilities '${previous}' and '${definition.id}' both map to the Mastra tool name '${toolName}'.`,
      );
    }
    nameOwner.set(toolName, definition.id);
    tools[toolName] = bridgeCapabilityToolToMastra(activation, definition, deps);
  }
  return tools;
}

/**
 * Bridge ONE pinned capability into a Mastra tool with the full governed
 * execution order. The definition MUST come from the pinned activation
 * envelope resolution — a live registry lookup is never consulted at
 * request time.
 */
export function bridgeCapabilityToolToMastra(
  activation: AgentProfileActivation,
  definition: CapabilityDefinition<unknown, unknown>,
  deps: CapabilityBridgeDeps,
): unknown {
  const capabilityId = definition.id;
  const capabilityRevision = definition.revision;
  const effect = definition.effect as EffectClass;
  const policy = defaultBridgePolicy(capabilityId, capabilityRevision, effect);
  const inputContract = definition.input;
  const outputContract = definition.output;
  const clock = deps.clock ?? (() => Date.now());
  const createToolLoose = createTool as unknown as (options: unknown) => unknown;

  return createToolLoose({
    id: capabilityId,
    // Bounded, capability-declaration-derived metadata — never authority.
    description: `VICT governed capability '${capabilityId}' (revision ${capabilityRevision}, effect '${effect}').`,
    inputSchema: standardSchemaFromContract(inputContract),
    outputSchema: standardSchemaFromContract(outputContract),
    execute: async (
      inputData: unknown,
      executionContext: {
        toolCallId?: unknown;
        abortSignal?: unknown;
        requestContext?: { get?: (key: string) => unknown };
      },
    ): Promise<unknown> => {
      // ---- 0. Turn scope (authenticated actor + turn identity) -----------
      const turn = readTurnScope();
      if (turn === undefined) {
        return {
          victCapabilityFailure: 'VICT_CAPABILITY_AUTHORITY_DENIED',
        } satisfies CapabilityToolFailure;
      }
      // Per-turn tool budget (same discipline as helper tools).
      if (deps.budgetGate !== undefined) {
        try {
          if (deps.budgetGate() !== 'allowed') {
            return {
              victCapabilityFailure: 'VICT_CAPABILITY_TOOL_LIMIT_EXCEEDED',
            } satisfies CapabilityToolFailure;
          }
        } catch {
          return {
            victCapabilityFailure: 'VICT_CAPABILITY_AUTHORITY_DENIED',
          } satisfies CapabilityToolFailure;
        }
      }
      // ---- 1. Closed tool-envelope validation ----------------------------
      // The tool exists only because this exact (id, revision) is in the
      // frozen envelope; re-verify against the CURRENT snapshot (a stale
      // or extra tool fails closed).
      const pinned = activation.capabilities.find(
        (reference) => reference.id === capabilityId && reference.revision === capabilityRevision,
      );
      if (pinned === undefined) {
        return {
          victCapabilityFailure: 'VICT_CAPABILITY_AUTHORITY_DENIED',
        } satisfies CapabilityToolFailure;
      }
      let toolCallId: string;
      if (
        typeof executionContext.toolCallId === 'string' &&
        /^[A-Za-z0-9._:-]{1,128}$/.test(executionContext.toolCallId)
      ) {
        toolCallId = executionContext.toolCallId;
      } else {
        // Deterministic fallback identity derived from the DURABLE turn
        // context and the invocation ordinal — never from current time —
        // so the identity is STABLE across retries, approval suspension,
        // and process restarts. A malformed upstream identity therefore
        // fails closed into a documented deterministic identity instead.
        const ordinal = await deps.getTurnInvocationOrdinal(turn.turnId);
        toolCallId = `call-${digest12(`${turn.turnId}:${capabilityId}:${ordinal}`)}`;
      }
      // ---- 2. Authenticated actor + authority check ----------------------
      // The turn's authenticated actor is the only authority source; a
      // mismatch (hostile request context) fails closed.
      const requestActor = readRequestActor(executionContext);
      if (requestActor !== undefined && requestActor !== turn.actorId) {
        return {
          victCapabilityFailure: 'VICT_CAPABILITY_AUTHORITY_DENIED',
        } satisfies CapabilityToolFailure;
      }
      // ---- 3. Authoritative VICT input-contract validation ---------------
      let parsedInput: { ok: true; value: unknown } | { ok: false } | undefined;
      if (inputContract !== undefined) {
        try {
          const result = inputContract.parse(inputData);
          parsedInput = result.ok ? { ok: true, value: result.value } : { ok: false };
        } catch {
          parsedInput = { ok: false };
        }
        if (!parsedInput.ok) {
          return {
            victCapabilityFailure: 'VICT_CAPABILITY_INPUT_CONTRACT_REJECTED',
          } satisfies CapabilityToolFailure;
        }
      }
      const effectiveInput =
        parsedInput !== undefined && parsedInput.ok ? parsedInput.value : inputData;
      const argDigest = canonicalArgDigest(effectiveInput);
      // ---- 4. Durable intent (durable BEFORE invocation; always) ---------
      // The intent is idempotent over the logical invocation identity: a
      // retry/resume/restart with the same tool-call identity and digest
      // resolves to the SAME durable invocation record (exactly-once).
      const invocation = await recordInvocationIntentIdempotent(deps, {
        turnId: turn.turnId,
        toolCallId,
        toolName: capabilityId,
        capabilityId,
        capabilityRevision,
        effect,
        actorId: turn.actorId,
        argDigest,
        argumentSummary: safeArgumentSummary(effectiveInput),
      });
      // ---- 5. Effect and approval policy ---------------------------------
      if (policy.requiresApproval) {
        // Check for an ALREADY-valid approval (idempotent retries after
        // restart/retry reuse the same logical invocation identity).
        const existing = await deps.findExistingApproval?.(invocation.invocationId);
        let approvalId = existing;
        if (approvalId === undefined) {
          const created = await deps.requestApproval({
            invocation,
            agentProfileVersion: turn.agentProfileVersion,
            expiresAt: clock() + (deps.approvalExpiryMs ?? 900_000),
          });
          approvalId = created.approvalId;
          // Durable `tool.awaiting_approval` milestone (safe identity fields
          // only). The milestone is AWAITED so durable events stay ordered
          // and exactly once relative to the approval record; a persistence
          // failure here fails the tool closed BEFORE any effect exists.
          if (deps.emitAwaitingApproval !== undefined) {
            await deps.emitAwaitingApproval({
              kind: 'tool.awaiting_approval',
              streamId: turn.streamId,
              turnId: turn.turnId,
              threadId: readThreadId(),
              actorId: turn.actorId,
              agentProfileVersion: turn.agentProfileVersion,
              seq: 0,
              toolCallId,
              toolName: capabilityId,
              victInvocationId: invocation.invocationId,
            } as unknown as AgentStreamEvent);
          }
        }
        // Wait for the durable decision (VICT approval record commits
        // BEFORE any Mastra resume of the effect). Cancellation and expiry
        // end the wait without invoking the capability.
        const decision = await awaitApprovalDecision(deps, approvalId, {
          clock,
          pollIntervalMs: deps.pollIntervalMs ?? 25,
          expiryAt: clock() + (deps.approvalExpiryMs ?? 900_000),
          abortSignal: turn.abortSignal,
        });
        if (decision.status === 'declined') {
          await transitionInvocation(
            deps,
            invocation.invocationId,
            'declined',
            clock(),
            undefined,
            'VICT_TOOL_DECLINED',
          );
          return {
            victCapabilityFailure: 'VICT_CAPABILITY_DECLINED',
          } satisfies CapabilityToolFailure;
        }
        if (decision.status === 'expired' || decision.status === 'timeout') {
          await transitionInvocation(
            deps,
            invocation.invocationId,
            'failed',
            clock(),
            undefined,
            'VICT_APPROVAL_EXPIRED',
          );
          return {
            victCapabilityFailure: 'VICT_CAPABILITY_AWAITING_APPROVAL_TIMED_OUT',
          } satisfies CapabilityToolFailure;
        }
        if (decision.status === 'cancelled') {
          await transitionInvocation(
            deps,
            invocation.invocationId,
            'cancelled',
            clock(),
            undefined,
            'VICT_TURN_CANCELLED',
          );
          return {
            victCapabilityFailure: 'VICT_CAPABILITY_CANCELLED',
          } satisfies CapabilityToolFailure;
        }
        // Exact-binding consumption: any wrong identity is denied.
        const consumed = await deps.consumeApproval({
          approvalId,
          actorId: turn.actorId,
          agentProfileVersion: turn.agentProfileVersion,
          capabilityId,
          capabilityRevision,
          turnId: turn.turnId,
          toolCallId,
          invocationId: invocation.invocationId,
          argDigest,
          effect,
          at: clock(),
        });
        if (!consumed.approved) {
          await transitionInvocation(
            deps,
            invocation.invocationId,
            'failed',
            clock(),
            undefined,
            consumed.reasonCode,
          );
          return {
            victCapabilityFailure: 'VICT_CAPABILITY_AUTHORITY_DENIED',
          } satisfies CapabilityToolFailure;
        }
        await transitionInvocation(deps, invocation.invocationId, 'approved', clock());
      }
      // ---- 6. Capability invocation (durable intent already recorded) ----
      await transitionInvocation(deps, invocation.invocationId, 'running', clock());
      // The stable durable idempotency key is propagated into the capability
      // invocation context so EXTERNAL adapters can deduplicate their own
      // effects after retries and restarts (one logical effect per key).
      let rawOutput: unknown;
      try {
        rawOutput = await deps.invoke(definition, effectiveInput, {
          signal: turn.abortSignal,
          victIdempotencyKey: invocation.idempotencyKey,
          victInvocationId: invocation.invocationId,
          victTurnId: turn.turnId,
          victToolCallId: toolCallId,
          victActorId: turn.actorId,
        } as Partial<CapabilityContext>);
      } catch {
        await transitionInvocation(
          deps,
          invocation.invocationId,
          'failed',
          clock(),
          undefined,
          'VICT_CAPABILITY_INVOCATION_FAILED',
        );
        return {
          victCapabilityFailure: 'VICT_CAPABILITY_INVOCATION_FAILED',
        } satisfies CapabilityToolFailure;
      }
      // ---- 7. Authoritative output-contract validation --------------------
      if (outputContract !== undefined) {
        try {
          const parsed = outputContract.parse(rawOutput);
          if (!parsed.ok) {
            await transitionInvocation(
              deps,
              invocation.invocationId,
              'failed',
              clock(),
              undefined,
              'VICT_CAPABILITY_OUTPUT_CONTRACT_REJECTED',
            );
            return {
              victCapabilityFailure: 'VICT_CAPABILITY_OUTPUT_CONTRACT_REJECTED',
            } satisfies CapabilityToolFailure;
          }
          rawOutput = parsed.value;
        } catch {
          await transitionInvocation(
            deps,
            invocation.invocationId,
            'failed',
            clock(),
            undefined,
            'VICT_CAPABILITY_OUTPUT_CONTRACT_REJECTED',
          );
          return {
            victCapabilityFailure: 'VICT_CAPABILITY_OUTPUT_CONTRACT_REJECTED',
          } satisfies CapabilityToolFailure;
        }
      }
      // ---- Terminal persistence: TRUTHFUL under failure ------------------
      // The capability effect may already exist at this point. A store
      // failure while recording the terminal state must NOT surface as a
      // normal completion: the invocation enters the truthful durable
      // `outcome_unknown` state and the model receives the structured
      // recoverable failure instead of the capability output.
      try {
        await transitionInvocation(
          deps,
          invocation.invocationId,
          'completed',
          clock(),
          safeArgumentSummary(rawOutput),
        );
      } catch {
        await tryTransitionInvocation(
          deps,
          invocation.invocationId,
          'outcome_unknown',
          clock(),
          undefined,
          'VICT_CAPABILITY_OUTCOME_UNKNOWN',
        );
        return {
          victCapabilityFailure: 'VICT_CAPABILITY_OUTCOME_UNKNOWN',
        } satisfies CapabilityToolFailure;
      }
      // ---- 8. Sanitized result to Mastra ----------------------------------
      return rawOutput;
    },
  });
}

/**
 * Wrap one neutral VICT capability contract into the Standard-Schema-With-JSON
 * interface the pinned tools API accepts. Validation authority stays with
 * the VICT contract (CONT-001); the JSON Schema describes only the boundary
 * shape to the model.
 */
function standardSchemaFromContract(
  contract: { parse: (value: unknown) => unknown } | undefined,
): unknown {
  return {
    '~standard': {
      version: 1,
      vendor: 'vict.contract',
      validate: (value: unknown) => {
        // The bridge's own SAFE structured failure markers pass through the
        // output schema: they are fixed non-echoing denial envelopes, never
        // capability output (the strict capability contract still governs
        // every real result inside execute).
        if (
          typeof value === 'object' &&
          value !== null &&
          typeof (value as Record<string, unknown>).victCapabilityFailure === 'string'
        ) {
          return { value } as const;
        }
        if (contract === undefined) {
          return { value } as const;
        }
        try {
          const result = contract.parse(value) as {
            ok: boolean;
            value?: unknown;
            issues?: unknown;
          };
          if (result.ok) {
            return { value: result.value } as const;
          }
          return { issues: [{ message: 'vict-contract-rejected' }] } as const;
        } catch {
          return { issues: [{ message: 'vict-contract-rejected' }] } as const;
        }
      },
      jsonSchema: {
        input: () => ({ type: 'object' }),
        output: () => ({ type: 'object' }),
      },
    },
  };
}

/** Deterministic, model-safe tool name for a capability id. */
export function sanitizeCapabilityToolName(id: string): string {
  const sanitized = id.replace(/[^A-Za-z0-9_-]/g, '_');
  return sanitized.length > 0 && sanitized.length <= 64 ? sanitized : 'vict_capability';
}

// ---- Internals -------------------------------------------------------------

async function awaitApprovalDecision(
  deps: CapabilityBridgeDeps,
  approvalId: string,
  options: {
    clock: () => number;
    pollIntervalMs: number;
    expiryAt: number;
    abortSignal: AbortSignal | undefined;
  },
): Promise<{ status: 'approved' | 'declined' | 'expired' | 'timeout' | 'cancelled' }> {
  const poll = deps.pollApprovalDecision;
  if (poll === undefined) {
    return { status: 'timeout' };
  }
  for (;;) {
    if (options.abortSignal?.aborted === true) {
      return { status: 'cancelled' };
    }
    const snapshot = await poll(approvalId);
    if (snapshot === undefined) {
      return { status: 'expired' };
    }
    if (snapshot.status === 'approved') {
      return { status: 'approved' };
    }
    if (snapshot.status === 'declined') {
      return { status: 'declined' };
    }
    if (snapshot.status === 'expired' || options.clock() >= options.expiryAt) {
      return { status: 'expired' };
    }
    await sleep(options.pollIntervalMs);
  }
}

/**
 * Record the invocation intent with EXACTLY-ONCE semantics: a retry,
 * resume, or restart that reaches the same logical invocation identity
 * (idempotency key) resolves to the EXISTING durable record. Only a
 * recognized digest-collision is a real conflict; other store failures
 * propagate (fail closed) instead of being swallowed.
 */
async function recordInvocationIntentIdempotent(
  deps: CapabilityBridgeDeps,
  input: Parameters<CapabilityBridgeDeps['recordInvocationIntent']>[0],
): Promise<AgentToolInvocationRecord> {
  try {
    return await deps.recordInvocationIntent(input);
  } catch (error) {
    if (
      error instanceof VictControlError &&
      error.code === 'VICT_CONTROL_INVOCATION_KEY_COLLISION'
    ) {
      // The collision path can only mean a different digest under the same
      // logical key — a hostile/changed retry that must fail closed.
      throw error;
    }
    throw error;
  }
}

/**
 * Durable invocation transition with FENCED-RETRY recognition: only
 * explicitly recognized terminal-fenced/idempotent outcomes are safe to
 * treat as already-applied; ANY other store failure propagates (fail
 * closed) instead of being silently swallowed.
 */
async function transitionInvocation(
  deps: CapabilityBridgeDeps,
  invocationId: string,
  status:
    'approved' | 'running' | 'completed' | 'failed' | 'declined' | 'cancelled' | 'outcome_unknown',
  at: number,
  resultSummary?: string,
  errorCode?: string,
): Promise<void> {
  try {
    await deps.updateInvocationStatus({
      invocationId,
      status,
      at,
      ...(resultSummary !== undefined ? { resultSummary } : {}),
      ...(errorCode !== undefined ? { errorCode } : {}),
    });
  } catch (error) {
    // Recognized idempotent/fenced outcomes ONLY: a late duplicate of a
    // transition that is already durably recorded (terminal fencing) or a
    // forward-only regression on an exactly-once retry is safe to ignore.
    if (
      error instanceof VictControlError &&
      (error.code === 'VICT_CONTROL_INVOCATION_TERMINAL' ||
        error.code === 'VICT_CONTROL_INVOCATION_REGRESSION')
    ) {
      return;
    }
    // Everything else is a REAL durable failure and must never be swallowed.
    throw error;
  }
}

/** Best-effort transition wrapper (boolean success; never throws). */
async function tryTransitionInvocation(
  deps: CapabilityBridgeDeps,
  invocationId: string,
  status:
    'approved' | 'running' | 'completed' | 'failed' | 'declined' | 'cancelled' | 'outcome_unknown',
  at: number,
  resultSummary?: string,
  errorCode?: string,
): Promise<boolean> {
  try {
    await transitionInvocation(deps, invocationId, status, at, resultSummary, errorCode);
    return true;
  } catch {
    return false;
  }
}

/** The turn-scoped async context (set by the turn executor around the stream). */
const turnScopeStorage = new AsyncLocalStorage<BridgeTurnScopeInternal>();

interface BridgeTurnScopeInternal extends BridgeTurnContext {
  readonly threadId: string;
}

/** Run one turn with the bridge scope installed (called by the turn executor). */
export function runWithBridgeTurnScope<T>(
  scope: BridgeTurnContext & { readonly threadId: string },
  run: () => Promise<T>,
): Promise<T> {
  return turnScopeStorage.run(scope, run);
}

function readTurnScope(): BridgeTurnContext | undefined {
  const scope = turnScopeStorage.getStore();
  if (scope === undefined) {
    return undefined;
  }
  return {
    turnId: scope.turnId,
    streamId: scope.streamId,
    actorId: scope.actorId,
    agentProfileVersion: scope.agentProfileVersion,
    abortSignal: scope.abortSignal,
  };
}

function readThreadId(): string {
  return turnScopeStorage.getStore()?.threadId ?? 'unknown';
}

function readRequestActor(context: {
  requestContext?: { get?: (key: string) => unknown };
}): string | undefined {
  const value = context.requestContext?.get?.('victActorId');
  return typeof value === 'string' ? value : undefined;
}

function digest12(payload: string): string {
  return sha256Hex(payload).slice(0, 12);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
