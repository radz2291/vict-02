import { executeGraph } from '@vict/kernel';
import type { ApplicationGraphDefinition, CompiledGraph, KernelRunOutput } from '@vict/kernel';
import { compileGraph, canonicalSemanticForm, computeCapabilitySetVersion } from '@vict/kernel';
import { VictStoreError } from './store-errors.js';
import type { StoreErrorCode } from './store-errors.js';
import { ACTIVATION_MANIFEST_SCHEMA } from './store-types.js';
import type { ExecutionStore } from './store-types.js';
import { DurableRunTracker } from './durable-run.js';
import type { ConformanceStores, ConformanceTestRunner } from './store-conformance.js';
import { toCanonicalJson } from './serialization.js';

/**
 * Adapter-neutral durable-boundary conformance suite.
 *
 * Proves the Stage 02 write-ahead invariant against ANY ExecutionStore
 * backend, through the REAL production wiring: kernel events feed
 * `DurableRunTracker`, the tracker's writes go through the store under
 * test, and the kernel's `beforeInvoke` port is
 * `tracker.awaitDurableBoundary()`. The suite wraps the store's writes in
 * explicit FIFO gates so it can hold a write open and observe what the
 * kernel does until the write commits: nothing.
 *
 * Invariants proven at every invocation boundary:
 * - run creation must commit before the FIRST capability is invoked;
 * - a node's `node.started` transition must commit before THAT node's
 *   capability is invoked;
 * - the preceding node-result batch must commit before the NEXT node's
 *   capability is invoked;
 * - a store rejection at any required boundary yields ZERO capability
 *   invocations and surfaces the structured store error.
 *
 * Determinism: gates are deferred promises, and every await targets
 * observable state (a write arriving at the gate, an invocation being
 * recorded). There are no sleeps and no timing assumptions. Every
 * capability records its invocation SYNCHRONOUSLY as its first statement,
 * so no in-capability barrier can fake a pass.
 */

export interface BoundaryConformanceFactory {
  /** Human-readable backend name used in test titles. */
  readonly name: string;
  /** Create a fresh, isolated store set backed by a disposable database. */
  create(): Promise<ConformanceStores>;
}

interface DeferredWrite {
  readonly label: string;
  resolve(): void;
  reject(error: unknown): void;
}

export interface BoundaryGates {
  /** Labels of writes waiting at the gate, oldest first. */
  pendingLabels(): readonly string[];
  /** Resolve the oldest pending write. */
  releaseNext(): void;
  /** Reject the oldest pending write with a structured store error. */
  failNext(code?: string): void;
  /** Resolves once a write whose label contains `fragment` is at the gate. */
  waitForPending(fragment: string): Promise<void>;
  /** Resolves once the recorded capability invocations reach `count`. */
  waitForInvocations(count: number): Promise<void>;
  /** Labels of writes that fully committed through the inner store, in order. */
  readonly committed: readonly string[];
  /** Capability ids whose bodies began, in invocation order. */
  readonly invocations: readonly string[];
}

interface Scenario {
  readonly gates: BoundaryGates;
  readonly execution: Promise<void>;
  readonly stores: ConformanceStores;
}

const RUN_ID = 'boundary-run';

/**
 * Wrap an ExecutionStore so every write blocks at an explicit gate until the
 * test releases it. FIFO ordering is preserved; reads pass straight through.
 */
