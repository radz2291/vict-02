import { expect, it } from 'vitest';
import { AgentStreamHub, createInMemoryAgentControlStores } from '../src/index.js';

const base = {
  streamId: 'handoff',
  turnId: 'turn',
  threadId: 'thread',
  actorId: 'actor',
  agentProfileVersion: 'v1_handoff',
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

it('streams more than the default pending limit to a fast replay sink without overflow', async () => {
  const stores = createInMemoryAgentControlStores();
  const hub = new AgentStreamHub({ ledger: stores.streamLedger });
  for (let i = 0; i < 4100; i++) await hub.publish({ ...base, kind: 'response.started' });
  const received: number[] = [];
  let overflow = false;
  await hub.subscribe(base.streamId, {
    subscriberId: 'large',
    deliver: (event) => {
      received.push(event.seq);
      return true;
    },
    onOverflow: () => {
      overflow = true;
    },
  });
  expect(overflow).toBe(false);
  expect(received).toEqual(Array.from({ length: 4100 }, (_, i) => i + 1));
});

it('merges transient and durable replay before newer live capture without duplicates', async () => {
  const stores = createInMemoryAgentControlStores();
  const entered = deferred<void>(),
    release = deferred<void>();
  let gate = true;
  const ledger = {
    latestSeq: stores.streamLedger.latestSeq.bind(stores.streamLedger),
    appendEvent: stores.streamLedger.appendEvent.bind(stores.streamLedger),
    listStreamIds: stores.streamLedger.listStreamIds.bind(stores.streamLedger),
    listEventsFrom: async (...args: Parameters<typeof stores.streamLedger.listEventsFrom>) => {
      if (gate) {
        gate = false;
        entered.resolve();
        await release.promise;
      }
      return stores.streamLedger.listEventsFrom(...args);
    },
  };
  const hub = new AgentStreamHub({ ledger, replayPageSize: 1 });
  await hub.publish({ ...base, kind: 'response.started' });
  await hub.publish({ ...base, kind: 'text.delta', delta: 'old' });
  await hub.publish({ ...base, kind: 'response.completed' });
  const received: number[] = [];
  const subscription = hub.subscribe(base.streamId, {
    subscriberId: 'race',
    deliver: (event) => {
      received.push(event.seq);
      return true;
    },
  });
  await entered.promise;
  try {
    await hub.publish({ ...base, kind: 'text.delta', delta: 'new' });
    await hub.publish({ ...base, kind: 'response.cancelled' });
    expect(hub.pull(base.streamId, 'race')).toEqual([]);
  } finally {
    release.resolve();
    await subscription;
  }
  expect(received).toEqual([1, 2, 3, 4, 5]);
});

it.each(['signal', 'unsubscribe'] as const)(
  'releases blocked replay delivery on %s before sink release',
  async (mode) => {
    const stores = createInMemoryAgentControlStores();
    const hub = new AgentStreamHub({ ledger: stores.streamLedger });
    await hub.publish({ ...base, kind: 'response.started' });
    const entered = deferred<void>(),
      release = deferred<boolean>(),
      owner = new AbortController();
    const received: number[] = [];
    const subscription = hub.subscribe(base.streamId, {
      subscriberId: 'cancel',
      signal: owner.signal,
      deliver: (event) => {
        received.push(event.seq);
        entered.resolve();
        return release.promise;
      },
    });
    await entered.promise;
    await hub.publish({ ...base, kind: 'response.cancelled' });
    if (mode === 'signal') owner.abort();
    else hub.unsubscribe(base.streamId, 'cancel');
    try {
      await subscription;
      expect(received).toEqual([1]);
    } finally {
      release.resolve(true);
    }
  },
);

it('a slow historical sink makes cursor progress before recoverable overflow', async () => {
  const stores = createInMemoryAgentControlStores();
  const hub = new AgentStreamHub({ ledger: stores.streamLedger, pendingLimit: 2 });
  for (let i = 0; i < 6; i++) await hub.publish({ ...base, kind: 'response.started' });
  const received: number[] = [];
  let overflows = 0;
  await hub.subscribe(base.streamId, {
    subscriberId: 'slow',
    deliver: (event) => {
      received.push(event.seq);
      return false;
    },
    onOverflow: () => {
      overflows++;
    },
  });
  expect(received).toEqual([1]);
  expect(overflows).toBe(1);
  const reconnect: number[] = [];
  await hub.subscribe(
    base.streamId,
    {
      subscriberId: 'reconnected',
      deliver: (event) => {
        reconnect.push(event.seq);
        return true;
      },
    },
    { lastSeq: 1 },
  );
  expect(reconnect).toEqual([2, 3, 4, 5, 6]);
});

it.each(['watermark', 'page'] as const)(
  'cancellation releases a blocked replay %s read before its release',
  async (mode) => {
    const stores = createInMemoryAgentControlStores();
    const entered = deferred<void>(),
      release = deferred<void>(),
      owner = new AbortController();
    let gate = true;
    const ledger = {
      appendEvent: stores.streamLedger.appendEvent.bind(stores.streamLedger),
      listStreamIds: stores.streamLedger.listStreamIds.bind(stores.streamLedger),
      latestSeq: async (streamId: string) => {
        if (mode === 'watermark' && gate) {
          gate = false;
          entered.resolve();
          await release.promise;
        }
        return stores.streamLedger.latestSeq(streamId);
      },
      listEventsFrom: async (...args: Parameters<typeof stores.streamLedger.listEventsFrom>) => {
        if (mode === 'page' && gate) {
          gate = false;
          entered.resolve();
          await release.promise;
        }
        return stores.streamLedger.listEventsFrom(...args);
      },
    };
    const hub = new AgentStreamHub({ ledger });
    await hub.publish({ ...base, kind: 'response.started' });
    let deliveries = 0;
    const subscription = hub.subscribe(base.streamId, {
      subscriberId: 'read-cancel',
      signal: owner.signal,
      deliver: () => {
        deliveries++;
        return true;
      },
    });
    await entered.promise;
    owner.abort();
    try {
      await subscription;
      await hub.publish({ ...base, kind: 'response.cancelled' });
      expect(deliveries).toBe(0);
    } finally {
      release.resolve();
    }
  },
);

it('retains live transients captured before the snapshot even when replay buffer rolls over', async () => {
  const stores = createInMemoryAgentControlStores();
  const hub = new AgentStreamHub({ ledger: stores.streamLedger, transientBufferSize: 1 });
  const entered = deferred<void>(),
    release = deferred<boolean>();
  await hub.subscribe(base.streamId, {
    subscriberId: 'earlier',
    deliver: (event) => {
      if (event.seq === 1) {
        entered.resolve();
        return release.promise;
      }
      return true;
    },
  });
  const first = hub.publish({ ...base, kind: 'response.started' });
  await entered.promise;
  const queued = [1, 2, 3].map((i) =>
    hub.publish({ ...base, kind: 'text.delta', delta: String(i) }),
  );
  const received: number[] = [];
  const subscribing = hub.subscribe(base.streamId, {
    subscriberId: 'new',
    deliver: (event) => {
      received.push(event.seq);
      return true;
    },
  });
  release.resolve(true);
  await Promise.all([first, ...queued, subscribing]);
  expect(received).toEqual([1, 2, 3, 4]);
});
