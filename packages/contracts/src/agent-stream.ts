/**
 * Neutral product-agent stream contract.
 *
 * `vict.agent-stream@1` — the VICT-owned normalized event surface for
 * product-agent turns (agent-framework amendment §9.1, AI-001/AI-009). This
 * module is deliberately schema-library neutral and framework neutral: no
 * agent-framework type, provider chunk type, or schema-library type may appear here
 * (AI-002, CONT-006 discipline extended to the agent boundary).
 *
 * Stage 06A scope boundary (honest): this surface is the IN-PROCESS event
 * contract needed for adapter conformance — the event vocabulary, per-stream
 * sequence numbers, and payload-safe field discipline. The final SSE
 * serialization, cursor-reconnect protocol, and the complete field-level
 * `vict.agent-stream@1` wire schema are finalized in Stage 06B (OPEN-015
 * stays open). Nothing here claims transport completeness.
 *
 * Stage 06B (OPEN-015 DECIDED): the COMPLETE field-level schema below is
 * the final frozen `vict.agent-stream@1` contract. Closed per-kind field
 * sets, bounded namespace identifiers, strict monotonic sequences, and the
 * transient/durable kind classification are validated by
 * `validateAgentStreamEvent` / `assertAgentStreamEvent`. Unknown event
 * kinds and unknown fields FAIL CLOSED. Compatibility/evolution rules for
 * the frozen `@1` marker are documented in the module contract at the
 * bottom of this file.
 *
 * Payload-safety invariants (AI-009, §9.1):
 * - no raw provider or agent-framework chunk type is representable;
 * - no hidden chain-of-thought: reasoning content is never carried;
 * - tool arguments/results cross only as validated, summarized data;
 * - every event identifies the stream, turn, thread, actor, and the
 *   agent-profile version that produced it;
 * - `seq` is a per-stream monotonically increasing 1-based sequence number.
 */

/** The versioned marker of the normalized agent-stream contract. */
export const AGENT_STREAM_SCHEMA = 'vict.agent-stream@1';

/** Identity and correlation context carried by every normalized event. */
export interface AgentStreamContext {
  /** Stable identity of the stream (one turn's event sequence). */
  readonly streamId: string;
  /** VICT turn identity (one logical agent turn). */
  readonly turnId: string;
  /** the agent framework-owned conversation thread identity. */
  readonly threadId: string;
  /** VICT actor identity (the only source of memory ownership). */
  readonly actorId: string;
  /** The exact agent-profile identity pinned for the turn. */
  readonly agentProfileVersion: string;
  /** the agent framework trace identity for correlation, when tracing produced one. */
  readonly traceId?: string;
  /** VICT run identity for correlation, when the turn runs inside a run. */
  readonly victRunId?: string;
  /** The pinned activation identity for the turn, when composed. */
  readonly activationVersion?: string;
  /** the agent framework execution identity for correlation, when one exists. */
  readonly mastraRunId?: string;
  /** The durable VICT tool-invocation identity, when the event belongs to one. */
  readonly victInvocationId?: string;
  /** The durable VICT attempt identity (one logical invocation attempt). */
  readonly victAttemptId?: string;
}

/** Payload of `text.delta` — transient streamed text content. */
export interface AgentStreamTextDelta {
  readonly kind: 'text.delta';
  readonly delta: string;
}

/** Payload of `content.completed` — the durable completed-content milestone. */
export interface AgentStreamContentCompleted {
  readonly kind: 'content.completed';
  /**
   * Bounded reference to the completed assistant content inside the
   * designated, actor-authorized conversation store. The operational
   * stream ledger never carries the content itself.
   */
  readonly contentRef: string;
}

/** Payload of `tool.requested` — the model selected a tool. */
export interface AgentStreamToolRequested {
  readonly kind: 'tool.requested';
  readonly toolCallId: string;
  readonly toolName: string;
}

