import type { KernelEvent } from '@vict/kernel';
import {
  canonicalSemanticForm,
  computeActivationVersion,
  computeCapabilitySetVersion,
  computeGraphVersion,
} from '@vict/kernel';
import type { VictError } from '@vict/contracts';
import { ACTIVATION_MANIFEST_SCHEMA, RUN_EVENT_SCHEMA } from './store-types.js';
import type {
  ActivationManifest,
  ActivationManifestBinding,
  CommitRunTransitionCommand,
  CreateRunCommand,
  StoredRun,
  TransitionFaultHooks,
  VictStores,
} from './store-types.js';
import { toCanonicalJson } from './serialization.js';

/**
 * Adapter-neutral store conformance suite.
 *
 * One behavioral source, executed against every conforming backend: the
 * in-memory store and the SQLite adapter both run this exact suite. Covers
 * activation publish/read equivalence, idempotent republish, version
 * collisions, selection concurrency, atomic transitions, optimistic
 * concurrency, dense append-only events, retention shapes, safe errors,
 * record encapsulation, idempotent recovery, and corrupt-record rejection.
 *
 * The runner is structural: any test framework whose `test`/`expect` match
 * these minimal shapes can drive the suite (vitest does directly).
 */
export interface ConformanceExpect {
  (actual: unknown): {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toBeDefined(): void;
    toBeUndefined(): void;
    toBeTruthy(): void;
    toHaveLength(n: number): void;
    toMatchObject(pattern: Record<string, unknown>): void;
    rejects: { toMatchObject(pattern: Record<string, unknown>): Promise<void> };
  };
}

export interface ConformanceTestRunner {
  test(name: string, fn: () => Promise<void> | void): void;
  expect: ConformanceExpect;
}

/** A disposable store set under test, optionally exposing test-only fault hooks. */
export interface ConformanceStores extends VictStores {
  dispose(): Promise<void>;
  faults?: TransitionFaultHooks;
}

export interface StoreConformanceFactory {
  /** Human-readable backend name used in test titles. */
  readonly name: string;
  /** Create a fresh, isolated store set backed by a disposable database. */
  create(): Promise<ConformanceStores>;
}

/**
 * Build a fixture activation manifest whose identities are REAL: every
 * content-derived identity is computed by the kernel's canonical identity
 * functions, exactly as the runtime would produce it. Stores recompute and
 * reject hand-made identities, so fixtures must be genuine.
 */
function fixtureManifest(graphId: string, capabilityRevision = '1'): ActivationManifest {
  const graph = {
    schema: 'vict.graph@1',
    id: graphId,
    entry: 'n1',
    nodes: [{ id: 'n1', capability: 'cap.a', input: null, output: null }],
    edges: [] as never[],
  } as unknown as Parameters<typeof computeGraphVersion>[0];
  const bindings = [
    {
      capability: 'cap.a',
      revision: capabilityRevision,
      effect: 'pure' as const,
      input: null,
      output: null,
    },
  ];
  const graphVersion = computeGraphVersion(graph);
  const capabilitySetVersion = computeCapabilitySetVersion(bindings);
  const activationVersion = computeActivationVersion(graphVersion, capabilitySetVersion);
  return {
    manifestSchema: ACTIVATION_MANIFEST_SCHEMA,
    graphId,
    graph: canonicalSemanticForm(graph as unknown as Parameters<typeof canonicalSemanticForm>[0]),
    graphVersion,
    capabilitySetVersion,
    activationVersion,
    bindings,
    contracts: [],
  };
}

const GRAPH_A = fixtureManifest('conf-graph-a');
/** Same graph as GRAPH_A, different capability revision: a valid successor activation. */
const GRAPH_A_V2 = fixtureManifest('conf-graph-a', '2');
const GRAPH_B = fixtureManifest('conf-graph-b');

function makeEvent(
  seq: number,
  type: KernelEvent['type'],
  extra: Record<string, unknown> = {},
  runId = 'conf-run-1',
): KernelEvent {
  return {
    seq,
    runId,
    graphId: GRAPH_A.graphId,
    graphVersion: GRAPH_A.graphVersion,
    capabilitySetVersion: GRAPH_A.capabilitySetVersion,
    activationVersion: GRAPH_A.activationVersion,
    timestamp: 1_000 + seq,
    type,
    ...extra,
  } as KernelEvent;
}

function createCommand(overrides: Partial<CreateRunCommand> = {}): CreateRunCommand {
  const command = {
    runId: 'conf-run-1',
    graphId: GRAPH_A.graphId,
    graphVersion: GRAPH_A.graphVersion,
    capabilitySetVersion: GRAPH_A.capabilitySetVersion,
    activationVersion: GRAPH_A.activationVersion,
    mode: 'normal',
    retention: 'summary',
    currentNodeId: 'n1',
    steps: 0,
    events: [makeEvent(0, 'run.started')],
    timestamp: 1_000,
    ...overrides,
  };
  // Events always belong to the run under test, whatever overrides change.
  return {
    ...command,
    events: command.events.map((event) => ({ ...event, runId: command.runId })),
  } as CreateRunCommand;
}

