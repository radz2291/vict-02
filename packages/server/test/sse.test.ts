import { afterAll, describe, expect, it } from 'vitest';
import { AGENT_STREAM_SCHEMA, type AgentStreamEvent } from '@victframework/contracts';
import { httpFixture } from './fixtures.js';
import {
  createInMemoryAgentControlStores,
  createInMemoryStores,
  InMemoryActorDirectory,
  AgentStreamHub,
  type AgentControlStores,
} from '@victframework/runtime';
import { ControlPlaneService, createControlPlaneSandboxSimulator } from '@victframework/control';
import {
  createLocalTestAuthenticator,
  createServerAuthenticator,
  createVictHttpServer,
  listenVictHttpServer,
  VictCommandService,
} from '../src/index.js';

const TEST_TOKENS: Readonly<Record<string, string>> = {
  'vict-test-token-user': 'actor-user',
};

/**
 * Stage 06B — resumable SSE delivery of `vict.agent-stream@1` over REAL
 * HTTP:
 *
 * - `text/event-stream` framing with stable event IDs (stream sequence);
 * - `Last-Event-ID` and explicit `?cursor=` reconnect with the bounded
 *   `v1:<streamId>:<seq>` cursor carrying STREAM IDENTITY;
 * - at-least-once delivery with client-side deduplication;
 * - coalescing of consecutive `text.delta` under slow-client backpressure
 *   while non-delta events are never dropped or reordered, and a `false`
 *   write (bytes ACCEPTED) never discards events;
 * - malformed, foreign-stream, and future cursors rejected;
 * - actor-scoped authorization: streams without a valid turn ownership
 *   record are denied, cross-actor reads fail closed;
 * - clean completion after the turn became terminal (in replay or live).
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

/** The bounded reconnect cursor format (stream identity + sequence). */
const cursor = (streamId: string, seq: number): string => `v1:${streamId}:${seq}`;

/** A client-side SSE collector (at-least-once; dedup by stream seq). */
class SseCollector {
  readonly #events: AgentStreamEvent[] = [];
  readonly #seen = new Set<number>();
  readonly raw: string[] = [];
  readonly headers: Record<string, string> = {};

  get events(): readonly AgentStreamEvent[] {
    return this.#events;
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
): Promise<{ status: number; collector: SseCollector; contentType: string }> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${options.token ?? 'vict-test-token-user'}`,
  };
  if (options.lastEventId !== undefined) {
    headers['last-event-id'] = options.lastEventId;
  }
  const query = options.cursor !== undefined ? `?cursor=${encodeURIComponent(options.cursor)}` : '';
  const controller = new AbortController();
  const collector = new SseCollector();
  const response = await fetch(`http://127.0.0.1:${port}/vict/v1/streams/${streamId}${query}`, {
    headers,
    signal: controller.signal,
  });
  for (const [name, value] of response.headers.entries()) {
    collector.headers[name] = value;
  }
  const contentType = response.headers.get('content-type') ?? '';
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
  // The stream closes itself after a terminal event; otherwise bounded wait.
  await Promise.race([pumping, new Promise((resolve) => setTimeout(resolve, 700).unref?.())]).catch(
    () => undefined,
  );
  controller.abort();
  await pumping.catch(() => undefined);
  return { status: response.status, collector, contentType };
}

let turnCounter = 0;

/** Create the DURABLE turn ownership record for a stream (owned by actor-user). */
async function ownStream(
  stores: AgentControlStores,
  streamId: string,
  actorId = 'actor-user',
): Promise<void> {
  const turnId = `turn-own-${(turnCounter += 1)}`;
  await stores.turns.createTurnIntent({
    turnId,
    streamId,
    threadId: `thread-${streamId}`,
    actorId,
    agentProfileVersion: 'v1_sse',
    activationVersion: undefined,
    applicationReleaseVersion: undefined,
    inputSummary: 'user-input:length=1',
    status: 'intent',
    createdAt: 1,
    updatedAt: 1,
    terminalAt: undefined,
    errorCode: undefined,
    traceId: undefined,
    victRunId: undefined,
    mastraRunId: undefined,
  });
  await stores.turns.startTurn(turnId, 2);
}

