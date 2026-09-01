#!/usr/bin/env node
/**
 * Stage 02 aggregate verification: runs the real suites end to end.
 *
 * This is an aggregation for convenience — it does NOT replace or skip the
 * individual evidence commands in the verification ladder:
 *   npm ci
 *   npm run format:check
 *   npm run lint
 *   npm run typecheck
 *   npx vitest run --project unit
 *   npx vitest run --project integration
 *   npm test
 *   npm run build
 *   npm run verify:consumer
 *   npm run example
 *   npm run bench
 */
import { spawnSync } from 'node:child_process';

const steps = [
  ['unit tests', 'npx', ['vitest', 'run', '--project', 'unit']],
  ['integration tests', 'npx', ['vitest', 'run', '--project', 'integration']],
  ['packed consumer + SQLite reopen verification', 'node', ['scripts/isolated-consumer-check.mjs']],
];

let failures = 0;
for (const [label, command, args] of steps) {
  console.log(`\n=== verify:stage2 — ${label} ===`);
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
  console.error(`\nverify:stage2 FAILED with ${failures} failing step(s).`);
  process.exit(1);
}
console.log('\nverify:stage2 PASSED (full unit + integration suites, packed SQLite consumer).');
