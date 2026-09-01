import type { VictRuntime } from './runtime.js';
import type {
  ConformanceExpect,
  ConformanceTestRunner,
  OrchestrationConformanceFixture,
} from './orchestration-conformance.js';

/**
 * Adapter-neutral join-boundary conformance suite (corrective Stage 03).
 *
 * The join node is a durable control boundary: the final branch arrival
 * atomically creates exactly one join-ready token carrying the private
 * canonical checkpoint; the runtime then claims that token, validates the
 * join's DECLARED output contract outside any persistence transaction, and
 * commits one atomic transition that either advances downstream, completes
 * a terminal join with the validated (possibly transformed) output, or
 * fails the run with a sanitized structured error.
 *
 * Every conforming backend (in-memory, SQLite) runs this exact suite.
 */

export interface JoinConformanceContext {
  readonly runner: ConformanceTestRunner;
  readonly expect: ConformanceExpect;
  readonly factory: OrchestrationConformanceFixture;
}

interface RawContractRegistration {
  id: string;
  revision: string;
  expected: string;
  parse(input: unknown): {
    ok: boolean;
    value?: unknown;
    issues: { code: string; path: string; message: string }[];
  };
}

/** Fork/join flow graph with optional join contract and downstream node. */
function joinFlowGraph(options: {
  joinContractId?: string;
  downstreamInputContractId?: string;
  terminal?: boolean;
}): Parameters<VictRuntime['activate']>[0] {
  const nodes: Record<string, unknown>[] = [
    { id: 'start', capability: 'start' },
    { id: 'f', kind: 'fork', join: 'j' },
    { id: 'a', capability: 'branchA' },
    { id: 'b', capability: 'branchB' },
    {
      id: 'j',
      kind: 'join',
      fork: 'f',
      ...(options.joinContractId !== undefined ? { output: options.joinContractId } : {}),
    },
  ];
  const edges: Record<string, unknown>[] = [
    { from: 'start', to: 'f' },
    { from: 'f', to: 'a', kind: 'branch', key: 'a' },
    { from: 'f', to: 'b', kind: 'branch', key: 'b' },
    { from: 'a', to: 'j' },
    { from: 'b', to: 'j' },
  ];
  if (!options.terminal) {
    nodes.push({
      id: 'z',
      capability: 'after',
      ...(options.downstreamInputContractId !== undefined
        ? { input: options.downstreamInputContractId }
        : {}),
    });
    edges.push({ from: 'j', to: 'z' });
  }
  return {
    id: options.terminal ? 'conf-join-terminal' : 'conf-join-flow',
    entry: 'start',
    nodes,
    edges,
  } as unknown as Parameters<VictRuntime['activate']>[0];
}

/** Distinctive payload values used as leakage canaries. */
const CANARY_A = 'branch-alpha-payload-7f3a';
const CANARY_B = 'branch-beta-payload-91cd';
const REJECT_CANARY = 'raw-parser-canary-4e2b';

