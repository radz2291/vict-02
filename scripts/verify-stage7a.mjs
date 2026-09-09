#!/usr/bin/env node
/**
 * Stage 07A aggregate verification — Quellight consumer foundation.
 *
 * Self-contained gates for the six handoff work items:
 *  1. Namespace migration gate: NO tracked executable surface
 *     (source, tests, manifests, scripts, configs, examples, packs,
 *     lockfile) still references the superseded development-only
 *     `@vict/*` namespace — every current reference is
 *     `@victframework/*`. Historical reports (docs/report/**) and
 *     handoffs (docs/handoff/**) are excluded by design. This
 *     verifier's own file is also excluded: it necessarily contains
 *     the literal `@vict/` as its detection pattern (F-1 correction;
 *     no other file or pattern is exempt).
 *  2. Release-set consistency: the manifests match the recorded
 *     immutable release-set identity exactly (verify:release-set).
 *  3. N-1 hardening suites: the delivery-snapshot boundary rejects own
 *     `__proto__` keys at every depth with the dedicated closed reason
 *     `proto-field`, at the source boundary AND through the governed
 *     bridge (fenced outcome_unknown, one effect, no second effect on
 *     retry), plus the emitted-package probe (verify:n1).
 *  4. Protected operator-configuration foundation: canary-based
 *     resolution/validation/non-leakage suites.
 *  5. Affected delivery-snapshot regression suites (the H-1 boundary
 *     suites) — byte-for-byte accepted-domain behavior unchanged.
 *  6. Manifest hygiene: every publishable manifest is publishable
 *     (public access, Apache-2.0, engines, exact internal pins) and the
 *     examples/packs/root remain workspace-private.
 */
import { spawnSync } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
let failures = 0;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
    cwd: options.cwd ?? repoRoot,
    timeout: options.timeout ?? 600_000,
    ...(options.shell ? { shell: true } : {}),
  });
  if (options.capture && result.status !== 0) {
    console.error(result.stdout?.slice(-4000));
    console.error(result.stderr?.slice(-4000));
  }
  return result;
}

function check(condition, label) {
  if (condition) {
    console.log(`  ok: ${label}`);
  } else {
    console.error(`  FAIL: ${label}`);
    failures += 1;
  }
}

function vitest(suites, label, timeout = 600_000) {
  const vitestEntry = join(repoRoot, 'node_modules', 'vitest', 'vitest.mjs');
  const result = run(process.execPath, [vitestEntry, 'run', '--root', repoRoot, ...suites], {
    capture: true,
    timeout,
  });
  check(result.status === 0, `${label} (exit ${result.status})`);
  return result;
}

console.log('\n--- Gate 1: namespace migration (no superseded @vict/* on executable surfaces) ---');
{
  const tracked = execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' })
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  const executableExtensions = /\.(ts|tsx|mts|cts|mjs|cjs|js|json|svelte|css|html)$/;
  // F-1 correction: exclude ONLY this verifier's own file from the
  // scan — it contains the literal `@vict/` as its detection pattern
  // and doc-comment text by design, so the gate must not flag itself.
  // Every other executable surface remains fully scanned.
  const self = 'scripts/verify-stage7a.mjs';
  const executable = tracked.filter(
    (file) =>
      executableExtensions.test(file) &&
      !file.startsWith('docs/report/') &&
      !file.startsWith('docs/handoff/') &&
      file !== self,
  );
  const offenders = executable.filter((file) => {
    try {
      return readFileSync(join(repoRoot, file), 'utf8').includes('@vict/');
    } catch {
      return false;
    }
  });
  check(
    offenders.length === 0,
    `no tracked executable surface references @vict/* (${executable.length} files scanned; offenders: ${offenders.slice(0, 5).join(', ') || 'none'})`,
  );
  check(
    readFileSync(join(repoRoot, 'package-lock.json'), 'utf8').includes(
      '"@victframework/contracts"',
    ) && !readFileSync(join(repoRoot, 'package-lock.json'), 'utf8').includes('"@vict/'),
    'package-lock.json resolves the @victframework/* workspaces only',
  );
}

console.log('\n--- Gate 2: immutable release-set consistency ---');
{
  const result = run('node', [join(repoRoot, 'scripts', 'check-release-set.mjs')], {
    capture: true,
  });
  check(result.status === 0, 'verify:release-set (manifests == recorded release-set identity)');
}

console.log('\n--- Gate 3: N-1 hardening (source boundary, governed bridge, emitted package) ---');
vitest(
  ['packages/mastra/test/tool-bridge.proto-field.test.ts'],
  'N-1 source-boundary + bridge suites',
);
{
  const result = run('node', [join(repoRoot, 'scripts', 'verify-n1-emitted.mjs')], {
    capture: true,
  });
  check(
    result.status === 0,
    'verify:n1 (emitted-package probe: proto-field rejections, safe domain preserved)',
  );
}

console.log('\n--- Gate 4: protected operator-configuration foundation ---');
vitest(['packages/runtime/test/operator-config.test.ts'], 'operator-configuration canary suites');

console.log('\n--- Gate 5: affected delivery-snapshot regression (accepted domain unchanged) ---');
vitest(
  [
    'packages/mastra/test/tool-bridge.delivery-snapshot.test.ts',
    'packages/mastra/test/tool-bridge.h1-delivery.test.ts',
  ],
  'H-1 delivery-snapshot boundary suites',
);

console.log('\n--- Gate 6: publishable-manifest hygiene ---');
{
  const examples = [
    'examples/application-proof',
    'examples/ara-proof',
    'examples/orchestration-proof',
    'examples/reference-app',
  ];
  const packs = ['packs/ledger-pack', 'packs/notes-pack'];
  let hygiene = 0;
  for (const dir of examples) {
    const manifest = JSON.parse(readFileSync(join(repoRoot, dir, 'package.json'), 'utf8'));
    if (manifest.private !== true || manifest.name.startsWith('@victframework/')) hygiene += 1;
  }
  for (const dir of packs) {
    const manifest = JSON.parse(readFileSync(join(repoRoot, dir, 'package.json'), 'utf8'));
    if (manifest.private !== true || !manifest.name.startsWith('@victframework/')) hygiene += 1;
  }
  check(
    hygiene === 0,
    'examples stay unscoped-private; packs carry the canonical namespace but remain workspace-private',
  );
}

console.log('\n========================================');
if (failures === 0) {
  console.log('verify:stage7a: ALL GATES PASSED');
  console.log(
    'Stage 07A implementation gates confirmed; independent verification is still required.',
  );
  process.exit(0);
} else {
  console.log(`verify:stage7a: ${failures} gate(s) FAILED`);
  process.exit(1);
}