/** Payload of `tool.started` — tool execution began. */
export interface AgentStreamToolStarted {
  readonly kind: 'tool.started';
  readonly toolCallId: string;
  readonly toolName: string;
}

/** Payload of `tool.awaiting_approval` — a protected action waits for VICT approval. */
export interface AgentStreamToolAwaitingApproval {
  readonly kind: 'tool.awaiting_approval';
  readonly toolCallId: string;
  readonly toolName: string;
}

/** Payload of `tool.completed` — a tool finished with a validated result summary. */
export interface AgentStreamToolCompleted {
  readonly kind: 'tool.completed';
  readonly toolCallId: string;
  readonly toolName: string;
}

/** Payload of `tool.failed` — a tool failed with a stable, non-echoing code. */
export interface AgentStreamToolFailed {
  readonly kind: 'tool.failed';
  readonly toolCallId: string;
  readonly toolName: string;
  /** Stable sanitized failure code; never raw provider/tool error content. */
  readonly code: string;
}

/** Payload of `memory.updated` — durable conversation-memory milestone. */
export interface AgentStreamMemoryUpdated {
  readonly kind: 'memory.updated';
  readonly threadId: string;
}

/** Token/cost usage summary. Aggregated counts only — never payloads. */
export interface AgentStreamUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
}

/** Payload of `usage.updated` — safe usage summary for the turn. */
export interface AgentStreamUsageUpdated {
  readonly kind: 'usage.updated';
  readonly usage: AgentStreamUsage;
}

/** Payload of `response.started` — the turn began producing a response. */
export interface AgentStreamResponseStarted {
  readonly kind: 'response.started';
}

/** Payload of `response.completed` — the turn completed normally. */
export interface AgentStreamResponseCompleted {
  readonly kind: 'response.completed';
}

/** Payload of `response.failed` — the turn failed with a stable, non-echoing code. */
export interface AgentStreamResponseFailed {
  readonly kind: 'response.failed';
  /** Stable sanitized failure code; never raw provider/the agent framework error content. */
  readonly code: string;
}

/** Payload of `response.cancelled` — durable cancellation reached the turn. */
export interface AgentStreamResponseCancelled {
  readonly kind: 'response.cancelled';
}

/**
 * One normalized agent-stream event. `kind` selects the payload; `seq`
 * orders the event within its stream (1-based, monotonic, gapless in
 * process-local production).
 */
export type AgentStreamEvent = AgentStreamContext & {
  readonly seq: number;
} & (
    | AgentStreamResponseStarted
    | AgentStreamTextDelta
    | AgentStreamContentCompleted
    | AgentStreamToolRequested
    | AgentStreamToolStarted
    | AgentStreamToolAwaitingApproval
    | AgentStreamToolCompleted
    | AgentStreamToolFailed
    | AgentStreamMemoryUpdated
    | AgentStreamUsageUpdated
    | AgentStreamResponseCompleted
    | AgentStreamResponseFailed
    | AgentStreamResponseCancelled
  );

/** The closed set of normalized event kinds (vocabulary of `vict.agent-stream@1`). */
export const AGENT_STREAM_EVENT_KINDS = [
  'response.started',
  'text.delta',
  'content.completed',
  'tool.requested',
  'tool.started',
  'tool.awaiting_approval',
  'tool.completed',
  'tool.failed',
  'memory.updated',
  'usage.updated',
  'response.completed',
  'response.failed',
  'response.cancelled',
] as const;

export type AgentStreamEventKind = (typeof AGENT_STREAM_EVENT_KINDS)[number];

// ---- Final field-level schema (Stage 06B — OPEN-015 decided) ---------------

/**
 * Bounded namespace identifier: printable, non-empty, at most 128
 * characters, no whitespace, no control characters, no leading/trailing
 * separators. Used for stream, turn, thread, actor, run, trace, and tool-call
 * identifiers crossing the `vict.agent-stream@1` boundary.
 */
export const AGENT_STREAM_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/;

