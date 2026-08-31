/**
 * Night 01 performance baseline.
 *
 * Repeated execution of a three-node pure graph (the deterministic core of
 * the ARA shape). Excludes install, process startup, filesystem discovery,
 * network, and model latency: everything measured is in-process graph
 * execution. Compilation happens once at activation, never per run.
 *
 * Usage: npm run bench
 */
import { createRuntime, defineCapability, defineGraph } from '@vict/sdk';
import { defineZodContract } from '@vict/sdk/zod';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { platform, release, arch } from 'node:os';

const In = defineZodContract('bench.in', '1', z.object({ n: z.number() }));
const Mid = defineZodContract('bench.mid', '1', z.object({ n: z.number(), doubled: z.boolean() }));
const Out = defineZodContract('bench.out', '1', z.object({ n: z.number(), digest: z.string() }));

const runtime = createRuntime();
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

const activation = runtime.activate(
  defineGraph({
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
  }),
);
if (!activation.ok) {
  throw new Error('benchmark graph failed to activate');
}
const benchGraphId = activation.graphId;
const benchGraphVersion = activation.graphVersion;

const WARMUP = 1_000;
const ITERATIONS = 5_000;

async function main(): Promise<void> {
  // Warm-up: JIT, allocation paths, repository growth.
  for (let i = 0; i < WARMUP; i++) {
    await runtime.run({ n: i });
  }

  const samples: number[] = [];
  const started = process.hrtime.bigint();
  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = process.hrtime.bigint();
    const result = await runtime.run({ n: i });
    const t1 = process.hrtime.bigint();
    if (result.status !== 'completed') {
      throw new Error(`benchmark run ${i} did not complete: ${result.status}`);
    }
    samples.push(Number(t1 - t0) / 1e6);
  }
  const totalMs = Number(process.hrtime.bigint() - started) / 1e6;

  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)] as number;
  const p95 = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))] as number;
  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const min = samples[0] as number;
  const max = samples.at(-1) as number;

  const nodeVersion = process.version;
  const pkgVersions = {
    contracts: '0.1.0',
    kernel: '0.1.0',
    runtime: '0.1.0',
  };

  console.log('=== Vict Night 01 execution benchmark ===');
  console.log(`node:            ${nodeVersion} (${platform()} ${release()} ${arch()})`);
  console.log(`packages:        @vict/* ${pkgVersions.kernel}`);
  console.log(`graph:           ${benchGraphId} @ ${benchGraphVersion.slice(0, 18)}...`);
  console.log(`activation:      ${runtime.activeGraph()?.activationVersion.slice(0, 18)}...`);
  console.log(`iterations:      ${ITERATIONS} (warmup ${WARMUP})`);
  console.log(`total:           ${totalMs.toFixed(1)} ms`);
  console.log(`median:          ${median.toFixed(3)} ms/run`);
  console.log(`p95:             ${p95.toFixed(3)} ms/run`);
  console.log(`mean:            ${mean.toFixed(3)} ms/run`);
  console.log(`min:             ${min.toFixed(3)} ms/run`);
  console.log(`max:             ${max.toFixed(3)} ms/run`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