function gatedExecutionStore(
  inner: ExecutionStore,
  invocations: string[],
): ExecutionStore & BoundaryGates & { recordInvocation(capabilityId: string): void } {
  const waiting: DeferredWrite[] = [];
  const committed: string[] = [];
  const pendingWaiters: Array<{ fragment: string; resolve: () => void }> = [];
  let invocationWaiters: Array<{ count: number; resolve: () => void }> = [];

  const notifyPending = (label: string): void => {
    for (let index = 0; index < pendingWaiters.length;) {
      const waiter = pendingWaiters[index] as { fragment: string; resolve: () => void };
      if (label.includes(waiter.fragment)) {
        waiter.resolve();
        pendingWaiters.splice(index, 1);
      } else {
        index += 1;
      }
    }
  };

  const gate = async <T>(label: string, write: () => Promise<T>): Promise<T> => {
    await new Promise<void>((resolve, reject) => {
      waiting.push({ label, resolve, reject });
      notifyPending(label);
    });
    const result = await write();
    committed.push(label);
    return result;
  };

  const writeLabel = (command: {
    runId: string;
    events: ReadonlyArray<{ type: string; seq: number; nodeId?: string }>;
  }): string => {
    const first = command.events[0];
    const detail =
      command.events.length === 0
        ? 'state-only'
        : command.events
            .map((event) => `${event.type}@${'nodeId' in event ? (event.nodeId ?? '-') : '-'}`)
            .join('+');
    return `commit:${command.runId}:${first?.seq ?? '-'}:${detail}`;
  };

  const gated: ExecutionStore = {
    createRun: (command) => gate(`createRun:${command.runId}`, () => inner.createRun(command)),
    commitTransition: (command) => gate(writeLabel(command), () => inner.commitTransition(command)),
    getRun: (runId) => inner.getRun(runId),
    listRuns: (query) => inner.listRuns(query),
    listEvents: (runId, afterSeq) => inner.listEvents(runId, afterSeq),
    recoverInterruptedRuns: (command) => inner.recoverInterruptedRuns(command),
  };

  return Object.assign(gated, {
    pendingLabels: (): readonly string[] => waiting.map((write) => write.label),
    releaseNext: (): void => {
      const write = waiting.shift();
      if (write) {
        write.resolve();
      }
    },
    failNext: (code: StoreErrorCode = 'VICT_STORE_UNAVAILABLE'): void => {
      const write = waiting.shift();
      if (write) {
        write.reject(
          new VictStoreError(code, 'Injected durable-boundary failure.', {
            operation: 'boundary-conformance',
          }),
        );
      }
    },
    waitForPending: (fragment: string): Promise<void> =>
      new Promise<void>((resolve) => {
        if (waiting.some((write) => write.label.includes(fragment))) {
          resolve();
          return;
        }
        pendingWaiters.push({ fragment, resolve });
      }),
    waitForInvocations: (count: number): Promise<void> => {
      return new Promise<void>((resolve) => {
        if (invocations.length >= count) {
          resolve();
          return;
        }
        invocationWaiters.push({ count, resolve });
      });
    },
    /** Record that a capability body began (wakes invocation waiters). */
    recordInvocation: (capabilityId: string): void => {
      invocations.push(capabilityId);
      invocationWaiters = invocationWaiters.filter((waiter) => {
        if (invocations.length >= waiter.count) {
          waiter.resolve();
          return false;
        }
        return true;
      });
    },
    committed,
    invocations,
  });
}

const TWO_NODE_GRAPH: ApplicationGraphDefinition = {
  id: 'boundary-graph',
  entry: 'a',
  nodes: [
    { id: 'a', capability: 'boundary.a' },
    { id: 'b', capability: 'boundary.b' },
  ],
  edges: [{ from: 'a', to: 'b' }],
};

/** Compile through the same canonical path the runtime uses. */
function compile(definition: ApplicationGraphDefinition): CompiledGraph {
  const result = compileGraph({
    definition,
    capabilities: {
      getCapabilityDescriptor: (capabilityId) => ({
        id: capabilityId,
        revision: '1',
        effect: 'pure' as const,
      }),
    },
    contracts: { has: () => false, isCompatible: () => true, get: () => undefined },
  });
  if (!result.ok) {
    throw new Error(`boundary fixture graph failed to compile: ${result.issues.length} issue(s)`);
  }
  return result.graph;
}

/**
 * The exact manifest for the compiled graph's identities. The compiled
 * capabilitySetVersion/activationVersion were computed by the kernel from
 * the same bindings, so the store's identity validation accepts it.
 */
function manifestFor(graph: CompiledGraph) {
  const bindings = graph.nodeIds.map((nodeId) => {
    const node = graph.getNode(nodeId) as { capability: string };
    return {
      capability: node.capability,
      revision: '1',
      effect: 'pure' as const,
      input: null,
      output: null,
    };
  });
  return {
    manifestSchema: ACTIVATION_MANIFEST_SCHEMA,
    graphId: graph.id,
    graph: canonicalSemanticForm(graph.toDefinition()),
    graphVersion: graph.graphVersion,
    capabilitySetVersion: computeCapabilitySetVersion(bindings),
    activationVersion: graph.activationVersion,
    bindings,
    contracts: [],
  };
}