/** Stable issue codes produced by the field-level validation. */
export const AGENT_STREAM_SCHEMA_CODES = [
  'AGENT_STREAM_UNKNOWN_KIND',
  'AGENT_STREAM_UNKNOWN_FIELD',
  'AGENT_STREAM_INVALID_ID',
  'AGENT_STREAM_INVALID_SEQ',
  'AGENT_STREAM_INVALID_FIELD',
  'AGENT_STREAM_INVALID_CODE',
  'AGENT_STREAM_INVALID_USAGE',
  'AGENT_STREAM_INVALID_CONTENT_REF',
  'AGENT_STREAM_SCHEMA_MISMATCH',
  'AGENT_STREAM_NOT_OBJECT',
] as const;

export type AgentStreamSchemaCode = (typeof AGENT_STREAM_SCHEMA_CODES)[number];

/** A structured, non-echoing schema issue (paths and codes only — never values). */
export interface AgentStreamSchemaIssue {
  readonly code: AgentStreamSchemaCode;
  /** Field path of the offending member (e.g. `"tool.failed"`, `"seq"`). */
  readonly path?: string;
}

/** The field-level validation result. */
export type AgentStreamValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly issues: readonly AgentStreamSchemaIssue[] };

/** Per-kind payloads keyed by the closed event vocabulary. */
interface KindFields {
  readonly fields: ReadonlySet<string>;
  /** True when the kind is transient stream content (safe to coalesce). */
  readonly transient: boolean;
}

const KIND_FIELDS: Readonly<Record<AgentStreamEventKind, KindFields>> = {
  'response.started': { fields: new Set(['kind']), transient: false },
  'text.delta': { fields: new Set(['kind', 'delta']), transient: true },
  'content.completed': { fields: new Set(['kind', 'contentRef']), transient: false },
  'tool.requested': { fields: new Set(['kind', 'toolCallId', 'toolName']), transient: false },
  'tool.started': { fields: new Set(['kind', 'toolCallId', 'toolName']), transient: false },
  'tool.awaiting_approval': {
    fields: new Set(['kind', 'toolCallId', 'toolName']),
    transient: false,
  },
  'tool.completed': { fields: new Set(['kind', 'toolCallId', 'toolName']), transient: false },
  'tool.failed': {
    fields: new Set(['kind', 'toolCallId', 'toolName', 'code']),
    transient: false,
  },
  'memory.updated': { fields: new Set(['kind', 'threadId']), transient: false },
  'usage.updated': { fields: new Set(['kind', 'usage']), transient: false },
  'response.completed': { fields: new Set(['kind']), transient: false },
  'response.failed': { fields: new Set(['kind', 'code']), transient: false },
  'response.cancelled': { fields: new Set(['kind']), transient: false },
};

/** The durable (persisted) kinds; every other kind is transient stream content. */
export const AGENT_STREAM_DURABLE_KINDS: readonly AgentStreamEventKind[] =
  AGENT_STREAM_EVENT_KINDS.filter((kind) => !KIND_FIELDS[kind].transient);

/** The transient kinds: safe to coalesce under backpressure, never persisted by default. */
export const AGENT_STREAM_TRANSIENT_KINDS: readonly AgentStreamEventKind[] =
  AGENT_STREAM_EVENT_KINDS.filter((kind) => KIND_FIELDS[kind].transient);

/** Stable sanitized failure-code shape used by `tool.failed` / `response.failed`. */
export const AGENT_STREAM_CODE_PATTERN = /^VICT_[A-Z0-9_]{1,96}$/;

/**
 * Bounded content-reference shape for durable content milestones. A
 * content reference IDENTIFIES content inside the designated,
 * actor-authorized conversation store — it never carries the content.
 */
export const AGENT_STREAM_CONTENT_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/;

/** The closed context field set carried by EVERY event. */
const CONTEXT_FIELDS: ReadonlySet<string> = new Set([
  'streamId',
  'turnId',
  'threadId',
  'actorId',
  'agentProfileVersion',
  'traceId',
  'victRunId',
  'activationVersion',
  'mastraRunId',
  'victInvocationId',
  'victAttemptId',
  'seq',
]);

