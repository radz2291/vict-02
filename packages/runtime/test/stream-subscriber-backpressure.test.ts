import { expect, it } from 'vitest';
import {
  AgentStreamHub,
  createInMemoryAgentControlStores,
  awaitAgentDelivery,
} from '../src/index.js';

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

it.each(['unsubscribe', 'signal'] as const)(
  'wakes a blocked subscriber on %s without releasing its sink and retains durable order',
  async (mode) => {
    const stores = createInMemoryAgentControlStores(),
      hub = new AgentStreamHub({ ledger: stores.streamLedger });
    const owner = new AbortController();
    let entered!: () => void, release!: () => void;
    const ready = new Promise<void>((resolve) => (entered = resolve)),
      blocked = new Promise<boolean>((resolve) => (release = () => resolve(true)));
    const base = {
      streamId: 'cancel-stream',
      turnId: 'cancel-turn',
      threadId: 'cancel-thread',
      actorId: 'cancel-actor',
      agentProfileVersion: 'v1_cancel',
    };
    let deliveries = 0;
    await hub.subscribe(base.streamId, {
      subscriberId: 'blocked',
      signal: owner.signal,
      deliver: () => {
        deliveries++;
        entered();
        return blocked;
      },
    });
    const publication = hub.publish({ ...base, kind: 'response.started' });
    await ready;
    try {
      if (mode === 'signal') owner.abort();
      else hub.unsubscribe(base.streamId, 'blocked');
      await Promise.race([
        publication,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(Error('Detached sink retained publish')), 500),
        ),
      ]);
      await hub.publish({ ...base, kind: 'response.cancelled' });
      expect(deliveries).toBe(1);
      expect(await hub.latestSeq(base.streamId)).toBe(2);
      expect(
        (await hub.replay({ streamId: base.streamId, lastSeq: 0 })).events.map(
          (event) => event.kind,
        ),
      ).toEqual(['response.started', 'response.cancelled']);
    } finally {
      release();
    }
  },
);
it('does not abandon an unfinished durable append on subscriber abort or swallow its failure', async () => {
  const stores = createInMemoryAgentControlStores();
  let release!: () => void, entered!: () => void;
  const ready = new Promise<void>((resolve) => (entered = resolve)),
    blocked = new Promise<void>((resolve) => (release = resolve));
  const ledger = {
    latestSeq: stores.streamLedger.latestSeq.bind(stores.streamLedger),
    listEventsFrom: stores.streamLedger.listEventsFrom.bind(stores.streamLedger),
    listStreamIds: stores.streamLedger.listStreamIds.bind(stores.streamLedger),
    appendEvent: async () => {
      entered();
      await blocked;
      throw Error('durable publication failed');
    },
  };
  const hub = new AgentStreamHub({ ledger }),
    owner = new AbortController();
  await hub.subscribe('durable-cancel', {
    subscriberId: 'cancel',
    signal: owner.signal,
    deliver: () => true,
  });
  let finished = false;
  const publication = hub.publish({
    streamId: 'durable-cancel',
    turnId: 't',
    threadId: 'thread',
    actorId: 'actor',
    agentProfileVersion: 'v1_durable',
    kind: 'response.started',
  });
  void publication.then(
    () => (finished = true),
    () => (finished = true),
  );
  await ready;
  owner.abort();
  await Promise.resolve();
  expect(finished).toBe(false);
  release();
  await expect(publication).rejects.toThrow('durable publication failed');
});

it('observes a late rejection after delivery cancellation and still propagates noncancelled sink failures', async () => {
  const owner = new AbortController();
  let rejectLater!: (error: Error) => void;
  const pending = new Promise<void>((_, reject) => (rejectLater = reject));
  const waiting = awaitAgentDelivery(pending, owner.signal);
  owner.abort();
  expect(await waiting).toEqual({ delivered: false });
  rejectLater(Error('late detached transport failure'));
  await Promise.resolve();
  await Promise.resolve();
  await expect(awaitAgentDelivery(Promise.reject(Error('live sink failure')))).rejects.toThrow(
    'live sink failure',
  );
});