function transitionCommand(
  overrides: Partial<CommitRunTransitionCommand> = {},
): CommitRunTransitionCommand {
  const command = {
    runId: 'conf-run-1',
    expectedRecordRevision: 1,
    expectedNextEventSeq: 1,
    next: { currentNodeId: 'n1' },
    events: [],
    timestamp: 1_100,
    ...overrides,
  };
  return {
    ...command,
    events: command.events.map((event) => ({ ...event, runId: command.runId })),
  } as CommitRunTransitionCommand;
}

const SAFE_ERROR: VictError = {
  code: 'VICT_RUNTIME_CAPABILITY_THREW',
  message: 'Capability threw during invocation; the thrown message is not retained.',
  details: { errorName: 'Error', errorId: 'err_conf-1' },
};

const SECRET_CANARY = 'conf-canary-9d1c2-secret';

function rejectsWithCode(
  expect: ConformanceExpect,
  promise: Promise<unknown>,
  code: string,
): Promise<void> {
  return expect(promise).rejects.toMatchObject({ code });
}

/** Publish the fixture activation: runs must reference a published activation (RUN-001). */
async function publishFixture(s: VictStores): Promise<void> {
  await s.catalog.publish({ manifest: GRAPH_A, canonicalManifest: toCanonicalJson(GRAPH_A) });
}

