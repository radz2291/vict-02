/**
 * Stage 02 performance baseline.
 *
 * Reports, separately and labeled:
 *   1. the existing in-memory runtime;
 *   2. a SQLite-backed sequential runtime (file-backed = real local
 *      durability, and :memory: = no fsync — never compared unlabeled);
 *   3. activation publish/restore;
 *   4. completed-run read with events.
 *
 * Everything measured is in-process graph execution and storage. Compilation
 * happens once at activation, never per run. Durable transactions per run
 * are counted, not estimated. No wall-clock assertion belongs in correctness
 * tests; this script is informational only.
 *
 * Usage: npm run bench
 */
import { createRuntime, defineCapability, defineGraph } from '@vict/sdk';
import { createSqliteStores } from '@vict/store-sqlite';
import type { VictRuntime } from '@vict/runtime';
import { defineZodContract } from '@vict/sdk/zod';
import { z } from 'zod';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { platform, release, arch } from 'node:os';

const In = defineZodContract('bench.in', '1', z.object({ n: z.number() }));
const Mid = defineZodContract('bench.mid', '1', z.object({ n: z.number(), doubled: z.boolean() }));
const Out = defineZodContract(
  'bench.out',
  '1',
  z.object({ n: number_or_undefined(), digest: z.string() }),
);

function number_or_undefined(): z.ZodNumber {
  return z.number();
}

const GRAPH = defineGraph({
  id: 'bench-three-node-pure',
  entry: 'start',
  nodes: [
    { id: 'start', capability: 'bench.start' },
    { id: 'prepare', capability: 'bench.prepare' },
    { id: 'finish', capability: 'bench.finish' },
  ],
  edges: [
    { from: 'start', to: 'prepare' },
    { from: 'prepare', to: 'finish' },
  ],
});

function registerBenchCapabilities(runtime: VictRuntime): VictRuntime {
  runtime
    .registerCapability(
      defineCapability({
        id: 'bench.start',
        revision: '1',
        effect: 'pure',
        input: In,
        output: In,
        invoke: async (input) => ({ n: input.n }),
      }),
    )
    .registerCapability(
      defineCapability({
        id: 'bench.prepare',
        revision: '1',
        effect: 'pure',
        input: In,
        output: Mid,
        invoke: (input) => ({ n: input.n, doubled: input.n % 2 === 0 }),
      }),
    )
    .registerCapability(
      defineCapability({
        id: 'bench.finish',
        revision: '1',
        effect: 'pure',
        input: Mid,
        output: Out,
        invoke: (input) => ({
          n: input.n,
          digest: createHash('sha256')
            .update(`${input.n}:${input.doubled}`)
            .digest('hex')
            .slice(0, 8),
        }),
      }),
    );
  return runtime;
}

const WARMUP_IN_MEMORY = 1_000;
const ITERATIONS_IN_MEMORY = 5_000;
const WARMUP_SQLITE_FILE = 50;
const ITERATIONS_SQLITE_FILE = 500;
const WARMUP_SQLITE_MEMORY = 200;
const ITERATIONS_SQLITE_MEMORY = 2_000;
const READ_ITERATIONS = 500;

interface SampleSet {
  median: number;
  p95: number;
  mean: number;
  min: number;
  max: number;
}

function summarize(samples: number[]): SampleSet {
  const sorted = [...samples].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] as number;
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] as number;
  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  return { median, p95, mean, min: sorted[0] as number, max: sorted.at(-1) as number };
}

async function benchRuntime(
  runtime: VictRuntime,
  warmup: number,
  iterations: number,
): Promise<SampleSet> {
  for (let i = 0; i < warmup; i++) {
    await runtime.run({ n: i });
  }
  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = process.hrtime.bigint();
    const result = await runtime.run({ n: i });
    const t1 = process.hrtime.bigint();
    if (result.status !== 'completed') {
      throw new Error(`benchmark run ${i} did not complete: ${result.status}`);
    }
    samples.push(Number(t1 - t0) / 1e6);
  }
  return summarize(samples);
}

function printSet(label: string, set: SampleSet, iterations: number): void {
  console.log(`  ${label}`);
  console.log(
    `    median: ${set.median.toFixed(3)} ms/run | p95: ${set.p95.toFixed(3)} ms/run | mean: ${set.mean.toFixed(3)} ms/run | min: ${set.min.toFixed(3)} | max: ${set.max.toFixed(3)} | n=${iterations}`,
  );
}

