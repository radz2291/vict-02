import { expect, it } from 'vitest';
import { AgentStreamHub, createInMemoryAgentControlStores } from '../src/index.js';

const base = {
  streamId: 'ordered-stream',
  turnId: 'turn',
  threadId: 'thread',
  actorId: 'actor',
  agentProfileVersion: 'v1_ordered',
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

it('serializes concurrent publications through completion of async subscriber delivery', async () => {
  const stores = createInMemoryAgentControlStores();
  const hub = new AgentStreamHub({ ledger: stores.streamLedger });
  const entered = deferred<void>(),
    blocked = deferred<boolean>();
  const received: number[] = [];
  await hub.subscribe(base.streamId, {
    subscriberId: 'ordered',
    deliver: async (event) => {
      if (event.seq === 1) {
        entered.resolve();
        await blocked.promise;
      }
      received.push(event.seq);
      return true;
    },
  });
  const first = hub.publish({ ...base, kind: 'response.started' });
  await entered.promise;
  let secondSettled = false;
  const second = hub.publish({ ...base, kind: 'response.completed' }).then(() => {
    secondSettled = true;
  });
  // Drain the actual concurrent publication, not a timing-dependent sleep.
  await new Promise<void>((resolve) => setImmediate(resolve));
  try {
    expect(secondSettled).toBe(false);
    expect(received).toEqual([]);
  } finally {
    blocked.resolve(true);
    await Promise.all([first, second]);
  }
  expect(received).toEqual([1, 2]);
});

it.each(['signal', 'unsubscribe'] as const)(
  'releases concurrent publishers on %s before the sink settles',
  async (mode) => {
    const stores = createInMemoryAgentControlStores();
    const hub = new AgentStreamHub({ ledger: stores.streamLedger });
    const owner = new AbortController(),
      entered = deferred<void>(),
      blocked = deferred<boolean>();
    const received: number[] = [];
    await hub.subscribe(base.streamId, {
      subscriberId: 'cancel',
      signal: owner.signal,
      deliver: (event) => {
        received.push(event.seq);
        entered.resolve();
        return blocked.promise;
      },
    });
    const first = hub.publish({ ...base, kind: 'response.started' });
    await entered.promise;
    const second = hub.publish({ ...base, kind: 'response.cancelled' });
    if (mode === 'signal') owner.abort();
    else hub.unsubscribe(base.streamId, 'cancel');
    try {
      await Promise.all([first, second]);
      expect(received).toEqual([1]);
      expect(
        (await hub.replay({ streamId: base.streamId, lastSeq: 0 })).events.map((e) => e.seq),
      ).toEqual([1, 2]);
      // A rejected detached transport must be observed without poisoning later publication.
      blocked.reject(Error('late detached sink rejection'));
      await hub.publish({ ...base, kind: 'text.delta', delta: 'after detach' });
    } finally {
      blocked.resolve(true);
    }
  },
);

it('rejects the failed publication without poisoning concurrent later publication or another stream', async () => {
  const stores = createInMemoryAgentControlStores();
  const entered = deferred<void>(),
    blocked = deferred<void>();
  const ledger = {
    latestSeq: stores.streamLedger.latestSeq.bind(stores.streamLedger),
    listEventsFrom: stores.streamLedger.listEventsFrom.bind(stores.streamLedger),
    listStreamIds: stores.streamLedger.listStreamIds.bind(stores.streamLedger),
    appendEvent: async (input: Parameters<typeof stores.streamLedger.appendEvent>[0]) => {
      if (input.streamId === base.streamId && input.kind === 'response.started') {
        entered.resolve();
        await blocked.promise;
        throw Error('ledger failed');
      }
      return stores.streamLedger.appendEvent(input);
    },
  };
  const hub = new AgentStreamHub({ ledger });
  const first = hub.publish({ ...base, kind: 'response.started' });
  const failed = expect(first).rejects.toThrow('ledger failed');
  await entered.promise;
  const second = hub.publish({ ...base, kind: 'response.cancelled' });
  try {
    await hub.publish({ ...base, streamId: 'independent-stream', kind: 'response.started' });
    expect(await hub.latestSeq('independent-stream')).toBe(1);
  } finally {
    blocked.resolve();
  }
  await failed;
  expect((await second).seq).toBe(1);
  expect(
    (await hub.replay({ streamId: base.streamId, lastSeq: 0 })).events.map((e) => e.kind),
  ).toEqual(['response.cancelled']);
});

it('propagates a live delivery rejection and keeps subsequent publication available', async () => {
  const stores = createInMemoryAgentControlStores();
  const hub = new AgentStreamHub({ ledger: stores.streamLedger });
  await hub.subscribe(base.streamId, {
    subscriberId: 'reject',
    deliver: async (event) => {
      if (event.seq === 1) throw Error('live delivery failed');
      return true;
    },
  });
  const first = hub.publish({ ...base, kind: 'response.started' });
  const failed = expect(first).rejects.toThrow('live delivery failed');
  const second = hub.publish({ ...base, kind: 'response.cancelled' });
  await failed;
  expect((await second).seq).toBe(2);
  expect(await hub.latestSeq(base.streamId)).toBe(2);
});

it('owns admitted event bytes while waiting behind a blocked delivery', async () => {
  const stores = createInMemoryAgentControlStores();
  const hub = new AgentStreamHub({ ledger: stores.streamLedger });
  const entered = deferred<void>(),
    blocked = deferred<boolean>();
  await hub.subscribe(base.streamId, {
    subscriberId: 'capture',
    deliver: (event) => {
      if (event.seq === 1) {
        entered.resolve();
        return blocked.promise;
      }
      return true;
    },
  });
  const first = hub.publish({ ...base, kind: 'response.started' });
  await entered.promise;
  const input = { ...base, kind: 'text.delta' as const, delta: 'accepted bytes' };
  const second = hub.publish(input);
  input.streamId = 'mutated-stream';
  input.delta = 'mutated bytes';
  blocked.resolve(true);
  await first;
  expect(await second).toMatchObject({ streamId: base.streamId, seq: 2, delta: 'accepted bytes' });
  expect(await hub.latestSeq('mutated-stream')).toBe(0);
});
