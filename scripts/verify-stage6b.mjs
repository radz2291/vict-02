#!/usr/bin/env node
/**
 * Stage 06B aggregate verification: control plane and governed remote
 * execution (corrective finalization).
 *
 * SELF-CONTAINED: the verifier builds EVERY artifact it consumes (all
 * production workspaces in dependency order, including @vict/server and
 * @vict/cli), so it is valid from a zero-artifact clean clone — it never
 * depends on artifacts from previous manual builds.
 *
 * Gates:
 *  1. Clean zero-artifact build + typecheck of the full package graph.
 *  2. New-package inspection: @vict/control, @vict/server and @vict/cli own
 *     real behavior; dependency direction is acyclic (neutral packages stay
 *     Mastra-free and store-free; server is agent-framework-free and
 *     provider-free); exact pinned Mastra versions; CLI has no store access.
 *  3. Runtime + SQLite control-plane conformance suites (close/reopen
 *     parity) and the agent-stream wire-schema suite.
 *  4. Control-plane lifecycle suites — including the durable commit saga,
 *     authoritative evidence, and the authorization matrix gates.
 *  5. Durable command idempotency gates (in-memory + SQLite + HTTP).
 *  6. Governed Mastra tool-bridge suites + phase fault injection.
 *  7. Real-HTTP server suites: versioned commands, resumable SSE with
 *     real-socket backpressure, remote Application data boundary, CLI over
 *     the shared command surface.
 *  8. SIGKILL cross-store fixtures and the end-to-end canary retention
 *     scan (raw DB/WAL/SHM bytes).
 *  9. Real child-process proof: a fresh process opens a SQLite control
 *     store, serves HTTP, and the CLI drives a ChangeSet lifecycle against
 *     it end-to-end.
 * 10. Stage 06A gates re-run: driver-cause, migration and governance
 *     regression suites.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
let failures = 0;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
    cwd: options.cwd ?? repoRoot,
    timeout: options.timeout,
    // npm (and pnpm-style shims) are .cmd scripts on Windows and can only
    // be spawned through the shell; direct node.exe invocations stay
    // shell-free so inline -e scripts survive cmd.exe parsing.
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
    timeout: 900_000,
  });
  check(result.status === 0, `${label} (${suites.length} suites)`);
}

// ---- 1. Clean build + typecheck (the verifier builds what it consumes) ------

console.log('\n=== verify:stage6b — zero-artifact build + typecheck ===');
{
  // No pre-existing dist artifact may be REQUIRED: prove the tree typechecks
  // and builds from whatever state it is in (the typecheck runs on sources).
  const typecheck = run('npm', ['run', 'typecheck'], {
    capture: true,
    timeout: 600_000,
    shell: true,
  });
  check(typecheck.status === 0, 'npm run typecheck succeeds (strict, before build)');
  if (typecheck.status !== 0) {
    console.error(typecheck.stdout?.slice(-2000));
  }
  const build = run('npm', ['run', 'build'], { capture: true, timeout: 900_000, shell: true });
  check(build.status === 0, 'npm run build builds EVERY production workspace (incl. server + cli)');
  if (build.status !== 0) {
    console.error(build.stdout?.slice(-2000));
  }
  const typecheckAfter = run('npm', ['run', 'typecheck'], {
    capture: true,
    timeout: 600_000,
    shell: true,
  });
  check(typecheckAfter.status === 0, 'npm run typecheck succeeds after build');
  // The built graph must include server + cli dist (packed consumers).
  check(
    existsSync(join(repoRoot, 'packages/server/dist/index.js')) &&
      existsSync(join(repoRoot, 'packages/cli/dist/cli.js')) &&
      existsSync(join(repoRoot, 'packages/control/dist/index.js')),
    'the built package graph includes @vict/server, @vict/cli and @vict/control dist',
  );
}

// ---- 2. Package inspection -------------------------------------------------

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

// ---- 3. Runtime + SQLite conformance and schema suites ----------------------

runVitestSuites('runtime control-plane conformance + wire schema', [
  'packages/runtime/test/agent-control-conformance.test.ts',
  'packages/contracts/test/agent-stream-schema.test.ts',
  'packages/runtime/test/store-errors.driver-cause.test.ts',
]);

runVitestSuites('SQLite control-plane conformance (close/reopen parity)', [
  'packages/store-sqlite/test/agent-control-conformance.test.ts',
  'packages/store-sqlite/test/agent-governance-receipt-steps.test.ts',
  'packages/store-sqlite/test/migrations.test.ts',
]);

// ---- 4. Control plane lifecycle + authorization matrix + commit saga --------

runVitestSuites('control-plane lifecycle, commit saga, authoritative evidence, actor boundary', [
  'packages/control/test/control-plane.test.ts',
]);

runVitestSuites('Stage 06B final reliability suites (R1-R6, activation CAS, closed structures)', [
  'packages/runtime/test/changeset-structure.test.ts',
  'packages/control/test/control-plane-reliability.test.ts',
  'packages/mastra/test/tool-bridge-reliability.test.ts',
  'packages/store-sqlite/test/reliability-restart.test.ts',
  'packages/server/test/command-reliability.test.ts',
]);

runVitestSuites(
  'Stage 06B final boundary correction suites (capture boundary, live-owner fencing, occurrence identity, real-process recovery)',
  [
    'packages/runtime/test/changeset-capture-boundary.test.ts',
    'packages/mastra/test/tool-bridge-ownership.test.ts',
    'packages/mastra/test/occurrence-identity-pipeline.test.ts',
    'packages/store-sqlite/test/invocation-fencing.test.ts',
  ],
);

runVitestSuites(
  'Stage 06B tool-state truthfulness correction suites (truthful terminal mapping, duplicate-cancellation policy, cross-composition liveness, real-path normalization)',
  [
    'packages/mastra/test/tool-bridge.truthfulness.test.ts',
    'packages/mastra/test/tool-state-normalization.test.ts',
  ],
);

runVitestSuites('public-API authorization matrix (real HTTP)', [
  'packages/server/test/authorization-matrix.test.ts',
]);

// ---- 5. Durable command idempotency ------------------------------------------

runVitestSuites('durable command idempotency (in-memory + SQLite + HTTP)', [
  'packages/server/test/idempotency.test.ts',
]);

// ---- 6. Governed Mastra tool bridge + fault injection ------------------------

runVitestSuites('governed Mastra tool bridge, turn executor, phase fault injection', [
  'packages/mastra/test/tool-bridge.test.ts',
  'packages/mastra/test/tool-bridge.faults.test.ts',
  'packages/mastra/test/turn-executor.test.ts',
  'packages/mastra/test/tool-bridge.truthfulness.test.ts',
  'packages/mastra/test/tool-state-normalization.test.ts',
]);

// ---- 6b. Post-audit hostile-envelope containment suites ----------------------

runVitestSuites(
  'post-audit hostile-envelope containment (total capture boundary, fenced post-invocation settlement, helper containment)',
  [
    'packages/mastra/test/control-envelope-containment.test.ts',
    'packages/mastra/test/tool-bridge.hostile-output.test.ts',
    'packages/mastra/test/helper-tools.containment.test.ts',
  ],
);

// ---- 6c. H-1 delivery-snapshot suites (durable completion before safe result
// delivery; recursive delivery-safe snapshot + real pinned Mastra path) ------

runVitestSuites(
  'H-1 delivery remediation (delivery-safe snapshot boundary, hostile nested output rejected before durable completion, real Mastra path)',
  [
    'packages/mastra/test/tool-bridge.delivery-snapshot.test.ts',
    'packages/mastra/test/tool-bridge.h1-delivery.test.ts',
  ],
);

// ---- 7. Real-HTTP server suites ----------------------------------------------

runVitestSuites('versioned HTTP commands, SSE + real-socket backpressure, remote app data, CLI', [
  'packages/server/test/http.test.ts',
  'packages/server/test/sse.test.ts',
  'packages/server/test/app-remote.test.ts',
  'packages/server/test/cli.test.ts',
]);

// ---- 8. SIGKILL + end-to-end canary -------------------------------------------

runVitestSuites('child-process SIGKILL fixtures and end-to-end canary retention scan', [
  'packages/server/test/restart-sigkill.test.ts',
  'packages/server/test/canary.test.ts',
  'packages/server/test/e2e-canary.test.ts',
]);

// ---- 8b. Real child-process CLI lifecycle over SQLite + HTTP -------------------

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

// ---- 9. Stage 06A regression gates (LOW-06A-1/2) ------------------------------

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
      'packages/store-sqlite/test/migrations.test.ts',
    ],
    { capture: true, timeout: 300_000 },
  );
  check(
    result.status === 0,
    'Stage 06A regression suites (driver-cause + receipt steps + migrations) pass',
  );
}

// ---- Summary --------------------------------------------------------------------

console.log('\n========================================');
if (failures === 0) {
  console.log('verify:stage6b: ALL GATES PASSED');
  console.log('Stage 06B corrective finalization complete; awaiting fresh independent audit.');
  process.exit(0);
} else {
  console.log(`verify:stage6b: ${failures} gate(s) FAILED`);
  process.exit(1);
}