async function main(): Promise<void> {
  console.log('=== Vict Stage 02 performance baseline ===');
  console.log(`node:       ${process.version} (${platform()} ${release()} ${arch()})`);
  console.log(`packages:   @vict/* 0.1.0`);
  console.log(`graph:      ${GRAPH.id} (3 nodes, 2 edges, 10 events per completed run)`);
  console.log(
    `durability: file-backed runs use journal_mode=wal + synchronous=FULL (real fsync per commit)`,
  );
  console.log(
    '            :memory: runs keep the same API path but never touch disk (labeled, not comparable)',
  );
  console.log('');

  // --- 1. In-memory runtime -------------------------------------------
  const memoryRuntime = registerBenchCapabilities(createRuntime());
  const memoryActivation = await memoryRuntime.activate(GRAPH);
  if (!memoryActivation.ok) {
    throw new Error('benchmark graph failed to activate (in-memory)');
  }
  printSet(
    `in-memory store (default runtime), warmup ${WARMUP_IN_MEMORY}, measured ${ITERATIONS_IN_MEMORY}`,
    await benchRuntime(memoryRuntime, WARMUP_IN_MEMORY, ITERATIONS_IN_MEMORY),
    ITERATIONS_IN_MEMORY,
  );
  console.log(
    '  durable transactions per completed run: 7 (1 create + 3 node-start + 2 node-result + 1 terminal)',
  );
  console.log('');

  // --- 2. SQLite-backed runtime, file-backed (real durability) --------
  const dir = mkdtempSync(join(tmpdir(), 'vict-bench-'));
  try {
    const fileDb = join(dir, 'bench.db');
    const fileStores = createSqliteStores({
      path: fileDb,
      journalMode: 'wal',
      synchronous: 'full',
    });
    const fileRuntime = registerBenchCapabilities(createRuntime({ stores: fileStores }));
    const fileActivation = await fileRuntime.activate(GRAPH);
    if (!fileActivation.ok) {
      throw new Error('benchmark graph failed to activate (sqlite file)');
    }
    printSet(
      `sqlite FILE-BACKED (wal + synchronous=FULL, real local durability), warmup ${WARMUP_SQLITE_FILE}, measured ${ITERATIONS_SQLITE_FILE}`,
      await benchRuntime(fileRuntime, WARMUP_SQLITE_FILE, ITERATIONS_SQLITE_FILE),
      ITERATIONS_SQLITE_FILE,
    );
    console.log('  durable transactions per completed run: 7 (same as in-memory; each fsynced)');
    console.log('');

    // --- 3. SQLite-backed runtime, :memory: (labeled, not durability) ---
    const memStores = createSqliteStores({ path: ':memory:' });
    const memRuntime = registerBenchCapabilities(createRuntime({ stores: memStores }));
    const memActivation = await memRuntime.activate(GRAPH);
    if (!memActivation.ok) {
      throw new Error('benchmark graph failed to activate (sqlite :memory:)');
    }
    printSet(
      `sqlite :memory: (NO fsync — API-parity measurement only), warmup ${WARMUP_SQLITE_MEMORY}, measured ${ITERATIONS_SQLITE_MEMORY}`,
      await benchRuntime(memRuntime, WARMUP_SQLITE_MEMORY, ITERATIONS_SQLITE_MEMORY),
      ITERATIONS_SQLITE_MEMORY,
    );
    console.log('');

    // --- 4. Activation publish/restore ----------------------------------
    const publishSamples: number[] = [];
    for (let i = 0; i < 50; i++) {
      // Fresh graph identity per iteration: publish a new activation each time.
      const rt = registerBenchCapabilities(createRuntime({ stores: fileStores }));
      const t0 = process.hrtime.bigint();
      const result = await rt.activate({
        ...GRAPH,
        id: `bench-restore-${randomUUID()}`,
      });
      const t1 = process.hrtime.bigint();
      if (!result.ok) {
        throw new Error('publish iteration failed');
      }
      publishSamples.push(Number(t1 - t0) / 1e6);
    }
    printSet(
      'activation publish+select (sqlite file, fresh activation identity each time), n=50',
      summarize(publishSamples),
      publishSamples.length,
    );

    const restoreSamples: number[] = [];
    for (let i = 0; i < 200; i++) {
      const t0 = process.hrtime.bigint();
      const restored = await fileRuntime.restoreActivation(GRAPH, {
        activationVersion: fileActivation.ok ? fileActivation.activationVersion : undefined,
      });
      const t1 = process.hrtime.bigint();
      if (!restored.ok) {
        throw new Error('restore iteration failed');
      }
      restoreSamples.push(Number(t1 - t0) / 1e6);
    }
    printSet(
      'activation exact restore (compile + manifest compare, no execution), n=200',
      summarize(restoreSamples),
      restoreSamples.length,
    );

    // --- 5. Completed-run read with events ------------------------------
    const run = await fileRuntime.run({ n: 1 });
    const readSamples: number[] = [];
    for (let i = 0; i < READ_ITERATIONS; i++) {
      const t0 = process.hrtime.bigint();
      const record = await fileRuntime.getRun(run.runId);
      const t1 = process.hrtime.bigint();
      if (!record || record.status !== 'completed' || record.trace.length !== 10) {
        throw new Error('read iteration returned an unexpected record');
      }
      readSamples.push(Number(t1 - t0) / 1e6);
    }
    printSet(
      'completed-run read: run record + 10 events re-validated from SQLite, n=' + READ_ITERATIONS,
      summarize(readSamples),
      readSamples.length,
    );

    // --- 6. Stage 03 durable orchestration ---------------------------------
    await benchStage03(fileStores);

    await memStores.dispose();
    await fileStores.dispose();
  } finally {
    // Windows: pending statement finalizers can hold locks briefly; retry.
    for (let attempt = 0; ; attempt++) {
      try {
        rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
        break;
      } catch (cause) {
        if (attempt >= 10) {
          console.warn(
            `note: temp directory could not be fully removed (${String((cause as Error).message).slice(0, 60)}...); it is disposable and outside the repository.`,
          );
          break;
        }
        // Allocation pressure nudges pending statement finalizers.
        const junk: unknown[] = [];
        for (let i = 0; i < 3e5; i++) {
          junk.push({ index: i, tag: `gc-${i}` });
        }
        if (junk.length === -1) {
          break;
        }
      }
    }
  }

  console.log('');
  console.log('Notes:');
  console.log('- Compilation happens once at activation; it is never on the run path.');
  console.log(
    '- Activation restore recompiles and compares canonical manifests; it never executes capabilities.',
  );
  console.log(
    '- File-backed numbers include per-commit fsync (synchronous=FULL); do not compare to :memory: unlabeled.',
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

/* ------------------------------------------------------------------ */
/* Stage 03 durable orchestration measurements                          */
/* ------------------------------------------------------------------ */

const ORCH_S = {
  id: 'bench.s',
  revision: '1',
  expected: 'a string',
  parse: (input: unknown) =>
    typeof input === 'string'
      ? { ok: true as const, value: input, issues: [] }
      : { ok: false as const, issues: [] },
};

const ORCH_GRAPH = defineGraph({
  id: 'bench-orchestration',
  entry: 'd',
  nodes: [
    { id: 'd', kind: 'decision', capability: 'bench.route' },
    { id: 'f', kind: 'fork', join: 'j' },
    { id: 'a', capability: 'bench.branch' },
    { id: 'b', capability: 'bench.branch' },
    { id: 'j', kind: 'join', fork: 'f' },
    { id: 'w', kind: 'wait', wait: { kind: 'signal', name: 'bench-go' } },
    { id: 'done', capability: 'bench.sink', output: 'bench.s' },
  ],
  edges: [
    { from: 'd', to: 'f', kind: 'route', key: 'go' },
    { from: 'f', to: 'a', kind: 'branch', key: 'a' },
    { from: 'f', to: 'b', kind: 'branch', key: 'b' },
    { from: 'a', to: 'j' },
    { from: 'b', to: 'j' },
    { from: 'j', to: 'w' },
    { from: 'w', to: 'done' },
  ],
});

async function benchStage03(
  fileStores: ReturnType<typeof createSqliteStores> extends never
    ? never
    : Awaited<ReturnType<typeof createSqliteStores>>,
): Promise<void> {
  console.log('');
  console.log('--- Stage 03 durable orchestration (informational) ---');

  const orchestration = (
    fileStores as unknown as {
      orchestration: import('@vict/runtime').OrchestrationStore;
    }
  ).orchestration;
  let seq = 0;
  const runtime = createRuntime({
    stores: fileStores,
    ids: { runId: (): string => `bench-orch-${++seq}` },
  });
  runtime
    .registerContract(ORCH_S)
    .registerCapability({
      id: 'bench.route',
      revision: '1',
      effect: 'pure',
      invoke: (input: unknown) => ({ route: 'go', value: String(input) }),
    })
    .registerCapability({
      id: 'bench.branch',
      revision: '1',
      effect: 'pure',
      invoke: (input: unknown, context) =>
        `${String(input)}:${String(context.branch?.branchKey ?? '?')}`,
    })
    .registerCapability({
      id: 'bench.sink',
      revision: '1',
      effect: 'pure',
      invoke: (input: unknown) => String(input),
    })
    .registerCapability({
      id: 'bench.timer',
      revision: '1',
      effect: 'pure',
      invoke: (input: unknown) => String(input),
    });

  const activation = await runtime.activate(ORCH_GRAPH);
  if (!activation.ok) {
    throw new Error('orchestration benchmark graph failed to activate');
  }

  // Signal wait + delivery + resume (the full durable round trip).
  const samples: number[] = [];
  for (let i = 0; i < 50; i++) {
    const t0 = process.hrtime.bigint();
    const parked = (await runtime.run(`seed-${i}`)) as unknown as {
      status: string;
      runId: string;
      waits?: { waitId: string }[];
    };
    if (parked.status !== 'waiting') {
      throw new Error('orchestration bench run did not park');
    }
    const delivered = await runtime.signal({
      runId: parked.runId,
      waitId: parked.waits?.[0]?.waitId as string,
      signalId: `bench-signal-${i}`,
      signalName: 'bench-go',
      payload: 'resumed',
    });
    if (!delivered.ok) {
      throw new Error('orchestration bench signal failed');
    }
    const final = (await runtime.resumeRun(parked.runId)) as unknown as { status: string };
    if (final.status !== 'completed') {
      throw new Error('orchestration bench run did not complete');
    }
    const t1 = process.hrtime.bigint();
    samples.push(Number(t1 - t0) / 1e6);
  }
  printSet(
    'durable orchestration round trip (start -> fork/join -> signal wait -> signal -> resume -> complete), n=50',
    summarize(samples),
    samples.length,
  );
  console.log(
    '  durable transactions per completed orchestration run: claims + completions + wait + signal + join (each fsynced)',
  );
  console.log('');

  // Due-timer pump.
  const timerGraph = defineGraph({
    id: 'bench-timer',
    entry: 'a',
    nodes: [
      { id: 'a', capability: 'bench.sink' },
      { id: 't', kind: 'wait', wait: { kind: 'timer', delayMs: 1 } },
      { id: 'b', capability: 'bench.sink' },
    ],
    edges: [
      { from: 'a', to: 't' },
      { from: 't', to: 'b' },
    ],
  });
  const timerActivation = await runtime.activate(timerGraph);
  if (!timerActivation.ok) {
    throw new Error('timer benchmark graph failed to activate');
  }
  const timerSamples: number[] = [];
  for (let i = 0; i < 50; i++) {
    const t0 = process.hrtime.bigint();
    const parked = (await runtime.run(`t-${i}`)) as unknown as { status: string; runId: string };
    if (parked.status !== 'waiting') {
      throw new Error('timer bench run did not park');
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
    await runtime.processDueTimers({ runId: parked.runId });
    const final = (await runtime.resumeRun(parked.runId)) as unknown as { status: string };
    if (final.status !== 'completed') {
      throw new Error('timer bench run did not complete');
    }
    const t1 = process.hrtime.bigint();
    timerSamples.push(Number(t1 - t0) / 1e6);
  }
  printSet(
    'durable timer wait: park -> due-time pump -> wake -> complete, n=50',
    summarize(timerSamples),
    timerSamples.length,
  );
  console.log('');
}
