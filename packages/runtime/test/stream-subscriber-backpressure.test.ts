import { expect, it } from 'vitest';
import { AgentStreamHub, createInMemoryAgentControlStores } from '../src/index.js';

it('awaits asynchronous subscriber demand while retaining existing synchronous false/pull semantics', async () => {
  const stores = createInMemoryAgentControlStores();
  const hub = new AgentStreamHub({ ledger: stores.streamLedger });
  let release!: () => void;
  let entered!: () => void;
  const blocked = new Promise<void>((resolve) => (release = resolve));
  const started = new Promise<void>((resolve) => (entered = resolve));
  const base = {
    streamId: 'pressure-stream',
    turnId: 'pressure-turn',
    threadId: 'pressure-thread',
    actorId: 'pressure-actor',
    agentProfileVersion: 'v1_pressure',
  };
  const received: number[] = [];
  await hub.subscribe(base.streamId, {
    subscriberId: 'async',
    deliver: async (event) => {
      received.push(event.seq);
      entered();
      await blocked;
      return true;
    },
  });
  let settled = false;
  const publication = hub.publish({ ...base, kind: 'response.started' }).then(() => {
    settled = true;
  });
  await started;
  expect(settled).toBe(false);
  release();
  await publication;
  expect(received).toEqual([1]);
  hub.unsubscribe(base.streamId, 'async');
  const sync: number[] = [];
  await hub.subscribe(
    base.streamId,
    {
      subscriberId: 'sync',
      deliver: (event) => {
        sync.push(event.seq);
        return false;
      },
    },
    { lastSeq: 1 },
  );
  await hub.publish({ ...base, kind: 'text.delta', delta: 'a' });
  await hub.publish({ ...base, kind: 'text.delta', delta: 'b' });
  expect(sync).toEqual([2]);
  expect(hub.pull(base.streamId, 'sync').map((event) => event.seq)).toEqual([3]);
});