/** Build and run the conformance suite against one backend factory. */
export function runStoreConformanceSuite(
  runner: ConformanceTestRunner,
  factory: StoreConformanceFactory,
): void {
  const { test, expect } = runner;

  test(`[${factory.name}] activation publish/read round-trips immutably`, async () => {
    const s = await factory.create();
    try {
      const result = await s.catalog.publish({
        manifest: GRAPH_A,
        canonicalManifest: toCanonicalJson(GRAPH_A),
      });
      expect(result.created).toBe(true);
      const stored = await s.catalog.get(GRAPH_A.activationVersion);
      expect(stored).toBeDefined();
      expect(stored?.canonicalManifest).toBe(toCanonicalJson(GRAPH_A));
      expect(stored?.graphId).toBe(GRAPH_A.graphId);
      expect(Object.isFrozen(stored)).toBe(true);
      expect((await s.catalog.list()).length).toBe(1);
    } finally {
      await s.dispose();
    }
  });

  test(`[${factory.name}] equivalent republish is idempotent`, async () => {
    const s = await factory.create();
    try {
      const first = await s.catalog.publish({
        manifest: GRAPH_A,
        canonicalManifest: toCanonicalJson(GRAPH_A),
      });
      const second = await s.catalog.publish({
        manifest: GRAPH_A,
        canonicalManifest: toCanonicalJson(GRAPH_A),
      });
      expect(first.created).toBe(true);
      expect(second.created).toBe(false);
      expect((await s.catalog.list()).length).toBe(1);
    } finally {
      await s.dispose();
    }
  });

  test(`[${factory.name}] same version with different content is rejected as a collision`, async () => {
    const s = await factory.create();
    try {
      await s.catalog.publish({ manifest: GRAPH_A, canonicalManifest: toCanonicalJson(GRAPH_A) });
      const tamperedBinding = GRAPH_A.bindings[0] as ActivationManifestBinding;
      const tampered: ActivationManifest = {
        ...GRAPH_A,
        bindings: [
          {
            capability: tamperedBinding.capability,
            revision: '2',
            effect: tamperedBinding.effect,
            input: tamperedBinding.input,
            output: tamperedBinding.output,
          },
        ],
      };
      await rejectsWithCode(
        expect,
        s.catalog.publish({
          manifest: tampered,
          canonicalManifest: toCanonicalJson(tampered),
        }),
        'VICT_STORE_ACTIVATION_COLLISION',
      );
    } finally {
      await s.dispose();
    }
  });

  test(`[${factory.name}] selection uses optimistic concurrency`, async () => {
    const s = await factory.create();
    try {
      await s.catalog.publish({ manifest: GRAPH_A, canonicalManifest: toCanonicalJson(GRAPH_A) });
      await s.catalog.publish({
        manifest: GRAPH_A_V2,
        canonicalManifest: toCanonicalJson(GRAPH_A_V2),
      });
      // A valid activation of ANOTHER graph, for the cross-graph rejection below.
      await s.catalog.publish({ manifest: GRAPH_B, canonicalManifest: toCanonicalJson(GRAPH_B) });
      const first = await s.catalog.select({
        graphId: GRAPH_A.graphId,
        activationVersion: GRAPH_A.activationVersion,
      });
      expect(first.selectionRevision).toBe(1);
      // Select the successor activation of the SAME graph.
      const second = await s.catalog.select({
        graphId: GRAPH_A.graphId,
        activationVersion: GRAPH_A_V2.activationVersion,
      });
      expect(second.selectionRevision).toBe(2);
      // An activation of a DIFFERENT graph cannot be selected for this one.
      await rejectsWithCode(
        expect,
        s.catalog.select({
          graphId: GRAPH_A.graphId,
          activationVersion: GRAPH_B.activationVersion,
        }),
        'VICT_STORE_ACTIVATION_MISMATCH',
      );
      // Stale writer loses.
      await rejectsWithCode(
        expect,
        s.catalog.select({
          graphId: GRAPH_A.graphId,
          activationVersion: GRAPH_A.activationVersion,
          expectedSelectionRevision: 1,
        }),
        'VICT_STORE_SELECTION_CONFLICT',
      );
      // Current writer wins.
      const third = await s.catalog.select({
        graphId: GRAPH_A.graphId,
        activationVersion: GRAPH_A.activationVersion,
        expectedSelectionRevision: 2,
      });
      expect(third.selectionRevision).toBe(3);
      expect((await s.catalog.getSelected(GRAPH_A.graphId))?.activationVersion).toBe(
        GRAPH_A.activationVersion,
      );
    } finally {
      await s.dispose();
    }
  });

  test(`[${factory.name}] publishAndSelect is atomic and idempotent for equivalent content`, async () => {
    const s = await factory.create();
    try {
      const first = await s.catalog.publishAndSelect({
        publish: { manifest: GRAPH_A, canonicalManifest: toCanonicalJson(GRAPH_A) },
        select: { graphId: GRAPH_A.graphId },
      });
      expect(first.created).toBe(true);
      const second = await s.catalog.publishAndSelect({
        publish: { manifest: GRAPH_A, canonicalManifest: toCanonicalJson(GRAPH_A) },
        select: { graphId: GRAPH_A.graphId },
      });
      expect(second.created).toBe(false);
      expect(second.selection.selectionRevision).toBe(2);
      expect((await s.catalog.list()).length).toBe(1);
    } finally {
      await s.dispose();
    }
  });

  test(`[${factory.name}] createRun plus initial event is atomic`, async () => {
    const s = await factory.create();
    try {
      await s.catalog.publish({ manifest: GRAPH_A, canonicalManifest: toCanonicalJson(GRAPH_A) });
      const run = await s.execution.createRun(createCommand());
      expect(run.status).toBe('running');
      expect(run.recordRevision).toBe(1);
      const events = await s.execution.listEvents('conf-run-1');
      expect(events.length).toBe(1);
      expect(events[0]?.type).toBe('run.started');
      // Duplicate run id is a conflict, not an overwrite.
      await rejectsWithCode(
        expect,
        s.execution.createRun(createCommand()),
        'VICT_STORE_RUN_CONFLICT',
      );
    } finally {
      await s.dispose();
    }
  });

  test(`[${factory.name}] transition plus event batch is atomic; stale revisions lose`, async () => {
    const s = await factory.create();
    try {
      await publishFixture(s);
      await s.execution.createRun(createCommand());
      const updated = await s.execution.commitTransition(
        transitionCommand({
          expectedRecordRevision: 1,
          expectedNextEventSeq: 1,
          next: { currentNodeId: 'n2', steps: 1 },
          events: [makeEvent(1, 'node.started', { nodeId: 'n2', capabilityId: 'cap.a' })],
        }),
      );
      expect(updated.recordRevision).toBe(2);
      expect(updated.currentNodeId).toBe('n2');
      // Stale revision (same transition replayed) is rejected.
      await rejectsWithCode(
        expect,
        s.execution.commitTransition(
          transitionCommand({
            expectedRecordRevision: 1,
            expectedNextEventSeq: 2,
            events: [makeEvent(2, 'node.completed', { nodeId: 'n2', capabilityId: 'cap.a' })],
          }),
        ),
        'VICT_STORE_RUN_CONFLICT',
      );
      // Wrong event sequence is a conflict, and nothing is appended.
      await rejectsWithCode(
        expect,
        s.execution.commitTransition(
          transitionCommand({
            expectedRecordRevision: 2,
            expectedNextEventSeq: 3,
            events: [makeEvent(2, 'node.completed', { nodeId: 'n2', capabilityId: 'cap.a' })],
          }),
        ),
        'VICT_STORE_EVENT_SEQUENCE_CONFLICT',
      );
      expect((await s.execution.listEvents('conf-run-1')).length).toBe(2);
    } finally {
      await s.dispose();
    }
  });

  test(`[${factory.name}] completed, failed, and blocked records round-trip`, async () => {
    const s = await factory.create();
    try {
      const statuses: Array<{
        status: StoredRun['status'];
        error?: VictError;
        event: KernelEvent['type'];
      }> = [
        { status: 'completed', event: 'run.completed' },
        { status: 'failed', error: SAFE_ERROR, event: 'run.failed' },
        { status: 'blocked', event: 'run.blocked' },
      ];
      for (const [index, target] of statuses.entries()) {
        const runId = `conf-run-${index}`;
        await publishFixture(s);
        await s.execution.createRun(createCommand({ runId }));
        const terminal = await s.execution.commitTransition(
          transitionCommand({
            runId,
            expectedRecordRevision: 1,
            expectedNextEventSeq: 1,
            next: {
              status: target.status,
              steps: 3,
              completedAt: 2_000,
              ...(target.error ? { error: target.error } : {}),
            },
            events: [
              makeEvent(
                1,
                target.event,
                {
                  steps: 3,
                  ...(target.error ? { error: target.error } : {}),
                  ...(target.status === 'completed'
                    ? { output: { shape: 'object', keys: [] } }
                    : {}),
                  ...(target.status === 'blocked' ? { reason: 'r', remediation: 'm' } : {}),
                },
                runId,
              ),
            ],
          }),
        );
        expect(terminal.status).toBe(target.status);
        const read = await s.execution.getRun(runId);
        expect(read?.status).toBe(target.status);
        expect(read?.completedAt).toBe(2_000);
        if (target.error) {
          expect(read?.error?.code).toBe(SAFE_ERROR.code);
          expect(JSON.stringify(read).includes(SECRET_CANARY)).toBe(false);
        }
        // Terminal runs reject further transitions.
        await rejectsWithCode(
          expect,
          s.execution.commitTransition(
            transitionCommand({ runId, expectedRecordRevision: 2, expectedNextEventSeq: 2 }),
          ),
          'VICT_STORE_RUN_CONFLICT',
        );
      }
    } finally {
      await s.dispose();
    }
  });

  test(`[${factory.name}] retention shapes: none, summary, full`, async () => {
    const s = await factory.create();
    try {
      const output = { public: 'value', secretNote: SECRET_CANARY };
      // none: no summary, no output.
      await publishFixture(s);
      await s.execution.createRun(createCommand({ runId: 'r-none', retention: 'none' }));
      const none = await s.execution.commitTransition(
        transitionCommand({
          runId: 'r-none',
          expectedRecordRevision: 1,
          expectedNextEventSeq: 1,
          next: { status: 'completed', steps: 1, completedAt: 2_000 },
          events: [
            makeEvent(1, 'run.completed', {
              steps: 1,
              output: { shape: 'object', keys: ['public'] },
            }),
          ],
        }),
      );
      expect('output' in none).toBe(false);
      expect('outputSummary' in none).toBe(false);
      // summary: summary only; no canary value anywhere.
      await publishFixture(s);
      await s.execution.createRun(createCommand({ runId: 'r-summary', retention: 'summary' }));
      const summary = await s.execution.commitTransition(
        transitionCommand({
          runId: 'r-summary',
          expectedRecordRevision: 1,
          expectedNextEventSeq: 1,
          next: {
            status: 'completed',
            steps: 1,
            completedAt: 2_000,
            outputSummary: { shape: 'object', keys: ['public', '[redacted]'] },
          },
          events: [
            makeEvent(1, 'run.completed', {
              steps: 1,
              output: { shape: 'object', keys: ['public'] },
            }),
          ],
        }),
      );
      expect(summary.outputSummary).toEqual({ shape: 'object', keys: ['public', '[redacted]'] });
      expect(JSON.stringify(summary).includes(SECRET_CANARY)).toBe(false);
      // full: complete output stored by explicit configuration.
      await publishFixture(s);
      await s.execution.createRun(createCommand({ runId: 'r-full', retention: 'full' }));
      const full = await s.execution.commitTransition(
        transitionCommand({
          runId: 'r-full',
          expectedRecordRevision: 1,
          expectedNextEventSeq: 1,
          next: {
            status: 'completed',
            steps: 1,
            completedAt: 2_000,
            outputSummary: { shape: 'object', keys: ['public'] },
            output,
          },
          events: [
            makeEvent(1, 'run.completed', {
              steps: 1,
              output: { shape: 'object', keys: ['public'] },
            }),
          ],
        }),
      );
      expect(full.output).toEqual(output);
      // Inputs are never part of the record shape at all.
      expect('input' in full).toBe(false);
      expect('input' in none).toBe(false);
    } finally {
      await s.dispose();
    }
  });

  test(`[${factory.name}] safe errors round-trip without raw causes`, async () => {
    const s = await factory.create();
    try {
      await publishFixture(s);
      await s.execution.createRun(createCommand({ runId: 'r-err', retention: 'summary' }));
      const failed = await s.execution.commitTransition(
        transitionCommand({
          runId: 'r-err',
          expectedRecordRevision: 1,
          expectedNextEventSeq: 1,
          next: { status: 'failed', steps: 2, completedAt: 2_000, error: SAFE_ERROR },
          events: [makeEvent(1, 'run.failed', { steps: 2, error: SAFE_ERROR })],
        }),
      );
      const serialized = JSON.stringify(failed);
      expect(serialized.includes('VICT_RUNTIME_CAPABILITY_THREW')).toBe(true);
      // A store never invents driver detail into stored errors.
      expect(serialized.includes('driverCause')).toBe(false);
      expect(serialized.includes(SECRET_CANARY)).toBe(false);
    } finally {
      await s.dispose();
    }
  });

  test(`[${factory.name}] events are dense, append-only, and explicitly ordered`, async () => {
    const s = await factory.create();
    try {
      await publishFixture(s);
      await s.execution.createRun(createCommand());
      let seq = 1;
      let revision = 1;
      for (const type of ['node.started', 'node.completed', 'signal.routed'] as const) {
        await s.execution.commitTransition(
          transitionCommand({
            expectedRecordRevision: revision,
            expectedNextEventSeq: seq,
            events: [makeEvent(seq, type, { nodeId: 'n1', capabilityId: 'cap.a' })],
          }),
        );
        revision += 1;
        seq += 1;
      }
      const events = await s.execution.listEvents('conf-run-1');
      expect(events.map((event) => event.seq)).toEqual([0, 1, 2, 3]);
      // Ordered reads after a cursor.
      const tail = await s.execution.listEvents('conf-run-1', 2);
      expect(tail.map((event) => event.seq)).toEqual([3]);
      // Frozen snapshots.
      expect(Object.isFrozen(events[0])).toBe(true);
    } finally {
      await s.dispose();
    }
  });

  test(`[${factory.name}] returned records cannot mutate stored state`, async () => {
    const s = await factory.create();
    try {
      await publishFixture(s);
      await s.execution.createRun(createCommand());
      const run = await s.execution.getRun('conf-run-1');
      expect(run).toBeDefined();
      // Attempts to mutate the returned snapshot must not affect the store.
      const mutate = async (): Promise<void> => {
        const record = (await s.execution.getRun('conf-run-1')) as {
          status: string;
        };
        record.status = 'completed';
      };
      // Frozen records throw in strict mode; either way the store is unchanged.
      try {
        await mutate();
      } catch {
        /* expected for frozen snapshots */
      }
      expect((await s.execution.getRun('conf-run-1'))?.status).toBe('running');
    } finally {
      await s.dispose();
    }
  });

  test(`[${factory.name}] recover-interrupted is idempotent and preserves identity`, async () => {
    const s = await factory.create();
    try {
      await publishFixture(s);
      await s.execution.createRun(createCommand());
      const first = await s.execution.recoverInterruptedRuns({
        code: 'VICT_RUN_INTERRUPTED_BY_RESTART',
        reason: 'process ended',
        remediation: 'start a new run',
        timestamp: 5_000,
      });
      expect(first.scanned).toBe(1);
      expect(first.blocked.length).toBe(1);
      expect(first.blocked[0]?.activationVersion).toBe(GRAPH_A.activationVersion);
      expect(first.blocked[0]?.eventSeq).toBe(1);
      const run = await s.execution.getRun('conf-run-1');
      expect(run?.status).toBe('blocked');
      // Idempotent: the second recovery finds nothing and appends nothing.
      const second = await s.execution.recoverInterruptedRuns({
        code: 'VICT_RUN_INTERRUPTED_BY_RESTART',
        reason: 'process ended',
        remediation: 'start a new run',
        timestamp: 6_000,
      });
      expect(second.scanned).toBe(0);
      expect(second.blocked.length).toBe(0);
      const events = await s.execution.listEvents('conf-run-1');
      expect(events.length).toBe(2);
      const blockedEvent = events.at(-1);
      expect(blockedEvent?.type).toBe('run.blocked');
      const payload = JSON.parse(blockedEvent?.payload ?? '{}') as { code?: string };
      expect(payload.code).toBe('VICT_RUN_INTERRUPTED_BY_RESTART');
    } finally {
      await s.dispose();
    }
  });

  test(`[${factory.name}] unknown and malformed records fail safely`, async () => {
    const s = await factory.create();
    try {
      expect(await s.execution.getRun('ghost')).toBeUndefined();
      expect(await s.catalog.get('ghost')).toBeUndefined();
      expect(await s.catalog.getSelection('ghost')).toBeUndefined();
      await rejectsWithCode(expect, s.execution.listEvents('ghost'), 'VICT_STORE_RUN_NOT_FOUND');
      await rejectsWithCode(
        expect,
        s.execution.commitTransition(transitionCommand()),
        'VICT_STORE_RUN_NOT_FOUND',
      );
      await rejectsWithCode(
        expect,
        s.execution.createRun(createCommand({ mode: 'bogus' as 'normal' })),
        'VICT_STORE_INVALID_COMMAND',
      );
      await rejectsWithCode(
        expect,
        s.execution.createRun(createCommand({ retention: 'everything' as 'full' })),
        'VICT_STORE_INVALID_COMMAND',
      );
    } finally {
      await s.dispose();
    }
  });

  test(`[${factory.name}] event schema versions are recorded`, async () => {
    const s = await factory.create();
    try {
      await publishFixture(s);
      await s.execution.createRun(createCommand());
      const events = await s.execution.listEvents('conf-run-1');
      expect(events[0]?.eventSchema).toBe(RUN_EVENT_SCHEMA);
    } finally {
      await s.dispose();
    }
  });

  test(`[${factory.name}] expectedNextEventSeq must equal the actual stored next sequence`, async () => {
    const s = await factory.create();
    try {
      await publishFixture(s);
      await s.execution.createRun(createCommand());
      const events = await s.execution.listEvents('conf-run-1');
      expect(events.length).toBe(1);
      // The stored history ends at seq 0; an expectation of 5 with a
      // matching event seq must be rejected against ACTUAL stored history.
      await rejectsWithCode(
        expect,
        s.execution.commitTransition(
          transitionCommand({
            expectedRecordRevision: 1,
            expectedNextEventSeq: 5,
            events: [makeEvent(5, 'node.completed', { nodeId: 'n1', capabilityId: 'cap.a' })],
          }),
        ),
        'VICT_STORE_EVENT_SEQUENCE_CONFLICT',
      );
      // A stale expectation is equally rejected.
      await rejectsWithCode(
        expect,
        s.execution.commitTransition(
          transitionCommand({
            expectedRecordRevision: 1,
            expectedNextEventSeq: 0,
            events: [makeEvent(0, 'node.completed', { nodeId: 'n1', capabilityId: 'cap.a' })],
          }),
        ),
        'VICT_STORE_EVENT_SEQUENCE_CONFLICT',
      );
      // Rollback proof: revision and history are untouched.
      const run = await s.execution.getRun('conf-run-1');
      expect(run?.recordRevision).toBe(1);
      expect((await s.execution.listEvents('conf-run-1')).length).toBe(1);
      // The correct expectation succeeds.
      await s.execution.commitTransition(
        transitionCommand({
          expectedRecordRevision: 1,
          expectedNextEventSeq: 1,
          events: [makeEvent(1, 'node.completed', { nodeId: 'n1', capabilityId: 'cap.a' })],
        }),
      );
      expect((await s.execution.listEvents('conf-run-1')).length).toBe(2);
    } finally {
      await s.dispose();
    }
  });

  test(`[${factory.name}] createRun accepts only a dense initial batch beginning at zero`, async () => {
    const s = await factory.create();
    try {
      await publishFixture(s);
      // Batch starting at 1: rejected.
      await rejectsWithCode(
        expect,
        s.execution.createRun(
          createCommand({ runId: 'r-gap1', events: [makeEvent(1, 'run.started', {}, 'r-gap1')] }),
        ),
        'VICT_STORE_EVENT_SEQUENCE_CONFLICT',
      );
      // Dense prefix then gap [0, 2]: rejected.
      await rejectsWithCode(
        expect,
        s.execution.createRun(
          createCommand({
            runId: 'r-gap2',
            events: [
              makeEvent(0, 'run.started', {}, 'r-gap2'),
              makeEvent(2, 'node.started', { nodeId: 'n1', capabilityId: 'cap.a' }, 'r-gap2'),
            ],
          }),
        ),
        'VICT_STORE_EVENT_SEQUENCE_CONFLICT',
      );
      // No partial runs or events were left behind.
      expect(await s.execution.getRun('r-gap1')).toBeUndefined();
      expect(await s.execution.getRun('r-gap2')).toBeUndefined();
      // A dense batch from zero is accepted.
      await s.execution.createRun(
        createCommand({
          runId: 'r-dense',
          events: [
            makeEvent(0, 'run.started', {}, 'r-dense'),
            makeEvent(1, 'node.started', { nodeId: 'n1', capabilityId: 'cap.a' }, 'r-dense'),
          ],
        }),
      );
      expect((await s.execution.listEvents('r-dense')).map((event) => event.seq)).toEqual([0, 1]);
    } finally {
      await s.dispose();
    }
  });

  test(`[${factory.name}] publish rejects canonical content that is not the manifest's canonical form`, async () => {
    const s = await factory.create();
    try {
      // Top-level identifiers look valid, but the canonical string does not
      // correspond to the supplied manifest content.
      const tampered = { ...GRAPH_A, graphVersion: 'v1_graph-a' } as ActivationManifest;
      await rejectsWithCode(
        expect,
        s.catalog.publish({ manifest: tampered, canonicalManifest: '{"tampered":true}' }),
        'VICT_STORE_ACTIVATION_MISMATCH',
      );
      // Canonical string of a DIFFERENT manifest: rejected.
      await rejectsWithCode(
        expect,
        s.catalog.publish({
          manifest: GRAPH_A,
          canonicalManifest: toCanonicalJson(GRAPH_B),
        }),
        'VICT_STORE_ACTIVATION_MISMATCH',
      );
      expect((await s.catalog.list()).length).toBe(0);
    } finally {
      await s.dispose();
    }
  });

  test(`[${factory.name}] publish rejects identities that do not recompute from content`, async () => {
    const s = await factory.create();
    try {
      // The manifest is internally consistent JSON (canonical string
      // matches), the columns agree — but the graph CONTENT was tampered
      // with while keeping the original identity strings. The canonical
      // identity functions must catch it.
      const forgedGraph = {
        schema: 'vict.graph@1',
        id: 'conf-graph-a',
        entry: 'n1',
        nodes: [{ id: 'n1', capability: 'cap.OTHER', input: null, output: null }],
        edges: [],
      };
      const forged = { ...GRAPH_A, graph: forgedGraph };
      await rejectsWithCode(
        expect,
        s.catalog.publish({ manifest: forged, canonicalManifest: toCanonicalJson(forged) }),
        'VICT_STORE_ACTIVATION_MISMATCH',
      );
      // Same trick for bindings: keep the capabilitySetVersion string, swap
      // the binding revision.
      const forgedBindings = {
        ...GRAPH_A,
        bindings: [
          {
            capability: 'cap.a',
            revision: '999',
            effect: 'pure' as const,
            input: null,
            output: null,
          },
        ],
      };
      await rejectsWithCode(
        expect,
        s.catalog.publish({
          manifest: forgedBindings,
          canonicalManifest: toCanonicalJson(forgedBindings),
        }),
        'VICT_STORE_ACTIVATION_MISMATCH',
      );
      expect((await s.catalog.list()).length).toBe(0);
    } finally {
      await s.dispose();
    }
  });

  test(`[${factory.name}] selection requires the activation to belong to the graph`, async () => {
    const s = await factory.create();
    try {
      await s.catalog.publish({ manifest: GRAPH_A, canonicalManifest: toCanonicalJson(GRAPH_A) });
      await rejectsWithCode(
        expect,
        s.catalog.select({
          graphId: GRAPH_B.graphId,
          activationVersion: GRAPH_A.activationVersion,
        }),
        'VICT_STORE_ACTIVATION_MISMATCH',
      );
      expect(await s.catalog.getSelection(GRAPH_B.graphId)).toBeUndefined();
    } finally {
      await s.dispose();
    }
  });

  test(`[${factory.name}] createRun requires a coherent published activation identity`, async () => {
    const s = await factory.create();
    try {
      await publishFixture(s);
      // Wrong graph id.
      await rejectsWithCode(
        expect,
        s.execution.createRun(createCommand({ runId: 'r-id1', graphId: 'conf-graph-OTHER' })),
        'VICT_STORE_ACTIVATION_MISMATCH',
      );
      // Wrong graph version.
      await rejectsWithCode(
        expect,
        s.execution.createRun(createCommand({ runId: 'r-id2', graphVersion: 'v1_graph-a-OTHER' })),
        'VICT_STORE_ACTIVATION_MISMATCH',
      );
      // Wrong capability-set version.
      await rejectsWithCode(
        expect,
        s.execution.createRun(
          createCommand({ runId: 'r-id3', capabilitySetVersion: 'v1_capset-a-OTHER' }),
        ),
        'VICT_STORE_ACTIVATION_MISMATCH',
      );
      // No partial runs were created.
      for (const runId of ['r-id1', 'r-id2', 'r-id3']) {
        expect(await s.execution.getRun(runId)).toBeUndefined();
      }
    } finally {
      await s.dispose();
    }
  });

  test(`[${factory.name}] appended events must carry the stored run's identity`, async () => {
    const s = await factory.create();
    try {
      await publishFixture(s);
      await s.execution.createRun(createCommand());
      for (const [field, value] of [
        ['graphId', 'conf-graph-OTHER'],
        ['graphVersion', 'v1_graph-a-OTHER'],
        ['capabilitySetVersion', 'v1_capset-a-OTHER'],
        ['activationVersion', 'v1_act-a-OTHER'],
      ] as const) {
        const event = makeEvent(1, 'node.started', { nodeId: 'n1', capabilityId: 'cap.a' });
        await rejectsWithCode(
          expect,
          s.execution.commitTransition(
            transitionCommand({
              expectedRecordRevision: 1,
              expectedNextEventSeq: 1,
              events: [{ ...event, [field]: value } as KernelEvent],
            }),
          ),
          'VICT_STORE_INVALID_COMMAND',
        );
      }
      // Every rejection left no partial state.
      expect((await s.execution.getRun('conf-run-1'))?.recordRevision).toBe(1);
      expect((await s.execution.listEvents('conf-run-1')).length).toBe(1);
    } finally {
      await s.dispose();
    }
  });

  test(`[${factory.name}] publishAndSelect failure leaves catalog and selection untouched`, async () => {
    const s = await factory.create();
    try {
      // Establish an unrelated selection so revision 0 is stale.
      await s.catalog.publish({ manifest: GRAPH_B, canonicalManifest: toCanonicalJson(GRAPH_B) });
      await s.catalog.select({
        graphId: GRAPH_B.graphId,
        activationVersion: GRAPH_B.activationVersion,
      });
      // Publish a previously ABSENT activation with a stale selection
      // revision: the whole operation must fail atomically.
      await rejectsWithCode(
        expect,
        s.catalog.publishAndSelect({
          publish: { manifest: GRAPH_A, canonicalManifest: toCanonicalJson(GRAPH_A) },
          select: { graphId: GRAPH_A.graphId, expectedSelectionRevision: 999 },
        }),
        'VICT_STORE_SELECTION_CONFLICT',
      );
      // The activation was NOT left behind.
      expect(await s.catalog.get(GRAPH_A.activationVersion)).toBeUndefined();
      expect((await s.catalog.list()).length).toBe(1);
      expect(await s.catalog.getSelection(GRAPH_A.graphId)).toBeUndefined();
    } finally {
      await s.dispose();
    }
  });

  test(`[${factory.name}] publishAndSelect honors the selection revision guard`, async () => {
    const s = await factory.create();
    try {
      const first = await s.catalog.publishAndSelect({
        publish: { manifest: GRAPH_A, canonicalManifest: toCanonicalJson(GRAPH_A) },
        select: { graphId: GRAPH_A.graphId },
      });
      expect(first.selection.selectionRevision).toBe(1);
      // Stale guard (0) fails; nothing changes.
      await rejectsWithCode(
        expect,
        s.catalog.publishAndSelect({
          publish: { manifest: GRAPH_A, canonicalManifest: toCanonicalJson(GRAPH_A) },
          select: { graphId: GRAPH_A.graphId, expectedSelectionRevision: 0 },
        }),
        'VICT_STORE_SELECTION_CONFLICT',
      );
      expect((await s.catalog.getSelection(GRAPH_A.graphId))?.selectionRevision).toBe(1);
      // Current guard succeeds.
      const again = await s.catalog.publishAndSelect({
        publish: { manifest: GRAPH_A, canonicalManifest: toCanonicalJson(GRAPH_A) },
        select: { graphId: GRAPH_A.graphId, expectedSelectionRevision: 1 },
      });
      expect(again.selection.selectionRevision).toBe(2);
      expect(again.created).toBe(false);
    } finally {
      await s.dispose();
    }
  });

  test(`[${factory.name}] strict persisted-value domain: full-retention output cannot be silently altered`, async () => {
    const s = await factory.create();
    try {
      await publishFixture(s);
      await s.execution.createRun(createCommand({ runId: 'r-strict', retention: 'full' }));
      // A Map collapses to {} under JSON.stringify — must be rejected.
      await rejectsWithCode(
        expect,
        s.execution.commitTransition(
          transitionCommand({
            runId: 'r-strict',
            expectedRecordRevision: 1,
            expectedNextEventSeq: 1,
            next: {
              status: 'completed',
              steps: 1,
              completedAt: 2_000,
              output: { plain: 1, sneaky: new Map([['secret', 'value']]) },
            },
            events: [makeEvent(1, 'run.completed', { steps: 1 }, 'r-strict')],
          }),
        ),
        'VICT_STORE_INVALID_COMMAND',
      );
      // Explicit undefined in objects and arrays: rejected.
      // NOTE: an absent/undefined `output` means 'no output' at the port
      // level (the field is optional), so it is not in the rejected set;
      // carrying `undefined` INSIDE an object or array is rejected.
      for (const bad of [{ x: undefined }, [undefined], new Set([1]), Symbol('s')]) {
        await rejectsWithCode(
          expect,
          s.execution.commitTransition(
            transitionCommand({
              runId: 'r-strict',
              expectedRecordRevision: 1,
              expectedNextEventSeq: 1,
              next: { status: 'completed', steps: 1, completedAt: 2_000, output: bad },
              events: [makeEvent(1, 'run.completed', { steps: 1 }, 'r-strict')],
            }),
          ),
          'VICT_STORE_INVALID_COMMAND',
        );
      }
      // No partial mutation: still running at revision 1 with one event.
      const run = await s.execution.getRun('r-strict');
      expect(run?.status).toBe('running');
      expect(run?.recordRevision).toBe(1);
      expect((await s.execution.listEvents('r-strict')).length).toBe(1);
      // A plain, in-domain output is accepted and round-trips.
      const completed = await s.execution.commitTransition(
        transitionCommand({
          runId: 'r-strict',
          expectedRecordRevision: 1,
          expectedNextEventSeq: 1,
          next: {
            status: 'completed',
            steps: 1,
            completedAt: 2_000,
            output: { plain: 1, nested: { b: 2, a: 1 }, when: new Date(1_500) },
          },
          events: [makeEvent(1, 'run.completed', { steps: 1 }, 'r-strict')],
        }),
      );
      expect(completed.output).toEqual({
        plain: 1,
        nested: { b: 2, a: 1 },
        when: '1970-01-01T00:00:01.500Z',
      });
    } finally {
      await s.dispose();
    }
  });

  test(`[${factory.name}] fault between run update and event append leaves no half-state`, async () => {
    const s = await factory.create();
    try {
      if (!s.faults) {
        // Backend does not expose fault hooks; atomicity is still covered by
        // the sequence-conflict and terminal-conflict cases above.
        return;
      }
      await publishFixture(s);
      await s.execution.createRun(createCommand());
      const faults = s.faults as TransitionFaultHooks;
      faults.afterRunUpdate = () => {
        throw new Error('injected failure after run update');
      };
      await rejectsWithCode(
        expect,
        s.execution.commitTransition(
          transitionCommand({
            expectedRecordRevision: 1,
            expectedNextEventSeq: 1,
            next: { status: 'completed', steps: 1, completedAt: 9_999 },
            events: [makeEvent(1, 'run.completed', { steps: 1 })],
          }),
        ),
        'VICT_STORE_UNAVAILABLE',
      );
      // No half-state: the run is still running at revision 1 with one event.
      const run = await s.execution.getRun('conf-run-1');
      expect(run?.status).toBe('running');
      expect(run?.recordRevision).toBe(1);
      expect((await s.execution.listEvents('conf-run-1')).length).toBe(1);
    } finally {
      const faults = s.faults as TransitionFaultHooks | undefined;
      if (faults) {
        faults.afterRunUpdate = undefined;
      }
      await s.dispose();
    }
  });
}
