import {
  assertAgentStreamEvent,
  validateAgentStreamEvent,
  type AgentStreamEvent,
} from '@victframework/contracts';
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
 * - replay and live delivery use ISOLATED copies: no stored/frozen event
 *   object is ever handed to a subscriber queue or mutated after publish;
 * - backpressure coalesces CONSECUTIVE pending `text.delta` events for a
 *   slow subscriber only, and never drops, reorders, or coalesces
 *   non-delta events; a coalesced delta carries the cursor semantics of
 *   the COMPLETE coalesced range (its sequence is the LAST combined
 *   sequence, so a reconnect cannot re-deliver part of its text);
 * - reconnect replays from a cursor: durable ledger rows plus buffered
 *   transient deltas, detected against the AUTHORITATIVE ledger
 *   high-watermark; a cursor older than the replayable transient content
 *   reports `olderThanBuffer` so completed content is recovered from
 *   durable state — including after a restart when the memory buffer is
 *   empty;
 * - a bounded subscriber queue that overflows follows an EXPLICIT
 *   recoverable policy: the subscriber is detached through
 *   `onOverflow()` and MUST reconnect/replay from its last acknowledged
 *   cursor. Durable, control, and terminal events are never silently
 *   discarded.
 *
 * The hub is transport-free: SSE belongs to `@victframework/server`.
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
  /**
   * Called when the subscriber's bounded pending queue OVERFLOWS, immediately
   * before the hub detaches the subscriber. The transport MUST recover by
   * reconnecting/replaying from its last acknowledged cursor — the hub never
   * silently discards events to fit the bound.
   */
  onOverflow?(): void;
  /** Called when the subscriber is detached (clean completion or overflow). */
  detach?(): void;
}

/** The reconnect cursor: stream identity + last processed sequence. */
export interface AgentStreamCursor {
  readonly streamId: string;
  readonly lastSeq: number;
}

/** Replay/status disclosure for a reconnect (bounded-memory computation). */
export interface AgentStreamReplayStatus {
  /** The newest sequence the stream has assigned (ledger high-watermark). */
  readonly newestSeq: number;
  /**
   * True when transient content after the cursor is no longer replayable:
   * at least one sequence in `(lastSeq, newestSeq]` is neither a durable
   * row nor a buffered transient delta (lost transient interval), so
   * completed content must be restored from authoritative durable state.
   * Detected against the ledger high-watermark — a fresh hub over the same
   * ledger with an EMPTY memory buffer still reports the lost interval.
   */
  readonly olderThanBuffer: boolean;
}

/** Result of a materialized replay. */
export interface AgentStreamReplay extends AgentStreamReplayStatus {
  readonly events: readonly AgentStreamEvent[];
}

export interface AgentStreamHubOptions {
  readonly ledger: AgentStreamLedgerStore;
  /** Injected clock (epoch ms). */
  readonly clock?: () => number;
  /** Bounded transient replay buffer per stream (default 512). */
  readonly transientBufferSize?: number;
  /** Hard pending-queue bound per slow subscriber (default 4096 events). */
  readonly pendingLimit?: number;
  /** Ledger read page size for bounded-memory replay (default 256). */
  readonly replayPageSize?: number;
}

interface SubscriberState {
  readonly subscriber: AgentStreamSubscriber;
  /**
   * Buffer mode. During the REGISTRATION phase (`registering`) live events
   * buffer unconditionally so nothing can overtake the ordered replay; the
   * epilogue flushes the buffered events and leaves the subscriber in the
   * mode the LAST delivered event dictated (fast when the transport keeps
   * accepting, buffered when it signaled saturation).
   */
  registering: boolean;
  slow: boolean;
  pending: AgentStreamEvent[];
  detached: boolean;
}

interface StreamState {
  readonly streamId: string;
  readonly buffer: AgentStreamEvent[];
  readonly subscribers: Map<string, SubscriberState>;
}

export class AgentStreamHub {
  readonly #ledger: AgentStreamLedgerStore;
  readonly #clock: () => number;
  readonly #transientBufferSize: number;
  readonly #pendingLimit: number;
  readonly #replayPageSize: number;
  readonly #streams = new Map<string, StreamState>();

  constructor(options: AgentStreamHubOptions) {
    this.#ledger = options.ledger;
    this.#clock = options.clock ?? (() => Date.now());
    this.#transientBufferSize = options.transientBufferSize ?? 512;
    this.#pendingLimit = options.pendingLimit ?? 4096;
    this.#replayPageSize = options.replayPageSize ?? 256;
  }