export function runOrchestrationJoinSuite(
  runner: ConformanceTestRunner,
  expect: ConformanceExpect,
  factory: OrchestrationConformanceFixture,
): void {
  const t = runner.test;

  t(
    `[${factory.name}] join boundary: accepting contract called exactly once, downstream runs`,
    async () => {
      const fixture = await factory.create();
      try {
        const runtime = fixture.runtime;
        let joinParseCalls = 0;
        let downstreamCalls = 0;
        registerFlow(runtime, {
          joinContract: {
            id: 'conf-join-accept',
            revision: '1',
            expected: 'a record',
            parse: (input: unknown) => {
              joinParseCalls += 1;
              if (typeof input !== 'object' || input === null) {
                return {
                  ok: false as const,
                  issues: [{ code: 'TYPE', path: '$', message: 'record' }],
                };
              }
              return { ok: true as const, value: input, issues: [] };
            },
          },
          after: (input: unknown) => {
            downstreamCalls += 1;
            return `processed:${JSON.stringify(input)}`;
          },
        });
        const activated = await runtime.activate(
          joinFlowGraph({ joinContractId: 'conf-join-accept' }),
        );
        expect(activated.ok).toBe(true);
        const result = await runtime.run('seed');
        expect(result.status).toBe('completed');
        expect(joinParseCalls).toBe(1);
        expect(downstreamCalls).toBe(1);
        const events = await fixture.orchestration.listOrchestrationEvents(result.runId);
        expect(events.filter((event) => event.type === 'join.completed').length).toBe(1);
        expect(events.filter((event) => event.type === 'branch.completed').length).toBe(2);
        const snapshot = await fixture.orchestration.getOrchestrationSnapshot(result.runId);
        expect(snapshot?.attempts.filter((attempt) => attempt.nodeId === 'j').length).toBe(1);
        void expect;
      } finally {
        await fixture.dispose();
      }
    },
  );

  t(
    `[${factory.name}] join boundary: rejecting contract fails safely, no downstream, no leakage`,
    async () => {
      const fixture = await factory.create();
      try {
        const runtime = fixture.runtime;
        let joinParseCalls = 0;
        let downstreamCalls = 0;
        registerFlow(runtime, {
          joinContract: {
            id: 'conf-join-reject',
            revision: '1',
            expected: 'never',
            parse: (input: unknown) => {
              joinParseCalls += 1;
              // Hostile parser: raw custom message + payload echo + nested
              // secret-shaped content that must never reach any event,
              // record, or safe error.
              return {
                ok: false as const,
                issues: [
                  {
                    code: 'HOSTILE',
                    path: '$',
                    message: `${REJECT_CANARY}:${JSON.stringify(input)}`,
                  },
                ],
              };
            },
          },
          after: () => {
            downstreamCalls += 1;
            return 'must-not-run';
          },
        });
        const activated = await runtime.activate(
          joinFlowGraph({ joinContractId: 'conf-join-reject' }),
        );
        expect(activated.ok).toBe(true);
        const result = await runtime.run('seed');
        expect(result.status).toBe('failed');
        expect(joinParseCalls).toBe(1);
        expect(downstreamCalls).toBe(0);
        const message = (result as { error?: { code?: string; message?: string } }).error ?? {};
        expect(message.code).toBe('VICT_KERNEL_CONTRACT_REJECTED');
        expect(String(message.message ?? '').includes(REJECT_CANARY)).toBe(false);
        const events = await fixture.orchestration.listOrchestrationEvents(result.runId);
        expect(events.filter((event) => event.type === 'join.completed').length).toBe(0);
        const serialized = JSON.stringify(events);
        expect(serialized.includes(REJECT_CANARY)).toBe(false);
        expect(serialized.includes(CANARY_A)).toBe(false);
        expect(serialized.includes(CANARY_B)).toBe(false);
        // Default retained history never carries the rejected payload.
        const record = await fixture.orchestration.getOrchestrationRun(result.runId);
        expect(record).toBeDefined();
        const recordJson = JSON.stringify(record);
        expect(recordJson.includes(REJECT_CANARY)).toBe(false);
        expect(recordJson.includes(CANARY_A)).toBe(false);
        expect(recordJson.includes(CANARY_B)).toBe(false);
      } finally {
        await fixture.dispose();
      }
    },
  );

  t(
    `[${factory.name}] join boundary: transforming contract feeds its validated value downstream`,
    async () => {
      const fixture = await factory.create();
      try {
        const runtime = fixture.runtime;
        let joinParseCalls = 0;
        let downParseCalls = 0;
        registerFlow(runtime, {
          joinContract: {
            id: 'conf-join-upper',
            revision: '1',
            expected: 'a record of strings',
            parse: (input: unknown) => {
              joinParseCalls += 1;
              if (typeof input !== 'object' || input === null) {
                return {
                  ok: false as const,
                  issues: [{ code: 'TYPE', path: '$', message: 'record' }],
                };
              }
              const out: Record<string, unknown> = {};
              for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
                out[key] = String(value).toUpperCase();
              }
              return { ok: true as const, value: out, issues: [] };
            },
          },
          after: (input: unknown) => {
            downParseCalls += 1;
            return `processed:${JSON.stringify(input)}`;
          },
        });
        const activated = await runtime.activate(
          joinFlowGraph({ joinContractId: 'conf-join-upper' }),
        );
        expect(activated.ok).toBe(true);
        const result = await runtime.run('seed');
        expect(result.status).toBe('completed');
        expect(joinParseCalls).toBe(1);
        // The downstream capability observed the TRANSFORMED value: had the
        // join's validated value not flowed downstream, the payload would
        // be the raw canonical checkpoint instead.
        expect(downParseCalls).toBe(1);
        expect(result.output).toBe(
          `processed:${JSON.stringify({
            a: CANARY_A.toUpperCase(),
            b: CANARY_B.toUpperCase(),
          })}`,
        );
      } finally {
        await fixture.dispose();
      }
    },
  );

  t(
    `[${factory.name}] join boundary: downstream input contract is an independent validating boundary`,
    async () => {
      const fixture = await factory.create();
      try {
        const runtime = fixture.runtime;
        let downParseCalls = 0;
        registerFlow(runtime, {
          // The join declares NO output contract: the raw canonical payload
          // flows to the downstream node, whose INPUT contract is a separate
          // boundary — and it rejects what the join passed through.
          downstreamContract: {
            id: 'conf-down-strict',
            revision: '1',
            expected: 'a string payload',
            parse: (input: unknown) => {
              downParseCalls += 1;
              if (typeof input !== 'string') {
                return {
                  ok: false as const,
                  issues: [{ code: 'SHAPE', path: '$', message: 'expected a string' }],
                };
              }
              return { ok: true as const, value: input, issues: [] };
            },
          },
          after: () => 'must-not-run',
        });
        const activated = await runtime.activate(
          joinFlowGraph({ downstreamInputContractId: 'conf-down-strict' }),
        );
        expect(activated.ok).toBe(true);
        const result = await runtime.run('seed');
        // The join passed the canonical record; the downstream INPUT
        // boundary rejected it independently.
        expect(result.status).toBe('failed');
        expect(downParseCalls).toBe(1);
        const message = (result as { error?: { code?: string } }).error ?? {};
        expect(message.code).toBe('VICT_KERNEL_CONTRACT_REJECTED');
        const events = await fixture.orchestration.listOrchestrationEvents(result.runId);
        expect(events.filter((event) => event.type === 'join.completed').length).toBe(1);
      } finally {
        await fixture.dispose();
      }
    },
  );

  t(
    `[${factory.name}] join boundary: reverse branch-completion order yields the same canonical join input`,
    async () => {
      const outputs: unknown[] = [];
      for (const reverse of [false, true]) {
        const fixture = await factory.create();
        const runtime = fixture.runtime;
        let releaseA: (() => void) | undefined;
        let releaseB: (() => void) | undefined;
        const gateA = new Promise<void>((resolve) => {
          releaseA = resolve;
        });
        const gateB = new Promise<void>((resolve) => {
          releaseB = resolve;
        });
        registerFlow(runtime, {
          joinContract: {
            id: `conf-join-order-${reverse ? 'r' : 'f'}`,
            revision: '1',
            expected: 'a record',
            parse: (input: unknown) => ({ ok: true as const, value: input, issues: [] }),
          },
          branchA: async () => {
            if (reverse) {
              await gateA; // a waits for b: reverse completion order
            } else {
              releaseB?.(); // forward: a completes first
            }
            return CANARY_A;
          },
          branchB: async () => {
            if (reverse) {
              releaseA?.();
            } else {
              await gateB;
            }
            return CANARY_B;
          },
          after: (input: unknown) => `processed:${JSON.stringify(input)}`,
        });
        const activated = await runtime.activate(
          joinFlowGraph({ joinContractId: `conf-join-order-${reverse ? 'r' : 'f'}` }),
        );
        expect(activated.ok).toBe(true);
        const result = await runtime.run('seed');
        expect(result.status).toBe('completed');
        outputs.push(result.output);
        void releaseA;
        void releaseB;
      }
      // Both orders produce the identical canonical (branch-key-sorted) join.
      expect(outputs[0]).toBe(outputs[1]);
      expect(outputs[0]).toBe(`processed:${JSON.stringify({ a: CANARY_A, b: CANARY_B })}`);
    },
  );

  t(
    `[${factory.name}] join boundary: concurrent final arrivals create one join token and one join.completed`,
    async () => {
      const fixture = await factory.create();
      try {
        const runtime = fixture.runtime;
        let joinParseCalls = 0;
        let downstreamCalls = 0;
        let active = 0;
        let maxConcurrent = 0;
        let release: (() => void) | undefined;
        const barrier = new Promise<void>((resolve) => {
          release = resolve;
        });
        registerFlow(runtime, {
          joinContract: {
            id: 'conf-join-race',
            revision: '1',
            expected: 'a record',
            parse: (input: unknown) => {
              joinParseCalls += 1;
              return { ok: true as const, value: input, issues: [] };
            },
          },
          branchA: async () => {
            active += 1;
            maxConcurrent = Math.max(maxConcurrent, active);
            await barrier;
            active -= 1;
            return CANARY_A;
          },
          branchB: async () => {
            active += 1;
            maxConcurrent = Math.max(maxConcurrent, active);
            await barrier;
            active -= 1;
            return CANARY_B;
          },
          after: (input: unknown) => {
            downstreamCalls += 1;
            return `processed:${JSON.stringify(input)}`;
          },
        });
        const activated = await runtime.activate(
          joinFlowGraph({ joinContractId: 'conf-join-race' }),
        );
        expect(activated.ok).toBe(true);
        // Both branches are released in the same tick: the store serializes
        // the two final-arrival candidates; exactly one may fire the join.
        const releaseNow = release as () => void;
        setTimeout(releaseNow, 5);
        const result = await runtime.run('seed', { concurrency: 4 });
        expect(result.status).toBe('completed');
        expect(maxConcurrent).toBe(2);
        expect(joinParseCalls).toBe(1);
        expect(downstreamCalls).toBe(1);
        const events = await fixture.orchestration.listOrchestrationEvents(result.runId);
        expect(events.filter((event) => event.type === 'join.completed').length).toBe(1);
        expect(events.filter((event) => event.type === 'branch.completed').length).toBe(2);
        const snapshot = await fixture.orchestration.getOrchestrationSnapshot(result.runId);
        expect(snapshot?.attempts.filter((attempt) => attempt.nodeId === 'j').length).toBe(1);
      } finally {
        await fixture.dispose();
      }
    },
  );

  t(
    `[${factory.name}] join boundary: duplicate and stale branch completions cannot revalidate or rejoin`,
    async () => {
      const fixture = await factory.create();
      try {
        const runtime = fixture.runtime;
        registerFlow(runtime, {
          joinContract: {
            id: 'conf-join-replay',
            revision: '1',
            expected: 'a record',
            parse: (input: unknown) => ({ ok: true as const, value: input, issues: [] }),
          },
          after: (input: unknown) => `processed:${JSON.stringify(input)}`,
        });
        const activated = await runtime.activate(
          joinFlowGraph({ joinContractId: 'conf-join-replay' }),
        );
        expect(activated.ok).toBe(true);
        const result = await runtime.run('seed');
        expect(result.status).toBe('completed');

        // The completed run has exactly one join completion and no ready
        // tokens; a replayed branch arrival cannot resurrect anything.
        const events = await fixture.orchestration.listOrchestrationEvents(result.runId);
        expect(events.filter((event) => event.type === 'join.completed').length).toBe(1);
        const beforeSeq = events.length;
        void beforeSeq;

        // A stale/fabricated branch arrival (unknown token, bogus fence)
        // must be rejected by the store without mutating durable state.
        let rejected = false;
        try {
          await fixture.orchestration.completeAttempt({
            runId: result.runId,
            attemptId: 'attempt_does_not_exist',
            ownerId: 'stale-owner',
            expectedAttemptFence: 999,
            now: Date.now(),
            outcome: { kind: 'completed', outputSummary: { shape: 'string', length: 3 } },
            continuation: {
              kind: 'branchArrival',
              forkId: 'f',
              joinId: 'j',
              branchKey: 'a',
              joinContinuation: { tokenId: 'token_forged', toNodeId: 'j', lineage: 'forged' },
            },
            events: [],
            run: { status: 'running' },
            branchOutput: CANARY_A,
            declaredBranchKeys: ['a', 'b'],
          });
        } catch {
          rejected = true;
        }
        expect(rejected).toBe(true);
        const eventsAfter = await fixture.orchestration.listOrchestrationEvents(result.runId);
        expect(eventsAfter.length).toBe(beforeSeq);
        expect(eventsAfter.filter((event) => event.type === 'join.completed').length).toBe(1);
        const snapshotAfter = await fixture.orchestration.getOrchestrationSnapshot(result.runId);
        expect(snapshotAfter?.run.status).toBe('completed');
      } finally {
        await fixture.dispose();
      }
    },
  );

  t(
    `[${factory.name}] terminal join: validating contract completes the run with the canonical output`,
    async () => {
      const fixture = await factory.create();
      try {
        const runtime = fixture.runtime;
        let joinParseCalls = 0;
        registerFlow(runtime, {
          joinContract: {
            id: 'conf-join-terminal',
            revision: '1',
            expected: 'a record of strings',
            parse: (input: unknown) => {
              joinParseCalls += 1;
              if (typeof input !== 'object' || input === null) {
                return {
                  ok: false as const,
                  issues: [{ code: 'TYPE', path: '$', message: 'record' }],
                };
              }
              const out: Record<string, unknown> = {};
              for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
                out[key] = `v:${String(value)}`;
              }
              return { ok: true as const, value: out, issues: [] };
            },
          },
        });
        const activated = await runtime.activate(
          joinFlowGraph({ joinContractId: 'conf-join-terminal', terminal: true }),
        );
        expect(activated.ok).toBe(true);
        const result = await runtime.run('seed');
        expect(result.status).toBe('completed');
        expect(joinParseCalls).toBe(1);
        // The validated, transformed canonical join output IS the run output.
        expect(JSON.stringify(result.output)).toBe(
          JSON.stringify({ a: `v:${CANARY_A}`, b: `v:${CANARY_B}` }),
        );
        const events = await fixture.orchestration.listOrchestrationEvents(result.runId);
        expect(events.filter((event) => event.type === 'join.completed').length).toBe(1);
        expect(events.filter((event) => event.type === 'run.completed').length).toBe(1);
      } finally {
        await fixture.dispose();
      }
    },
  );

  t(
    `[${factory.name}] terminal join: rejecting contract fails durably without an unhandled exception`,
    async () => {
      const fixture = await factory.create();
      try {
        const runtime = fixture.runtime;
        let joinParseCalls = 0;
        registerFlow(runtime, {
          joinContract: {
            id: 'conf-join-terminal-reject',
            revision: '1',
            expected: 'never',
            parse: (input: unknown) => {
              joinParseCalls += 1;
              return {
                ok: false as const,
                issues: [
                  {
                    code: 'HOSTILE',
                    path: '$',
                    message: `${REJECT_CANARY}:${JSON.stringify(input)}`,
                  },
                ],
              };
            },
          },
        });
        const activated = await runtime.activate(
          joinFlowGraph({ joinContractId: 'conf-join-terminal-reject', terminal: true }),
        );
        expect(activated.ok).toBe(true);
        const result = await runtime.run('seed');
        expect(result.status).toBe('failed');
        expect(joinParseCalls).toBe(1);
        const message = (result as { error?: { code?: string; message?: string } }).error ?? {};
        expect(message.code).toBe('VICT_KERNEL_CONTRACT_REJECTED');
        expect(String(message.message ?? '').includes(REJECT_CANARY)).toBe(false);
        const events = await fixture.orchestration.listOrchestrationEvents(result.runId);
        expect(events.filter((event) => event.type === 'run.failed').length).toBe(1);
        expect(events.filter((event) => event.type === 'join.completed').length).toBe(0);
        expect(JSON.stringify(events).includes(REJECT_CANARY)).toBe(false);
      } finally {
        await fixture.dispose();
      }
    },
  );
}

/** Register the standard flow capabilities plus caller-provided contracts. */
function registerFlow(
  runtime: VictRuntime,
  options: {
    joinContract?: RawContractRegistration;
    downstreamContract?: RawContractRegistration;
    branchA?: (input: unknown) => unknown | Promise<unknown>;
    branchB?: (input: unknown) => unknown | Promise<unknown>;
    after?: (input: unknown) => unknown;
  },
): void {
  runtime
    .registerCapability({ id: 'start', revision: '1', effect: 'pure', invoke: () => 'seed' })
    .registerCapability({
      id: 'branchA',
      revision: '1',
      effect: 'pure',
      invoke: options.branchA ?? (() => CANARY_A),
    })
    .registerCapability({
      id: 'branchB',
      revision: '1',
      effect: 'pure',
      invoke: options.branchB ?? (() => CANARY_B),
    })
    .registerCapability({
      id: 'after',
      revision: '1',
      effect: 'pure',
      invoke: options.after ?? ((input: unknown) => `processed:${JSON.stringify(input)}`),
    });
  if (options.joinContract !== undefined) {
    runtime.registerContract(options.joinContract as never);
  }
  if (options.downstreamContract !== undefined) {
    runtime.registerContract(options.downstreamContract as never);
  }
}