/**
 * Execute the two-node graph through the exact production wiring:
 * kernel → DurableRunTracker (onEvent + awaitDurableBoundary) → store.
 */
async function openScenario(factory: BoundaryConformanceFactory): Promise<Scenario> {
  const stores = await factory.create();
  const invocations: string[] = [];
  const store = gatedExecutionStore(stores.execution, invocations);

  const graph = compile(TWO_NODE_GRAPH);
  // Publish the exact activation the run will reference: stores validate
  // run identity against the published activation (adapter-neutral rule).
  const manifest = manifestFor(graph);
  await stores.catalog.publish({ manifest, canonicalManifest: toCanonicalJson(manifest) });

  const tracker = new DurableRunTracker(store, {
    runId: RUN_ID,
    graphId: graph.id,
    graphVersion: graph.graphVersion,
    capabilitySetVersion: graph.capabilitySetVersion,
    activationVersion: graph.activationVersion,
    mode: 'normal',
    retention: 'summary',
    entryNodeId: graph.entryNodeId,
  });

  const execution = (async (): Promise<void> => {
    const output: KernelRunOutput = await executeGraph({
      graph,
      input: { n: 1 },
      mode: 'normal',
      ports: {
        descriptors: {
          getCapabilityDescriptor: (capabilityId) => ({
            id: capabilityId,
            revision: '1',
            effect: 'pure' as const,
          }),
        },
        contracts: { has: () => false, isCompatible: () => true, get: () => undefined },
        // Pin the kernel's run id to the tracker's run id — exactly what the
        // runtime does; events and run rows must carry one run identity.
        ids: { runId: (): string => RUN_ID },
        onEvent: (event) => {
          tracker.onEvent(event);
        },
        // The exact boundary the runtime installs.
        beforeInvoke: () => tracker.awaitDurableBoundary(),
        policy: { authorize: () => ({ allowed: true, useDouble: false }) },
        capabilities: {
          invoke: async (capabilityId) => {
            // FIRST statement: a synchronous, observable side effect. If the
            // kernel ever invoked before the durable write committed, this
            // would record it — no in-capability barrier can mask that.
            store.recordInvocation(capabilityId);
            return { ok: true as const, value: { from: capabilityId } };
          },
        },
      },
    });
    await tracker.finish(output);
  })();
  execution.catch(() => undefined); // rejections are observed through `execution`
  return { gates: store, execution, stores };
}

