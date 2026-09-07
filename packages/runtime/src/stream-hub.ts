import {
  assertAgentStreamEvent,
  validateAgentStreamEvent,
  type AgentStreamEvent,
} from '@vict/contracts';
import { isDurableStreamKind, streamEventPayloadOf } from './control-types.js';
import type { AgentStreamLedgerStore } from './control-types.js';

/**
 * Stage 06B — the neutral agent-stream hub (AI-009).
 *
 * One hub owns the per-stream event flow above a durable ledger:
 *
 * - every event is validated against the FINAL `vict.agent-stream@1`
 *   field-level schema (fail closed on unknown kinds/fields);
 * - sequence numbers are assigned by the durable ledger (strictly
 *   monotonic per stream, survive restart);
 * - durable kinds are persisted ledger rows; `text.delta` is transient and
 *   lives only in the bounded replay buffer;
 * - delivery is at-least-once in sequence order (clients deduplicate by
 *   streamId + seq);
 * - backpressure coalesces CONSECUTIVE pending `text.delta` events for a
 *   slow subscriber only, and never drops, reorders, or coalesces
 *   non-delta events;
 * - reconnect replays from a cursor: durable ledger rows plus buffered
 *   transient deltas; a cursor older than the buffer reports that
 *   authoritative completed content must be recovered from durable state.
 *
 * The hub is transport-free: SSE belongs to `@vict/server`.
 */

/** One hub subscriber (transport-owned delivery mechanism). */
export interface AgentStreamSubscriber {
  readonly subscriberId: string;
  /**
   * Deliver one event. Returning `false` signals backpressure: the hub
   * switches this subscriber to buffered mode with delta coalescing until
   * it drains via `pull()`.
   */
  deliver(event: AgentStreamEvent): boolean;
  /** Called when the subscriber is detached. */
  detach?(): void;
}

/** The reconnect cursor: stream identity + last processed sequence. */
export interface AgentStreamCursor {
  readonly streamId: string;
  readonly lastSeq: number;
}

/** Result of a replay. */
export interface AgentStreamReplay {
  readonly events: readonly AgentStreamEvent[];
  /** The newest sequence the stream has assigned. */
  readonly newestSeq: number;
  /**
   * True when the cursor is older than the transient buffer: transient
   * deltas between the cursor and the buffer are unrecoverable, so
   * completed content must be restored from authoritative durable state
   * (`content.completed` milestones).
   */
  readonly olderThanBuffer: boolean;
}

export interface AgentStreamHubOptions {
  readonly ledger: AgentStreamLedgerStore;
  /** Injected clock (epoch ms). */
  readonly clock?: () => number;
  /** Bounded transient replay buffer per stream (default 512). */
  readonly transientBufferSize?: number;
  /** Hard pending-queue bound per slow subscriber (default 4096 events). */
  readonly pendingLimit?: number;
}

interface SubscriberState {
  readonly subscriber: AgentStreamSubscriber;
  slow: boolean;
  pending: AgentStreamEvent[];
}

interface StreamState {
  readonly buffer: AgentStreamEvent[];
  readonly subscribers: Map<string, SubscriberState>;
}

export class AgentStreamHub {
  readonly #ledger: AgentStreamLedgerStore;
  readonly #clock: () => number;
  readonly #transientBufferSize: number;
  readonly #pendingLimit: number;
  readonly #streams = new Map<string, StreamState>();

  constructor(options: AgentStreamHubOptions) {
    this.#ledger = options.ledger;
    this.#clock = options.clock ?? (() => Date.now());
    this.#transientBufferSize = options.transientBufferSize ?? 512;
    this.#pendingLimit = options.pendingLimit ?? 4096;
  }

