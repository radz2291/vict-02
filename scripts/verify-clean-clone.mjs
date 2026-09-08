#!/usr/bin/env node
/**
 * Clean-clone regression for Stage 06B corrective finalization.
 *
 * Proves the REQUIRED sequence from a genuine zero-artifact clone of the
 * committed repository state:
 *
 *   git clone <repo> <fresh dir>
 *   npm ci
 *   npm run typecheck
 *   npm run build
 *   npm run verify:stage6b
 *
 * `npm run typecheck` MUST succeed immediately after `npm ci`, BEFORE any
 * build and with no `dist` directories present (this exact sequence failed
 * at the pre-correction SHA: the root tsconfig lacked project/path
 * resolution for @vict/control, @vict/server and @vict/cli).
 *
 * The clone is taken from the COMMITTED repository state (git clone reads
 * HEAD); run this script after committing the correction.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
let failures = 0;

function check(condition, label) {
  if (condition) {
    console.log(`  ok: ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL: ${label}`);
  }
}

function run(command, args, cwd, label, timeout = 1_200_000) {
  console.log(`\n--- ${label}\n    $ ${command} ${args.join(' ')} (cwd: ${cwd})`);
  // npm is a .cmd shim on Windows and can only be spawned through the shell.
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', timeout, shell: true });
  check(result.status === 0, `${label} (exit ${result.status})`);
  return result;
}

// Resolve the repository root through git (never trust the caller's cwd).
const rootProbe = spawnSync('git', ['-C', repoRoot, 'rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
  shell: true,
});
if (rootProbe.status !== 0) {
  console.error('verify:clean-clone: not a git repository');
  process.exit(1);
}
const topLevel = rootProbe.stdout.trim();

const cloneDir = mkdtempSync(join(tmpdir(), 'vict-clean-clone-'));
console.log(`\n=== verify:clean-clone — fresh clone into ${cloneDir} ===`);
try {
  const clone = spawnSync('git', ['-C', topLevel, 'clone', '--quiet', topLevel, cloneDir], {
    stdio: 'inherit',
    timeout: 300_000,
    shell: true,
  });
  check(clone.status === 0, 'git clone of the committed repository state succeeds');
  // Prove the clone is zero-artifact: no dist directories anywhere.
  const distFound = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir)) {
      if (entry === '.git') continue;
      const p = join(dir, entry);
      let stat;
      try {
        stat = statSync(p);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        if (entry === 'dist') {
          distFound.push(p);
        } else {
          visit(p);
        }
      }
    }
  };
  visit(cloneDir);
  check(
    distFound.length === 0,
    `zero-artifact clone: no dist directories (${distFound.length} found)`,
  );
  check(
    !existsSync(join(cloneDir, 'node_modules')),
    'zero-artifact clone: no node_modules present',
  );

  run('npm', ['ci', '--no-audit', '--no-fund'], cloneDir, '1/4 npm ci');
  run('npm', ['run', 'typecheck'], cloneDir, '2/4 npm run typecheck (BEFORE any build, no dist)');
  run('npm', ['run', 'build'], cloneDir, '3/4 npm run build');
  run('npm', ['run', 'verify:stage6b'], cloneDir, '4/4 npm run verify:stage6b');
} finally {
  rmSync(cloneDir, { recursive: true, force: true, retryDelay: 300, maxRetries: 10 });
}

console.log('\n========================================');
if (failures === 0) {
  console.log('verify:clean-clone: ALL GATES PASSED');
  process.exit(0);
} else {
  console.log(`verify:clean-clone: ${failures} gate(s) FAILED`);
  process.exit(1);
}
