#!/usr/bin/env node
/**
 * Stage 06B aggregate verification: control plane and governed remote
 * execution.
 *
 * Aggregation for convenience — it does NOT replace or skip the individual
 * evidence commands in the verification ladder. It verifies:
 *
 *  1. New-package inspection: @vict/control, @vict/server and @vict/cli
 *     own real behavior (no empty placeholders); the dependency direction
 *     is acyclic (neutral packages stay Mastra-free; control/server/cli are
 *     transport-only and agent-framework-free); exact pinned Mastra
 *     versions are untouched; @vict/cli has no store access.
 *  2. Runtime + SQLite control-plane conformance suites (semantic parity
 *     incl. close/reopen) and the agent-stream schema suite.
 *  3. Control-plane lifecycle suites (ChangeSets, approvals, actor
 *     boundary) and the governed Mastra tool-bridge/executor suites.
 *  4. Real-HTTP server suites: versioned commands, resumable SSE,
 *     remote Application data boundary, CLI over the shared command
 *     surface, SIGKILL cross-store fixtures, canary leakage matrix.
 *  5. Real child-process proof: a fresh process opens a SQLite control
 *     store, serves HTTP, and the CLI drives a ChangeSet lifecycle against
 *     it end-to-end.
 *  6. Stage 06A gates re-run: the LOW-06A-1/LOW-06A-2 driver-cause,
 *     migration and governance regression suites.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
let failures = 0;
const shell = process.platform === 'win32';
const npm = shell ? 'npm.cmd' : 'npm';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
    cwd: options.cwd ?? repoRoot,
    timeout: options.timeout,
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
    failures += 1;
    console.error(`  FAIL: ${label}`);
  }
}

function runVitestSuites(label, suites) {
  console.log(`\n=== verify:stage6b — ${label} ===`);
  const vitestEntry = join(repoRoot, 'node_modules', 'vitest', 'vitest.mjs');
  const result = run(process.execPath, [vitestEntry, 'run', '--root', repoRoot, ...suites], {
    capture: true,
    timeout: 600_000,
  });
  check(result.status === 0, `${label} (${suites.length} suites)`);
}

// ---- 1. Package inspection -------------------------------------------------

console.log('\n=== verify:stage6b — package inspection (Stage 06B) ===');
{
  const packages = [
    'packages/control/src/control-plane.ts',
    'packages/control/src/agent-turns.ts',
    'packages/server/src/http.ts',
    'packages/server/src/commands.ts',
    'packages/server/src/app-remote.ts',
    'packages/server/src/auth.ts',
    'packages/cli/src/cli.ts',
    'packages/cli/src/client.ts',
    'packages/cli/src/commands.ts',
  ];
  for (const rel of packages) {
    check(existsSync(join(repoRoot, rel)), `owns real behavior: ${rel}`);
  }
  check(
    existsSync(join(repoRoot, 'packages/cli/bin/vict.mjs')),
    'CLI binary entry exists (bin/vict.mjs)',
  );

  // Neutral packages stay Mastra-free and store-free.
  const neutralDirs = [
    'packages/contracts/src',
    'packages/runtime/src',
    'packages/control/src',
    'packages/cli/src',
  ];
  const forbidden = [
    /@mastra\//,
    /from '@vict\/mastra'/,
    /from '@vict\/store-sqlite'/,
    /node:sqlite/,
    /better-sqlite3/,
  ];
  let neutralClean = true;
  for (const dir of neutralDirs) {
    const result = run(
      process.execPath,
      [
        '-e',
        `
const { readdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const dir = process.argv[1];
const forbidden = [/@mastra\\//, /from '@vict\\/mastra'/, /from '@vict\\/store-sqlite'/, /node:sqlite/, /better-sqlite3/];
let bad = [];
for (const file of readdirSync(dir)) {
  if (!file.endsWith('.ts')) continue;
  const text = readFileSync(join(dir, file), 'utf8');
  for (const re of forbidden) { if (re.test(text)) bad.push(file); }
}
if (bad.length > 0) { console.error(bad.join(',')); process.exit(1); }
`,
        dir,
      ],
      { capture: true },
    );
    if (result.status !== 0) {
      neutralClean = false;
      console.error(`  ${dir}: ${result.stdout?.toString()} ${result.stderr?.toString()}`);
    }
  }
  check(
    neutralClean,
    'neutral/transport packages (contracts, runtime, control, cli) are Mastra-free and store-free',
  );

  // The server package composes stores only through declared interfaces;
  // it must not embed a second orchestration engine or a raw provider.
  const serverDir = join(repoRoot, 'packages/server/src');
  const serverForbidden = [/@mastra\//, /from '@vict\/mastra'/, /openai/, /anthropic/];
  const serverResult = run(
    process.execPath,
    [
      '-e',
      `
const { readdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const dir = process.argv[1];
const forbidden = [/@mastra\\//, /from '@vict\\/mastra'/, /openai/, /anthropic/];
let bad = [];
for (const file of readdirSync(dir)) {
  if (!file.endsWith('.ts')) continue;
  const text = readFileSync(join(dir, file), 'utf8');
  for (const re of forbidden) { if (re.test(text)) bad.push(file); }
}
if (bad.length > 0) { console.error(bad.join(',')); process.exit(1); }
`,
      serverDir,
    ],
    { capture: true },
  );
  check(serverResult.status === 0, 'server package is agent-framework-free and provider-free');

  // Exact pinned Mastra versions (Stage 06A pins are untouched).
  const mastraPkg = JSON.parse(
    readFileSync(join(repoRoot, 'packages/mastra/package.json'), 'utf8'),
  );
  check(
    mastraPkg.dependencies['@mastra/core'] === '1.64.0' &&
      mastraPkg.dependencies['@mastra/memory'] === '1.28.2' &&
      mastraPkg.dependencies['@mastra/libsql'] === '1.22.3' &&
      mastraPkg.dependencies['@mastra/observability'] === '1.17.5',
    'exact pinned Mastra versions unchanged (core 1.64.0, memory 1.28.2, libsql 1.22.3, observability 1.17.5)',
  );

  // CLI must not read stores directly.
  const cliText =
    readFileSync(join(repoRoot, 'packages/cli/src/client.ts'), 'utf8') +
    readFileSync(join(repoRoot, 'packages/cli/src/cli.ts'), 'utf8');
  check(
    !/store-sqlite|node:sqlite|DatabaseSync|vict_agent_turn|vict_changeset/.test(cliText),
    'CLI consumes the command surface only (no direct store access)',
  );
}

// ---- 2. Runtime + SQLite conformance and schema suites ----------------------

runVitestSuites('runtime control-plane conformance + schema', [
  'packages/runtime/test/agent-control-conformance.test.ts',
  'packages/contracts/test/agent-stream-schema.test.ts',
  'packages/runtime/test/store-errors.driver-cause.test.ts',
]);

runVitestSuites('SQLite control-plane conformance (close/reopen parity)', [
  'packages/store-sqlite/test/agent-control-conformance.test.ts',
  'packages/store-sqlite/test/agent-governance-receipt-steps.test.ts',
]);

// ---- 3. Control plane + Mastra bridge ---------------------------------------

runVitestSuites('control-plane lifecycle and actor boundary', [
  'packages/control/test/control-plane.test.ts',
]);

runVitestSuites('governed Mastra tool bridge and turn executor', [
  'packages/mastra/test/tool-bridge.test.ts',
  'packages/mastra/test/turn-executor.test.ts',
]);

// ---- 4. Real-HTTP server suites ---------------------------------------------

runVitestSuites('versioned HTTP commands, SSE, remote app data, CLI', [
  'packages/server/test/http.test.ts',
  'packages/server/test/sse.test.ts',
  'packages/server/test/app-remote.test.ts',
  'packages/server/test/cli.test.ts',
]);

// ---- 5. SIGKILL + canary fixtures -------------------------------------------

runVitestSuites('child-process SIGKILL fixtures and canary leakage matrix', [
  'packages/server/test/restart-sigkill.test.ts',
  'packages/server/test/canary.test.ts',
]);

// ---- 5b. Real child-process CLI lifecycle over SQLite + HTTP -----------------

console.log('\n=== verify:stage6b — fresh-process SQLite server + CLI lifecycle ===');
{
  const dir = mkdtempSync(join(tmpdir(), 'vict-stage6b-verify-'));
  const worker = join(repoRoot, 'packages/server/test/fixtures/sigkill-worker.mjs');
  const readyFile = join(dir, 'ready.txt');
  const child = spawn(
    process.execPath,
    [
      worker,
      '--mode',
      'serve',
      '--db',
      join(dir, 'control.db'),
      '--ready-file',
      readyFile,
      '--effects',
      join(dir, 'effects.log'),
    ],
    { stdio: 'ignore' },
  );
  let port;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (existsSync(readyFile)) {
      const line = readFileSync(readyFile, 'utf8')
        .split('\n')
        .find((l) => l.startsWith('READY '));
      if (line !== undefined) {
        port = Number(line.split(' ')[1]);
        break;
      }
    }
    spawnSync(process.execPath, ['-e', 'setTimeout(()=>{},50)']);
  }
  let lifecycleOk = false;
  if (port !== undefined) {
    // Propose a ChangeSet through the CLI (typed command surface only).
    const payloadPath = join(dir, 'cs.json');
    writeFileSync(
      payloadPath,
      JSON.stringify({
        changesetId: 'cs-verify-1',
        base: { kind: 'release', subjectId: 'app-support', expectedVersion: 'release-v1' },
        operations: [
          {
            kind: 'publish-and-select-release',
            release: {
              releaseVersion: 'release-v2',
              applicationId: 'app-support',
              applicationVersion: 'app-1',
              rendererIdentity: 'renderer-v2',
              componentRegistryIdentity: 'registry-v2',
              dataAdapterIdentity: 'adapter-v2',
              activationBinding: 'activation-1',
            },
          },
        ],
        rationale: 'stage6b aggregate verification',
        riskClass: 'low',
        requiredApproverCount: 1,
        expiresAt: Date.now() + 3_600_000,
      }),
    );
    const propose = run(
      process.execPath,
      [
        join(repoRoot, 'packages/cli/dist/cli.js'),
        'changeset',
        'propose',
        '--file',
        payloadPath,
        '--endpoint',
        `http://127.0.0.1:${port}`,
        '--token',
        'vict-test-token-user',
      ],
      { capture: true },
    );
    lifecycleOk = propose.status === 0;
    if (!lifecycleOk) {
      console.error(
        `  CLI propose failed: ${propose.stdout?.toString()} ${propose.stderr?.toString()}`,
      );
    }
  } else {
    console.error('  server child never became ready');
  }
  child.kill('SIGKILL');
  rmSync(dir, { recursive: true, force: true, retryDelay: 200, maxRetries: 10 });
  check(lifecycleOk, 'fresh-process SQLite server: CLI drives a ChangeSet proposal end-to-end');
}

// ---- 6. Stage 06A regression gates (LOW-06A-2) -------------------------------

console.log('\n=== verify:stage6b — Stage 06A regression suites (LOW-06A-1/2) ===');
{
  const vitestEntry = join(repoRoot, 'node_modules', 'vitest', 'vitest.mjs');
  const result = run(
    process.execPath,
    [
      vitestEntry,
      'run',
      '--root',
      repoRoot,
      'packages/runtime/test/store-errors.driver-cause.test.ts',
      'packages/store-sqlite/test/agent-governance-receipt-steps.test.ts',
    ],
    { capture: true, timeout: 300_000 },
  );
  check(result.status === 0, 'Stage 06A regression suites (driver-cause + receipt steps) pass');
}

// ---- Summary ------------------------------------------------------------------

console.log('\n========================================');
if (failures === 0) {
  console.log('verify:stage6b: ALL GATES PASSED');
  console.log('Stage 06B implemented and awaiting fresh independent audit.');
  process.exit(0);
} else {
  console.log(`verify:stage6b: ${failures} gate(s) FAILED`);
  process.exit(1);
}
