#!/usr/bin/env node
/**
 * ONE-TIME bulk trust bootstrap for npm trusted publishing (GitHub OIDC).
 *
 * Implements contract §11 of
 * `docs/RELEASE-TRUSTED-PUBLISHING-CONTRACT.md`: configures every
 * `@victframework/*` release-set member to trust EXACTLY
 *
 *   provider:    GitHub Actions
 *   repository:  radz2291/vict-02
 *   workflow:    release.yml
 *   permission:  --allow-publish (direct `npm publish`)
 *   environment: none
 *
 * through the official `npm trust github` interface (npm >= 11.15.0).
 *
 * Safety model (frozen):
 * - exact package allowlist: derives the inventory from the canonical
 *   manifests and refuses to act if it is not exactly the frozen
 *   15-package set (contract §5 as amended 2026-09-26, §14);
 * - deterministic order: the frozen dependency-topological publication
 *   order;
 * - two-second delay between registry-mutating requests;
 * - spawnSync argument arrays only — NO shell interpolation of any
 *   value (the win32 shell escape hatch applies only to the fixed,
 *   shell-safe npm/npx launchers, never to interpolated data);
 * - no token input, token output, token storage, or `.npmrc`
 *   inspection of any kind; all echoed tool output is token-sanitized;
 * - stops IMMEDIATELY on the first failure;
 * - verifies EVERY resulting trust relationship afterward through
 *   `npm trust list` and fails closed if any relationship is missing,
 *   unrecognized, or conflicting;
 * - idempotent: an already-EXACT relationship is skipped; an existing
 *   CONFLICTING relationship is refused (never auto-replaced);
 * - DEFAULT IS DRY: without `--execute` the script only prints the exact
 *   plan; registry mutation additionally requires the frozen workflow
 *   file to already exist on the PUSHED origin/main (checked with a
 *   fresh fetch) so trust is never configured against an unpushed
 *   workflow.
 *
 * The one-time human ceremony (five-minute npm 2FA grace window) is
 * described in the contract; this script performs no credential entry
 * itself — the human completes npm's official 2FA flow in the browser on
 * the first request.
 *
 * Usage:
 *   node scripts/trust-bootstrap.mjs            # dry structural plan
 *   node scripts/trust-bootstrap.mjs --execute  # perform the bootstrap
 *   node scripts/trust-bootstrap.mjs --verify-only
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  deriveReleaseInventory,
  EXPECTED_RELEASE_PACKAGE_COUNT,
  FROZEN_PUBLISH_ORDER,
  FROZEN_TRUST_TARGET,
  npmVersionSatisfiesMinimum,
  trustGithubArgv,
} from './lib/release-set.mjs';
import {
  classifyRelationships,
  collectRelationships,
  describeRelationship,
  originMatchesFrozenRepository,
  sanitize,
} from './lib/trust-config.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const PINNED_NPM_VERSION = '11.19.1';
const DELAY_MS = 2000;

function fail(message) {
  console.error(`trust-bootstrap: BLOCKED — ${sanitize(message)}`);
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

// ---- npm launcher resolution (>= 11.15.0 required for npm trust) ------------

function npmVersionOf(command, args) {
  const result = spawnSync(command, [...args, '--version'], {
    encoding: 'utf8',
    shell: process.platform === 'win32' && command !== process.execPath,
  });
  if (result.status !== 0) return undefined;
  return (result.stdout ?? '').trim().split(/\r?\n/).at(-1);
}

/**
 * Resolve an npm launcher that satisfies the `npm trust` minimum.
 * Order: $NPM_BIN (explicit operator override), the active `npm`,
 * then the pinned npm through `npx -y npm@<pinned>`. Returns
 * { command, prefix, description }; no credentials are involved here.
 */