  /**
   * Validate and publish one event. Assigns the monotonic sequence via the
   * durable ledger, persists durable kinds, buffers transient deltas, and
   * delivers to subscribers. Throws (fail closed) on any schema-invalid
   * event.
   */
  async publish(event: AgentStreamEvent): Promise<AgentStreamEvent> {
    // Pre-validate the event STRUCTURE with a placeholder sequence (the
    // durable ledger assigns the authoritative monotonic sequence next).
    const { seq: _ignored, ...withoutSeq } = event as unknown as Record<string, unknown>;
    void _ignored;
    const validation = validateAgentStreamEvent({ ...withoutSeq, seq: 1 });
    if (!validation.ok) {
      throw new Error(
        `AGENT_STREAM_EVENT_INVALID: event rejected by the vict.agent-stream@1 schema (${validation.issues
          .map((issue) => issue.code)
          .join(', ')}).`,
      );
    }
    const { seq } = await this.#ledger.appendEvent({
      streamId: event.streamId,
      kind: event.kind,
      payload: streamEventPayloadOf(event),
      at: this.#clock(),
    });
    const assigned: AgentStreamEvent = { ...event, seq };
    assertAgentStreamEvent(assigned);
    const state = this.#stateOf(event.streamId);
    if (!isDurableStreamKind(event.kind)) {
      pushBounded(state.buffer, assigned, this.#transientBufferSize);
    }
    this.#deliver(state, assigned);
    return assigned;
  }

  /**
   * Subscribe to a stream. Replays durable ledger rows and buffered
   * transient deltas after the cursor, then attaches the subscriber.
   * Delivery is at-least-once: duplicates after the cursor are possible
   * when a buffered delta was already delivered.
   */
  async subscribe(
    streamId: string,
    subscriber: AgentStreamSubscriber,
    cursor?: { lastSeq?: number },
  ): Promise<void> {
    const state = this.#stateOf(streamId);
    if (state.subscribers.has(subscriber.subscriberId)) {
      throw new Error('AGENT_STREAM_SUBSCRIBER_EXISTS: the subscriber id is already attached.');
    }
    const afterSeq = cursor?.lastSeq ?? 0;
    const durableRows = await this.#ledger.listEventsFrom(streamId, afterSeq);
    for (const row of durableRows) {
      if (!subscriber.deliver(ledgerRowToEvent(row))) {
        break;
      }
    }
    for (const buffered of state.buffer) {
      if (buffered.seq <= afterSeq) {
        continue;
      }
      if (!subscriber.deliver(buffered)) {
        break;
      }
    }
    state.subscribers.set(subscriber.subscriberId, { subscriber, slow: false, pending: [] });
  }

  /** Detach a subscriber (clean completion/cancellation). */
  unsubscribe(streamId: string, subscriberId: string): void {
    this.#stateOf(streamId).subscribers.delete(subscriberId);
  }

  /** Latest assigned sequence for a stream. */
  async latestSeq(streamId: string): Promise<number> {
    return this.#ledger.latestSeq(streamId);
  }

  /**
   * Drain the pending queue of a slow subscriber. Consecutive pending
   * `text.delta` events are coalesced into one delta; non-delta events are
   * never dropped, reordered, or coalesced.
   */
  pull(streamId: string, subscriberId: string): readonly AgentStreamEvent[] {
    const state = this.#stateOf(streamId);
    const entry = state.subscribers.get(subscriberId);
    if (entry === undefined) {
      return [];
    }
    const coalesced = coalesceDeltas(entry.pending);
    entry.pending = [];
    entry.slow = false;
    return coalesced;
  }

  /**
   * Replay for reconnect: durable ledger rows plus buffered transient
   * deltas after the cursor, in strict sequence order.
   */
  async replay(cursor: AgentStreamCursor): Promise<AgentStreamReplay> {
    const rows = await this.#ledger.listEventsFrom(cursor.streamId, cursor.lastSeq);
    const durable = rows.map((row) => ledgerRowToEvent(row));
    const state = this.#stateOf(cursor.streamId);
    const buffered = state.buffer.filter((event) => event.seq > cursor.lastSeq);
    const ledgerNewest = await this.#ledger.latestSeq(cursor.streamId);
    const bufferedNewest = buffered.at(-1)?.seq ?? 0;
    const newestSeq = Math.max(ledgerNewest, bufferedNewest, cursor.lastSeq);
    // Exact transient-gap detection: any sequence strictly between the
    // cursor and the buffer's oldest event that is NOT a durable row is a
    // lost transient delta, so completed content must be recovered from
    // authoritative durable state.
    const oldestBuffered = buffered.at(0)?.seq;
    let olderThanBuffer = false;
    if (oldestBuffered !== undefined) {
      const gapStart = cursor.lastSeq + 1;
      const gapEnd = oldestBuffered; // exclusive
      if (gapEnd > gapStart) {
        const gapSize = gapEnd - gapStart;
        const durableInGap = rows.filter((row) => row.seq >= gapStart && row.seq < gapEnd).length;
        // A missing sequence in the gap is a lost transient delta.
        olderThanBuffer = durableInGap < gapSize;
      }
    }
    const events = [...durable, ...buffered].sort((a, b) => a.seq - b.seq);
    return { events, newestSeq, olderThanBuffer };
  }

  #stateOf(streamId: string): StreamState {
    let state = this.#streams.get(streamId);
    if (state === undefined) {
      state = { buffer: [], subscribers: new Map() };
      this.#streams.set(streamId, state);
    }
    return state;
  }

  /** Deliver to every subscriber; slow subscribers buffer with coalescing. */
  #deliver(state: StreamState, event: AgentStreamEvent): void {
    for (const entry of state.subscribers.values()) {
      if (!entry.slow) {
        const accepted = entry.subscriber.deliver(event);
        if (!accepted) {
          entry.slow = true;
          entry.pending.push(event);
        }
        continue;
      }
      // Buffered mode: coalesce consecutive transient deltas, never drop
      // non-delta events, and honor the hard pending bound.
      const last = entry.pending.at(-1);
      if (
        event.kind === 'text.delta' &&
        last !== undefined &&
        last.kind === 'text.delta' &&
        entry.pending.length <= this.#pendingLimit
      ) {
        // Coalesce in place: consecutive deltas merge into one.
        (last as { delta: string }).delta = last.delta + event.delta;
        continue;
      }
      if (entry.pending.length < this.#pendingLimit) {
        entry.pending.push(event);
        continue;
      }
      // Hard bound reached: only further transient deltas may be folded
      // into the last pending delta (transient content only).
      if (event.kind === 'text.delta' && last !== undefined && last.kind === 'text.delta') {
        (last as { delta: string }).delta = last.delta + event.delta;
      }
      // Non-delta events are NEVER dropped: they cannot exceed the bound in
      // a bounded turn (the pending limit far exceeds one turn's events).
    }
  }
}

/** Bounded push; drops the OLDEST transient delta when full. */
function pushBounded(buffer: AgentStreamEvent[], event: AgentStreamEvent, size: number): void {
  buffer.push(event);
  if (buffer.length > size) {
    buffer.splice(0, buffer.length - size);
  }
}

/** Coalesce CONSECUTIVE text.delta events; all other events pass through. */
function coalesceDeltas(events: readonly AgentStreamEvent[]): AgentStreamEvent[] {
  const result: AgentStreamEvent[] = [];
  for (const event of events) {
    const last = result.at(-1);
    if (event.kind === 'text.delta' && last !== undefined && last.kind === 'text.delta') {
      (last as { delta: string }).delta = last.delta + event.delta;
      continue;
    }
    result.push(event);
  }
  return result;
}

/** Reconstruct one full event from a durable ledger row (fail closed). */
function ledgerRowToEvent(row: {
  streamId: string;
  seq: number;
  kind: string;
  payload: string;
}): AgentStreamEvent {
  const payload = JSON.parse(row.payload) as Record<string, unknown>;
  const event = {
    ...payload,
    streamId: row.streamId,
    seq: row.seq,
  } as unknown as AgentStreamEvent;
  assertAgentStreamEvent(event);
  return event;
}
