#!/usr/bin/env node
/**
 * FIRST-PUBLICATION BOOTSTRAP (owner-authorized; §16 contract exception).
 *
 * npm's trusted-publisher configuration is a PER-PACKAGE setting on an
 * EXISTING package (docs.npmjs.com/trusted-publishers: the trusted
 * publisher is configured under "your package settings on npmjs.com →
 * Packages → YOUR_PACKAGE → Settings → Trusted publishing"; the CLI
 * `npm trust github <pkg>` targets an existing package). A package with
 * no registry presence therefore cannot be trusted — and under the
 * frozen model it could never publish. The §16 amendment resolves this
 * chicken-and-egg gap for the two NEW members (`@victframework/ui`,
 * `@victframework/ui-svelte`) with a SEPARATELY OWNER-AUTHORIZED
 * one-time bootstrap:
 *
 *   1. Establish registry presence with a PLACEHOLDER version
 *      `0.0.0-bootstrap.1` under a dedicated `bootstrap` dist-tag — a
 *      version shape that can NEVER satisfy the coordinated release-set
 *      version rule (X.Y.Z / X.Y.Z-rc.N), so the bootstrap can never
 *      consume or partially publish the coordinated `0.4.0-rc.1` set.
 *      The placeholder carries the REAL built package content,
 *      truthfully versioned; it is registry-immutable lineage once
 *      published. `latest` stays unoccupied (the placeholder never
 *      claims it).
 *   2. The placeholder publish uses the HISTORICAL local interactive-
 *      2FA path (contract §13 precedent: "All historical publications
 *      used local interactive WebAuthn 2FA") — npm OIDC trusted
 *      publishing cannot publish a package that has no configured
 *      trust relationship yet. This is the ONLY registered contract
 *      exception; every subsequent publication of these members goes
 *      through the ordinary OIDC engine.
 *   3. After presence exists, the §11 trust bootstrap configures the
 *      exact relationship; `scripts/verify-trust-preflight.mjs` must
 *      pass for ALL 14 members; only then may the coordinated set
 *      publish (contract authority gate + release engine).
 *
 * SAFETY (this script):
 *   - DRY BY DEFAULT: without `--execute` it prints the plan only —
 *     no registry call of any kind;
 *   - `--execute` requires ALL of: the contract authority gate GREEN
 *     (i.e. §16 — including this exception — is ratified into the
 *     frozen contract), an explicit `--authorization <file>` whose
 *     text contains the exact owner-authorization marker, the two
 *     member names, and the placeholder version, and a clean git tree;
 *   - it refuses ANY member that is not ABSENT from the registry
 *     (idempotent: an existing package never gets a second placeholder);
 *   - it refuses ANY package name outside the frozen release inventory;
 *   - it refuses to touch the coordinated set's version in any way
 *     (the placeholder version is a fixed constant, never derived from
 *     the workspace version);
 *   - spawnSync argument arrays only; no token input/output/storage;
 *     output is token-sanitized; stops at the first failure.
 *
 * Usage:
 *   node scripts/first-publish-bootstrap.mjs            # plan only
 *   node scripts/first-publish-bootstrap.mjs --execute \
 *        --authorization path/to/owner-authorization.txt
 */
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assessContractAuthorityAtRoot, FROZEN_CONTRACT_PATH } from './lib/contract-authority.mjs';
import { fetchPackument } from './lib/registry-probe.mjs';
import {
  assessTrustPreflight,
  BOOTSTRAP_PLACEHOLDER_TAG,
  BOOTSTRAP_PLACEHOLDER_VERSION,
} from './lib/trust-preflight.mjs';
import { deriveReleaseInventory, FROZEN_PUBLISH_ORDER } from './lib/release-set.mjs';
import { sanitize } from './lib/trust-config.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

const OWNER_AUTHORIZATION_MARKER =
  'FIRST-PUBLICATION BOOTSTRAP AUTHORIZATION (§16 contract exception)';

