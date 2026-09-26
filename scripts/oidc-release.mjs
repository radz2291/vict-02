#!/usr/bin/env node
/**
 * GitHub-OIDC coordinated release engine (trusted publishing).
 *
 * Implements the frozen contract in
 * `docs/RELEASE-TRUSTED-PUBLISHING-CONTRACT.md` as four subcommands used
 * by `.github/workflows/release.yml` (and usable locally for
 * deterministic validation):
 *
 *   validate        — inputs, source-SHA lineage, release-set coherence,
 *                     and the unpublished/resume registry guard
 *   pack            — pack the ACTUAL release tarballs into one directory
 *   publish         — publish those exact tarballs in frozen topological
 *                     order through npm OIDC (no token of any kind)
 *   verify-registry — prove registry integrity/tag state equal to the
 *                     packed artifacts and record release evidence
 *
 * Safety model (frozen):
 * - fail closed on every violated rule; never warn-and-continue;
 * - NEVER overwrite, re-publish, or unpublish an existing version;
 * - on partial failure stop immediately and report the exact published
 *   subset (never unpublish); a later run may resume ONLY through the
 *   `resume_from_package` input, and every already-published member must
 *   then prove byte-identical registry integrity against the local
 *   tarball before anything is published;
 * - no token, secret, or `_auth` material is ever read, written, or
 *   passed to npm: publication authority comes from the GitHub OIDC
 *   exchange performed by npm itself (`id-token: write`);
 * - no dist-tag mutation commands exist here (publish authority only).
 *
 * Inputs are accepted as CLI flags or, equivalently, as environment
 * variables (the workflow passes env vars only — no shell interpolation
 * of untrusted data):
 *
 *   RELEASE_SOURCE_SHA / RELEASE_VERSION / RELEASE_NPM_TAG /
 *   RELEASE_RESUME_FROM
 *
 * Usage:
 *   node scripts/oidc-release.mjs validate [--source-sha S] [--version V]
 *        [--tag T] [--resume-from P] [--repo-root R]
 *   node scripts/oidc-release.mjs pack --pack-dir D [--repo-root R]
 *   node scripts/oidc-release.mjs publish [--source-sha S] [--version V]
 *        [--tag T] [--resume-from P] --pack-dir D --results-file F
 *        [--repo-root R]
 *   node scripts/oidc-release.mjs verify-registry [--version V] [--tag T]
 *        --pack-dir D --results-file F [--repo-root R]
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveReleaseSetContentId, normalizeResumeInput } from './lib/release-set.mjs';
import { matchTarballSet } from './lib/tarball-set.mjs';
import { readTarballMember } from './lib/tarball-io.mjs';
import {
  deriveReleaseInventory,
  PUBLIC_REGISTRY,
  publishArgv,
  SOURCE_SHA_PATTERN,
  validateVersionTagPair,
} from './lib/release-set.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = resolve(scriptDir, '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npmSpawnOptions = { shell: process.platform === 'win32' };

function fail(message) {
  console.error(`oidc-release: BLOCKED — ${message}`);
  process.exit(1);
}

function ok(label) {
  console.log(`  ok: ${label}`);
}

// ---- argument parsing (flags OR environment; flags win) --------------------

function parseArgs(argv) {
  const args = { repoRoot: DEFAULT_REPO_ROOT };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    switch (flag) {
      case '--source-sha':
        args.sourceSha = value;
        index += 1;
        break;
      case '--version':
        args.version = value;
        index += 1;
        break;
      case '--tag':
        args.tag = value;
        index += 1;
        break;
      case '--resume-from':
        args.resumeFrom = value;
        index += 1;
        break;
      case '--pack-dir':
        args.packDir = value;
        index += 1;
        break;
      case '--results-file':
        args.resultsFile = value;
        index += 1;
        break;
      case '--repo-root':
        args.repoRoot = resolve(value);
        index += 1;
        break;
      default:
        fail(`unknown argument '${flag}'`);
    }
  }
  // Workflow inputs arrive as environment variables only.
  args.sourceSha ??= process.env.RELEASE_SOURCE_SHA;
  args.version ??= process.env.RELEASE_VERSION;
  args.tag ??= process.env.RELEASE_NPM_TAG;
  args.resumeFrom ??= process.env.RELEASE_RESUME_FROM;
  args.resumeFrom = normalizeResumeInput(args.resumeFrom);
  return args;
}

// ---- shared validation pieces ----------------------------------------------

function run(command, argv, options = {}) {
  return spawnSync(command, argv, {
    encoding: 'utf8',
    cwd: options.cwd ?? DEFAULT_REPO_ROOT,
    ...npmSpawnOptions,
    ...options,
  });
}

/**
 * Verify the source-SHA belongs to the permitted main lineage (contract
 * §6): the SHA must resolve to a commit object and must be an ancestor of
 * the freshly fetched `origin/main`.
 */
