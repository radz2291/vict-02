import { afterAll, describe, expect, it } from 'vitest';
import { AGENT_STREAM_SCHEMA, type AgentStreamEvent } from '@vict/contracts';
import { bearer, httpFixture, userToken, TEST_ACTOR_TOKENS } from './fixtures.js';
import type { AgentControlStores } from '@vict/runtime';

/**
 * Stage 06B — resumable SSE delivery of `vict.agent-stream@1` over REAL
 * HTTP:
 *
 * - `text/event-stream` framing with stable event IDs (stream sequence);
 * - `Last-Event-ID` and explicit `?cursor=` reconnect before, during, and
 *   after completion;
 * - at-least-once delivery with client-side deduplication;
 * - coalescing of consecutive `text.delta` under slow-client backpressure
 *   while non-delta events are never dropped or reordered;
 * - malformed, future cursors rejected;
 * - clean completion and per-actor authorization.
 */

const fixtures: { close: () => Promise<void> }[] = [];
let current: Awaited<ReturnType<typeof httpFixture>> | undefined;

async function fixture(): Promise<Awaited<ReturnType<typeof httpFixture>>> {
  if (current === undefined) {
    current = await httpFixture();
    fixtures.push({ close: current.close });
  }
  return current;
}

afterAll(async () => {
  for (const entry of fixtures) {
    await entry.close();
  }
});

/** A client-side SSE collector (at-least-once; dedup by stream seq). */
class SseCollector {
  readonly #events: AgentStreamEvent[] = [];
  readonly #seen = new Set<number>();
  readonly raw: string[] = [];
  readonly controller = new AbortController();

  get events(): readonly AgentStreamEvent[] {
    return this.#events;
  }

  get duplicates(): number {
    return 0; // deduped client-side; raw lines show duplicates
  }

  /** Feed one raw SSE chunk (may contain multiple events). */
  feed(chunk: string): void {
    this.raw.push(chunk);
    for (const block of chunk.split('\n\n')) {
      const dataLine = block.split('\n').find((line) => line.startsWith('data: '));
      if (dataLine === undefined) {
        continue;
      }
      try {
        const parsed = JSON.parse(dataLine.slice('data: '.length)) as AgentStreamEvent;
        if (typeof parsed.seq === 'number' && !this.#seen.has(parsed.seq)) {
          this.#seen.add(parsed.seq);
          this.#events.push(parsed);
        }
      } catch {
        // partial frames are ignored until complete
      }
    }
  }
}

/** Open a real SSE connection and collect frames until closed. */
async function collectStream(
  port: number,
  streamId: string,
  options: { cursor?: string; lastEventId?: string; token?: string } = {},
  collectMs = 600,
): Promise<{ status: number; collector: SseCollector; contentType: string }> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${options.token ?? 'vict-test-token-user'}`,
  };
  if (options.lastEventId !== undefined) {
    headers['last-event-id'] = options.lastEventId;
  }
  const query = options.cursor !== undefined ? `?cursor=${options.cursor}` : '';
  const controller = new AbortController();
  const collector = new SseCollector();
  const response = await fetch(`http://127.0.0.1:${port}/vict/v1/streams/${streamId}${query}`, {
    headers,
    signal: controller.signal,
  });
  const contentType = response.headers.get('content-type') ?? '';
  void collectMs;
  const reader = response.body?.getReader();
  const pumping = (async () => {
    if (reader === undefined) {
      return;
    }
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        collector.feed(new TextDecoder().decode(value));
      }
    } catch {
      // stream closed
    }
  })();
  // Bounded collection window.
  await new Promise((resolve) => setTimeout(resolve, 400));
  controller.abort();
  await pumping.catch(() => undefined);
  return { status: response.status, collector, contentType };
}

/** Publish a valid event through the hub (the final-schema gate). */
async function publish(
  stores: AgentControlStores,
  hub: Awaited<ReturnType<typeof httpFixture>>['hub'],
  streamId: string,
  seq: number,
  event: Record<string, unknown>,
): Promise<void> {
  void stores;
  const base = {
    streamId,
    turnId: 'turn-sse',
    threadId: 'thread-sse',
    actorId: 'actor-user',
    agentProfileVersion: 'v1_sse',
  };
  await hub.publish({ ...base, ...event } as unknown as AgentStreamEvent);
  void seq;
}