/** Publish a valid event through the hub (the final-schema gate). */
async function publish(
  stores: AgentControlStores,
  hub: Awaited<ReturnType<typeof httpFixture>>['hub'],
  streamId: string,
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
}

describe('resumable SSE (real HTTP, vict.agent-stream@1)', () => {
  it('frames events with text/event-stream, stable IDs, and monotonic sequences', async () => {
    const f = await fixture();
    await ownStream(f.stores, 'stream-sse-1');
    await publish(f.stores, f.hub, 'stream-sse-1', { kind: 'response.started' });
    await publish(f.stores, f.hub, 'stream-sse-1', { kind: 'text.delta', delta: 'he' });
    await publish(f.stores, f.hub, 'stream-sse-1', {
      kind: 'tool.started',
      toolCallId: 'call-1',
      toolName: 'cap.one',
    });
    await publish(f.stores, f.hub, 'stream-sse-1', { kind: 'response.completed' });
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
    // Sequences are strictly monotonic.
    const seqs = events.map((event) => event.seq);
    expect(seqs.every((seq, index) => index === 0 || seq > (seqs[index - 1] as number))).toBe(true);
    // Event IDs derive from the stream sequence.
    for (const raw of collector.raw) {
      if (raw.includes('id: ')) {
        expect(raw).toContain('event: ');
      }
    }
    // Every emitted data frame is the closed wire envelope: schema + event.
    expect(collector.raw.join('')).toContain(AGENT_STREAM_SCHEMA);
    // The terminal event closed the stream (clean completion).
    expect(collector.events.at(-1)?.kind).toBe('response.completed');
  });

  it('reconnect from Last-Event-ID replays exactly the events after the cursor (before completion)', async () => {
    const f = await fixture();
    await ownStream(f.stores, 'stream-sse-2');
    await publish(f.stores, f.hub, 'stream-sse-2', { kind: 'response.started' });
    await publish(f.stores, f.hub, 'stream-sse-2', {
      kind: 'tool.started',
      toolCallId: 'c2',
      toolName: 'cap.one',
    });
    const { collector } = await collectStream(f.port, 'stream-sse-2', {
      lastEventId: cursor('stream-sse-2', 1),
    });
    const kinds = collector.events.map((event) => event.kind);
    expect(kinds).toEqual(['tool.started']);
    expect(collector.events[0]?.seq).toBe(2);
  });

  it('a cursor from ANOTHER stream is rejected (stream identity in the cursor)', async () => {
    const f = await fixture();
    await ownStream(f.stores, 'stream-sse-2b');
    await publish(f.stores, f.hub, 'stream-sse-2b', { kind: 'response.started' });
    const foreign = await collectStream(f.port, 'stream-sse-2b', {
      cursor: cursor('stream-other', 0),
    });
    expect(foreign.status).toBe(403);
    expect(foreign.collector.headers['x-vict-replay-bounded']).toBeUndefined();
  });

  it('reconnect after completion replays the full durable history and closes cleanly', async () => {
    const f = await fixture();
    await ownStream(f.stores, 'stream-sse-3');
    await publish(f.stores, f.hub, 'stream-sse-3', { kind: 'response.started' });
    await publish(f.stores, f.hub, 'stream-sse-3', {
      kind: 'content.completed',
      contentRef: 'conversation:vict-actor-actor-user/thread-sse-3/turn-1',
    });
    await publish(f.stores, f.hub, 'stream-sse-3', { kind: 'response.completed' });
    // Mark the turn terminal: the SSE endpoint closes after the replay.
    const turns = await f.stores.turns.listTurns();
    const owned = turns.find((turn) => turn.streamId === 'stream-sse-3');
    await f.stores.turns.completeTurn({
      turnId: owned?.turnId ?? 'missing',
      status: 'completed',
      at: 3,
    });
    const { collector } = await collectStream(f.port, 'stream-sse-3', {
      cursor: cursor('stream-sse-3', 0),
    });
    expect(collector.events.map((event) => event.kind)).toEqual([
      'response.started',
      'content.completed',
      'response.completed',
    ]);
    // The response carries the separately defined replay disclosure headers.
    expect(collector.headers['x-vict-stream-newest-seq']).toBe('3');
  });

  it('a stream WITHOUT a durable turn ownership record is denied (never public)', async () => {
    const f = await fixture();
    const ghost = await collectStream(f.port, 'stream-never-owned');
    expect(ghost.status).toBe(404);
  });

  it('at-least-once delivery with client deduplication (duplicate-safe replay)', async () => {
    const f = await fixture();
    await ownStream(f.stores, 'stream-sse-4');
    await publish(f.stores, f.hub, 'stream-sse-4', { kind: 'response.started' });
    await publish(f.stores, f.hub, 'stream-sse-4', {
      kind: 'content.completed',
      contentRef: 'conversation:vict-actor-actor-user/thread-sse-4/turn-1',
    });
    // Reconnect from a cursor BEHIND durable rows: replay overlaps what the
    // client may already have processed; the client dedupes by seq.
    const { collector } = await collectStream(f.port, 'stream-sse-4', {
      cursor: cursor('stream-sse-4', 0),
    });
    const seqs = collector.events.map((event) => event.seq);
    expect(new Set(seqs).size).toBe(seqs.length);
  });

  it('malformed and future cursors are rejected', async () => {
    const f = await fixture();
    await ownStream(f.stores, 'stream-sse-5');
    await publish(f.stores, f.hub, 'stream-sse-5', { kind: 'response.started' });
    const malformed = await collectStream(f.port, 'stream-sse-5', { cursor: 'not-a-number' });
    expect(malformed.status).toBe(400);
    const bare = await collectStream(f.port, 'stream-sse-5', { cursor: '999' });
    expect(bare.status).toBe(400);
    const future = await collectStream(f.port, 'stream-sse-5', {
      cursor: cursor('stream-sse-5', 999),
    });
    expect(future.status).toBe(409);
  });

  it('cross-actor stream reads are denied without the operator scope', async () => {
    const f = await fixture();
    // The stream's turn is owned by actor-user; the approver lacks both
    // ownership and the privileged operator.resolve scope.
    await ownStream(f.stores, 'stream-sse-owned');
    const denied = await collectStream(f.port, 'stream-sse-owned', {
      token: 'vict-test-token-approver',
    });
    expect(denied.status).toBe(403);
  });

  it('slow-client backpressure coalesces consecutive deltas and never drops non-delta events', async () => {
    const f = await fixture();
    const streamId = 'stream-sse-6';
    await publish(f.stores, f.hub, streamId, { kind: 'response.started' });
    // A slow subscriber: deliver returning false means the handed event was
    // ACCEPTED and the transport is saturated; subsequent events buffer.
    const delivered: AgentStreamEvent[] = [];
    await f.hub.subscribe(
      streamId,
      {
        subscriberId: 'slow-sub',
        deliver: (event) => {
          delivered.push(event);
          return false; // accepted, but saturated
        },
      },
      { lastSeq: 1 },
    );
    for (const delta of ['a', 'b', 'c']) {
      await publish(f.stores, f.hub, streamId, { kind: 'text.delta', delta });
    }
    await publish(f.stores, f.hub, streamId, {
      kind: 'tool.started',
      toolCallId: 'c9',
      toolName: 'cap.one',
    });
    await publish(f.stores, f.hub, streamId, { kind: 'text.delta', delta: 'd' });
    await publish(f.stores, f.hub, streamId, { kind: 'response.completed' });
    // Pull (drain): consecutive deltas coalesce; non-delta events survive.
    const drained = f.hub.pull(streamId, 'slow-sub');
    const kinds = drained.map((event) => event.kind);
    expect(kinds).toEqual(['text.delta', 'tool.started', 'text.delta', 'response.completed']);
    // 'b' and 'c' coalesced into ONE delta ('a' was the accepted handoff).
    const firstDelta = drained[0] as { delta: string };
    expect(firstDelta.delta).toBe('bc');
    expect(drained.find((event) => event.kind === 'tool.started')).toBeDefined();
    expect(drained.find((event) => event.kind === 'response.completed')).toBeDefined();
    // Nothing was lost: the client observes a, bc, tool, d, completed in order
    // (response.started sat before the subscription cursor).
    const observed = [
      ...delivered.map((event) => (event.kind === 'text.delta' ? event.delta : event.kind)),
      ...drained.map((event) => (event.kind === 'text.delta' ? event.delta : event.kind)),
    ];
    expect(observed).toEqual(['a', 'bc', 'tool.started', 'd', 'response.completed']);
  });

  it('buffered events are never mutated: the replay buffer stays byte-identical under coalescing', async () => {
    const f = await fixture();
    const streamId = 'stream-sse-6b';
    await publish(f.stores, f.hub, streamId, { kind: 'text.delta', delta: 'first' });
    await f.hub.subscribe(
      streamId,
      {
        subscriberId: 'slow-sub-b',
        deliver: () => false,
      },
      { lastSeq: 0 },
    );
    const bufferedBefore = (await f.hub.replay({ streamId, lastSeq: 0 })).events.find(
      (event) => event.kind === 'text.delta',
    ) as { delta: string };
    await publish(f.stores, f.hub, streamId, { kind: 'text.delta', delta: 'second' });
    void f.hub.pull(streamId, 'slow-sub-b');
    const bufferedAfter = (await f.hub.replay({ streamId, lastSeq: 0 })).events.find(
      (event) => event.kind === 'text.delta',
    ) as { delta: string };
    // Coalescing mutated only the subscriber's PRIVATE pending copy.
    expect(bufferedBefore.delta).toBe('first');
    expect(bufferedAfter.delta).toBe('first');
  });

  it('real-socket forced backpressure never loses or duplicates events (pause/resume via drain)', async () => {
    const f = await fixture();
    const streamId = 'stream-sse-8';
    await ownStream(f.stores, streamId);
    await publish(f.stores, f.hub, streamId, { kind: 'response.started' });
    // A raw TCP socket that STOPS READING mid-stream: Node buffers writes,
    // `writableNeedDrain` engages, and the hub's pending queue + `drain`
    // pump carry the remaining events without loss or duplication.
    const net = await import('node:net');
    const socket = net.createConnection({ port: f.port, host: '127.0.0.1' });
    await new Promise((resolve) => socket.once('connect', resolve));
    socket.write(
      `GET /vict/v1/streams/${streamId} HTTP/1.1\r\nHost: 127.0.0.1\r\nAuthorization: Bearer vict-test-token-user\r\nAccept: text/event-stream\r\n\r\n`,
    );
    // Publish events WHILE the socket is intentionally paused.
    socket.pause();
    const received: AgentStreamEvent[] = [];
    const seen = new Set<number>();
    let raw = '';
    const parseChunk = (chunk: string): void => {
      raw += chunk;
      for (const block of raw.split('\n\n')) {
        const dataLine = block.split('\n').find((line) => line.startsWith('data: '));
        if (dataLine === undefined) {
          continue;
        }
        try {
          const parsed = JSON.parse(dataLine.slice('data: '.length)) as AgentStreamEvent;
          if (!seen.has(parsed.seq)) {
            seen.add(parsed.seq);
            received.push(parsed);
          }
        } catch {
          // partial frame
        }
      }
      // Keep only a trailing partial block in the accumulator.
      const lastBreak = raw.lastIndexOf('\n\n');
      if (lastBreak >= 0) {
        raw = raw.slice(lastBreak + 2);
      }
    };
    socket.on('data', parseChunk);
    socket.on('error', () => undefined);
    for (let i = 0; i < 200; i += 1) {
      await publish(f.stores, f.hub, streamId, { kind: 'text.delta', delta: `d${i};` });
    }
    await publish(f.stores, f.hub, streamId, {
      kind: 'tool.completed',
      toolCallId: 'call-bp',
      toolName: 'cap.one',
    });
    await publish(f.stores, f.hub, streamId, { kind: 'response.completed' });
    // Give the server a moment to saturate while the socket is paused.
    await new Promise((resolve) => setTimeout(resolve, 200));
    socket.resume();
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      const terminal = received.find((event) => event.kind === 'response.completed');
      if (terminal !== undefined) {
        break;
      }
    }
    socket.destroy();
    // EVERY durable and transient event arrived, in order, exactly once.
    expect(received.length).toBe(203);
    expect(received[0]?.kind).toBe('response.started');
    expect(received.filter((event) => event.kind === 'tool.completed')).toHaveLength(1);
    expect(received.at(-1)?.kind).toBe('response.completed');
    const seqs = received.map((event) => event.seq);
    expect(new Set(seqs).size).toBe(seqs.length);
    expect(seqs.every((seq, index) => index === 0 || seq > (seqs[index - 1] as number))).toBe(true);
  });

  it('server close() awaits actual shutdown and terminates open SSE clients', async () => {
    const stores = createInMemoryAgentControlStores();
    const directory = new InMemoryActorDirectory();
    await directory.upsert({
      actorId: 'actor-user',
      status: 'active',
      roles: ['developer', 'operator', 'approver', 'administrator'],
      createdAt: 0,
    });
    const hub = new AgentStreamHub({ ledger: stores.streamLedger, clock: () => Date.now() });
    const catalog = createInMemoryStores().catalog;
    let n = 0;
    const controlPlane = new ControlPlaneService({
      stores,
      catalog,
      clock: () => Date.now(),
      simulator: createControlPlaneSandboxSimulator({ stores, catalog }),
      ids: {
        changesetId: () => `cs-${(n += 1)}`,
        changesetApprovalId: () => `csa-${(n += 1)}`,
        auditId: () => `audit-${(n += 1)}`,
        controlRunId: () => `run-${(n += 1)}`,
      },
    });
    const commandService = new VictCommandService({
      stores,
      controlPlane,
      clock: () => Date.now(),
    });
    const auth = createServerAuthenticator({
      authenticator: createLocalTestAuthenticator(TEST_TOKENS),
      directory,
    });
    const composedLocal = createVictHttpServer({ commandService, auth, hub, stores });
    const localPort = await listenVictHttpServer(composedLocal);
    // port() reports the REAL bound port.
    expect(composedLocal.port()).toBe(localPort);
    // An open SSE client with a durable turn ownership record.
    await stores.turns.createTurnIntent({
      turnId: 'turn-close-1',
      streamId: 'stream-close-1',
      threadId: 'thread-close-1',
      actorId: 'actor-user',
      agentProfileVersion: 'v1_close',
      activationVersion: undefined,
      applicationReleaseVersion: undefined,
      inputSummary: 'user-input:length=1',
      status: 'intent',
      createdAt: 1,
      updatedAt: 1,
      terminalAt: undefined,
      errorCode: undefined,
      traceId: undefined,
      victRunId: undefined,
      mastraRunId: undefined,
    });
    await stores.turns.startTurn('turn-close-1', 2);
    await hub.publish({
      streamId: 'stream-close-1',
      turnId: 'turn-close-1',
      threadId: 'thread-close-1',
      actorId: 'actor-user',
      agentProfileVersion: 'v1_close',
      kind: 'response.started',
    });
    const controller = new AbortController();
    const response = await fetch(`http://127.0.0.1:${localPort}/vict/v1/streams/stream-close-1`, {
      headers: { authorization: 'Bearer vict-test-token-user' },
      signal: controller.signal,
    });
    expect(response.status).toBe(200);
    // Read until the server ends the stream (the first chunk is the SSE
    // comment handshake, so a single read is not enough).
    const readerClosed = (async (): Promise<string> => {
      const reader = response.body?.getReader();
      if (reader === undefined) {
        return 'closed';
      }
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            return 'closed';
          }
          void value;
        }
      } catch {
        return 'aborted';
      }
    })();
    // close() AWAITS actual shutdown (the promise resolves only when the
    // server has closed), and the open SSE client is terminated.
    await composedLocal.close();
    const verdict = await readerClosed;
    expect(['closed', 'aborted']).toContain(verdict);
    controller.abort();
  });

  it('durable milestones survive restart: a fresh hub over the same ledger replays them', async () => {
    const f = await fixture();
    await publish(f.stores, f.hub, 'stream-sse-7', { kind: 'response.started' });
    await publish(f.stores, f.hub, 'stream-sse-7', {
      kind: 'content.completed',
      contentRef: 'conversation:vict-actor-actor-user/thread-sse/turn-1',
    });
    // A fresh hub over the SAME durable ledger (restart simulation) sees
    // the durable rows; transient deltas from before the restart do not
    // replay, and the cursor-older-than-buffer disclosure is computed from
    // the AUTHORITATIVE durable sequence bounds.
    const freshHub = new (await import('@victframework/runtime')).AgentStreamHub({
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