function validateLineage(repoRoot, sourceSha) {
  const git = (gitArgs, label) => {
    const result = spawnSync('git', gitArgs, { encoding: 'utf8', cwd: repoRoot });
    if (result.status !== 0) {
      fail(`${label} failed (exit ${result.status}): ${(result.stderr ?? '').trim()}`);
    }
    return (result.stdout ?? '').trim();
  };
  git(['fetch', 'origin', 'main'], 'git fetch origin main');
  const resolved = git(['rev-parse', '--verify', `${sourceSha}^{commit}`], 'git rev-parse');
  if (resolved !== sourceSha) {
    fail(`source SHA input '${sourceSha}' resolved to a different object '${resolved}'.`);
  }
  git(['merge-base', '--is-ancestor', sourceSha, 'origin/main'], 'git merge-base --is-ancestor');
  ok(`source SHA ${sourceSha} resolves and is an ancestor of origin/main`);
}

/**
 * Registry existence probe for one exact package version (never caches;
 * a registry failure fails closed — absence of proof is treated as a
 * blocker, not as "unpublished").
 */
function fetchPackument(name) {
  const url = `${PUBLIC_REGISTRY}${encodeURIComponent(name)}`;
  const response = fetchSync(url);
  if (response.kind === 'error') {
    fail(`the public npm registry is unreachable for ${name}: ${response.message}`);
  }
  if (response.kind === 'not-found') {
    return { name, versions: {}, 'dist-tags': {} };
  }
  let packument;
  try {
    packument = JSON.parse(response.body);
  } catch {
    fail(`the registry returned unparseable metadata for ${name}.`);
  }
  return packument;
}

/**
 * Small, dependency-free synchronous GET with a bounded timeout.
 * Windows Node 22 supports synchronous fetch only via this child trick —
 * spawn the resident `node` with an inline fetch script (no shell).
 */
function fetchSync(url) {
  const script = `
    const url = process.argv[1];
    fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(30_000) })
      .then(async (response) => {
        if (response.status === 404) { console.log(JSON.stringify({ kind: 'not-found' })); return; }
        if (!response.ok) { console.log(JSON.stringify({ kind: 'error', message: 'HTTP ' + response.status })); return; }
        const body = await response.text();
        console.log(JSON.stringify({ kind: 'ok', body }));
      })
      .catch((error) => { console.log(JSON.stringify({ kind: 'error', message: String(error && error.message) })); });
  `;
  const result = spawnSync(process.execPath, ['-e', script, url], {
    encoding: 'utf8',
    timeout: 60_000,
  });
  if (result.status !== 0) {
    return { kind: 'error', message: `probe exited ${result.status}` };
  }
  const line = (result.stdout ?? '').trim().split(/\r?\n/).at(-1) ?? '';
  try {
    return JSON.parse(line);
  } catch {
    return { kind: 'error', message: 'unparseable probe output' };
  }
}

/**
 * The frozen resume split (contract §10): with a resume point, every
 * member BEFORE it must already exist (integrity proof happens where the
 * local tarball exists), and every member AT/AFTER it must be
 * unpublished. Without a resume point, all 15 must be unpublished.
 */
