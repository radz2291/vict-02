import { createTool } from '@mastra/core/tools';
import { createHash } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
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
    status: 'approved' | 'running' | 'completed' | 'failed' | 'declined' | 'cancelled';
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
  readonly emitAwaitingApproval?: (event: AgentStreamEvent) => void;
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
  return sha256Hex(canonicalJson(input));
}

function canonicalJson(value: unknown): string {
  return (
    JSON.stringify(value, (_key, inner) => {
      if (typeof inner === 'bigint') return inner.toString();
      return inner;
    }) ?? 'null'
  );
}

function sha256Hex(payload: string): string {
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

/** Bounded safe argument summary (never full payloads). */
export function safeArgumentSummary(input: unknown, limit = 120): string {
  let serialized: string;
  try {
    serialized = JSON.stringify(input) ?? 'null';
  } catch {
    serialized = '(unserializable)';
  }
  return serialized.length <= limit ? serialized : `${serialized.slice(0, limit)}…`;
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
      const toolCallId =
        typeof executionContext.toolCallId === 'string' &&
        /^[A-Za-z0-9._:-]{1,128}$/.test(executionContext.toolCallId)
          ? executionContext.toolCallId
          : `call-${digest12(canonicalJson({ turn: turn.turnId, capability: capabilityId, at: clock() }))}`;
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
      const invocation = await deps.recordInvocationIntent({
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
          // Durable `tool.awaiting_approval` milestone (safe summary only).
          deps.emitAwaitingApproval?.({
            kind: 'tool.awaiting_approval',
            streamId: turn.streamId,
            turnId: turn.turnId,
            threadId: readThreadId(),
            actorId: turn.actorId,
            agentProfileVersion: turn.agentProfileVersion,
            seq: 0,
            toolCallId,
            toolName: capabilityId,
          } as unknown as AgentStreamEvent);
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
          await safeStatus(
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
          await safeStatus(
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
          await safeStatus(
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
          await safeStatus(
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
        await safeStatus(deps, invocation.invocationId, 'approved', clock());
      }
      // ---- 6. Capability invocation (durable intent already recorded) ----
      await safeStatus(deps, invocation.invocationId, 'running', clock());
      let rawOutput: unknown;
      try {
        rawOutput = await deps.invoke(definition, effectiveInput, {
          signal: turn.abortSignal,
        } as Partial<CapabilityContext>);
      } catch {
        await safeStatus(
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
            await safeStatus(
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
          await safeStatus(
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
      await safeStatus(
        deps,
        invocation.invocationId,
        'completed',
        clock(),
        safeArgumentSummary(rawOutput),
      );
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

async function safeStatus(
  deps: CapabilityBridgeDeps,
  invocationId: string,
  status: 'approved' | 'running' | 'completed' | 'failed' | 'declined' | 'cancelled',
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
  } catch {
    // A terminal-fenced update attempt is not an execution failure.
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
