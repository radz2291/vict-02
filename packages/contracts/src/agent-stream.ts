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
}

/** Payload of `text.delta` — transient streamed text content. */
export interface AgentStreamTextDelta {
  readonly kind: 'text.delta';
  readonly delta: string;
}

/** Payload of `content.completed` — the durable completed content milestone. */
export interface AgentStreamContentCompleted {
  readonly kind: 'content.completed';
  /** Full completed assistant text for this turn (safe, model-authored). */
  readonly text: string;
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