  /**
   * Validate and publish one event. Assigns the monotonic sequence via the
   * durable ledger, persists durable kinds, buffers transient deltas, and
   * delivers to subscribers. Throws (fail closed) on any schema-invalid
   * event.
   */
  async publish(
    event: Omit<AgentStreamEvent, 'seq'> & { readonly seq?: number },
  ): Promise<AgentStreamEvent> {
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
    // The stored event is ONE immutable, frozen copy: the replay buffer and
    // every subscriber receive their OWN copies, so no delivery path can
    // ever mutate an event object that another path still reads.
    const assigned: AgentStreamEvent = deepFreezeEvent({ ...event, seq } as AgentStreamEvent);
    assertAgentStreamEvent(assigned);
    const state = this.#stateOf(event.streamId);
    if (!isDurableStreamKind(event.kind)) {
      pushBounded(state.buffer, assigned, this.#transientBufferSize);
    }
    this.#deliver(state, assigned);
    return assigned;
  }

  /**
   * Subscribe to a stream and replay everything after the cursor: durable
   * ledger rows plus buffered transient deltas, in strict sequence order.
   *
   * The subscriber is REGISTERED before the ledger is read, so a concurrent
   * publish can never fall into the gap between the replay read and the
   * live attachment: events published during the replay read are captured
   * in the subscriber's private pending queue and delivered in sequence
   * order as part of the backlog.
   *
   * Delivery is at-least-once and CURSOR-DEDUPLICATED. Backpressure NEVER
   * discards events: the remaining backlog is buffered (bounded) for this
   * subscriber and delivered through `pull()`. If the bounded pending
   * queue overflows, the explicit recoverable policy applies: `onOverflow()`
   * is called and the subscriber is detached (reconnect from the last
   * acknowledged cursor).
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
    // Register in the REGISTERING phase: every live event published during
    // the ledger read lands in this subscriber's private pending queue
    // (never lost to the replay/live race, never out of order).
    const entry: SubscriberState = {
      subscriber,
      registering: true,
      slow: false,
      pending: [],
      detached: false,
    };
    state.subscribers.set(subscriber.subscriberId, entry);
    // Deliver the ordered backlog page by page (bounded memory) plus any
    // live events that were captured during registration. Everything goes
    // through the private pending queue during registration so the ordered
    // backlog and live captures stay strictly ordered relative to each
    // other; the epilogue then hands them off and leaves the subscriber in
    // the mode the LAST delivery dictated (fast transport keeps receiving
    // directly; a saturated transport buffers with coalescing).
    for await (const event of this.#replayIterator(streamId, afterSeq)) {
      if (entry.detached) {
        return;
      }
      // Registration buffers EXACTLY (no coalescing): every replayed and
      // captured event keeps its identity and sequence, and the epilogue
      // hands each one off individually, in order.
      if (entry.pending.length < this.#pendingLimit) {
        entry.pending.push(cloneEvent(event));
        continue;
      }
      // Hard bound reached during registration: explicit recoverable
      // overflow (never silent loss).
      this.#overflow(state, entry);
      return;
    }
    this.#flushPending(state, entry);
  }

  /** Detach a subscriber (clean completion/cancellation/overflow). */
  unsubscribe(streamId: string, subscriberId: string): void {
    const state = this.#stateOf(streamId);
    const entry = state.subscribers.get(subscriberId);
    if (entry !== undefined && !entry.detached) {
      entry.detached = true;
      state.subscribers.delete(subscriberId);
      entry.subscriber.detach?.();
    }
  }

  /** Latest assigned sequence for a stream (ledger high-watermark). */
  async latestSeq(streamId: string): Promise<number> {
    return this.#ledger.latestSeq(streamId);
  }

  /**
   * Drain the pending queue of a slow subscriber. Consecutive pending
   * `text.delta` events are coalesced into one delta whose sequence is the
   * LAST combined sequence (complete-range cursor semantics: a client that
   * acknowledges the coalesced event acknowledges every delta inside it).
   * Non-delta events are never dropped, reordered, or coalesced. Returned
   * events are private copies of this subscriber's queue — coalescing never
   * mutates any event that another consumer can observe.
   */
  pull(streamId: string, subscriberId: string): readonly AgentStreamEvent[] {
    const state = this.#stateOf(streamId);
    const entry = state.subscribers.get(subscriberId);
    if (entry === undefined) {
      return [];
    }
    // REGISTRATION phase: the private queue belongs to the ordered backlog
    // handoff (subscribe epilogue). Draining it here would steal events
    // mid-handoff and coalesce live captures that must be delivered
    // exactly — wait until the epilogue completed.
    if (entry.registering) {
      return [];
    }
    const coalesced = coalesceDeltas(entry.pending);
    entry.pending = [];
    entry.slow = false;
    return coalesced;
  }

  /**
   * Reconnect status WITHOUT materializing the replay: ledger high-watermark
   * plus exact transient-gap detection against the durable rows. Bounded
   * memory: the durable coverage is counted page by page.
   */
  async replayStatus(cursor: AgentStreamCursor): Promise<AgentStreamReplayStatus> {
    return this.#computeStatus(cursor);
  }

  /**
   * Materialized replay for reconnect: durable ledger rows plus buffered
   * transient deltas after the cursor, in strict sequence order. The
   * returned events are private copies; `olderThanBuffer` is detected
   * against the authoritative ledger high-watermark (exact, restart-safe).
   * For arbitrarily large histories prefer `replayIterate`/`replayStatus`,
   * which never materialize the whole range.
   */
  async replay(cursor: AgentStreamCursor): Promise<AgentStreamReplay> {
    const events: AgentStreamEvent[] = [];
    for await (const event of this.#replayIterator(cursor.streamId, cursor.lastSeq)) {
      events.push(event);
    }
    const status = await this.#computeStatus(cursor);
    return { events, newestSeq: status.newestSeq, olderThanBuffer: status.olderThanBuffer };
  }

  /**
   * Bounded-memory replay iterator: merges paged durable ledger reads with
   * the bounded transient buffer in strict sequence order. Each yielded
   * event is a private copy for this consumption path.
   */
  async *#replayIterator(
    streamId: string,
    afterSeq: number,
  ): AsyncGenerator<AgentStreamEvent, void, void> {
    const state = this.#stateOf(streamId);
    // Buffered transients are bounded by the buffer size: snapshot them
    // once (private copies; the buffer itself may keep growing).
    const buffered = state.buffer
      .filter((event) => event.seq > afterSeq)
      .map((event) => cloneEvent(event))
      .sort((a, b) => a.seq - b.seq);
    let bufferIndex = 0;
    let after = afterSeq;
    for (;;) {
      const page = await this.#ledger.listEventsFrom(streamId, after, this.#replayPageSize);
      if (page.length === 0) {
        break;
      }
      for (const row of page) {
        const durableEvent = ledgerRowToEvent(row);
        while (bufferIndex < buffered.length && buffered[bufferIndex]!.seq < row.seq) {
          yield buffered[bufferIndex]!;
          bufferIndex += 1;
        }
        // Durable rows and buffered transients are disjoint sequences
        // (durable kinds are never buffered); the merge stays strict.
        yield cloneEvent(durableEvent);
        after = row.seq;
      }
      if (page.length < this.#replayPageSize) {
        break;
      }
    }
    while (bufferIndex < buffered.length) {
      yield buffered[bufferIndex]!;
      bufferIndex += 1;
    }
  }