/** Validate one bounded namespace identifier. */
export function isValidAgentStreamId(value: unknown): value is string {
  return typeof value === 'string' && AGENT_STREAM_ID_PATTERN.test(value);
}

function isValidOptionalId(value: unknown): boolean {
  return value === undefined || isValidAgentStreamId(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value) as object | null;
  return proto === Object.prototype || proto === null;
}

/**
 * The FINAL field-level validation of one `vict.agent-stream@1` event.
 * Fails closed on unknown event kinds, unknown fields (per kind AND in the
 * common envelope), non-plain input, invalid identifiers, invalid
 * sequences, and unsafe codes. Diagnostics carry codes and paths only —
 * never event values (CONT-005 discipline at the stream boundary).
 *
 * Delivery remains at-least-once: sequence MONOTONICITY per stream is a
 * stateful property enforced by the durable stream ledger (append gate),
 * not by this structural validator.
 */
export function validateAgentStreamEvent(input: unknown): AgentStreamValidationResult {
  const issues: AgentStreamSchemaIssue[] = [];
  const reject = (code: AgentStreamSchemaCode, path?: string): void => {
    issues.push(path === undefined ? { code } : { code, path });
  };
  if (!isPlainObject(input)) {
    return { ok: false, issues: [{ code: 'AGENT_STREAM_NOT_OBJECT' }] };
  }
  const event = input as Record<string, unknown>;
  const allowed = new Set(CONTEXT_FIELDS);
  const kindValue = event.kind;
  if (typeof kindValue !== 'string' || !Object.hasOwn(KIND_FIELDS, kindValue)) {
    // Unknown kinds fail closed; the specific value is never echoed.
    reject('AGENT_STREAM_UNKNOWN_KIND', 'kind');
    return { ok: false, issues };
  }
  const kind = kindValue as AgentStreamEventKind;
  for (const field of KIND_FIELDS[kind].fields) {
    allowed.add(field);
  }
  for (const key of Object.keys(event)) {
    if (!allowed.has(key)) {
      reject('AGENT_STREAM_UNKNOWN_FIELD', `${kind}.${key}`);
    }
  }
  if (issues.length > 0) {
    return { ok: false, issues };
  }
  // Bounded namespace identifiers on every required identity field.
  for (const idField of ['streamId', 'turnId', 'threadId', 'actorId'] as const) {
    if (!isValidAgentStreamId(event[idField])) {
      reject('AGENT_STREAM_INVALID_ID', idField);
    }
  }
  if (!isValidOptionalId(event.traceId)) {
    reject('AGENT_STREAM_INVALID_ID', 'traceId');
  }
  if (!isValidOptionalId(event.victRunId)) {
    reject('AGENT_STREAM_INVALID_ID', 'victRunId');
  }
  for (const optionalIdField of [
    'activationVersion',
    'mastraRunId',
    'victInvocationId',
    'victAttemptId',
  ] as const) {
    if (!isValidOptionalId(event[optionalIdField])) {
      reject('AGENT_STREAM_INVALID_ID', optionalIdField);
    }
  }
  if (
    typeof event.agentProfileVersion !== 'string' ||
    event.agentProfileVersion.length === 0 ||
    event.agentProfileVersion.length > 256
  ) {
    reject('AGENT_STREAM_INVALID_ID', 'agentProfileVersion');
  }
  // Strictly positive safe-integer sequences (monotonic ordering is the
  // ledger's per-stream stateful gate).
  if (typeof event.seq !== 'number' || !Number.isSafeInteger(event.seq) || event.seq < 1) {
    reject('AGENT_STREAM_INVALID_SEQ', 'seq');
  }
  // Kind-specific field validation.
  switch (kind) {
    case 'text.delta':
      if (typeof event.delta !== 'string' || event.delta.length === 0) {
        reject('AGENT_STREAM_INVALID_FIELD', 'text.delta.delta');
      }
      break;
    case 'content.completed':
      if (
        typeof event.contentRef !== 'string' ||
        !AGENT_STREAM_CONTENT_REF_PATTERN.test(event.contentRef)
      ) {
        reject('AGENT_STREAM_INVALID_CONTENT_REF', 'content.completed.contentRef');
      }
      break;
    case 'tool.requested':
    case 'tool.started':
    case 'tool.awaiting_approval':
    case 'tool.completed':
      for (const field of ['toolCallId', 'toolName'] as const) {
        if (!isValidAgentStreamId(event[field])) {
          reject('AGENT_STREAM_INVALID_ID', `${kind}.${field}`);
        }
      }
      break;
    case 'tool.failed':
      for (const field of ['toolCallId', 'toolName'] as const) {
        if (!isValidAgentStreamId(event[field])) {
          reject('AGENT_STREAM_INVALID_ID', `${kind}.${field}`);
        }
      }
      if (typeof event.code !== 'string' || !AGENT_STREAM_CODE_PATTERN.test(event.code)) {
        reject('AGENT_STREAM_INVALID_CODE', 'tool.failed.code');
      }
      break;
    case 'memory.updated':
      if (!isValidAgentStreamId(event.threadId)) {
        reject('AGENT_STREAM_INVALID_ID', 'memory.updated.threadId');
      }
      break;
    case 'usage.updated': {
      const usage = event.usage as Record<string, unknown> | undefined;
      if (
        !isPlainObject(usage) ||
        Object.keys(usage).length !== 3 ||
        ['inputTokens', 'outputTokens', 'totalTokens'].some(
          (field) =>
            typeof usage[field] !== 'number' ||
            !Number.isSafeInteger(usage[field]) ||
            (usage[field] as number) < 0,
        ) ||
        (usage.totalTokens as number) !==
          (usage.inputTokens as number) + (usage.outputTokens as number)
      ) {
        reject('AGENT_STREAM_INVALID_USAGE', 'usage.updated.usage');
      }
      break;
    }
    case 'response.failed':
      if (typeof event.code !== 'string' || !AGENT_STREAM_CODE_PATTERN.test(event.code)) {
        reject('AGENT_STREAM_INVALID_CODE', 'response.failed.code');
      }
      break;
    default:
      break;
  }
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

/**
 * Validate and THROW (fail closed) on any invalid event. The thrown error
 * is a neutral `VictError`-style structural failure carrying only codes
 * and paths.
 */
export function assertAgentStreamEvent(input: unknown): asserts input is AgentStreamEvent {
  const result = validateAgentStreamEvent(input);
  if (!result.ok) {
    const error = new Error(
      `AGENT_STREAM_EVENT_INVALID: the agent-stream event is not a valid ${AGENT_STREAM_SCHEMA} event (${result.issues
        .map((issue) => issue.code)
        .join(', ')}).`,
    ) as Error & { readonly name: string; code: string };
    error.name = 'AgentStreamSchemaError';
    error.code = 'AGENT_STREAM_EVENT_INVALID';
    throw error;
  }
}

// ---- The closed WIRE envelope (server-emitted SSE data payloads) ------------

/**
 * The ONE closed wire-envelope shape for every server-emitted
 * `vict.agent-stream@1` frame. A wire frame is a normalized event PLUS the
 * exact schema marker field. This is the ONLY shape the server is allowed
 * to emit and the ONLY shape the exported validator accepts; unknown
 * fields, schema mismatches, undeclared event kinds, and malformed
 * payloads FAIL CLOSED.
 */
const WIRE_ENVELOPE_FIELDS: ReadonlySet<string> = new Set(['schema']);

/** The closed field set of the wire envelope (event fields + `schema`). */
export function agentStreamWireEnvelopeFields(kind: AgentStreamEventKind): ReadonlySet<string> {
  const fields = new Set([...CONTEXT_FIELDS, ...KIND_FIELDS[kind].fields, ...WIRE_ENVELOPE_FIELDS]);
  return fields;
}

/** The field-level validation result for one wire envelope. */
export type AgentStreamWireValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly issues: readonly AgentStreamSchemaIssue[] };