function validateUnpublishedGuard(inventory, version, resumeFrom) {
  const order = inventory.order;
  if (resumeFrom !== undefined) {
    // Accept both the bare directory name ('sdk') and the full package
    // name ('@victframework/sdk'); anything else is refused.
    const bare = resumeFrom.replace(/^@victframework\//, '');
    const fullName = `@victframework/${bare}`;
    if (!order.includes(fullName)) {
      fail(
        `resume point '${resumeFrom}' is not a release-set member (members: ${order.join(', ')}).`,
      );
    }
    resumeFrom = fullName;
  }
  // Without a resume point NOTHING may be published yet; with one, only
  // the members BEFORE it may exist (contract §10).
  const resumeIndex = resumeFrom === undefined ? 0 : order.indexOf(resumeFrom);
  const published = [];
  const unpublished = [];
  for (let index = 0; index < order.length; index += 1) {
    const name = order[index];
    const packument = fetchPackument(name);
    const exists = packument.versions?.[version] !== undefined;
    if (index < resumeIndex) {
      if (!exists) {
        fail(
          `resume mismatch: ${name}@${version} is NOT published, but it precedes the resume point '${resumeFrom}'.`,
        );
      }
      published.push(name);
    } else {
      if (exists) {
        fail(
          `${name}@${version} already exists in the registry — never overwrite or re-publish a used version.`,
        );
      }
      unpublished.push(name);
    }
  }
  if (published.length > 0) {
    ok(`resume prefix verified published: ${published.join(', ')}`);
  }
  ok(`unpublished for all remaining members: ${unpublished.length} package(s) at ${version}`);
  return { published, unpublished };
}

/** SHA-512 integrity string (npm `dist.integrity` format) of a tarball. */
function tarballIntegrity(tgzPath) {
  const digest = createHash('sha512').update(readFileSync(tgzPath)).digest('base64');
  return `sha512-${digest}`;
}

/** `npm view <pkg>@<version> dist.integrity --json` (fails closed). */
function registryIntegrity(name, version) {
  const result = run(npm, ['view', `${name}@${version}`, 'dist.integrity', '--json'], {});
  if (result.status !== 0) {
    fail(`npm view ${name}@${version} dist.integrity failed (exit ${result.status}).`);
  }
  const value = JSON.parse((result.stdout ?? '').trim());
  if (typeof value !== 'string' || value.length === 0) {
    fail(`registry integrity for ${name}@${version} is missing.`);
  }
  return value;
}

/**
 * Read the pack directory and match the ACTUAL tarballs against the
 * expected identities by the metadata INSIDE each tarball
 * (canonical npm-pack naming; scripts/lib/tarball-set.mjs).
 */
function matchPackDir(repoRoot, packDir, inventory) {
  const expected = inventory.order.map((name) => ({
    name,
    version: inventory.byName.get(name).version,
  }));
  const found = readdirSync(packDir)
    .filter((fileName) => fileName.endsWith('.tgz'))
    .map((fileName) => {
      try {
        // Read identity from the tarball's own package metadata.
        const out = readTarballMember(join(packDir, fileName), 'package/package.json');
        const parsed = JSON.parse(out);
        return { fileName, name: parsed.name, version: parsed.version };
      } catch (error) {
        return { fileName, error: error.message };
      }
    });
  const result = matchTarballSet(expected, found);
  if (!result.ok) {
    fail(
      `packed tarball set does not match the release inventory:\n  - ${result.problems.join('\n  - ')}`,
    );
  }
  return result;
}

// ---- subcommands ------------------------------------------------------------

function commandValidate(args) {
  const { repoRoot, sourceSha, version, tag, resumeFrom } = args;
  if (sourceSha === undefined || !SOURCE_SHA_PATTERN.test(sourceSha)) {
    fail('a full 40-hex source SHA is required (got missing/malformed input).');
  }
  const tagVerdict = validateVersionTagPair(version, tag);
  if (!tagVerdict.ok) fail(tagVerdict.reason);
  ok(`version/tag rule satisfied: ${version} under ${tagVerdict.tag}`);

  const inventory = deriveReleaseInventory(repoRoot);
  if (inventory.problems.length > 0) {
    fail(`release-set inventory invalid:\n  - ${inventory.problems.join('\n  - ')}`);
  }
  if (inventory.version !== version) {
    fail(
      `requested version '${version}' does not equal the coherent manifest version '${inventory.version}'.`,
    );
  }
  ok(`release-set inventory coherent: ${inventory.order.length} packages at ${version}`);

  const setCheck = run('node', [join(scriptDir, 'check-release-set.mjs')], {
    capture: true,
    cwd: repoRoot,
  });
  if (setCheck.status !== 0) {
    process.stdout.write(setCheck.stdout ?? '');
    process.stderr.write(setCheck.stderr ?? '');
    fail('verify:release-set failed against the checked-out source.');
  }
  ok('verify:release-set passed (recorded identity matches the manifests)');

  validateLineage(repoRoot, sourceSha);
  validateUnpublishedGuard(inventory, version, resumeFrom);

  console.log(`\noidc-release: validation PASSED — ${version} under '${tag}' from ${sourceSha}`);
}

function commandPack(args) {
  const { repoRoot, packDir } = args;
  if (packDir === undefined) fail('pack requires --pack-dir <dir>.');
  const inventory = deriveReleaseInventory(repoRoot);
  if (inventory.problems.length > 0) {
    fail(`release-set inventory invalid:\n  - ${inventory.problems.join('\n  - ')}`);
  }
  rmSync(packDir, { recursive: true, force: true });
  mkdirSync(packDir, { recursive: true });
  for (const name of inventory.order) {
    const entry = inventory.byName.get(name);
    const result = run(npm, ['pack', entry.dir, '--pack-destination', packDir, '--silent'], {});
    if (result.status !== 0) {
      process.stderr.write(result.stderr ?? '');
      fail(`npm pack failed for ${name}.`);
    }
  }
  matchPackDir(repoRoot, packDir, inventory);
  ok(`packed exactly ${inventory.order.length} canonical tarballs into ${packDir}`);
}

function commandPublish(args) {
  const { repoRoot, packDir, resultsFile, sourceSha, version, tag, resumeFrom } = args;
  if (packDir === undefined || !existsSync(packDir)) fail('publish requires a valid --pack-dir.');
  if (resultsFile === undefined) fail('publish requires --results-file <path>.');
  const tagVerdict = validateVersionTagPair(version, tag);
  if (!tagVerdict.ok) fail(tagVerdict.reason);
  if (sourceSha !== undefined && !SOURCE_SHA_PATTERN.test(sourceSha)) {
    fail('source SHA, when provided, must be a full 40-hex commit SHA.');
  }

  const inventory = deriveReleaseInventory(repoRoot);
  if (inventory.problems.length > 0) {
    fail(`release-set inventory invalid:\n  - ${inventory.problems.join('\n  - ')}`);
  }
  if (inventory.version !== version) {
    fail(
      `requested version '${version}' does not equal the coherent manifest version '${inventory.version}'.`,
    );
  }
  const matched = matchPackDir(repoRoot, packDir, inventory);

  const guard = validateUnpublishedGuard(inventory, version, resumeFrom);

  // Resume proof: every already-published member must be BYTE-IDENTICAL
  // to the local artifact (contract §10) before anything new publishes.
  for (const name of guard.published) {
    const tgzPath = join(packDir, matched.byName.get(name).fileName);
    const local = tarballIntegrity(tgzPath);
    const remote = registryIntegrity(name, version);
    if (local !== remote) {
      fail(
        `resume integrity mismatch for ${name}@${version}: registry ${remote} != local ${local} — refusing to resume a changed artifact.`,
      );
    }
    ok(`resume integrity proof: ${name}@${version} matches the local artifact byte-for-byte`);
  }

  // Content-derived release-set identity — THE RECORDED derivation
  // (RELEASE-COMPATIBILITY.md §2: sha256 over the sorted newline-joined
  // `name@version` list; identical to check-release-set.mjs). A previous
  // engine draft hashed a JSON.stringify of the list instead, producing a
  // divergent evidence identity (observed on run 35530894104); the
  // recorded algorithm is authoritative.
  const contentId = deriveReleaseSetContentId(
    inventory.order.map((name) => `${name}@${inventory.byName.get(name).version}`),
  );

  const results = {
    sourceSha: sourceSha ?? null,
    releaseSetIdentity: `vict-release-set@1/${version}`,
    contentId,
    version,
    tag,
    registry: PUBLIC_REGISTRY,
    packages: [],
    startedAt: new Date().toISOString(),
  };
  const writeResults = () => {
    mkdirSync(dirname(resultsFile), { recursive: true });
    writeFileSync(resultsFile, `${JSON.stringify(results, null, 2)}\n`);
  };
  writeResults();

  let stopped;
  const publishedNames = [];
  for (const name of inventory.order) {
    if (guard.published.includes(name)) {
      results.packages.push({ name, version, status: 'already-published (integrity-verified)' });
      writeResults();
      continue;
    }
    const tgzPath = join(packDir, matched.byName.get(name).fileName);
    const integrity = tarballIntegrity(tgzPath);
    console.log(`\npublishing ${name}@${version} ...`);
    const result = run(npm, publishArgv(tgzPath, tagVerdict.tag), {});
    if (result.status !== 0) {
      stopped = { name, exit: result.status, stderr: (result.stderr ?? '').trim() };
      results.packages.push({
        name,
        version,
        status: 'FAILED',
        integrity,
        exit: result.status,
      });
      writeResults();
      break;
    }
    results.packages.push({ name, version, status: 'published', integrity });
    writeResults();
    publishedNames.push(`${name}@${version}`);
    console.log(`  published: ${name}@${version}`);
  }

  if (stopped !== undefined) {
    console.error(`\noidc-release: STOPPED at ${stopped.name}@${version} (exit ${stopped.exit}).`);
    console.error(`Published subset (${publishedNames.length} this run):`);
    for (const entry of publishedNames) console.error(`  - ${entry}`);
    console.error('Unpublished remainder (resume with --resume-from when safe):');
    for (const name of inventory.order) {
      if (!guard.published.includes(name) && !publishedNames.includes(`${name}@${version}`)) {
        console.error(`  - ${name}@${version}`);
      }
    }
    console.error('Successful publications are preserved (never unpublished, never mutated).');
    fail(`publication failed at ${stopped.name}: ${stopped.stderr.slice(0, 500)}`);
  }
  console.log(`\noidc-release: ALL ${inventory.order.length} PACKAGES PUBLISHED under '${tag}'`);
  console.log(`release-set identity: vict-release-set@1/${version} (${contentId.slice(0, 18)}…)`);
}

function commandVerifyRegistry(args) {
  const { repoRoot, packDir, resultsFile, version, tag } = args;
  const tagVerdict = validateVersionTagPair(version, tag);
  if (!tagVerdict.ok) fail(tagVerdict.reason);
  const inventory = deriveReleaseInventory(repoRoot);
  const matched = matchPackDir(repoRoot, packDir, inventory);

  // Registry propagation lag: immediately after the LAST publish, CDN
  // replicas can still serve STALE packuments for freshly published
  // packages (observed on run 35530894104: all 13 publishes succeeded,
  // every immediate read reported the version 'missing', and every read
  // minutes later verified clean). Verification is therefore retried on
  // a bounded backoff. The retries are READ-ONLY — they never publish,
  // mutate, or unpublish anything — and a final failed pass still fails
  // the run closed.
  const VERIFY_ATTEMPTS = 12;
  const VERIFY_BACKOFF_MS = 10_000;
  let rows = [];
  let failures = 0;
  for (let attempt = 1; attempt <= VERIFY_ATTEMPTS; attempt += 1) {
    rows = [];
    failures = 0;
    for (const name of inventory.order) {
      const tgzPath = join(packDir, matched.byName.get(name).fileName);
      const local = tarballIntegrity(tgzPath);
      const packument = fetchPackument(name);
      const registry = packument.versions?.[version];
      const problems = [];
      if (registry === undefined) {
        problems.push('version missing in registry');
      } else {
        const remoteIntegrity = registry.dist?.integrity;
        if (remoteIntegrity !== local) {
          problems.push(
            `integrity mismatch (registry ${remoteIntegrity ?? 'missing'} vs local ${local})`,
          );
        }
      }
      const tags = packument['dist-tags'] ?? {};
      if (tags[tag] !== version) {
        problems.push(`dist-tag '${tag}' is '${tags[tag] ?? 'missing'}', expected '${version}'`);
      }
      if (tag !== 'latest' && tags.latest === version) {
        problems.push('latest must never point at a candidate version');
      }
      if (problems.length > 0) {
        failures += 1;
        rows.push({ name, version, integrity: local, ok: false, problems });
      } else {
        rows.push({ name, version, integrity: local, ok: true, problems: [] });
      }
    }
    if (failures === 0) {
      for (const row of rows) {
        console.log(`  ok: ${row.name}@${row.version} integrity + dist-tag verified`);
      }
      break;
    }
    if (attempt < VERIFY_ATTEMPTS) {
      console.log(
        `  ${failures} package(s) not yet visible on the registry (attempt ${attempt}/${VERIFY_ATTEMPTS}); waiting ${VERIFY_BACKOFF_MS / 1000}s before the read-only re-check (registry propagation lag)...`,
      );
      // Portable bounded wait (the workflow runs on ubuntu-latest).
      spawnSync(process.execPath, ['-e', `setTimeout(() => {}, ${VERIFY_BACKOFF_MS})`], {
        stdio: 'ignore',
      });
    }
  }
  for (const row of rows) {
    if (!row.ok) {
      console.error(`  FAIL: ${row.name}@${row.version}: ${row.problems.join('; ')}`);
    }
  }

  let results;
  try {
    results = JSON.parse(readFileSync(resultsFile, 'utf8'));
  } catch {
    results = {};
  }
  results.registryVerification = {
    verifiedAt: new Date().toISOString(),
    tag,
    version,
    packages: rows,
    ok: failures === 0,
  };
  writeFileSync(resultsFile, `${JSON.stringify(results, null, 2)}\n`);

  if (process.env.GITHUB_STEP_SUMMARY !== undefined) {
    const identity = results.releaseSetIdentity ?? `vict-release-set@1/${version}`;
    const lines = [
      '## VICT coordinated release (GitHub OIDC trusted publishing)',
      '',
      `- Release-set identity: \`${identity}\``,
      `- Content-derived ID: \`${results.contentId ?? 'n/a'}\``,
      `- Source SHA: \`${results.sourceSha ?? 'n/a'}\``,
      `- Dist-tag: \`${tag}\` → \`${version}\``,
      '',
      '| Package | Version | Integrity (sha512) | Result |',
      '| --- | --- | --- | --- |',
    ];
    for (const row of rows) {
      lines.push(
        `| ${row.name} | ${row.version} | \`${row.integrity.slice(0, 24)}…\` | ${row.ok ? '✅ verified' : `❌ ${row.problems.join('; ')}`} |`,
      );
    }
    lines.push('');
    const previous = readFileSync(process.env.GITHUB_STEP_SUMMARY, 'utf8');
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, `${previous}${lines.join('\n')}\n`);
  }

  if (failures > 0) fail(`registry verification failed for ${failures} package(s).`);
  console.log(`\noidc-release: REGISTRY STATE VERIFIED for all ${inventory.order.length} packages`);
}

// ---- dispatch ---------------------------------------------------------------

const [command] = process.argv.slice(2);
const args = parseArgs(process.argv.slice(3));
switch (command) {
  case 'validate':
    commandValidate(args);
    break;
  case 'pack':
    commandPack(args);
    break;
  case 'publish':
    commandPublish(args);
    break;
  case 'verify-registry':
    commandVerifyRegistry(args);
    break;
  default:
    fail(
      `unknown command '${command ?? ''}' (expected validate | pack | publish | verify-registry).`,
    );
}