  /**
   * Exact transient-gap detection against the AUTHORITATIVE ledger
   * high-watermark. Bounded memory: durable coverage is counted page by
   * page; buffered coverage comes from the bounded buffer.
   */
  async #computeStatus(cursor: AgentStreamCursor): Promise<AgentStreamReplayStatus> {
    const state = this.#stateOf(cursor.streamId);
    // The high-watermark is read FIRST so every row read afterwards (with a
    // seq ≤ watermark) is included: no publish can fall into the gap.
    const ledgerNewest = await this.#ledger.latestSeq(cursor.streamId);
    const bufferedInRange = state.buffer.filter((event) => event.seq > cursor.lastSeq);
    const bufferedNewest = bufferedInRange.at(-1)?.seq ?? 0;
    const newestSeq = Math.max(ledgerNewest, bufferedNewest, cursor.lastSeq);
    const rangeSize = newestSeq - cursor.lastSeq;
    let covered = 0;
    if (rangeSize > 0) {
      covered += bufferedInRange.length;
      let after = cursor.lastSeq;
      for (;;) {
        const page = await this.#ledger.listEventsFrom(
          cursor.streamId,
          after,
          this.#replayPageSize,
        );
        if (page.length === 0) {
          break;
        }
        covered += page.length;
        after = page.at(-1)!.seq;
        if (page.length < this.#replayPageSize) {
          break;
        }
      }
    }
    return { newestSeq, olderThanBuffer: covered < rangeSize };
  }

  #stateOf(streamId: string): StreamState {
    let state = this.#streams.get(streamId);
    if (state === undefined) {
      state = { streamId, buffer: [], subscribers: new Map() };
      this.#streams.set(streamId, state);
    }
    return state;
  }

  /** Deliver to every subscriber; slow subscribers buffer with coalescing. */
  #deliver(state: StreamState, event: AgentStreamEvent): void {
    for (const entry of [...state.subscribers.values()]) {
      if (entry.detached) {
        continue;
      }
      if (entry.registering) {
        // Registration phase: buffer EXACTLY (no coalescing) so every
        // captured event keeps its identity and sequence — the epilogue
        // hands each one off individually, in order with the backlog.
        if (entry.pending.length < this.#pendingLimit) {
          entry.pending.push(cloneEvent(event));
          continue;
        }
        // Hard bound reached during registration: explicit recoverable
        // overflow (never silent loss).
        this.#overflow(state, entry);
        continue;
      }
      if (!entry.slow) {
        // Each subscriber receives its OWN copy: no delivery path can
        // mutate an event the replay buffer (or another subscriber) reads.
        // A `false` return means the event was ACCEPTED and the transport
        // is saturated: only SUBSEQUENT events buffer.
        if (!entry.subscriber.deliver(cloneEvent(event))) {
          entry.slow = true;
        }
        continue;
      }
      // Buffered mode: enqueue honoring the hard bound. Overflow follows
      // the explicit recoverable policy (never silent loss).
      this.#enqueue(state, entry, event);
    }
  }

  /**
   * Enqueue one event into a slow subscriber's private pending queue.
   * Consecutive transient deltas coalesce (the coalesced delta carries the
   * LAST sequence of its range). A queue overflow detaches the subscriber
   * through the explicit recoverable policy: `onOverflow()` then detach.
   * Returns false when the subscriber was detached by overflow.
   */
  #enqueue(state: StreamState, entry: SubscriberState, event: AgentStreamEvent): boolean {
    const last = entry.pending.at(-1);
    if (event.kind === 'text.delta' && last !== undefined && last.kind === 'text.delta') {
      // Coalesce into the private pending copy; the coalesced delta covers
      // the complete range (cursor semantics = LAST combined sequence).
      coalesceInto(last, event);
      return true;
    }
    if (entry.pending.length < this.#pendingLimit) {
      entry.pending.push(cloneEvent(event));
      return true;
    }
    // Hard bound reached. A further transient delta with no pending delta
    // neighbor cannot fit: overflow policy. Non-delta (durable, control,
    // terminal) events are NEVER discarded: overflow policy.
    this.#overflow(state, entry);
    return false;
  }

  /** The explicit recoverable overflow policy: signal, then detach. */
  #overflow(state: StreamState, entry: SubscriberState): void {
    if (entry.detached) {
      return;
    }
    entry.subscriber.onOverflow?.();
    this.unsubscribe(state.streamId, entry.subscriber.subscriberId);
  }

  /** Deliver the pending queue of a slow subscriber (subscribe epilogue). */
  #flushPending(state: StreamState, entry: SubscriberState): void {
    while (entry.pending.length > 0 && !entry.detached) {
      const next = entry.pending[0]!;
      if (!entry.slow) {
        entry.pending.shift();
        if (!entry.subscriber.deliver(next)) {
          entry.slow = true;
        }
        continue;
      }
      break;
    }
    // Registration is complete: live publishes now follow the mode the
    // last delivery dictated. A transport that never signaled saturation
    // receives events DIRECTLY (per-event identity is preserved for the
    // byte-level transport pump); a saturated transport buffers (with
    // coalescing) for pull-based draining.
    entry.registering = false;
  }
}