/**
 * The FINAL validation of one server-emitted wire envelope. The input must
 * be a plain object carrying the exact `vict.agent-stream@1` marker and a
 * structurally valid normalized event; anything else fails closed with
 * codes and paths only (never values).
 */
export function validateAgentStreamWireEnvelope(input: unknown): AgentStreamWireValidationResult {
  if (!isPlainObject(input)) {
    return { ok: false, issues: [{ code: 'AGENT_STREAM_NOT_OBJECT' }] };
  }
  const frame = input as Record<string, unknown>;
  if (frame.schema !== AGENT_STREAM_SCHEMA) {
    return {
      ok: false,
      issues: [{ code: 'AGENT_STREAM_SCHEMA_MISMATCH', path: 'schema' }],
    };
  }
  // Strip the closed marker field and validate the remaining payload as a
  // normalized event (unknown fields still fail closed).
  const { schema: _marker, ...event } = frame;
  void _marker;
  return validateAgentStreamEvent(event);
}

/** Validate and THROW on any invalid wire envelope (fail closed). */
export function assertAgentStreamWireEnvelope(input: unknown): void {
  const result = validateAgentStreamWireEnvelope(input);
  if (!result.ok) {
    const error = new Error(
      `AGENT_STREAM_WIRE_INVALID: the wire envelope is not a valid ${AGENT_STREAM_SCHEMA} frame (${result.issues
        .map((issue) => issue.code)
        .join(', ')}).`,
    ) as Error & { readonly name: string; code: string };
    error.name = 'AgentStreamSchemaError';
    error.code = 'AGENT_STREAM_WIRE_INVALID';
    throw error;
  }
}