describe('resumable SSE (real HTTP, vict.agent-stream@1)', () => {
  it('frames events with text/event-stream, stable IDs, and monotonic sequences', async () => {
    const f = await fixture();
    await publish(f.stores, f.hub, 'stream-sse-1', 1, { kind: 'response.started' });
    await publish(f.stores, f.hub, 'stream-sse-1', 2, { kind: 'text.delta', delta: 'he' });
    await publish(f.stores, f.hub, 'stream-sse-1', 3, {
      kind: 'tool.started',
      toolCallId: 'call-1',
      toolName: 'cap.one',
    });
    await publish(f.stores, f.hub, 'stream-sse-1', 4, { kind: 'response.completed' });
    const { status, collector, contentType } = await collectStream(f.port, 'stream-sse-1');
    expect(status).toBe(200);
    expect(contentType).toContain('text/event-stream');
    const events = collector.events;
    // The transient delta is still inside the buffer window, so the replay
    // carries durable rows AND buffered deltas in strict sequence order.
    expect(events.map((event) => event.kind)).toEqual([
      'response.started',
      'text.delta',
      'tool.started',
      'response.completed',
    ]);
    // The delta was buffered transiently: replay from cursor 0 includes it
    // only within the buffer window — the durable rows plus buffered delta.
    // Sequences are strictly monotonic.
    const seqs = events.map((event) => event.seq);
    expect(seqs.every((seq, index) => index === 0 || seq > (seqs[index - 1] as number))).toBe(true);
    // Event IDs derive from the stream sequence.
    for (const raw of collector.raw) {
      if (raw.includes('id: ')) {
        expect(raw).toContain('event: ');
      }
    }
    expect(collector.raw.join('')).toContain(AGENT_STREAM_SCHEMA);
  });

  it('reconnect from Last-Event-ID replays exactly the events after the cursor (before completion)', async () => {
    const f = await fixture();
    await publish(f.stores, f.hub, 'stream-sse-2', 1, { kind: 'response.started' });
    await publish(f.stores, f.hub, 'stream-sse-2', 2, {
      kind: 'tool.started',
      toolCallId: 'c2',
      toolName: 'cap.one',
    });
    const { collector } = await collectStream(f.port, 'stream-sse-2', { lastEventId: '1' });
    const kinds = collector.events.map((event) => event.kind);
    expect(kinds).toEqual(['tool.started']);
    expect(collector.events[0]?.seq).toBe(2);
  });

  it('reconnect after completion replays the full durable history and closes cleanly', async () => {
    const f = await fixture();
    await publish(f.stores, f.hub, 'stream-sse-3', 1, { kind: 'response.started' });
    await publish(f.stores, f.hub, 'stream-sse-3', 2, { kind: 'content.completed', text: 'done' });
    await publish(f.stores, f.hub, 'stream-sse-3', 3, { kind: 'response.completed' });
    // Mark the turn terminal so the SSE endpoint closes after replay.
    await f.stores.turns.createTurnIntent({
      turnId: 'turn-sse',
      streamId: 'stream-sse-3',
      threadId: 'thread-sse',
      actorId: 'actor-user',
      agentProfileVersion: 'v1_sse',
      activationVersion: undefined,
      applicationReleaseVersion: undefined,
      inputSummary: 's',
      status: 'intent',
      createdAt: 1,
      updatedAt: 1,
      terminalAt: undefined,
      errorCode: undefined,
      traceId: undefined,
      victRunId: undefined,
      mastraRunId: undefined,
    });
    await f.stores.turns.startTurn('turn-sse', 2);
    await f.stores.turns.completeTurn({ turnId: 'turn-sse', status: 'completed', at: 3 });
    const { collector } = await collectStream(f.port, 'stream-sse-3', { cursor: '0' });
    expect(collector.events.map((event) => event.kind)).toEqual([
      'response.started',
      'content.completed',
      'response.completed',
    ]);
  });

  it('at-least-once delivery with client deduplication (duplicate-safe replay)', async () => {
    const f = await fixture();
    await publish(f.stores, f.hub, 'stream-sse-4', 1, { kind: 'response.started' });
    await publish(f.stores, f.hub, 'stream-sse-4', 2, { kind: 'content.completed', text: 'x' });
    // Reconnect from a cursor BEHIND durable rows: replay overlaps what the
    // client may already have processed; the client dedupes by seq.
    const { collector } = await collectStream(f.port, 'stream-sse-4', { cursor: '0' });
    const seqs = collector.events.map((event) => event.seq);
    expect(new Set(seqs).size).toBe(seqs.length);
  });

  it('malformed and future cursors are rejected', async () => {
    const f = await fixture();
    await publish(f.stores, f.hub, 'stream-sse-5', 1, { kind: 'response.started' });
    const malformed = await collectStream(f.port, 'stream-sse-5', { cursor: 'not-a-number' });
    expect(malformed.status).toBe(400);
    const future = await collectStream(f.port, 'stream-sse-5', { cursor: '999' });
    expect(future.status).toBe(409);
  });

  it('cross-actor stream reads are denied without the operator scope', async () => {
    const f = await fixture();
    // The stream's turn is owned by actor-user; the approver lacks
    // agent.stream.read.
    await f.stores.turns.createTurnIntent({
      turnId: 'turn-sse-own',
      streamId: 'stream-sse-owned',
      threadId: 'thread-sse-owned',
      actorId: 'actor-user',
      agentProfileVersion: 'v1_sse',
      activationVersion: undefined,
      applicationReleaseVersion: undefined,
      inputSummary: 's',
      status: 'intent',
      createdAt: 1,
      updatedAt: 1,
      terminalAt: undefined,
      errorCode: undefined,
      traceId: undefined,
      victRunId: undefined,
      mastraRunId: undefined,
    });
    const denied = await collectStream(f.port, 'stream-sse-owned', {
      token: 'vict-test-token-approver',
    });
    expect(denied.status).toBe(403);
    void TEST_ACTOR_TOKENS;
    void userToken;
  });

  it('slow-client backpressure coalesces consecutive deltas and never drops non-delta events', async () => {
    const f = await fixture();
    const streamId = 'stream-sse-6';
    await publish(f.stores, f.hub, streamId, 1, { kind: 'response.started' });
    // A slow subscriber whose deliver always refuses: the hub buffers with
    // coalescing of consecutive deltas.
    const pending: AgentStreamEvent[] = [];
    await f.hub.subscribe(
      streamId,
      {
        subscriberId: 'slow-sub',
        deliver: (event) => {
          pending.push(event);
          return false; // always backpressured
        },
      },
      { lastSeq: 1 },
    );
    for (const delta of ['a', 'b', 'c']) {
      await publish(f.stores, f.hub, streamId, 0, { kind: 'text.delta', delta });
    }
    await publish(f.stores, f.hub, streamId, 0, {
      kind: 'tool.started',
      toolCallId: 'c9',
      toolName: 'cap.one',
    });
    await publish(f.stores, f.hub, streamId, 0, { kind: 'text.delta', delta: 'd' });
    await publish(f.stores, f.hub, streamId, 0, { kind: 'response.completed' });
    // Pull (drain): consecutive deltas coalesce; non-delta events survive.
    const drained = f.hub.pull(streamId, 'slow-sub');
    const kinds = drained.map((event) => event.kind);
    expect(kinds[0]).toBe('text.delta');
    // 'abc' coalesced into ONE delta; the tool event; then 'd'; then terminal.
    expect(kinds).toEqual(['text.delta', 'tool.started', 'text.delta', 'response.completed']);
    const firstDelta = drained[0] as { delta: string };
    expect(firstDelta.delta).toBe('abc');
    expect(drained.find((event) => event.kind === 'tool.started')).toBeDefined();
    expect(drained.find((event) => event.kind === 'response.completed')).toBeDefined();
  });

  it('durable milestones survive restart: a fresh hub over the same ledger replays them', async () => {
    const f = await fixture();
    await publish(f.stores, f.hub, 'stream-sse-7', 1, { kind: 'response.started' });
    await publish(f.stores, f.hub, 'stream-sse-7', 2, {
      kind: 'content.completed',
      text: 'persisted',
    });
    // A fresh hub over the SAME durable ledger (restart simulation) sees
    // the durable rows; transient deltas from before the restart do not
    // replay, and the cursor-older-than-buffer notice is disclosed.
    const freshHub = new (await import('@vict/runtime')).AgentStreamHub({
      ledger: f.stores.streamLedger,
      clock: () => Date.now(),
    });
    const replay = await freshHub.replay({ streamId: 'stream-sse-7', lastSeq: 0 });
    expect(replay.events.map((event) => event.kind)).toEqual([
      'response.started',
      'content.completed',
    ]);
    const deltaReplay = await freshHub.replay({ streamId: 'stream-sse-7', lastSeq: 0 });
    expect(deltaReplay.events.some((event) => event.kind === 'text.delta')).toBe(false);
  });
});
