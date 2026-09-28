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
 *      The placeholder is a REGISTRY-PRESENCE MARKER, not a functional
 *      release: it carries the REAL built package content with the REAL
 *      dependency pins, which is exactly why members depending on the
 *      (still unpublished) coordinated versions are NOT installable
 *      until the coordinated set publishes — resolution fails by design.
 *      It is registry-immutable lineage once published; `latest` stays
 *      unoccupied. Its only purpose is to make the package EXIST so its
 *      trust relationship can be configured.
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
 *   node scripts/first-publish-bootstrap.mjs --inspect  # build + inspect the actual dry-run tarballs (no registry write)
 *   node scripts/first-publish-bootstrap.mjs --execute \
 *        --authorization path/to/owner-authorization.txt
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assessContractAuthorityAtRoot, FROZEN_CONTRACT_PATH } from './lib/contract-authority.mjs';
import { buildBootstrapCandidate } from './lib/bootstrap-pack.mjs';
import { fetchPackument } from './lib/registry-probe.mjs';
import {
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
const inspect = process.argv.includes('--inspect');
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

// 2b. Artifact inspection (--inspect): build + pack --dry-run per absent
//     member and VALIDATE the actual tarball against the manifest. No
//     registry write of any kind; the workspace is only built in place.
if (inspect) {
  console.log(
    '\nfirst-publish-bootstrap: INSPECTING the placeholder artifacts (dry-run tarballs; no registry write)',
  );
  let failed = false;
  for (const name of absent) {
    console.log(`\n  ${name}:`);
    let candidate;
    try {
      candidate = buildBootstrapCandidate({
        repoRoot,
        name,
        log: (line) => console.log(`    ${line}`),
      });
    } catch (error) {
      console.error(`    BUILD/PACK FAILED: ${error.message}`);
      failed = true;
      continue;
    }
    console.log(`    placeholder version: ${candidate.manifest.version}`);
    console.log(
      `    tarball would be:    ${candidate.packSummary.filename} (${candidate.packSummary.size} bytes, ${candidate.fileList.length} files)`,
    );
    for (const path of candidate.fileList) console.log(`      - ${path}`);
    if (candidate.problems.length > 0) {
      failed = true;
      for (const problem of candidate.problems) console.error(`    VALIDATION FAILURE: ${problem}`);
    } else {
      console.log(
        '    validation: every declared export/main/types target present; files allowlist covered; dependency pins verbatim.',
      );
      const deps = candidate.manifest.dependencies ?? {};
      const pinnedToCoordinated = Object.values(deps).some((spec) => spec === inventory.version);
      console.log(
        pinnedToCoordinated
          ? `    installability: NOT installable until the coordinated set publishes (dependencies pin ${inventory.version}, which is unpublished) — registry-presence marker by design.`
          : '    installability: no dependencies — the placeholder itself installs standalone, but it remains a registry-presence marker, NOT a functional release (never a candidate/stable version, never `latest`).',
      );
    }
    rmSync(candidate.workDir, { recursive: true, force: true });
  }
  if (failed) {
    fail(
      'placeholder artifact inspection FAILED — the broken or incomplete artifact must never be published.',
    );
  }
  console.log(
    '\nfirst-publish-bootstrap: all inspected placeholder artifacts are complete and truthful. No registry write was made.',
  );
  process.exit(0);
}

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
    `    content:     the REAL BUILT package at packages/${name.replace('@victframework/', '')} (workspace build + temp-copy; dist included; the workspace tree is never mutated)`,
  );
  console.log(
    `    placeholder: ${BOOTSTRAP_PLACEHOLDER_VERSION} (fixed constant; never the coordinated set version ${inventory.version})`,
  );
  console.log(
    `    dist-tag:    ${BOOTSTRAP_PLACEHOLDER_TAG} ('latest' stays unoccupied until the first real coordinated release)`,
  );
  console.log(
    `    truth:       registry-presence marker, NOT a functional release — members whose dependencies pin the unpublished coordinated version are not installable until the set publishes (by design; run --inspect for the artifact proof)`,
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
  let candidate;
  try {
    // Build the REAL candidate (workspace build + faithful temp copy +
    // re-version) and VALIDATE the actual artifact before publishing it.
    candidate = buildBootstrapCandidate({
      repoRoot,
      name,
      log: (line) => console.log(`  ${line}`),
    });
    if (candidate.problems.length > 0) {
      for (const problem of candidate.problems) console.error(`  - ${problem}`);
      fail(
        `the ${name} placeholder artifact failed validation — never publish a broken or incomplete artifact.`,
      );
    }

    // Real pack from the validated candidate directory (same temp root).
    const pack = run(
      npm,
      ['pack', candidate.candidateDir, '--pack-destination', candidate.workDir, '--silent'],
      {
        cwd: candidate.workDir,
      },
    );
    if (pack.status !== 0) {
      fail(`npm pack failed for the ${name} placeholder (exit ${pack.status}).`);
    }
    const tgzName = (pack.stdout ?? '').trim().split(/\r?\n/).at(-1)?.trim();
    if (tgzName === undefined || !existsSync(join(candidate.workDir, tgzName))) {
      fail(`could not locate the packed placeholder tarball for ${name}.`);
    }
    console.log(
      `\nfirst-publish-bootstrap: publishing ${name}@${BOOTSTRAP_PLACEHOLDER_VERSION} — complete the npm 2FA challenge in the official npm flow when prompted...`,
    );
    const publish = spawnSync(
      npm,
      [
        'publish',
        join(candidate.workDir, tgzName),
        '--access',
        'public',
        '--tag',
        BOOTSTRAP_PLACEHOLDER_TAG,
        '--registry',
        'https://registry.npmjs.org/',
      ],
      { stdio: 'inherit', shell: process.platform === 'win32', cwd: candidate.workDir },
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
    if (candidate !== undefined) rmSync(candidate.workDir, { recursive: true, force: true });
  }
}

console.log(
  `\nfirst-publish-bootstrap: placeholders published for ${absent.join(', ')}. NEXT: scripts/trust-bootstrap.mjs --execute, then scripts/verify-trust-preflight.mjs must report AUTHORIZED for all 14 members before the coordinated set publishes.`,
);