/**
 * `vict.agent-stream@1` compatibility and evolution rules (frozen marker;
 * corrective finalization BEFORE the first independent acceptance of this
 * contract — no `@2` marker exists and none may be introduced here):
 *
 * 1. Once accepted, the `vict.agent-stream@1` marker is FROZEN: every
 *    event validated by this module must remain byte-compatible with the
 *    schema above for the lifetime of `@1`.
 * 2. Every server-emitted frame is a closed WIRE ENVELOPE: the exact
 *    schema marker field plus exactly the normalized event fields,
 *    validated by the exported `validateAgentStreamWireEnvelope`.
 *    Unknown kinds, unknown fields, schema mismatches, and malformed
 *    payloads fail closed; consumers MUST NOT forward unknown content.
 * 3. Replay status is NOT an event: it crosses the SSE boundary through a
 *    separately defined response mechanism (response headers), never as
 *    an undeclared frame inside the closed event vocabulary.
 * 4. Durable content milestones (`content.completed`) carry a bounded
 *    content REFERENCE into the designated, actor-authorized conversation
 *    store — never the content itself. The operational stream ledger
 *    therefore cannot retain prompt text, tool payloads, or completed
 *    assistant content.
 * 5. `text.delta` is transient stream content: delivery is at-least-once
 *    and consecutive deltas MAY be coalesced under backpressure. All other
 *    kinds are durable milestones that MUST NOT be dropped, reordered, or
 *    coalesced, and are persisted by the durable stream ledger.
 * 6. Delivery is at-least-once with client deduplication by
 *    (streamId, seq); sequence numbers are strictly monotonic per stream
 *    and enforced by the durable ledger's append gate.
 * 7. Raw provider/agent-framework chunk types, hidden chain-of-thought,
 *    raw provider/capability errors, credentials, and full tool payloads
 *    are NOT representable in `@1` and MUST never be smuggled through
 *    optional fields (the closed field sets structurally prevent this).
 */