function fail(message) {
  console.error(`first-publish-bootstrap: BLOCKED — ${sanitize(message)}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    cwd: options.cwd ?? repoRoot,
    shell: process.platform === 'win32' && command !== 'git' && command !== process.execPath,
  });
}

const execute = process.argv.includes('--execute');
const authFlagIndex = process.argv.indexOf('--authorization');
const authorizationPath = authFlagIndex !== -1 ? process.argv[authFlagIndex + 1] : undefined;
if (execute && (authorizationPath === undefined || authorizationPath.length === 0)) {
  fail('--execute requires --authorization <file> (the explicit owner authorization artifact).');
}

// 1. Frozen inventory; the bootstrap targets ONLY absent members.
const inventory = deriveReleaseInventory(repoRoot);
if (inventory.problems.length > 0) {
  fail(`release-set inventory invalid:\n  - ${inventory.problems.join('\n  - ')}`);
}
if (inventory.order.join('\n') !== FROZEN_PUBLISH_ORDER.join('\n')) {
  fail('derived inventory order does not equal the frozen publication order.');
}

// 2. Read-only registry probe of the whole set (absence of proof blocks).
const absent = [];
for (const name of inventory.order) {
  let versionCount;
  try {
    versionCount = Object.keys(fetchPackument(name).versions ?? {}).length;
  } catch (error) {
    fail(`registry probe failed for ${name}: ${error.message} — absence of proof is a blocker.`);
  }
  if (versionCount > 0) continue;
  absent.push(name);
  console.log(`  absent: ${name} (no presence at any version)`);
}

console.log(
  `\nfirst-publish-bootstrap: inventory verified — ${inventory.order.length} members; absent members needing the bootstrap: ${absent.length === 0 ? 'NONE' : absent.join(', ')}`,
);

if (absent.length === 0) {
  console.log(
    'first-publish-bootstrap: nothing to bootstrap — every member already has registry presence. Run scripts/verify-trust-preflight.mjs next.',
  );
  process.exit(0);
}

// 3. The plan (always printed; executed only behind --execute).
console.log('\nfirst-publish-bootstrap: plan (per absent member, frozen order)');
for (const name of absent) {
  const entry = inventory.byName.get(name);
  console.log(`  ${name}:`);
  console.log(
    `    content:     the REAL built package at packages/${name.replace('@victframework/', '')} (temp-copy only; the workspace tree is never mutated)`,
  );
  console.log(
    `    placeholder: ${BOOTSTRAP_PLACEHOLDER_VERSION} (fixed constant; never the coordinated set version ${inventory.version})`,
  );
  console.log(
    `    dist-tag:    ${BOOTSTRAP_PLACEHOLDER_TAG} ('latest' stays unoccupied until the first real coordinated release)`,
  );
  console.log(
    `    publish:     npm publish <placeholder.tgz> --access public --tag ${BOOTSTRAP_PLACEHOLDER_TAG} --registry https://registry.npmjs.org/ — INTERACTIVE 2FA (contract §13 historical path; the one registered §16 exception)`,
  );
  console.log(
    `    workspace version: untouched (${entry.version} remains the coordinated candidate version)`,
  );
}
console.log(
  '    after all placeholders: scripts/trust-bootstrap.mjs --execute, then scripts/verify-trust-preflight.mjs must be AUTHORIZED for all 14 before the coordinated set publishes.',
);

if (!execute) {
  console.log(
    '\nfirst-publish-bootstrap: DRY plan only (no registry call was made). Execute requires the ratified contract + an explicit owner authorization artifact.',
  );
  process.exit(0);
}