function resolveNpmLauncher() {
  if (process.env.NPM_BIN !== undefined && process.env.NPM_BIN.length > 0) {
    const version = npmVersionOf(process.env.NPM_BIN, []);
    if (version === undefined) fail(`NPM_BIN '${process.env.NPM_BIN}' could not report a version.`);
    if (!npmVersionSatisfiesMinimum(version)) {
      fail(`NPM_BIN npm ${version} is older than the required ${'11.15.0'}.`);
    }
    return { command: process.env.NPM_BIN, prefix: [], description: `NPM_BIN (npm ${version})` };
  }
  const activeVersion = npmVersionOf(process.platform === 'win32' ? 'npm.cmd' : 'npm', []);
  if (activeVersion !== undefined && npmVersionSatisfiesMinimum(activeVersion)) {
    return {
      command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
      prefix: [],
      description: `active npm (${activeVersion})`,
    };
  }
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const pinnedVersion = npmVersionOf(npx, ['-y', `npm@${PINNED_NPM_VERSION}`]);
  if (pinnedVersion === undefined) {
    fail(`could not run npm ${PINNED_NPM_VERSION} through npx for the trust interface.`);
  }
  return {
    command: npx,
    prefix: ['-y', `npm@${PINNED_NPM_VERSION}`],
    description: `npx npm@${PINNED_NPM_VERSION} (active npm ${activeVersion ?? 'unknown'} is too old)`,
  };
}

function runTrust(launcher, argv, options = {}) {
  // The mutating `trust github` call may need the LIVE browser-2FA prompt
  // ("Authenticate at <URL> / Press ENTER..."): when `interactive` is set
  // it inherits this terminal's stdio so the human can complete it in the
  // official npm flow. Read-only `trust list` stays captured for parsing.
  const result = spawnSync(launcher.command, [...launcher.prefix, ...argv], {
    shell: process.platform === 'win32' && launcher.command !== process.execPath,
    ...(options.interactive ? { stdio: 'inherit' } : { encoding: 'utf8' }),
  });
  if (options.interactive) {
    return { status: result.status, stdout: '', stderr: '' };
  }
  return {
    status: result.status,
    stdout: sanitize(result.stdout ?? ''),
    stderr: sanitize(result.stderr ?? ''),
  };
}

// ---- trust-list interpretation (defensive, fail closed) ---------------------
// The relationship parsing/classification rules live in
// scripts/lib/trust-config.mjs (permanently regression-covered); only the
// registry-touching wrapper lives here.

/** `npm trust list <pkg> --json`, interpreted fail-closed. */
/** True when a captured npm failure is the OTP/browser-auth challenge. */
function isOtpChallenge(result) {
  return (
    result.status !== 0 &&
    /EOTP|one-time password|Open this URL/i.test(`${result.stderr}${result.stdout}`)
  );
}

/**
 * Run one trust call; on the OTP challenge, re-run it INTERACTIVELY so
 * the human completes the browser auth once (npm's five-minute skip then
 * covers the remaining calls). After an interactive `list` succeeds, the
 * captured call is repeated once so its JSON can be parsed inside the
 * grace window.
 */
async function runTrustWithOtpRetry(launcher, argv) {
  let result = runTrust(launcher, argv);
  if (!isOtpChallenge(result)) {
    return result;
  }
  console.log(
    '  browser authentication required — complete the challenge in the npm window (a URL will appear there).',
  );
  const interactive = runTrust(launcher, argv, { interactive: true });
  if (interactive.status !== 0) {
    return interactive;
  }
  if (argv[0] === 'list') {
    return runTrust(launcher, argv);
  }
  return { status: 0, stdout: '', stderr: '' };
}