/** Build and run the durable-boundary suite against one backend factory. */
export function runDurableBoundarySuite(
  runner: ConformanceTestRunner,
  factory: BoundaryConformanceFactory,
): void {
  const { test, expect } = runner;

  test(`[${factory.name}] an unresolved createRun blocks the first capability invocation`, async () => {
    const scenario = await openScenario(factory);
    try {
      // Run creation reached the store but stays gated.
      await scenario.gates.waitForPending('createRun');
      // The kernel awaits the durable boundary; nothing has been invoked.
      expect(scenario.gates.invocations).toEqual([]);
    } finally {
      await settle(scenario);
    }
  });

  test(`[${factory.name}] an unresolved node.started commit blocks that node's capability`, async () => {
    const scenario = await openScenario(factory);
    try {
      await scenario.gates.waitForPending('createRun');
      scenario.gates.releaseNext();
      // Node a's node.started write is durable-in-flight.
      await scenario.gates.waitForPending('node.started@a');
      expect(scenario.gates.invocations).toEqual([]);
    } finally {
      await settle(scenario);
    }
  });

  test(`[${factory.name}] resolving the node-start commit invokes the capability exactly once`, async () => {
    const scenario = await openScenario(factory);
    try {
      await scenario.gates.waitForPending('createRun');
      scenario.gates.releaseNext();
      await scenario.gates.waitForPending('node.started@a');
      scenario.gates.releaseNext();
      await scenario.gates.waitForInvocations(1);
      expect(scenario.gates.invocations).toEqual(['boundary.a']);
      // Release the remaining durable writes as execution produces them;
      // node b then runs — exactly once more.
      await scenario.gates.waitForPending('node.completed@a');
      scenario.gates.releaseNext();
      await scenario.gates.waitForPending('node.started@b');
      scenario.gates.releaseNext();
      await scenario.gates.waitForInvocations(2);
      expect(scenario.gates.invocations).toEqual(['boundary.a', 'boundary.b']);
    } finally {
      await settle(scenario);
    }
  });

  test(`[${factory.name}] a rejected createRun invokes no capability and fails structured`, async () => {
    const scenario = await openScenario(factory);
    try {
      await scenario.gates.waitForPending('createRun');
      scenario.gates.failNext('VICT_STORE_UNAVAILABLE');
      await expect(scenario.execution).rejects.toMatchObject({ code: 'VICT_STORE_UNAVAILABLE' });
      expect(scenario.gates.invocations).toEqual([]);
    } finally {
      await settleSilently(scenario);
    }
  });

  test(`[${factory.name}] a rejected node-start transition invokes no capability`, async () => {
    const scenario = await openScenario(factory);
    try {
      await scenario.gates.waitForPending('createRun');
      scenario.gates.releaseNext();
      await scenario.gates.waitForPending('node.started@a');
      scenario.gates.failNext('VICT_STORE_BUSY');
      await expect(scenario.execution).rejects.toMatchObject({ code: 'VICT_STORE_BUSY' });
      expect(scenario.gates.invocations).toEqual([]);
    } finally {
      await settleSilently(scenario);
    }
  });

  test(`[${factory.name}] the second capability waits for the first result batch and its own node.started`, async () => {
    const scenario = await openScenario(factory);
    try {
      // FIFO write order: createRun, a:node.started, a:result batch,
      // b:node.started, b:result+terminal.
      await scenario.gates.waitForPending('createRun');
      scenario.gates.releaseNext();
      await scenario.gates.waitForPending('node.started@a');
      scenario.gates.releaseNext();
      await scenario.gates.waitForInvocations(1);
      expect(scenario.gates.invocations).toEqual(['boundary.a']);
      // a's result batch is now gated — b must not start.
      await scenario.gates.waitForPending('node.completed@a');
      expect(scenario.gates.invocations).toEqual(['boundary.a']);
      scenario.gates.releaseNext(); // commit a's result batch
      await scenario.gates.waitForPending('node.started@b');
      // b's intent is enqueued but not durable — still exactly one invocation.
      expect(scenario.gates.invocations).toEqual(['boundary.a']);
      scenario.gates.releaseNext(); // commit b's node.started
      await scenario.gates.waitForInvocations(2);
      expect(scenario.gates.invocations).toEqual(['boundary.a', 'boundary.b']);
      // Causal order: a's result batch committed before b's node.started
      // committed — and b ran only afterwards.
      const committed = scenario.gates.committed;
      const batchIndex = committed.findIndex((label) => label.includes('node.completed@a'));
      const bStartIndex = committed.findIndex((label) => label.includes('node.started@b'));
      expect(batchIndex >= 0).toBe(true);
      expect(bStartIndex > batchIndex).toBe(true);
    } finally {
      await settle(scenario);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Scenario settlement                                                 */
/* ------------------------------------------------------------------ */

/** Release everything still pending and let the run settle successfully. */
async function settle(scenario: Scenario): Promise<void> {
  await releaseUntilSettled(scenario);
  await scenario.execution;
  await scenario.stores.dispose();
}

/** Release everything still pending after an expected rejection. */
async function settleSilently(scenario: Scenario): Promise<void> {
  await releaseUntilSettled(scenario);
  await scenario.execution.catch(() => undefined);
  await scenario.stores.dispose();
}

/**
 * Release gated writes until the execution settles: each release can let
 * execution produce the next gated write, so the loop yields and re-checks
 * until the run promise resolves or rejects. Terminates because the write
 * sequence of a finite graph is finite.
 */
async function releaseUntilSettled(scenario: Scenario): Promise<void> {
  let settled = false;
  const done = scenario.execution.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  while (!settled) {
    if (scenario.gates.pendingLabels().length > 0) {
      scenario.gates.releaseNext();
    }
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  await done;
}