// 4. Execute-mode gates (in order; all fail closed).
const authority = assessContractAuthorityAtRoot(repoRoot);
if (!authority.authorized) {
  console.error(
    `first-publish-bootstrap: CONTRACT AUTHORITY REFUSED — the frozen contract (${FROZEN_CONTRACT_PATH}) does not yet carry the ratified §16 state (including this first-publication exception). NO registry write was made. Gaps:`,
  );
  for (const problem of authority.problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(
  'first-publish-bootstrap: contract authority verified (§16 ratified, exception in force)',
);

let authorizationText;
try {
  authorizationText = readFileSync(resolve(authorizationPath), 'utf8');
} catch (error) {
  fail(`the owner authorization file is unreadable: ${error.message}`);
}
if (!authorizationText.includes(OWNER_AUTHORIZATION_MARKER)) {
  fail(
    `the owner authorization file does not contain the exact marker "${OWNER_AUTHORIZATION_MARKER}" with the owner's name, date, the member list (${absent.join(', ')}), and the placeholder version ${BOOTSTRAP_PLACEHOLDER_VERSION}.`,
  );
}
for (const name of absent) {
  if (!authorizationText.includes(name)) {
    fail(`the owner authorization file does not name the absent member '${name}'.`);
  }
}
if (!authorizationText.includes(BOOTSTRAP_PLACEHOLDER_VERSION)) {
  fail(
    `the owner authorization file does not record the placeholder version ${BOOTSTRAP_PLACEHOLDER_VERSION}.`,
  );
}
console.log('first-publish-bootstrap: owner authorization artifact verified');

const gitStatus = run('git', ['status', '--porcelain']);
if (gitStatus.status !== 0) fail('git status failed.');
const dirty = (gitStatus.stdout ?? '')
  .split(/\r?\n/)
  .filter((line) => line.trim().length > 0 && !line.includes('.pi/'));
if (dirty.length > 0) {
  fail(
    `the working tree is not clean — run the bootstrap from the release checkout:\n${dirty.join('\n')}`,
  );
}

// 5. Publish the placeholders (interactive 2FA; stop at first failure).
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
for (const name of absent) {
  const bareName = name.replace('@victframework/', '');
  const work = mkdtempSync(join(tmpdir(), 'vict-first-publish-'));
  try {
    cpSync(join(repoRoot, 'packages', bareName), join(work, bareName), {
      recursive: true,
      filter: (source) =>
        !source.includes(`${bareName}${join('node_modules')}`) && !source.includes('dist'),
    });
    // Re-version the TEMP COPY only. The workspace manifest is never mutated.
    const manifestPath = join(work, bareName, 'package.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (manifest.name !== name) fail(`temp-copy manifest name mismatch for ${name}.`);
    manifest.version = BOOTSTRAP_PLACEHOLDER_VERSION;
    const { writeFileSync } = await import('node:fs');
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const pack = run(npm, ['pack', join(work, bareName), '--pack-destination', work, '--silent'], {
      cwd: work,
    });
    if (pack.status !== 0) {
      fail(`npm pack failed for the ${name} placeholder (exit ${pack.status}).`);
    }
    const tgzName = (pack.stdout ?? '').trim().split(/\r?\n/).at(-1)?.trim();
    if (tgzName === undefined || !existsSync(join(work, tgzName))) {
      fail(`could not locate the packed placeholder tarball for ${name}.`);
    }
    console.log(
      `\nfirst-publish-bootstrap: publishing ${name}@${BOOTSTRAP_PLACEHOLDER_VERSION} — complete the npm 2FA challenge in the official npm flow when prompted...`,
    );
    const publish = spawnSync(
      npm,
      [
        'publish',
        join(work, tgzName),
        '--access',
        'public',
        '--tag',
        BOOTSTRAP_PLACEHOLDER_TAG,
        '--registry',
        'https://registry.npmjs.org/',
      ],
      { stdio: 'inherit', shell: process.platform === 'win32', cwd: work },
    );
    if (publish.status !== 0) {
      fail(
        `the placeholder publish for ${name} failed (exit ${publish.status}); nothing is retried or rolled back — successful publications are immutable.`,
      );
    }
    console.log(
      `  published: ${name}@${BOOTSTRAP_PLACEHOLDER_VERSION} under '${BOOTSTRAP_PLACEHOLDER_TAG}'`,
    );
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

console.log(
  `\nfirst-publish-bootstrap: placeholders published for ${absent.join(', ')}. NEXT: scripts/trust-bootstrap.mjs --execute, then scripts/verify-trust-preflight.mjs must report AUTHORIZED for all 14 members before the coordinated set publishes.`,
);
