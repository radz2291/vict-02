#!/usr/bin/env node
/**
 * Stage 07A — reproducible publication path (handoff work item 3).
 *
 * Publishes the EXACT verified release set to the public npm registry in
 * dependency-topological order, from the packed artifacts — never from a
 * dirty tree, never re-publishing an existing version, never unpublishing.
 *
 * Safety model:
 * - dry by default: WITHOUT `--publish` the script only packs and prints
 *   the plan (safe to run any time);
 * - WITH `--publish` it first requires: a clean git tree at the release
 *   commit, a passing `verify:release-set`, and a fresh full build;
 * - every package is published by exact tarball (`npm publish <tgz>`) so
 *   the published bytes are exactly the artifacts verified beforehand;
 * - on any failure the script stops immediately and prints the exact
 *   published subset (never unpublishes, never mutates published
 *   versions; resume later from the first unpublished package);
 * - no credentials are read, printed, or stored by this script; registry
 *   credentials live only in the publishing environment. If npm requires
 *   interactive WebAuthn/2FA, complete the confirmation in the browser —
 *   the script never bypasses it.
 *
 * Usage:
 *   node scripts/publish-release.mjs                # pack + plan only
 *   node scripts/publish-release.mjs --publish      # publish for real
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assessContractAuthorityAtRoot, FROZEN_CONTRACT_PATH } from './lib/contract-authority.mjs';
import { assessPublicationPreflight } from './lib/publication-preflight.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const PUBLISH = process.argv.includes('--publish');
const PUBLIC_REGISTRY = 'https://registry.npmjs.org/';

/** Dependency-topological publication order (contract §5 as amended;
 * candidate set per the facade-retirement draft §16, 2026-09-27: the
 * §15 order minus the removed renderer-svelte facade — 14 members,
 * awaiting owner ratification). */
const PUBLISH_ORDER = [
  'contracts',
  'ui',
  'sdk',
  'kernel',
  'runtime',
  'store-sqlite',
  'application',
  'ui-svelte',
  'appdata-sqlite',
  'scaffolder',
  'control',
  'mastra',
  'server',
  'cli',
];

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: options.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    encoding: 'utf8',
    cwd: options.cwd ?? repoRoot,
    shell: process.platform === 'win32',
    timeout: options.timeout ?? 600_000,
  });
  return result;
}

function fail(message) {
  console.error(`publish:release: BLOCKED — ${message}`);
  process.exit(1);
}

// ---- Preflight -----------------------------------------------------------------
const setCheck = run('node', [join(scriptDir, 'check-release-set.mjs')], { capture: true });
if (setCheck.status !== 0) fail('release-set consistency check failed (see output above).');

const manifests = new Map();
for (const name of PUBLISH_ORDER) {
  const manifest = JSON.parse(
    readFileSync(join(repoRoot, 'packages', name, 'package.json'), 'utf8'),
  );
  manifests.set(manifest.name, { manifest, dir: join(repoRoot, 'packages', name) });
}