/** Bounded push; drops the OLDEST transient delta when full. */
function pushBounded(buffer: AgentStreamEvent[], event: AgentStreamEvent, size: number): void {
  buffer.push(event);
  if (buffer.length > size) {
    buffer.splice(0, buffer.length - size);
  }
}

/** A private deep copy of one event (delivery paths never share objects). */
function cloneEvent(event: AgentStreamEvent): AgentStreamEvent {
  return JSON.parse(JSON.stringify(event)) as AgentStreamEvent;
}

/** Freeze one event deeply (stored events are immutable by construction). */
function deepFreezeEvent<T>(event: T): T {
  if (event !== null && typeof event === 'object') {
    for (const value of Object.values(event as Record<string, unknown>)) {
      if (value !== null && typeof value === 'object') {
        deepFreezeEvent(value);
      }
    }
    Object.freeze(event);
  }
  return event;
}

/**
 * Coalesce one transient delta into a PRIVATE pending copy. The combined
 * event carries the complete-range cursor semantics: its sequence is the
 * LAST combined sequence, so acknowledging it acknowledges every delta in
 * the range and a reconnect cannot re-deliver part of the text.
 */
function coalesceInto(target: AgentStreamEvent, incoming: AgentStreamEvent): void {
  (target as { delta: string }).delta =
    (target as { delta: string }).delta + (incoming as { delta: string }).delta;
  (target as { seq: number }).seq = incoming.seq;
}

/** Coalesce CONSECUTIVE text.delta events; all other events pass through. */
function coalesceDeltas(events: readonly AgentStreamEvent[]): AgentStreamEvent[] {
  const result: AgentStreamEvent[] = [];
  for (const event of events) {
    const last = result.at(-1);
    if (event.kind === 'text.delta' && last !== undefined && last.kind === 'text.delta') {
      coalesceInto(last, event);
      continue;
    }
    result.push(cloneEvent(event));
  }
  return result.map((event) => deepFreezeEvent(event));
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
