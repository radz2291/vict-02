#!/usr/bin/env node
/**
 * Stage 03 aggregate verification: runs the real suites end to end.
 *
 * This is an aggregation for convenience — it does NOT replace or skip the
 * individual evidence commands in the verification ladder:
 *   npm ci
 *   npm run format:check
 *   npm run lint
 *   npm run typecheck
 *   npm run build
 *   npm run test:unit
 *   npm run test:integration
 *   npm test
 *   npm run verify:consumer
 *   npm run verify:stage2
 *   npm run example
 *   npm run bench
 *
 * Stage 03 additions proven here (not hidden by aggregation):
 *   - the full unit suite includes the adapter-neutral Stage 03
 *     orchestration conformance suite for BOTH adapters;
 *   - real-process crash/restart/keyed-write reconciliation fixtures run in
 *     the unit project (packages/store-sqlite/test/orchestration-restart.test.ts);
 *   - the real Stage 02 database migration fixture
 *     (packages/store-sqlite/test/stage2-migration.test.ts);
 *   - the offline orchestration proof (examples/orchestration-proof).
 */
import { spawnSync } from 'node:child_process';

const steps = [
  [
    'workspace build (packed consumers must package freshly built declarations and artifacts)',
    'npm',
    ['run', 'build'],
  ],
  [
    'unit tests (incl. shared orchestration conformance, restart + crash fixtures)',
    'npx',
    ['vitest', 'run', '--project', 'unit'],
  ],
  ['integration tests', 'npx', ['vitest', 'run', '--project', 'integration']],
  ['offline orchestration proof', 'npx', ['tsx', 'examples/orchestration-proof/src/main.ts']],
  [
    'packed consumer + orchestration consumer (SQLite close/reopen/wait/signal/resume)',
    'node',
    ['scripts/isolated-consumer-check.mjs'],
  ],
];

let failures = 0;
for (const [label, command, args] of steps) {
  console.log(`\n=== verify:stage3 — ${label} ===`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    console.error(`[FAIL] ${label} exited ${result.status}`);
    failures += 1;
  }
}

if (failures > 0) {
  console.error(`\nverify:stage3 FAILED with ${failures} failing step(s).`);
  process.exit(1);
}
console.log(
  '\nverify:stage3 PASSED (full unit + integration suites, offline proof, packed orchestration consumer).',
);
