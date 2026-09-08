import { createTool } from '@mastra/core/tools';
import { createHash, randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { toCanonicalJson, VictControlError } from '@vict/runtime';
import type {
  AgentProfileActivation,
  AgentToolInvocationRecord,
  AgentApprovalRecord,
} from '@vict/runtime';
import type { AgentStreamEvent } from '@vict/contracts';
import type { CapabilityDefinition, CapabilityContext, EffectClass } from '@vict/sdk';
import {
  CONTROL_MARKER_KEYS,
  captureControlRecord,
  capturedHasAnyControlMarker,
  capturedHasField,
  rebuildPlainCapturedObject,
} from './control-envelope.js';

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
 *   summaries; raw capability errors and secrets never re-enter the model;
 * - TOOL-STATE TRUTHFULNESS: `tool.completed` is normalized ONLY for a
 *   durably confirmed completion (the owner's own confirmed settlement,
 *   or a replay bound to an already-`completed` invocation). A running,
 *   unresolved, or ambiguous invocation never produces a terminal event:
 *   the `in_progress` duplicate report is non-terminal by policy, invalid
 *   or contradictory replay envelopes fail closed
 *   (`VICT_CAPABILITY_OUTCOME_UNKNOWN`), and one logical occurrence can
 *   never acquire contradictory terminal milestones (first terminal
 *   wins). Bridge control markers are reserved and rejected in tool
 *   outputs, and the live-owner registry is scoped per composition so
 *   colliding local invocation ids across store domains can never alias
 *   liveness.
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
  | 'VICT_CAPABILITY_TOOL_IDENTITY_REQUIRED'
  | 'VICT_CAPABILITY_TOOL_LIMIT_EXCEEDED';

/** The structured safe result returned to the model. */
export interface CapabilityToolFailure {
  readonly victCapabilityFailure: CapabilityToolFailureCode;
}

/**
 * The CLOSED runtime vocabulary of capability-tool failure codes. A
 * failure marker may normalize into a stream event ONLY through this exact
 * allowlist: the post-audit probes demonstrated that arbitrary strings
 * (`CANARY-ARBITRARY-CODE`), accessor-read values, non-enumerable fields,
 * and inherited markers previously crossed the boundary as event codes.
 * Anything outside this set becomes the safe `VICT_CAPABILITY_OUTCOME_UNKNOWN`.
 */
export const CAPABILITY_TOOL_FAILURE_CODES: ReadonlySet<string> =
  new Set<CapabilityToolFailureCode>([
    'VICT_CAPABILITY_INPUT_CONTRACT_REJECTED',
    'VICT_CAPABILITY_OUTPUT_CONTRACT_REJECTED',
    'VICT_CAPABILITY_INVOCATION_FAILED',
    'VICT_CAPABILITY_OUTCOME_UNKNOWN',
    'VICT_CAPABILITY_AUTHORITY_DENIED',
    'VICT_CAPABILITY_DECLINED',
    'VICT_CAPABILITY_AWAITING_APPROVAL_TIMED_OUT',
    'VICT_CAPABILITY_CANCELLED',
    'VICT_CAPABILITY_TOOL_IDENTITY_REQUIRED',
    'VICT_CAPABILITY_TOOL_LIMIT_EXCEEDED',
  ]);

/** Total, non-throwing closed-vocabulary check for one candidate code. */
export function isCapabilityToolFailureCode(value: unknown): value is CapabilityToolFailureCode {
  return typeof value === 'string' && CAPABILITY_TOOL_FAILURE_CODES.has(value);
}

/**
 * The structured TERMINAL REPLAY envelope: an invocation that is already
 * durably terminal NEVER passes through capability invocation again. The
 * replay returns the stable safe disposition of the existing record —
 * never a second effect, never a raw operational payload. The
 * `in_progress` disposition is the NON-terminal duplicate report: a
 * caller whose invocation identity is claimed by a LIVE owner reports the
 * observed attempt truthfully without mutating it.
 */
export interface CapabilityToolReplay {
  readonly victCapabilityReplay: {
    readonly disposition:
      'completed' | 'failed' | 'declined' | 'cancelled' | 'outcome_unknown' | 'in_progress';
    /** The durable invocation the replay is bound to. */
    readonly invocationId: string;
    /** Safe bounded result summary (structural shape only), when the
     * terminal record retained one. Actual capability output is NEVER
     * returned as an unrestricted operational payload. */
    readonly resultSummary?: string;
  };
}

/** The closed set of replay dispositions the bridge can ever produce. */
const REPLAY_DISPOSITIONS: ReadonlySet<string> = new Set([
  'completed',
  'failed',
  'declined',
  'cancelled',
  'outcome_unknown',
  'in_progress',
]);

/** A validated replay envelope: structural shape and disposition verified. */
export type ValidCapabilityReplay = {
  readonly kind: 'valid';
  readonly disposition:
    'completed' | 'failed' | 'declined' | 'cancelled' | 'outcome_unknown' | 'in_progress';
  readonly invocationId: string;
};

/** The replay-envelope validation verdict at the adapter boundary. */
export type CapabilityReplayVerdict =
  { readonly kind: 'not-a-replay' } | ValidCapabilityReplay | { readonly kind: 'invalid' };

const SAFE_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const MAX_RESULT_SUMMARY_LENGTH = 512;

/**
 * Validate a replay envelope at the ADAPTER boundary (fail closed, TOTAL).
 *
 * `tool.completed` may be normalized ONLY from a structurally valid
 * envelope whose durable meaning is a confirmed completion. Anything
 * unknown, malformed, unsupported, or contradictory is `invalid` and MUST
 * be normalized as a safe failure — never as completion, and with no
 * envelope content forwarded (events carry stable codes only).
 *
 * A result is `not-a-replay` when it carries no replay marker at all
 * (ordinary results, helper results, and structured failure envelopes).
 * A result carrying BOTH control markers is hostile: `invalid`.
 *
 * POST-AUDIT HARDENING: this function is TOTAL — no inspection can throw.
 * All structure is captured through the shared control-envelope boundary
 * (descriptor reads only; getters, proxy traps, `in`, and `Object.keys`
 * are never used before (or after) safe capture). Accessor, non-enumerable,
 * and symbol-keyed fields are rejected without being read; inherited
 * members are invisible to the capture and therefore never trusted; a
 * hostile, exotic, or REVOKED proxy classifies as `invalid` (marker
 * absence can never be proven for an uninspectable object) instead of
 * letting a raw exception escape. When a marker field is present in any
 * non-plain-data form, the record is `invalid` — it claims a bridge
 * structure it cannot present.
 */
export function parseCapabilityReplayEnvelope(result: unknown): CapabilityReplayVerdict {
  if (typeof result !== 'object' || result === null) {
    return { kind: 'not-a-replay' } as const;
  }
  const outer = captureControlRecord(result);
  if (outer.kind !== 'captured') {
    // A hostile/revoked container (including one whose Array.isArray
    // classification throws): nothing about it can be proven, so it can
    // never be treated as an ordinary result either. Fail closed.
    return { kind: 'invalid' } as const;
  }
  let isArray: boolean;
  try {
    isArray = Array.isArray(result);
  } catch {
    return { kind: 'invalid' } as const;
  }
  if (isArray) {
    return { kind: 'not-a-replay' } as const;
  }
  // GUARDED marker-membership honesty probe (the only `in` use, AFTER safe
  // capture): a throwing `has` trap is hostile; membership visible to `in`
  // but absent from the own-descriptor capture (inherited or a
  // descriptor-invisible proxy lie) is rejected — inherited and hidden
  // markers can never impersonate a bridge structure.
  for (const name of ['victCapabilityReplay', 'victCapabilityFailure'] as const) {
    let present: boolean;
    try {
      present = name in result;
    } catch {
      return { kind: 'invalid' } as const;
    }
    if (present && !outer.fields.has(name)) {
      return { kind: 'invalid' } as const;
    }
  }
  const hasReplayMarker = capturedHasField(outer, 'victCapabilityReplay');
  const hasFailureMarker = capturedHasField(outer, 'victCapabilityFailure');
  if (!hasReplayMarker && !hasFailureMarker) {
    return { kind: 'not-a-replay' } as const;
  }
  if (hasReplayMarker && hasFailureMarker) {
    // Contradictory control markers on one result: fail closed.
    return { kind: 'invalid' } as const;
  }
  if (!hasReplayMarker) {
    // A failure envelope (with or without a well-formed code) is not a
    // replay; the normalizer classifies the failure code separately.
    return { kind: 'not-a-replay' } as const;
  }
  // The replay marker claims a bridge-produced structure: it must be a
  // plain own enumerable DATA field on a plain (or null-proto) record.
  const replayField = outer.fields.get('victCapabilityReplay');
  if (replayField === undefined || replayField.kind !== 'data' || !replayField.enumerable) {
    return { kind: 'invalid' } as const;
  }
  if (outer.hasSymbolKeys || outer.prototype === 'exotic') {
    // A classed or symbol-carrying record is not a bridge-produced structure.
    return { kind: 'invalid' } as const;
  }
  const envelopeCapture = captureControlRecord(replayField.value);
  if (envelopeCapture.kind !== 'captured') {
    return { kind: 'invalid' } as const;
  }
  if (envelopeCapture.prototype === 'exotic') {
    // A classed/proxied envelope is not a bridge-produced structure.
    return { kind: 'invalid' } as const;
  }
  if (envelopeCapture.hasSymbolKeys) {
    return { kind: 'invalid' } as const;
  }
  let disposition: string | undefined;
  let invocationId: string | undefined;
  let resultSummary: string | undefined;
  for (const [key, field] of envelopeCapture.fields) {
    if (key !== 'disposition' && key !== 'invocationId' && key !== 'resultSummary') {
      // Closed structure: unknown envelope members are rejected, never
      // interpreted (nothing unknown can ever become completion).
      return { kind: 'invalid' } as const;
    }
    if (field.kind !== 'data' || !field.enumerable) {
      // Accessor or hidden envelope members are rejected unread.
      return { kind: 'invalid' } as const;
    }
    if (key === 'disposition') {
      disposition = typeof field.value === 'string' ? field.value : undefined;
    } else if (key === 'invocationId') {
      invocationId = typeof field.value === 'string' ? field.value : undefined;
    } else {
      resultSummary = typeof field.value === 'string' ? field.value : undefined;
    }
  }
  if (disposition === undefined || !REPLAY_DISPOSITIONS.has(disposition)) {
    return { kind: 'invalid' } as const;
  }
  if (invocationId === undefined || !SAFE_ID_PATTERN.test(invocationId)) {
    return { kind: 'invalid' } as const;
  }
  if (
    envelopeCapture.fields.has('resultSummary') &&
    (resultSummary === undefined || resultSummary.length > MAX_RESULT_SUMMARY_LENGTH)
  ) {
    return { kind: 'invalid' } as const;
  }
  return {
    kind: 'valid',
    disposition,
    invocationId,
  } as ValidCapabilityReplay;
}

/**
 * The EXACT normalization of a capability-bridge tool result into an
 * agent-stream tool milestone (vict.agent-stream@1).
 *
 * `tool.completed` means the tool (the durable capability invocation)
 * FINISHED. The mapping is total over the bridge's closed result
 * vocabulary and enforces the Stage 06B tool-state truthfulness
 * invariants:
 *
 * - `completed` replay → `tool.completed` (the durable invocation is
 *   already terminal-completed, or this is the owner's own confirmed
 *   completion result);
 * - `failed` | `declined` | `cancelled` | `outcome_unknown` replays →
 *   `tool.failed` with the corresponding stable safe code;
 * - `in_progress` replay → NONTERMINAL: a running, unresolved, or
 *   ambiguous invocation NEVER produces a terminal event — the
 *   occurrence's terminal milestone stays reserved for the owner's
 *   truthful settlement (the documented duplicate-cancellation policy:
 *   a cancelled duplicate waiter receives exactly this non-terminal
 *   report and no terminal event is fabricated for it);
 * - invalid / malformed / contradictory envelopes → `tool.failed` with
 *   `VICT_CAPABILITY_OUTCOME_UNKNOWN` (fail closed, never completion,
 *   no envelope content forwarded);
 * - anything without a capability-bridge marker → `not-capability`
 *   (helper results and ordinary results keep their existing handling).
 */
export type CapabilityToolEventVerdict =
  | { readonly kind: 'not-capability' }
  | { readonly kind: 'completed' }
  | { readonly kind: 'failed'; readonly code: CapabilityToolFailureCode }
  | { readonly kind: 'nonterminal' };

/**
 * Normalize ONE capability-bridge tool result into its stream milestone
 * verdict. This is the SINGLE mapping function the adapter's real
 * tool-result normalization path uses (no second mapping exists).
 *
 * POST-AUDIT HARDENING: the mapping is TOTAL — every inspection goes
 * through the shared control-envelope capture (descriptor reads only, no
 * getter/trap/`in`/`Object.keys` invocation), so hostile getters, revoked
 * proxies, and throwing traps classify instead of throwing. The failure
 * code is checked against the CLOSED `CAPABILITY_TOOL_FAILURE_CODES`
 * allowlist: arbitrary, accessor-read, non-enumerable, inherited, and
 * non-string failure markers all become the safe
 * `VICT_CAPABILITY_OUTCOME_UNKNOWN` and are never echoed as event codes.
 */
export function normalizeCapabilityToolResultEvent(result: unknown): CapabilityToolEventVerdict {
  if (typeof result !== 'object' || result === null) {
    return { kind: 'not-capability' } as const;
  }
  const outer = captureControlRecord(result);
  if (outer.kind !== 'captured') {
    // A hostile/revoked container (including one whose Array.isArray
    // classification throws): marker absence can never be proven — fail
    // closed (never a raw exception, never legacy forwarding).
    return { kind: 'failed', code: 'VICT_CAPABILITY_OUTCOME_UNKNOWN' } as const;
  }
  try {
    if (Array.isArray(result)) {
      return { kind: 'not-capability' } as const;
    }
  } catch {
    return { kind: 'failed', code: 'VICT_CAPABILITY_OUTCOME_UNKNOWN' } as const;
  }
  // GUARDED marker-membership honesty probe (the only `in` uses, AFTER
  // safe capture): a throwing `has` trap is hostile; membership visible to
  // `in` but absent from the own-descriptor capture (inherited or a
  // descriptor-invisible proxy lie) can never impersonate a bridge result.
  {
    let inReplay: boolean;
    let inFailure: boolean;
    try {
      inReplay = 'victCapabilityReplay' in result;
      inFailure = 'victCapabilityFailure' in result;
    } catch {
      return { kind: 'failed', code: 'VICT_CAPABILITY_OUTCOME_UNKNOWN' } as const;
    }
    const hasReplay = capturedHasField(outer, 'victCapabilityReplay');
    const hasFailure = capturedHasField(outer, 'victCapabilityFailure');
    if ((inReplay && !hasReplay) || (inFailure && !hasFailure)) {
      return { kind: 'failed', code: 'VICT_CAPABILITY_OUTCOME_UNKNOWN' } as const;
    }
  }
  const hasReplayMarker = capturedHasField(outer, 'victCapabilityReplay');
  const hasFailureMarker = capturedHasField(outer, 'victCapabilityFailure');
  if (!hasReplayMarker && !hasFailureMarker) {
    return { kind: 'not-capability' } as const;
  }
  if (hasReplayMarker && hasFailureMarker) {
    // Contradictory control markers on one result: fail closed.
    return { kind: 'failed', code: 'VICT_CAPABILITY_OUTCOME_UNKNOWN' } as const;
  }
  if (hasFailureMarker) {
    const failureField = outer.fields.get('victCapabilityFailure');
    if (failureField === undefined || failureField.kind !== 'data' || !failureField.enumerable) {
      // An accessor or hidden failure marker is hostile; its value is
      // never read. Fail closed with the safe code.
      return { kind: 'failed', code: 'VICT_CAPABILITY_OUTCOME_UNKNOWN' } as const;
    }
    return {
      kind: 'failed',
      code: isCapabilityToolFailureCode(failureField.value)
        ? failureField.value
        : 'VICT_CAPABILITY_OUTCOME_UNKNOWN',
    } as const;
  }
  const verdict = parseCapabilityReplayEnvelope(result);
  if (verdict.kind !== 'valid') {
    // A replay marker that does not validate strictly — or a malformed
    // failure marker — is fail closed: a safe failure, never completion.
    return { kind: 'failed', code: 'VICT_CAPABILITY_OUTCOME_UNKNOWN' } as const;
  }
  switch (verdict.disposition) {
    case 'completed':
      return { kind: 'completed' } as const;
    case 'failed':
      return { kind: 'failed', code: 'VICT_CAPABILITY_INVOCATION_FAILED' } as const;
    case 'declined':
      return { kind: 'failed', code: 'VICT_CAPABILITY_DECLINED' } as const;
    case 'cancelled':
      return { kind: 'failed', code: 'VICT_CAPABILITY_CANCELLED' } as const;
    case 'outcome_unknown':
      return { kind: 'failed', code: 'VICT_CAPABILITY_OUTCOME_UNKNOWN' } as const;
    case 'in_progress':
      // THE truthfulness rule: a still-running durable invocation is
      // never represented as completed (or as any terminal event).
      return { kind: 'nonterminal' } as const;
  }
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
  /** Durable-before-invocation intent recording (idempotent by identity). */
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
   * CLAIM the invocation attempt for ONE live owner (intent/approved →
   * running, stamped with the attempt fence + generation). A second claim
   * fails with `VICT_CONTROL_INVOCATION_OWNER_ACTIVE`: the caller is the
   * duplicate of a live owner and never mutates the record.
   */
  claimInvocationRun(command: {
    invocationId: string;
    fenceToken: string;
    ownerIdentity: string;
    at: number;
  }): Promise<AgentToolInvocationRecord>;
  /**
   * FENCED terminal settlement: accepted ONLY from `running` under the
   * EXACT fence token (the current owner). Normal success is returned by
   * the bridge ONLY after this exact durable `completed` transition is
   * confirmed; a stale owner (fence mismatch) can never settle.
   */
  settleInvocationRun(command: {
    invocationId: string;
    fenceToken: string;
    status: 'completed' | 'failed' | 'outcome_unknown';
    at: number;
    resultSummary?: string;
    errorCode?: string;
  }): Promise<AgentToolInvocationRecord>;
  /**
   * PRE-RUNNING terminal settlement (`failed`|`declined`|`cancelled`):
   * exact-binding idempotent; a claimed (`running`) record is never
   * touched.
   */
  settleInvocationPending(command: {
    invocationId: string;
    status: 'failed' | 'declined' | 'cancelled';
    at: number;
    errorCode?: string;
  }): Promise<AgentToolInvocationRecord>;
  /**
   * Conservative reconciliation of an ABANDONED `running` attempt (its
   * owner is provably lost): fences it to the terminal, NON-REPLAYABLE
   * `outcome_unknown` without executing anything; accepted only on the
   * exact observed running state + fence binding.
   */
  reconcileAbandonedRun(command: {
    invocationId: string;
    observedFenceToken: string;
    reconciledFenceToken: string;
    at: number;
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
  /**
   * The composition-scoped live-owner registry. When omitted, the bridge
   * creates a PRIVATE registry for the built tool set — registries are
   * never shared across compositions (colliding local invocation ids in
   * one process must never alias liveness across store domains).
   */
  readonly liveRunRegistry?: CapabilityLiveRunRegistry;
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
 *
 * TOTAL (post-audit): hostile containers (throwing traps, revoked proxies)
 * classify as `unsupported` through the shared control-envelope capture —
 * no reflection exception can escape, and no getter/trap is ever invoked.
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
      let isArray: boolean;
      try {
        isArray = Array.isArray(value);
      } catch {
        // A revoked proxy throws even on IsArray: unsupported.
        return 'unsupported';
      }
      if (isArray) {
        return `array(${(value as unknown[]).length})`;
      }
      const capture = captureControlRecord(value);
      if (capture.kind !== 'captured' || capture.prototype === 'exotic') {
        // A classed instance — or an uninspectable hostile container — is
        // unsupported and never serialized.
        return 'unsupported';
      }
      let count = 0;
      for (const field of capture.fields.values()) {
        if (field.kind === 'data' && field.enumerable) {
          count += 1;
        }
      }
      return `object(${count} fields)`;
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
  // ONE live-owner registry per built tool set (i.e. per composition):
  // every tool of this activation shares it, and it is never shared with
  // any other composition (colliding local invocation ids across store
  // domains must never alias liveness).
  const liveRunRegistry = deps.liveRunRegistry ?? createCapabilityLiveRunRegistry();
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
    tools[toolName] = bridgeCapabilityToolToMastra(activation, definition, deps, liveRunRegistry);
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
  liveRunRegistry: CapabilityLiveRunRegistry = createCapabilityLiveRunRegistry(),
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
        /** The pinned Mastra Tool wrapper organizes AGENT executions with
         * the occurrence identity nested under `agent` (the top-level
         * field remains the direct-call surface). */
        agent?: { toolCallId?: unknown };
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
      let toolCallId: string | undefined;
      // The occurrence identity is the FRAMEWORK-SUPPLIED tool-call id: the
      // pinned Mastra Tool wrapper carries it at the top level for direct
      // calls and under `agent` for agent-loop executions. Both surfaces are
      // read; anything malformed fails closed below.
      const identitySurfaces = [executionContext.toolCallId, executionContext.agent?.toolCallId];
      for (const candidate of identitySurfaces) {
        if (typeof candidate === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(candidate)) {
          toolCallId = candidate;
          break;
        }
      }
      // NOTE: when the framework supplies no valid tool-call identity, the
      // bridge fails CLOSED (VICT_CAPABILITY_TOOL_IDENTITY_REQUIRED) before
      // any durable work — occurrence identity is never inferred from
      // arguments, time, process counters, or row counts.
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
      // The canonical digest and the safe summary are computed under a
      // guard: hostile argument containers (throwing getters/traps) are
      // rejected with ONE stable non-echoing failure — never a raw error.
      let argDigest: string;
      let argumentSummary: string;
      try {
        argDigest = canonicalArgDigest(effectiveInput);
        argumentSummary = safeArgumentSummary(effectiveInput);
      } catch {
        return {
          victCapabilityFailure: 'VICT_CAPABILITY_INPUT_CONTRACT_REJECTED',
        } satisfies CapabilityToolFailure;
      }
      if (toolCallId === undefined) {
        // ---- TOOL-CALL OCCURRENCE IDENTITY (fail closed) -----------------
        // The framework-supplied `toolCallId` IS the occurrence identity.
        // A call with no stable occurrence identity is refused BEFORE any
        // durable intent, approval request, or capability invocation:
        // occurrence identity is NEVER inferred from the arguments alone —
        // a digest-only key cannot distinguish a retry from a second
        // legitimate identical call, so inferring from arguments would
        // alias distinct occurrences (and silently drop effects).
        return {
          victCapabilityFailure: 'VICT_CAPABILITY_TOOL_IDENTITY_REQUIRED',
        } satisfies CapabilityToolFailure;
      }
      /**
       * ---- 4. Durable intent (durable BEFORE invocation; always) ---------
       * The intent is idempotent over the logical invocation identity: a
       * retry/resume/restart with the same tool-call occurrence identity
       * and digest resolves to the SAME durable invocation record
       * (exactly-once). The idempotent re-record is ALSO the truthful
       * re-read primitive used after every arbitration conflict below.
       */
      const intentInput = {
        turnId: turn.turnId,
        toolCallId,
        toolName: capabilityId,
        capabilityId,
        capabilityRevision,
        effect,
        actorId: turn.actorId,
        argDigest,
        argumentSummary,
      } as const;
      const rereadInvocation = (): Promise<AgentToolInvocationRecord> =>
        recordInvocationIntentIdempotent(deps, intentInput);
      let current = await rereadInvocation();

      /**
       * ---- 5. Attempt-ownership dispatch (bounded arbitration) -----------
       * Exactly ONE live owner exists per invocation attempt (the durable
       * claim below is the single ownership gate):
       *
       * - `running`: this caller is a DUPLICATE. It NEVER mutates the
       *   record: with a same-composition live owner it AWAITS the owner's
       *   settlement and replays the truthful terminal disposition (a
       *   cancelled waiter receives the non-terminal `in_progress`
       *   report); with no live owner in this composition the attempt is
       *   conservatively reconciled to the fenced, NON-REPLAYABLE
       *   `outcome_unknown` (owner loss across a process life) without
       *   executing anything.
       * - terminal: the stable safe disposition replay (never a second
       *   effect, never raw capability output).
       * - `intent`/`approved`: this caller is the OWNER CANDIDATE — it
       *   runs the approval policy (if any) and then CLAIMS the attempt;
       *   exactly one claim wins per generation.
       */
      for (let round = 0; round < 6; round += 1) {
        if (current.status === 'running') {
          return resolveRunningDuplicate(deps, current, {
            abortSignal: turn.abortSignal,
            clock,
            liveRunRegistry,
            rereadInvocation,
          });
        }
        if (current.status !== 'intent' && current.status !== 'approved') {
          // TERMINAL REPLAY: an invocation that is already durably terminal
          // NEVER passes through capability invocation again.
          return stableDispositionEnvelope(current);
        }
        // ---- OWNER CANDIDATE: pre-running (intent | approved) ------------
        if (policy.requiresApproval) {
          const gate = await runApprovalGate(deps, current, {
            policy,
            turn,
            toolCallId,
            capabilityId,
            capabilityRevision,
            argDigest,
            effect,
            clock,
          });
          if (gate.kind === 'return') {
            return gate.envelope;
          }
          if (gate.kind === 'arbitrate') {
            // A fenced/idempotent conflict while settling the approval
            // outcome: re-read the truthful durable state and re-dispatch.
            current = await rereadInvocation();
            continue;
          }
          // Consumption winner: the durable pre-run state is `approved`.
          try {
            await deps.updateInvocationStatus({
              invocationId: current.invocationId,
              status: 'approved',
              at: clock(),
            });
          } catch (error) {
            if (
              error instanceof VictControlError &&
              (error.code === 'VICT_CONTROL_INVOCATION_TERMINAL' ||
                error.code === 'VICT_CONTROL_INVOCATION_REGRESSION' ||
                error.code === 'VICT_CONTROL_INVOCATION_OWNER_ACTIVE')
            ) {
              current = await rereadInvocation();
              continue;
            }
            throw error;
          }
        }
        // ---- 6. CLAIM the attempt (single ownership gate) ----------------
        // The live-owner registration is established BEFORE the durable
        // claim so a duplicate that observes `running` always finds the
        // same-composition owner (never a false "abandoned" inference).
        const registration = liveRunRegistry.register(current.invocationId);
        try {
          let claimed: AgentToolInvocationRecord;
          try {
            claimed = await deps.claimInvocationRun({
              invocationId: current.invocationId,
              fenceToken: registration.fenceToken,
              ownerIdentity: BRIDGE_OWNER_IDENTITY,
              at: clock(),
            });
          } catch (error) {
            if (
              error instanceof VictControlError &&
              (error.code === 'VICT_CONTROL_INVOCATION_OWNER_ACTIVE' ||
                error.code === 'VICT_CONTROL_INVOCATION_TERMINAL' ||
                error.code === 'VICT_CONTROL_INVOCATION_REGRESSION')
            ) {
              // Lost claim arbitration: re-read and re-dispatch truthfully.
              current = await rereadInvocation();
              continue;
            }
            throw error;
          }
          return await executeOwnedAttempt(deps, claimed, {
            definition,
            effectiveInput,
            outputContract,
            turn,
            toolCallId,
            idempotencyKey: current.idempotencyKey,
            fenceToken: registration.fenceToken,
            clock,
          });
        } finally {
          registration.settle();
        }
      }
      // Arbitration never converged (impossible under the bounded state
      // machine): fail closed with the stable non-replayable failure.
      return {
        victCapabilityFailure: 'VICT_CAPABILITY_OUTCOME_UNKNOWN',
      } satisfies CapabilityToolFailure;
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
        try {
          // The bridge's own SAFE structured failure markers and TERMINAL
          // REPLAY envelopes pass through the output schema — but ONLY
          // after EXACT structural validation succeeds (closed field set,
          // plain own enumerable data descriptors, allowlisted code or
          // disposition; post-audit rule: a replay or failure envelope may
          // bypass the Standard Schema output adapter only after that
          // exact validation succeeds). The check is TOTAL: a hostile or
          // uninspectable value can never throw out of `validate` — it
          // simply falls through to the contract parse below.
          if (isExactBridgeControlEnvelope(value)) {
            return { value } as const;
          }
          if (contract === undefined) {
            return { value } as const;
          }
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
          // A throwing contract parser is untrusted: its message and any
          // nested cause are never retained or surfaced.
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

/**
 * EXACT structural check for a bridge-produced control envelope: either a
 * single-field failure envelope `{ victCapabilityFailure: <allowlisted> }`
 * or a single-field structurally valid replay envelope. Total (never
 * throws) and non-echoing: hostile shapes simply return false.
 */
function isExactBridgeControlEnvelope(value: unknown): boolean {
  const outer = captureControlRecord(value);
  if (outer.kind !== 'captured') {
    return false;
  }
  if (outer.hasSymbolKeys || outer.prototype === 'exotic' || outer.fields.size !== 1) {
    return false;
  }
  const failureField = outer.fields.get('victCapabilityFailure');
  if (failureField !== undefined) {
    return (
      failureField.kind === 'data' &&
      failureField.enumerable &&
      isCapabilityToolFailureCode(failureField.value)
    );
  }
  if (!outer.fields.has('victCapabilityReplay')) {
    return false;
  }
  const replayField = outer.fields.get('victCapabilityReplay');
  if (replayField === undefined || replayField.kind !== 'data' || !replayField.enumerable) {
    return false;
  }
  return parseCapabilityReplayEnvelope(value).kind === 'valid';
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
 * (idempotency key) resolves to the EXISTING durable record. A recognized
 * digest-collision — and every other store failure — propagates (fail
 * closed); nothing is ever swallowed here.
 */
async function recordInvocationIntentIdempotent(
  deps: CapabilityBridgeDeps,
  input: Parameters<CapabilityBridgeDeps['recordInvocationIntent']>[0],
): Promise<AgentToolInvocationRecord> {
  return deps.recordInvocationIntent(input);
}

/**
 * Durable invocation transition with EXPLICIT conflict recognition (used
 * ONLY for the observability `approved` step): recognized terminal-fenced /
 * owner-active / regression conflicts are re-read + re-dispatched by the
 * caller (never silently swallowed); ANY other store failure propagates
 * (fail closed).
 */
function isArbitrationConflict(error: unknown): error is VictControlError {
  return (
    error instanceof VictControlError &&
    (error.code === 'VICT_CONTROL_INVOCATION_TERMINAL' ||
      error.code === 'VICT_CONTROL_INVOCATION_REGRESSION' ||
      error.code === 'VICT_CONTROL_INVOCATION_OWNER_ACTIVE')
  );
}

// ---- Live-owner registry (composition-scoped, single-process envelope) ----

/**
 * One registered LIVE attempt owner: the fence token the attempt was
 * claimed under and the signal that resolves exactly once when the owning
 * attempt settles.
 */
export interface CapabilityLiveRunRegistration {
  readonly fenceToken: string;
  /** Resolves exactly once when the owning attempt settles. */
  readonly settled: Promise<void>;
}

/**
 * The composition-scoped registry of LIVE attempt owners. Within the
 * accepted single-process/local deployment envelope this is the
 * authoritative liveness proof FOR ONE BRIDGE COMPOSITION (one durable
 * store domain): a duplicate that observes a `running` record either
 * finds the live owner HERE (and AWAITS it, never mutating its state) or
 * — when no live owner exists in this composition — treats the attempt as
 * abandoned and reconciles it conservatively to the fenced, non-replayable
 * `outcome_unknown`.
 *
 * The registry is deliberately scoped per composition (never a
 * module-global map keyed only by `invocationId`): two independent
 * compositions with two independent stores running in ONE process can
 * produce COLLIDING local invocation ids — a shared key would alias their
 * liveness (one composition would await, or fence-share with, the OTHER
 * composition's owner). Composition scoping makes the collision
 * impossible: each composition only ever observes its own owners.
 */
export interface CapabilityLiveRunRegistry {
  /**
   * Register THIS caller as the candidate owner of the invocation BEFORE
   * the durable claim. Concurrent candidates of ONE invocation SHARE the
   * incumbent registration (created before the first claim): exactly one
   * owner signal exists per invocation, so a duplicate always finds the
   * live owner and an owner's signal is never overwritten by a losing
   * candidate.
   */
  readonly register: (invocationId: string) => {
    readonly fenceToken: string;
    readonly settle: () => void;
  };
  /** The live registration for an invocation, if one exists. */
  readonly inspect: (invocationId: string) => CapabilityLiveRunRegistration | undefined;
}

/**
 * Create the live-owner registry for ONE bridge composition. Every
 * composition gets its own registry (injected through
 * `CapabilityBridgeDeps.liveRunRegistry` by the turn-executor
 * composition); registries are never shared across compositions.
 */
export function createCapabilityLiveRunRegistry(): CapabilityLiveRunRegistry {
  const liveRuns = new Map<string, CapabilityLiveRunRegistration>();
  let fenceCounter = 0;
  const nextFenceToken = (): string => {
    fenceCounter += 1;
    return `fence-${process.pid}-${fenceCounter}-${randomUUID()}`;
  };
  return {
    register(invocationId) {
      const existing = liveRuns.get(invocationId);
      if (existing !== undefined) {
        return { fenceToken: existing.fenceToken, settle: (): void => undefined };
      }
      let resolveSettled!: () => void;
      const settled = new Promise<void>((resolve) => {
        resolveSettled = resolve;
      });
      const fenceToken = nextFenceToken();
      liveRuns.set(invocationId, { fenceToken, settled });
      return {
        fenceToken,
        settle: (): void => {
          const current = liveRuns.get(invocationId);
          if (current !== undefined && current.fenceToken === fenceToken) {
            liveRuns.delete(invocationId);
          }
          resolveSettled();
        },
      };
    },
    inspect: (invocationId) => liveRuns.get(invocationId),
  };
}

/** Stable per-process owner identity (never a credential, never a payload). */
const BRIDGE_OWNER_IDENTITY = `vict-tool-bridge:${process.pid}:${randomUUID()}`;

/**
 * The stable envelope for an OBSERVED durable state (terminal replay or
 * truthful in-progress report). Explicit replay/recovery dispositions only:
 * a completed replay is the bounded, structural result SUMMARY — never the
 * raw capability output, never a satisfiable new execution result.
 */
function stableDispositionEnvelope(
  record: AgentToolInvocationRecord,
): CapabilityToolFailure | CapabilityToolReplay {
  switch (record.status) {
    case 'completed':
      return {
        victCapabilityReplay: {
          disposition: 'completed',
          invocationId: record.invocationId,
          ...(record.resultSummary !== undefined ? { resultSummary: record.resultSummary } : {}),
        },
      } satisfies CapabilityToolReplay;
    case 'failed':
      return {
        victCapabilityFailure: 'VICT_CAPABILITY_INVOCATION_FAILED',
      } satisfies CapabilityToolFailure;
    case 'declined':
      return {
        victCapabilityFailure: 'VICT_CAPABILITY_DECLINED',
      } satisfies CapabilityToolFailure;
    case 'cancelled':
      return {
        victCapabilityFailure: 'VICT_CAPABILITY_CANCELLED',
      } satisfies CapabilityToolFailure;
    case 'outcome_unknown':
      return {
        victCapabilityFailure: 'VICT_CAPABILITY_OUTCOME_UNKNOWN',
      } satisfies CapabilityToolFailure;
    case 'running':
      return {
        victCapabilityReplay: {
          disposition: 'in_progress',
          invocationId: record.invocationId,
        },
      } satisfies CapabilityToolReplay;
    default:
      // Defensive: an unobservable state is reported truthfully ambiguous.
      return {
        victCapabilityFailure: 'VICT_CAPABILITY_OUTCOME_UNKNOWN',
      } satisfies CapabilityToolFailure;
  }
}

interface DuplicateContext {
  readonly abortSignal: AbortSignal | undefined;
  readonly clock: () => number;
  readonly liveRunRegistry: CapabilityLiveRunRegistry;
  readonly rereadInvocation: () => Promise<AgentToolInvocationRecord>;
}

/**
 * Resolve a DUPLICATE observation of a claimed (`running`) attempt WITHOUT
 * mutating it:
 *
 * - same-composition live owner → await the owner's settlement (bounded by
 *   the owner's own execution) and replay the truthful terminal
 *   disposition; a cancelled waiter receives the non-terminal
 *   `in_progress` report — the documented duplicate-cancellation policy:
 *   the owner is never mutated or cancelled, no false terminal disposition
 *   is produced, and the non-terminal report is normalized by the adapter
 *   as an OPEN milestone (no terminal tool event) so the occurrence's
 *   terminal milestone stays reserved for the owner's truthful settlement;
 * - no live owner in this composition → the claim came from a previous
 *   process life (or a lost registry): reconcile conservatively to the
 *   fenced, NON-REPLAYABLE `outcome_unknown` without executing anything.
 *   The reconciliation is exact-binding: accepted only while the observed
 *   durable state is exactly the running attempt under the observed fence.
 */
async function resolveRunningDuplicate(
  deps: CapabilityBridgeDeps,
  record: AgentToolInvocationRecord,
  context: DuplicateContext,
): Promise<CapabilityToolFailure | CapabilityToolReplay> {
  const live = context.liveRunRegistry.inspect(record.invocationId);
  if (live !== undefined) {
    if (context.abortSignal !== undefined) {
      // A cancelled waiter must not wait forever: race the owner's
      // settlement against the abort signal (the re-read below still
      // reports the truthful state whatever the race outcome was).
      const abortWaiter = new Promise<void>((resolve) => {
        const signal = context.abortSignal as AbortSignal;
        if (signal.aborted) {
          resolve();
          return;
        }
        signal.addEventListener('abort', () => resolve(), { once: true });
      });
      await Promise.race([live.settled, abortWaiter]);
    } else {
      // No abort surface: await the owner's settlement (bounded by the
      // owner's own execution).
      await live.settled;
    }
    const after = await context.rereadInvocation();
    return stableDispositionEnvelope(after);
  }
  // No live owner in THIS process: the attempt is treated as abandoned
  // (owner loss across a process life). NEVER re-execute the effect and
  // NEVER fabricate a completion.
  try {
    await deps.reconcileAbandonedRun({
      invocationId: record.invocationId,
      observedFenceToken: record.runFenceToken ?? '',
      reconciledFenceToken: `fence-reconcile-${process.pid}-${randomUUID()}`,
      at: context.clock(),
    });
  } catch {
    // Lost the reconciliation race (another duplicate reconciled first, or
    // the state moved): report the re-read OBSERVED state truthfully.
  }
  const after = await context.rereadInvocation();
  return stableDispositionEnvelope(after);
}

interface ApprovalGateContext {
  readonly policy: BridgeCapabilityPolicy;
  readonly turn: BridgeTurnContext;
  readonly toolCallId: string;
  readonly capabilityId: string;
  readonly capabilityRevision: string;
  readonly argDigest: string;
  readonly effect: EffectClass;
  readonly clock: () => number;
}

type ApprovalGateResult =
  | { readonly kind: 'proceed' }
  | { readonly kind: 'arbitrate' }
  | { readonly kind: 'return'; readonly envelope: CapabilityToolFailure | CapabilityToolReplay };

/**
 * The approval gate for the OWNER CANDIDATE (pre-running). All durable
 * settlements go through the EXACT-BINDING pre-running settle command; a
 * denied consumption mutates NOTHING (the winning consumer will claim the
 * attempt; the denied caller is a duplicate, not an owner).
 */
async function runApprovalGate(
  deps: CapabilityBridgeDeps,
  invocation: AgentToolInvocationRecord,
  context: ApprovalGateContext,
): Promise<ApprovalGateResult> {
  const { turn, clock } = context;
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
    // only). The milestone is AWAITED so durable events stay ordered and
    // exactly once relative to the approval record; a persistence failure
    // here fails the tool closed BEFORE any effect exists.
    if (deps.emitAwaitingApproval !== undefined) {
      await deps.emitAwaitingApproval({
        kind: 'tool.awaiting_approval',
        streamId: turn.streamId,
        turnId: turn.turnId,
        threadId: readThreadId(),
        actorId: turn.actorId,
        agentProfileVersion: turn.agentProfileVersion,
        seq: 0,
        toolCallId: context.toolCallId,
        toolName: context.capabilityId,
        victInvocationId: invocation.invocationId,
      } as unknown as AgentStreamEvent);
    }
  }
  // Wait for the durable decision (VICT approval record commits BEFORE any
  // Mastra resume of the effect). Cancellation and expiry end the wait
  // without invoking the capability.
  const decision = await awaitApprovalDecision(deps, approvalId, {
    clock,
    pollIntervalMs: deps.pollIntervalMs ?? 25,
    expiryAt: clock() + (deps.approvalExpiryMs ?? 900_000),
    abortSignal: turn.abortSignal,
  });
  const settlePending = async (
    status: 'failed' | 'declined' | 'cancelled',
    errorCode: string | undefined,
  ): Promise<ApprovalGateResult> => {
    try {
      await deps.settleInvocationPending({
        invocationId: invocation.invocationId,
        status,
        at: clock(),
        ...(errorCode !== undefined ? { errorCode } : {}),
      });
    } catch (error) {
      if (isArbitrationConflict(error)) {
        // A claimed record (OWNER_ACTIVE) or a conflicting terminal state:
        // the caller re-reads and re-dispatches truthfully.
        return { kind: 'arbitrate' } as const;
      }
      throw error;
    }
    return { kind: 'arbitrate' } as const;
  };
  if (decision.status === 'declined') {
    // The declined settlement either lands (exact-binding idempotent) or
    // the durable state is owned elsewhere; either way the caller re-reads
    // and replays the truthful durable disposition.
    return settlePending('declined', 'VICT_TOOL_DECLINED');
  }
  if (decision.status === 'expired' || decision.status === 'timeout') {
    return settlePending('failed', 'VICT_APPROVAL_EXPIRED');
  }
  if (decision.status === 'cancelled') {
    return settlePending('cancelled', 'VICT_TURN_CANCELLED');
  }
  // Exact-binding consumption: any wrong identity is denied. The DENIED
  // caller is not the owner — it mutates nothing and receives the stable
  // denial (the winning consumer proceeds to claim the attempt).
  const consumed = await deps.consumeApproval({
    approvalId,
    actorId: turn.actorId,
    agentProfileVersion: turn.agentProfileVersion,
    capabilityId: context.capabilityId,
    capabilityRevision: context.capabilityRevision,
    turnId: turn.turnId,
    toolCallId: context.toolCallId,
    invocationId: invocation.invocationId,
    argDigest: context.argDigest,
    effect: context.effect,
    at: clock(),
  });
  if (!consumed.approved) {
    return {
      kind: 'return',
      envelope: {
        victCapabilityFailure: 'VICT_CAPABILITY_AUTHORITY_DENIED',
      } satisfies CapabilityToolFailure,
    } as const;
  }
  return { kind: 'proceed' } as const;
}

interface OwnedAttemptContext {
  readonly definition: CapabilityDefinition<unknown, unknown>;
  readonly effectiveInput: unknown;
  readonly outputContract: { parse: (value: unknown) => unknown } | undefined;
  readonly turn: BridgeTurnContext;
  readonly toolCallId: string;
  readonly idempotencyKey: string;
  readonly fenceToken: string;
  readonly clock: () => number;
}

/**
 * Execute ONE owned attempt under its EXACT fence: capability invocation,
 * authoritative output-contract validation, and the fenced terminal
 * settlement.
 *
 * Normal success is returned ONLY after the exact durable `completed`
 * transition is confirmed under this attempt's fence. A capability throw,
 * an output-contract violation, or ANY completion-persistence failure is
 * the truthful fenced, NON-replayable `outcome_unknown` — the model never
 * receives a normal success (and never the raw output) for an invocation
 * whose durable completion is unconfirmed.
 */
async function executeOwnedAttempt(
  deps: CapabilityBridgeDeps,
  claimed: AgentToolInvocationRecord,
  context: OwnedAttemptContext,
): Promise<unknown> {
  const invocationId = claimed.invocationId;
  const fenceToken = context.fenceToken;
  const settleUnknown = async (
    modelCode: CapabilityToolFailureCode,
    errorCode: string,
  ): Promise<CapabilityToolFailure> => {
    try {
      await deps.settleInvocationRun({
        invocationId,
        fenceToken,
        status: 'outcome_unknown',
        at: context.clock(),
        errorCode,
      });
    } catch {
      // Even the fenced fallback failed: the model still receives the
      // truthful non-replayable failure — never the raw output.
    }
    return {
      victCapabilityFailure: modelCode,
    } satisfies CapabilityToolFailure;
  };
  // The stable durable idempotency key is propagated into the capability
  // invocation context so EXTERNAL adapters can deduplicate their own
  // effects after retries and restarts (one logical effect per key).
  let rawOutput: unknown;
  try {
    rawOutput = await deps.invoke(context.definition, context.effectiveInput, {
      signal: context.turn.abortSignal,
      victIdempotencyKey: context.idempotencyKey,
      victInvocationId: invocationId,
      victTurnId: context.turn.turnId,
      victToolCallId: context.toolCallId,
      victActorId: context.turn.actorId,
    } as Partial<CapabilityContext>);
  } catch {
    // A capability that THREW may already have performed its effect (the
    // throw could have happened after the effect): the truthful disposition
    // is the fenced, NON-replayable `outcome_unknown` — never an ordinarily
    // retriable `failed` invocation.
    return settleUnknown('VICT_CAPABILITY_OUTCOME_UNKNOWN', 'VICT_CAPABILITY_OUTCOME_UNKNOWN');
  }
  // ---- Authoritative output-contract validation ---------------------------
  if (context.outputContract !== undefined) {
    try {
      const parsed = context.outputContract.parse(rawOutput) as {
        ok: boolean;
        value?: unknown;
      };
      if (!parsed.ok) {
        // The capability RAN — the effect may exist even though the output
        // violated its contract: the truthful disposition is the fenced,
        // NON-replayable `outcome_unknown`.
        return settleUnknown(
          'VICT_CAPABILITY_OUTPUT_CONTRACT_REJECTED',
          'VICT_CAPABILITY_OUTPUT_CONTRACT_REJECTED',
        );
      }
      rawOutput = parsed.value;
    } catch {
      return settleUnknown(
        'VICT_CAPABILITY_OUTPUT_CONTRACT_REJECTED',
        'VICT_CAPABILITY_OUTPUT_CONTRACT_REJECTED',
      );
    }
  }
  // ---- Reserved control-marker rejection + hostile-structure arbitration -
  // The bridge's control markers (`victCapabilityReplay`,
  // `victCapabilityFailure`) and the helper bridge's marker are RESERVED:
  // a capability whose output impersonates a control envelope can never
  // have that output returned as a normal result — it would poison the
  // adapter's milestone mapping (a fake `in_progress` would suppress the
  // truthful completion event; a fake failure marker would contradict the
  // durable completed state).
  //
  // POST-AUDIT SETTLEMENT GUARANTEE: the capability has ALREADY run here —
  // this entire inspection is therefore TOTAL and every rejection funnels
  // into the fenced, NON-replayable `outcome_unknown` settlement. The
  // previous direct `in`-based check let a hostile Proxy (`has` trap) or a
  // revoked proxy THROW past this point, bypassing the fence and leaving
  // the durable invocation incorrectly `running` with the raw exception
  // crossing the tool boundary. Now:
  // - structure is captured through the shared control-envelope boundary
  //   (descriptor reads only — no getter/setter/get-trap is ever invoked);
  // - an uninspectable (revoked/trap-hostile) output is `outcome_unknown`
  //   (`VICT_CAPABILITY_UNSAFE_OUTPUT_STRUCTURE`);
  // - any reserved marker in any own form (data, accessor, hidden) is
  //   rejected unread (`VICT_CAPABILITY_RESERVED_MARKER_REJECTED`);
  // - an own `then` field in any form is rejected — a thenable output
  //   would run arbitrary code during the post-settlement delivery await;
  // - THREE GUARDED `in`-consistency probes (the only `in` uses, AFTER
  //   safe capture) verify the container answers marker membership
  //   honestly: a throwing `has` trap, or a `has` lie invisible to the
  //   descriptor capture, classifies the output as hostile. A throwing
  //   trap never reaches the model and never echoes its canary.
  let capturedOutput:
    Extract<ReturnType<typeof captureControlRecord>, { kind: 'captured' }> | undefined;
  if (typeof rawOutput === 'object' && rawOutput !== null) {
    const reject = (
      errorCode:
        'VICT_CAPABILITY_RESERVED_MARKER_REJECTED' | 'VICT_CAPABILITY_UNSAFE_OUTPUT_STRUCTURE',
    ): Promise<CapabilityToolFailure> =>
      settleUnknown('VICT_CAPABILITY_OUTCOME_UNKNOWN', errorCode);
    try {
      const capture = captureControlRecord(rawOutput);
      if (capture.kind !== 'captured') {
        return await reject('VICT_CAPABILITY_UNSAFE_OUTPUT_STRUCTURE');
      }
      capturedOutput = capture;
      if (capturedHasAnyControlMarker(capture)) {
        return await reject('VICT_CAPABILITY_RESERVED_MARKER_REJECTED');
      }
      if (capturedHasField(capture, 'then')) {
        return await reject('VICT_CAPABILITY_UNSAFE_OUTPUT_STRUCTURE');
      }
      for (const name of CONTROL_MARKER_KEYS) {
        let present: boolean;
        try {
          present = name in rawOutput;
        } catch {
          return await reject('VICT_CAPABILITY_UNSAFE_OUTPUT_STRUCTURE');
        }
        if (present) {
          // Marker membership visible to `in` but not to the descriptor
          // capture (inherited or descriptor-invisible proxy lie): the
          // output impersonates a control envelope.
          return await reject('VICT_CAPABILITY_RESERVED_MARKER_REJECTED');
        }
      }
    } catch {
      // Absolute backstop: NO inspection failure can bypass the fenced
      // settlement path once the capability may already have acted.
      return await reject('VICT_CAPABILITY_UNSAFE_OUTPUT_STRUCTURE');
    }
  }
  // ---- FENCED completed settlement ---------------------------------------
  let resultSummary: string;
  try {
    resultSummary = safeArgumentSummary(rawOutput);
  } catch {
    return settleUnknown('VICT_CAPABILITY_OUTCOME_UNKNOWN', 'VICT_CAPABILITY_OUTCOME_UNKNOWN');
  }
  try {
    await deps.settleInvocationRun({
      invocationId,
      fenceToken,
      status: 'completed',
      at: context.clock(),
      resultSummary,
    });
  } catch {
    // Completion-persistence ambiguity: the exact durable `completed`
    // transition was NOT confirmed — never return normal success.
    return settleUnknown('VICT_CAPABILITY_OUTCOME_UNKNOWN', 'VICT_CAPABILITY_OUTCOME_UNKNOWN');
  }
  // ---- Sanitized result to Mastra (confirmed durable completion) ----------
  // A verified PLAIN output is delivered as a structurally identical
  // trap-free/thenable-free REBUILD (own enumerable data fields, values
  // taken from their descriptors): no downstream consumer (Mastra, the
  // adapter, the model) can ever trigger a getter, a proxy trap, or an
  // inherited/own `then` on the delivered container. Non-plain outputs
  // (arrays, class instances) are delivered as-is — their contract
  // validation, marker checks, and the guarded `in` probes above all
  // passed.
  if (capturedOutput !== undefined) {
    const rebuilt = rebuildPlainCapturedObject(capturedOutput);
    if (rebuilt !== undefined) {
      return rebuilt;
    }
  }
  return rawOutput;
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