if (PUBLISH) {
  // CONTRACT AUTHORITY GATE (fail-closed, pre-publication): the frozen
  // contract must carry the ratified 14-package state (§16) before ANY
  // registry write — including this operator-run engine and its resume
  // path. The dry plan above stays usable for inspection.
  const authority = assessContractAuthorityAtRoot(repoRoot);
  if (!authority.authorized) {
    console.error(
      `publish:release: CONTRACT AUTHORITY REFUSED — the frozen contract (${FROZEN_CONTRACT_PATH}) does not yet authorize the 14-package candidate set. NO registry write was made. Gaps:`,
    );
    for (const problem of authority.problems) console.error(`  - ${problem}`);
    console.error(
      'Owner action: ratify §16 into the frozen contract first (amendment draft Appendices A+B, verbatim).',
    );
    process.exit(1);
  }
  console.log('publish:release: contract authority verified (§16 ratified)');

  // TRUST PREFLIGHT GATE (fail-closed, pre-publication; r4): publication
  // of ANY member is refused unless ALL 14 members exist and carry the
  // EXACT frozen trust relationship, credibly verified (live session or
  // validated set-bound evidence). Runs BEFORE any registry write,
  // including this operator engine's resume path.
  const trustEvidenceFlagIndex = process.argv.indexOf('--trust-evidence');
  const trustEvidencePath =
    trustEvidenceFlagIndex !== -1 ? process.argv[trustEvidenceFlagIndex + 1] : undefined;
  const preflight = assessPublicationPreflight({
    repoRoot,
    evidencePath: trustEvidencePath,
    log: (line) => console.log(`  ${line}`),
  });
  if (!preflight.authorized) {
    console.error(
      `publish:release: TRUST PREFLIGHT REFUSED — ${preflight.blockedReason} NO registry write was made. Details:`,
    );
    for (const problem of preflight.problems) console.error(`  - ${problem}`);
    console.error(
      'Owner action: run from an authenticated session or pass a validated artifact via --trust-evidence (scripts/capture-trust-evidence.mjs).',
    );
    process.exit(1);
  }
  console.log(
    `publish:release: trust preflight verified (all 14 present + exact; mode: ${preflight.mode})`,
  );

  const gitStatus = run('git', ['status', '--porcelain'], { capture: true });
  if (gitStatus.status !== 0) fail('git status failed — publish only from the release checkout.');
  const dirty = (gitStatus.stdout ?? '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0 && !line.includes('.pi/'));
  if (dirty.length > 0)
    fail(`working tree is not clean at the release commit:\n${dirty.join('\n')}`);

  const packUpToDate = existsSync(join(repoRoot, 'packages', 'contracts', 'dist', 'index.js'));
  if (!packUpToDate) fail('dist output missing — run `npm run build` before publishing.');
}

// ---- Pack every artifact ---------------------------------------------------------
const work = mkdtempSync(join(tmpdir(), 'vict-publish-'));
const tarballs = new Map();
for (const name of PUBLISH_ORDER) {
  const { manifest, dir } = manifests.get(`@victframework/${name}`);
  const result = run(npm, ['pack', dir, '--pack-destination', work, '--silent'], { capture: true });
  if (result.status !== 0) fail(`npm pack failed for ${manifest.name}`);
  const tgz = (result.stdout ?? '').trim().split(/\r?\n/).at(-1);
  tarballs.set(manifest.name, { tgz: join(work, tgz.trim()), version: manifest.version });
}

console.log('publish:release — packed release artifacts:');
for (const [name, { tgz, version }] of tarballs) {
  console.log(`  ${name}@${version}  <-  ${tgz}`);
}

if (!PUBLISH) {
  console.log(
    '\npublish:release: DRY plan only (pass --publish to publish). No registry calls made.',
  );
  rmSync(work, { recursive: true, force: true });
  process.exit(0);
}

// ---- Existing-version guard -------------------------------------------------------
for (const [name, { version }] of tarballs) {
  const encoded = encodeURIComponent(name);
  const check = spawnSync(
    'node',
    [
      '-e',
      `
    fetch(${JSON.stringify(`${PUBLIC_REGISTRY}${encoded}`)})
      .then((r) => { console.log(r.status === 200 ? 'EXISTS' : 'FREE'); process.exit(0); })
      .catch(() => { console.log('REGISTRY_UNREACHABLE'); process.exit(0); });
  `,
    ],
    { encoding: 'utf8' },
  );
  const state = (check.stdout ?? '').trim();
  if (state === 'EXISTS') {
    fail(
      `${name}@${version} already exists in the registry — never overwrite or re-publish a used version.`,
    );
  }
  if (state === 'REGISTRY_UNREACHABLE') {
    fail('the public npm registry is unreachable — aborting before any publish.');
  }
}

// ---- Publish in topological order ---------------------------------------------------
const published = [];
let stopped = undefined;
for (const [name, { tgz, version }] of tarballs) {
  console.log(`\npublishing ${name}@${version} ...`);
  const result = run(npm, ['publish', tgz, '--access', 'public', '--registry', PUBLIC_REGISTRY]);
  if (result.status !== 0) {
    stopped = { name, version, exit: result.status };
    break;
  }
  published.push(`${name}@${version}`);
  console.log(`  published: ${name}@${version}`);
}

console.log('\n========================================');
if (stopped) {
  console.error(
    `publish:release: STOPPED at ${stopped.name}@${stopped.version} (exit ${stopped.exit}).`,
  );
  console.error(`Published subset (${published.length}):`);
  for (const name of published) console.error(`  - ${name}`);
  console.error('Unpublished remainder:');
  for (const [name, { version }] of tarballs) {
    if (!published.includes(`${name}@${version}`)) console.error(`  - ${name}@${version}`);
  }
  console.error('Successful publications are preserved (never unpublished, never mutated).');
  console.error(
    'Resolve the cause, then resume the SAME immutable release from the first unpublished package.',
  );
  rmSync(work, { recursive: true, force: true });
  process.exit(1);
}
console.log(`publish:release: ALL ${published.length} PACKAGES PUBLISHED`);
rmSync(work, { recursive: true, force: true });
console.log(
  'Next: run `npm run verify:release-consumer -- --registry` before recording the release identity as live.',
);