async function listTrustRelationships(launcher, packageName) {
  const result = await runTrustWithOtpRetry(launcher, ['trust', 'list', packageName, '--json']);
  if (result.status !== 0) {
    fail(
      `npm trust list ${packageName} failed (exit ${result.status}). Output: ${(result.stderr || result.stdout).slice(0, 1200)}`,
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(result.stdout || '{}');
  } catch {
    fail(`npm trust list ${packageName} returned unparseable output; inspect manually.`);
  }
  const entries = collectRelationships(parsed);
  if (entries.length === 0 && result.stdout.trim().length > 0 && result.stdout.trim() !== '{}') {
    fail(
      `npm trust list ${packageName} returned an unrecognized JSON shape; refusing to decide. Inspect manually: npm trust list ${packageName}`,
    );
  }
  return classifyRelationships(entries);
}

// ---- structural preflight ----------------------------------------------------

function canonicalOrigin() {
  const result = spawnSync('git', ['remote', 'get-url', 'origin'], {
    encoding: 'utf8',
    cwd: repoRoot,
  });
  if (result.status !== 0) fail('git remote get-url origin failed.');
  return (result.stdout ?? '').trim();
}

function workflowFilePushedToOriginMain() {
  const fetch = spawnSync('git', ['fetch', 'origin', 'main'], { encoding: 'utf8', cwd: repoRoot });
  if (fetch.status !== 0) fail('git fetch origin main failed; refusing to decide.');
  const ls = spawnSync(
    'git',
    [
      'ls-tree',
      'origin/main',
      '--name-only',
      '--',
      `.github/workflows/${FROZEN_TRUST_TARGET.workflowFile}`,
    ],
    { encoding: 'utf8', cwd: repoRoot },
  );
  if (ls.status !== 0) fail('git ls-tree against origin/main failed; refusing to decide.');
  return (ls.stdout ?? '').trim().length > 0;
}

// ---- main ----------------------------------------------------------------------

const execute = process.argv.includes('--execute');
const verifyOnly = process.argv.includes('--verify-only');
if (execute && verifyOnly) fail('--execute and --verify-only are mutually exclusive.');

// 1. Frozen inventory derivation (exact allowlist).
const inventory = deriveReleaseInventory(repoRoot);
if (inventory.problems.length > 0) {
  fail(`release-set inventory invalid:\n  - ${inventory.problems.join('\n  - ')}`);
}
if (inventory.order.length !== EXPECTED_RELEASE_PACKAGE_COUNT) {
  fail(
    `inventory is ${inventory.order.length} packages; expected exactly ${EXPECTED_RELEASE_PACKAGE_COUNT}.`,
  );
}
const namesInFrozenOrder = inventory.order;
for (let index = 0; index < namesInFrozenOrder.length; index += 1) {
  if (namesInFrozenOrder[index] !== FROZEN_PUBLISH_ORDER[index]) {
    fail('derived inventory order does not equal the frozen publication order.');
  }
}
console.log(
  `trust-bootstrap: inventory verified — ${namesInFrozenOrder.length} packages, frozen order`,
);

// 2. Structural preflight.
const originUrl = canonicalOrigin();
if (!originMatchesFrozenRepository(originUrl)) {
  fail(
    `origin '${originUrl}' is not the frozen trust repository '${FROZEN_TRUST_TARGET.repository}'.`,
  );
}
const workflowPath = join(repoRoot, '.github', 'workflows', FROZEN_TRUST_TARGET.workflowFile);
if (!existsSync(workflowPath)) {
  fail(
    `the frozen workflow file .github/workflows/${FROZEN_TRUST_TARGET.workflowFile} does not exist.`,
  );
}
console.log(
  `trust-bootstrap: origin and workflow file verified (${FROZEN_TRUST_TARGET.repository} / ${FROZEN_TRUST_TARGET.workflowFile})`,
);

const launcher = resolveNpmLauncher();
console.log(`trust-bootstrap: npm launcher — ${launcher.description}`);

if (verifyOnly) {
  let failures = 0;
  for (const name of namesInFrozenOrder) {
    const { exact, conflicting } = listTrustRelationships(launcher, name);
    if (exact.length > 0 && conflicting.length === 0) {
      console.log(
        `  ok: ${name} trusts exactly ${FROZEN_TRUST_TARGET.repository}/${FROZEN_TRUST_TARGET.workflowFile}`,
      );
    } else {
      failures += 1;
      console.error(`  FAIL: ${name}: exact=${exact.length} conflicting=${conflicting.length}`);
      for (const entry of conflicting)
        console.error(`        conflict: ${describeRelationship(entry)}`);
    }
  }
  if (failures > 0)
    fail(`${failures} package(s) do not have the exact expected trust relationship.`);
  console.log(
    `\ntrust-bootstrap: ALL ${namesInFrozenOrder.length} TRUST RELATIONSHIPS VERIFIED EXACT`,
  );
  process.exit(0);
}

// 3. Plan (always printed; mutated only behind --execute).
console.log('\ntrust-bootstrap: plan');
for (const name of namesInFrozenOrder) {
  console.log(`  ${name}:`);
  console.log(`    npm ${trustGithubArgv(name, FROZEN_TRUST_TARGET).join(' ')}`);
}
if (!execute) {
  console.log(
    '\ntrust-bootstrap: DRY plan only (no registry call was made). Pass --execute to perform the bootstrap.',
  );
  process.exit(0);
}

// 4. Execute-mode gate: the workflow must exist on the PUSHED origin/main.
if (!workflowFilePushedToOriginMain()) {
  fail(
    `the frozen workflow file is not on pushed origin/main yet — commit and push .github/workflows/${FROZEN_TRUST_TARGET.workflowFile} before bootstrapping trust.`,
  );
}
console.log('trust-bootstrap: workflow file confirmed on pushed origin/main');

// 5. Pre-check every package (idempotent skip / refuse conflicts).
const toConfigure = [];
for (const name of namesInFrozenOrder) {
  const { exact, conflicting } = await listTrustRelationships(launcher, name);
  if (exact.length > 0 && conflicting.length === 0) {
    console.log(`  already-exact: ${name} (skipped)`);
    continue;
  }
  if (conflicting.length > 0) {
    console.error(
      `  ${name} already has CONFLICTING trust relationship(s); refusing to replace automatically:`,
    );
    for (const entry of conflicting) console.error(`    ${describeRelationship(entry)}`);
    console.error(
      '  Revoke the conflicting relationship consciously (npm trust revoke) and re-run.',
    );
    process.exit(1);
  }
  toConfigure.push(name);
}
if (toConfigure.length === 0) {
  console.log('\ntrust-bootstrap: every relationship is already exact; nothing to configure.');
  process.exit(0);
}

// 6. Configure with the bounded ceremony cadence (stop on first failure).
console.log(`\ntrust-bootstrap: configuring ${toConfigure.length} package(s)...`);
console.log(
  "trust-bootstrap: complete the npm 2FA challenge in the OFFICIAL npm flow on the first request, and select npm's five-minute skip when offered.",
);
for (let index = 0; index < toConfigure.length; index += 1) {
  const name = toConfigure[index];
  const result = await runTrustWithOtpRetry(launcher, trustGithubArgv(name, FROZEN_TRUST_TARGET));
  if (result.status !== 0) {
    fail(`npm trust github ${name} failed (exit ${result.status}).`);
  }
  console.log(`  configured: ${name}`);
  if (index < toConfigure.length - 1) await sleep(DELAY_MS);
}

// 7. Verify EVERY relationship before the window closes.
console.log('\ntrust-bootstrap: verifying every configured relationship...');
let verificationFailures = 0;
for (const name of namesInFrozenOrder) {
  const { exact, conflicting } = await listTrustRelationships(launcher, name);
  if (exact.length > 0 && conflicting.length === 0) {
    console.log(`  ok: ${name}`);
  } else {
    verificationFailures += 1;
    console.error(`  FAIL: ${name}: exact=${exact.length} conflicting=${conflicting.length}`);
    for (const entry of conflicting)
      console.error(`        conflict: ${describeRelationship(entry)}`);
  }
}
if (verificationFailures > 0) {
  fail(`${verificationFailures} package(s) failed post-bootstrap verification.`);
}
console.log(
  `\ntrust-bootstrap: ALL ${namesInFrozenOrder.length} PACKAGES TRUST ${FROZEN_TRUST_TARGET.repository} / ${FROZEN_TRUST_TARGET.workflowFile} (publish, no environment)`,
);
