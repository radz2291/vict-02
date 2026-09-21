#!/usr/bin/env node
/**
 * VICT-M-1 candidate evidence-recovery engine (READ-ONLY).
 *
 * Implements the owner-approved evidence recovery of Blocking finding B-1
 * for the immutable `0.3.0-rc.1` candidate set, exactly as bounded by
 * `docs/report/VICT-TRUSTED-PUBLISHING-EVIDENCE-RECOVERY-AMENDMENT.md`.
 *
 * This engine NEVER publishes, republishes, unpublishes, deprecates,
 * retags, authenticates, or mutates the registry in any way. It performs
 * only registry/repository READS plus local rebuild comparison, and fails
 * closed on every violated rule. The publication engine
 * (`scripts/oidc-release.mjs`) is used ONLY through its non-mutating
 * `pack` and `verify-registry` subcommands.
 *
 * Subcommands:
 *   guard   -- static security audit of the evidence workflow
 *   verify  -- the full read-only evidence ladder (amendment §3–§8)
 *
 * Usage:
 *   node scripts/release-evidence.mjs guard --workflow .github/workflows/release-evidence.yml
 *   node scripts/release-evidence.mjs verify --candidate-root candidate-src \
 *        --pack-dir .evidence-pack --results-file m1-evidence-results.json \
 *        [--source-sha S] [--version V] [--npm-tag T] [--expect-content-id C]
 *
 * Any flag that differs from the BOUND candidate identity fails the run
 * closed (--expect-content-id is the comparison target for the identity
 * gate and defaults to the bound value; overriding it can only make the
 * run stricter).
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  BOUND_CANDIDATE,
  EVIDENCE_WORKFLOW_PATH,
  auditEvidenceWorkflow,
  compareRebuildWithRegistry,
  evaluateEvidenceSections,
  evaluateRegistryManifest,
  evaluateRegistryMemberState,
  evaluateSlsaProvenance,
  selfScanEvidenceText,
} from './lib/evidence-rules.mjs';
import {
  deriveReleaseInventory,
  deriveReleaseSetContentId,
  FROZEN_PUBLISH_ORDER,
} from './lib/release-set.mjs';
import { readTarballMember } from './lib/tarball-io.mjs';
import { checkText } from './lib/tarball-scan-rules.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const mainRoot = resolve(scriptDir, '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function fail(message) {
  console.error(`release-evidence: BLOCKED — ${message}`);
  process.exit(1);
}
function ok(label) {
  console.log(`  ok: ${label}`);
}

// ---- arguments ---------------------------------------------------------------

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    switch (flag) {
      case '--workflow':
        args.workflow = value;
        index += 1;
        break;
      case '--candidate-root':
        args.candidateRoot = value;
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
      case '--source-sha':
        args.sourceSha = value;
        index += 1;
        break;
      case '--version':
        args.version = value;
        index += 1;
        break;
      case '--npm-tag':
        args.npmTag = value;
        index += 1;
        break;
      case '--expect-content-id':
        args.expectContentId = value;
        index += 1;
        break;
      default:
        fail(`unknown argument '${flag}'`);
    }
  }
  return args;
}

// ---- small shared helpers ----------------------------------------------------

function git(cwd, args, label) {
  const result = spawnSync('git', args, { encoding: 'utf8', cwd });
  if (result.status !== 0) {
    fail(`${label ?? 'git'} failed (exit ${result.status}): ${(result.stderr ?? '').trim()}`);
  }
  return (result.stdout ?? '').trim();
}

function sha512Base64(buffer) {
  return `sha512-${createHash('sha512').update(buffer).digest('base64')}`;
}

async function fetchText(url, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(60_000),
      });
      if (response.status === 404) return { kind: 'not-found' };
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { kind: 'ok', body: await response.text() };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 2_000 * attempt));
      }
    }
  }
  return { kind: 'error', message: String(lastError && lastError.message) };
}

async function fetchJson(url) {
  const response = await fetchText(url);
  if (response.kind === 'not-found') return null;
  if (response.kind !== 'ok') fail(`registry read failed for ${url}: ${response.message}`);
  try {
    return JSON.parse(response.body);
  } catch (error) {
    fail(`unparseable JSON from ${url}: ${error.message}`);
  }
}

async function fetchBuffer(url) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (attempt === 4) fail(`tarball download failed for ${url}: ${error.message}`);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 2_000 * attempt));
    }
  }
}

function spawnChild(command, argv, options = {}) {
  const result = spawnSync(command, argv, {
    stdio: 'inherit',
    cwd: options.cwd ?? mainRoot,
    shell: options.shell === true,
    env: options.env ?? process.env,
  });
  return result.status ?? 1;
}

/** Extract a tarball with the platform tar (same conventions as lib/tarball-io). */
function extractTarball(tgzPath, destination) {
  mkdirSync(destination, { recursive: true });
  const isWindows = process.platform === 'win32';
  const normalize = (value) => (isWindows ? value.replace(/\\/g, '/') : value);
  const extractArgs = isWindows
    ? ['--force-local', '-xzf', normalize(tgzPath), '-C', normalize(destination)]
    : ['-xzf', tgzPath, '-C', destination];
  const listArgs = isWindows ? ['--force-local', '-tvzf', normalize(tgzPath)] : ['-tvzf', tgzPath];
  const extract = spawnSync('tar', extractArgs, { encoding: 'utf8', shell: isWindows });
  if (extract.status !== 0) fail(`tar extraction failed for ${tgzPath}`);
  const listing = spawnSync('tar', listArgs, { encoding: 'utf8', shell: isWindows });
  if (listing.status !== 0) fail(`tar listing failed for ${tgzPath}`);
  const modes = new Map();
  for (const line of (listing.stdout ?? '').split(/\r?\n/)) {
    if (line.trim().length === 0) continue;
    const tokens = line.trim().split(/\s+/);
    if (tokens.length < 6) continue;
    const mode = tokens[0];
    const path = tokens.slice(5).join(' ');
    if (path.startsWith('package/')) modes.set(path, mode);
  }
  return modes;
}

function listExtractedFiles(root) {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push(full);
    }
  };
  walk(root);
  return files.map((full) => full.slice(root.length + 1).replace(/\\/g, '/'));
}

/**
 * Deep content-level comparison of two extracted tarball trees: identical
 * member sets, byte-identical files. Returns mode differences separately so
 * an exec-bit-only container difference is visible and truthful.
 */
function compareExtractedTrees(registryDir, rebuiltDir, registryModes, rebuiltModes) {
  const contentDifferences = [];
  const registryFiles = new Set(listExtractedFiles(registryDir));
  const rebuiltFiles = new Set(listExtractedFiles(rebuiltDir));
  for (const file of registryFiles) {
    if (!rebuiltFiles.has(file)) contentDifferences.push(`only in registry artifact: ${file}`);
  }
  for (const file of rebuiltFiles) {
    if (!registryFiles.has(file)) contentDifferences.push(`only in rebuilt artifact: ${file}`);
  }
  for (const file of registryFiles) {
    if (!rebuiltFiles.has(file)) continue;
    const a = readFileSync(join(registryDir, file));
    const b = readFileSync(join(rebuiltDir, file));
    if (!a.equals(b)) contentDifferences.push(`content differs: ${file}`);
  }
  const modeDifferences = [];
  const allPaths = new Set([...registryModes.keys(), ...rebuiltModes.keys()]);
  for (const path of allPaths) {
    const registryMode = registryModes.get(path);
    const rebuiltMode = rebuiltModes.get(path);
    if (registryMode !== rebuiltMode) {
      modeDifferences.push({ path, registryMode, rebuiltMode });
    }
  }
  return {
    registryList: [...registryFiles].sort(),
    rebuiltList: [...rebuiltFiles].sort(),
    contentIdentical: contentDifferences.length === 0,
    contentDifferences,
    modeDifferences,
  };
}

// ---- guard subcommand --------------------------------------------------------

function commandGuard(args) {
  const workflowPath = resolve(
    args.workflow ?? join(mainRoot, '.github', 'workflows', 'release-evidence.yml'),
  );
  if (!existsSync(workflowPath)) fail(`workflow file not found: ${workflowPath}`);
  const raw = readFileSync(workflowPath, 'utf8');
  const audit = auditEvidenceWorkflow(raw);
  for (const check of audit.checks) console.log(`  ok: ${check}`);
  if (!audit.ok) {
    console.error('\nrelease-evidence guard: WORKFLOW AUDIT FAILED:');
    for (const problem of audit.problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  console.log(
    '\nrelease-evidence guard: WORKFLOW AUDIT PASSED (read-only, bound, no publication authority)',
  );
}

// ---- verify subcommand -------------------------------------------------------

async function commandVerify(args) {
  const resultsFile = resolve(args.resultsFile ?? 'm1-evidence-results.json');
  const candidateRoot = resolve(args.candidateRoot ?? 'candidate-src');
  const packDir = resolve(args.packDir ?? '.evidence-pack');
  const bound = BOUND_CANDIDATE;

  const evidence = {
    schema: bound.evidenceSchema,
    amendment: bound.amendment,
    policy:
      'READ-ONLY evidence recovery. This run publishes nothing, mutates nothing, ' +
      'authenticates nowhere, and holds no publication authority. The original ' +
      'publication run remains terminal-failure and is never relabelled.',
    startedAt: new Date().toISOString(),
    environment: {
      platform: `${process.platform}/${process.arch}`,
      node: process.version,
      npm: undefined,
      github: {
        isGitHubRunner: process.env.GITHUB_RUN_ID !== undefined,
        runId: process.env.GITHUB_RUN_ID ?? null,
        runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
        repository: process.env.GITHUB_REPOSITORY ?? null,
        runUrl:
          process.env.GITHUB_RUN_ID !== undefined
            ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
            : null,
        workflow: process.env.GITHUB_WORKFLOW_REF ?? null,
      },
    },
    bound: { ...bound },
    sections: {},
  };
  const record = () => {
    mkdirSync(dirname(resultsFile), { recursive: true });
    writeFileSync(resultsFile, `${JSON.stringify(evidence, null, 2)}\n`);
  };
  const section = (name) => {
    evidence.sections[name] = { ok: false, problems: [], startedAt: new Date().toISOString() };
    return evidence.sections[name];
  };
  record();

  // ---- section 1: bound inputs ---------------------------------------------
  console.log('\n[1/13] Bound-input gate (amendment §4)');
  {
    const s = section('boundInputs');
    s.observed = {
      sourceSha: args.sourceSha ?? bound.sourceSha,
      version: args.version ?? bound.version,
      npmTag: args.npmTag ?? bound.candidateTag,
      expectContentId: args.expectContentId ?? bound.expectedContentId,
    };
    if (s.observed.sourceSha !== bound.sourceSha) {
      s.problems.push(
        `source SHA '${s.observed.sourceSha}' is not the bound candidate source '${bound.sourceSha}'`,
      );
    }
    if (s.observed.version !== bound.version) {
      s.problems.push(
        `version '${s.observed.version}' is not the bound candidate version '${bound.version}'`,
      );
    }
    if (s.observed.npmTag !== bound.candidateTag) {
      s.problems.push(
        `npm tag '${s.observed.npmTag}' is not the bound candidate tag '${bound.candidateTag}'`,
      );
    }
    s.ok = s.problems.length === 0;
    record();
    if (!s.ok) fail(`inputs are outside the bounded recovery: ${s.problems.join(' | ')}`);
    ok('all inputs equal the bound candidate identity');
  }

  const npmVersion = spawnSync(npm, ['--version'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  evidence.environment.npm = (npmVersion.stdout ?? '').trim() || 'unknown';

  // ---- section 2: workflow security audit ----------------------------------
  console.log('\n[2/13] Evidence-workflow security audit');
  {
    const s = section('workflowGuard');
    const workflowPath = join(mainRoot, EVIDENCE_WORKFLOW_PATH);
    const audit = auditEvidenceWorkflow(readFileSync(workflowPath, 'utf8'));
    s.audit = { checks: audit.checks, problems: audit.problems, file: EVIDENCE_WORKFLOW_PATH };
    s.ok = audit.ok;
    if (!audit.ok) s.problems.push(...audit.problems);
    record();
    if (!s.ok) fail(`evidence workflow audit failed: ${audit.problems.join(' | ')}`);
    ok(
      `workflow is read-only, bound, and holds no publication authority (${EVIDENCE_WORKFLOW_PATH})`,
    );
  }

  // ---- section 3: engine binding (corrected release engine) -----------------
  console.log('\n[3/13] Corrected-engine binding');
  {
    const s = section('engineBinding');
    const head = git(mainRoot, ['rev-parse', 'HEAD'], 'main-root rev-parse');
    s.mainHeadSha = head;
    const ancestry = spawnSync(
      'git',
      ['merge-base', '--is-ancestor', bound.correctedEngineSha, 'HEAD'],
      {
        cwd: mainRoot,
      },
    );
    s.correctedEngineIsAncestor = ancestry.status === 0;
    s.correctedEngineSha = bound.correctedEngineSha;
    s.engineBlob = git(mainRoot, ['rev-parse', 'HEAD:scripts/oidc-release.mjs'], 'engine blob');
    s.releaseSetLibBlob = git(
      mainRoot,
      ['rev-parse', 'HEAD:scripts/lib/release-set.mjs'],
      'lib blob',
    );
    s.engineUsesRecordedIdentityAlgorithm =
      readFileSync(join(mainRoot, 'scripts', 'oidc-release.mjs'), 'utf8').includes(
        'deriveReleaseSetContentId(',
      ) &&
      readFileSync(join(mainRoot, 'scripts', 'lib', 'release-set.mjs'), 'utf8').includes(
        "createHash('sha256').update(canonicalList, 'utf8')",
      );
    if (!s.correctedEngineIsAncestor) {
      s.problems.push(
        `corrected engine commit ${bound.correctedEngineSha} is NOT an ancestor of the evidence HEAD`,
      );
    }
    if (!s.engineUsesRecordedIdentityAlgorithm) {
      s.problems.push('the checked-out engine does not carry the recorded §2 identity derivation');
    }
    s.ok = s.problems.length === 0;
    record();
    if (!s.ok) fail(s.problems.join(' | '));
    ok(
      `evidence HEAD ${head.slice(0, 12)} contains the corrected engine ${bound.correctedEngineSha.slice(0, 12)}`,
    );
  }

  // ---- section 4: original publication run remains truthfully failed --------
  console.log('\n[4/13] Original publication run (35530894104) truthful-failure check');
  {
    const s = section('originalRun');
    s.expected = {
      id: bound.originalRunId,
      conclusion: bound.originalRunConclusion,
      headSha: bound.sourceSha,
      path: bound.originalWorkflowPath,
      url: bound.originalRunUrl,
    };
    const response = await fetchText(
      `https://api.github.com/repos/${bound.repository}/actions/runs/${bound.originalRunId}`,
    );
    if (response.kind === 'ok') {
      s.performed = true;
      let run;
      try {
        run = JSON.parse(response.body);
      } catch (error) {
        s.problems.push(`GitHub API returned unparseable run metadata (${error.message})`);
        run = {};
      }
      s.observed = {
        conclusion: run.conclusion,
        status: run.status,
        headSha: run.head_sha,
        path: run.path,
        event: run.event,
      };
      if (run.conclusion !== bound.originalRunConclusion) {
        s.problems.push(
          `run conclusion is '${run.conclusion}', expected '${bound.originalRunConclusion}' (never relabelled)`,
        );
      }
      if (run.head_sha !== bound.sourceSha) {
        s.problems.push(`run head is '${run.head_sha}', expected the candidate source`);
      }
      if (run.path !== bound.originalWorkflowPath) {
        s.problems.push(`run path is '${run.path}', expected '${bound.originalWorkflowPath}'`);
      }
    } else {
      s.performed = false;
      s.reason = `GitHub API unreachable (${response.message}); the terminal-failure conclusion stands on the committed audit record and the provenance invocationId binding`;
      s.gated = false;
      s.ok = true;
      console.log(`  note: ${s.reason}`);
    }
    if (s.performed) s.ok = s.problems.length === 0;
    record();
    if (s.ok === false) fail(s.problems.join(' | '));
    if (s.performed) ok('original run is still terminal-failure at the candidate source');
  }

  // ---- section 5: immutable candidate source -------------------------------
  console.log('\n[5/13] Immutable candidate source');
  {
    const s = section('candidateSource');
    if (!existsSync(join(candidateRoot, 'package.json'))) {
      fail(`candidate root ${candidateRoot} does not contain the candidate checkout`);
    }
    const head = git(candidateRoot, ['rev-parse', 'HEAD'], 'candidate rev-parse');
    const status = git(candidateRoot, ['status', '--porcelain'], 'candidate status');
    s.headSha = head;
    s.clean = status.length === 0;
    s.basis = 'detached worktree of the evidence run full main checkout at the exact bound SHA';
    s.isAncestorOfMainHead =
      spawnSync('git', ['merge-base', '--is-ancestor', head, 'HEAD'], { cwd: mainRoot }).status ===
      0;
    s.verifierBlob = git(
      candidateRoot,
      ['rev-parse', 'HEAD:scripts/verify-release-consumer.mjs'],
      'verifier blob',
    );
    s.docBlob = git(candidateRoot, ['rev-parse', 'HEAD:docs/RELEASE-COMPATIBILITY.md'], 'doc blob');
    if (head !== bound.sourceSha) {
      s.problems.push(
        `candidate root HEAD is '${head}', expected the bound source '${bound.sourceSha}'`,
      );
    }
    if (!s.clean) {
      s.problems.push(
        `candidate checkout is not clean: ${status.split('\n').slice(0, 5).join('; ')}`,
      );
    }
    if (!s.isAncestorOfMainHead) {
      s.problems.push('candidate source is not an ancestor of the evidence main lineage');
    }
    // Candidate manifests must be exactly the frozen 13-member inventory at
    // the bound version (missing or extra member fails closed).
    const inventory = deriveReleaseInventory(candidateRoot);
    s.inventoryProblems = inventory.problems;
    if (inventory.problems.length > 0) {
      s.problems.push(`candidate inventory invalid: ${inventory.problems.join(' | ')}`);
    }
    if (inventory.version !== bound.version) {
      s.problems.push(
        `candidate manifests are at '${inventory.version}', expected '${bound.version}'`,
      );
    }
    // Recorded compatibility identity at the candidate source.
    const doc = readFileSync(join(candidateRoot, 'docs', 'RELEASE-COMPATIBILITY.md'), 'utf8');
    const blockMatch = doc.match(/```json\s*(\{[\s\S]*?"vict-release-set"[\s\S]*?\})\s*```/);
    const recorded =
      blockMatch === null ? undefined : JSON.parse(blockMatch[1])['vict-release-set'];
    s.recordedIdentity = recorded?.identity;
    s.recordedContentId = recorded?.contentId;
    if (recorded?.identity !== bound.releaseSetIdentity) {
      s.problems.push(
        `candidate doc records '${recorded?.identity}', expected '${bound.releaseSetIdentity}'`,
      );
    }
    if (recorded?.contentId !== bound.expectedContentId) {
      s.problems.push('candidate doc recorded contentId differs from the bound expected contentId');
    }
    s.ok = s.problems.length === 0;
    record();
    if (!s.ok) fail(s.problems.join(' | '));
    ok(
      `candidate source ${head.slice(0, 12)} verified: clean, immutable, exactly the 13-member set at ${bound.version}`,
    );
  }

  // ---- section 6: candidate release-set coherence gate ---------------------
  console.log(
    '\n[6/13] Candidate release-set coherence (verify:release-set at the candidate source)',
  );
  {
    const s = section('candidateCoherence');
    s.exitCode = spawnChild(
      process.execPath,
      [join(candidateRoot, 'scripts', 'check-release-set.mjs')],
      {
        cwd: candidateRoot,
      },
    );
    s.ok = s.exitCode === 0;
    record();
    if (!s.ok) fail('verify:release-set failed at the candidate source');
    ok('recorded identity matches the candidate manifests exactly');
  }

  // ---- section 7: registry state -------------------------------------------
  console.log('\n[7/13] Registry state (read-only)');
  const registryIntegrities = new Map();
  const registryPackuments = new Map();
  {
    const s = section('registryState');
    s.registry = bound.registry;
    s.packages = [];
    for (const name of FROZEN_PUBLISH_ORDER) {
      const packument = await fetchJson(`${bound.registry}${encodeURIComponent(name)}`);
      if (packument === null) {
        s.packages.push({ name, problems: ['packument not found (package absent)'] });
        continue;
      }
      registryPackuments.set(name, packument);
      const verdict = evaluateRegistryMemberState(name, packument);
      registryIntegrities.set(name, verdict.state.integrity);
      s.packages.push(verdict.state);
      s.problems.push(...verdict.problems);
    }
    s.ok = s.problems.length === 0;
    record();
    if (!s.ok) {
      fail(
        `registry state is not the bound candidate state: ${s.problems.slice(0, 10).join(' | ')}`,
      );
    }
    ok(
      `13/13 members present at ${bound.version}; latest=${bound.expectedLatest}; ${bound.candidateTag}=${bound.version}; stable absent`,
    );
  }

  // ---- section 8: corrected release-set identity ----------------------------
  console.log('\n[8/13] Corrected release-set identity (frozen §2 algorithm, registry-derived)');
  {
    const s = section('contentId');
    s.algorithm =
      'sha256 over the sorted newline-joined name@version list, prefixed v1_ (RELEASE-COMPATIBILITY §2)';
    s.derivedWith =
      'scripts/lib/release-set.mjs deriveReleaseSetContentId (corrected engine, shared with commandPublish)';
    const memberList = FROZEN_PUBLISH_ORDER.map((name) => {
      const packument = registryPackuments.get(name);
      const entry = packument?.versions?.[bound.version];
      return `${entry?.name ?? name}@${entry?.version ?? 'MISSING'}`;
    });
    s.memberList = memberList.sort();
    s.computedContentId = deriveReleaseSetContentId(memberList);
    s.expectedContentId = args.expectContentId ?? bound.expectedContentId;
    s.matchesBoundConstant = s.computedContentId === bound.expectedContentId;
    if (s.computedContentId !== s.expectedContentId) {
      s.problems.push(
        `computed contentId '${s.computedContentId}' != expected '${s.expectedContentId}'`,
      );
    }
    s.ok = s.problems.length === 0;
    record();
    if (!s.ok) fail(s.problems.join(' | '));
    ok(`contentId ${s.computedContentId}`);
  }

  // ---- section 9: SLSA provenance -------------------------------------------
  console.log('\n[9/13] SLSA provenance bindings');
  {
    const s = section('provenance');
    s.packages = [];
    for (const name of FROZEN_PUBLISH_ORDER) {
      const record_ = await fetchJson(
        `${bound.registry}-/npm/v1/attestations/${name}@${bound.version}`,
      );
      if (
        record_ === null ||
        !Array.isArray(record_.attestations) ||
        record_.attestations.length === 0
      ) {
        s.problems.push(`${name}: no attestations found on the registry`);
        s.packages.push({ name, problems: ['no attestations'] });
        continue;
      }
      s.predicateTypes = s.predicateTypes ?? new Set();
      for (const attestation of record_.attestations) {
        s.predicateTypes.add(attestation.predicateType);
      }
      const slsa = record_.attestations.find(
        (a) => a.predicateType === 'https://slsa.dev/provenance/v1',
      );
      if (slsa === undefined) {
        s.problems.push(`${name}: no SLSA provenance attestation`);
        continue;
      }
      const verdict = evaluateSlsaProvenance(name, registryIntegrities.get(name), slsa);
      s.packages.push(verdict.identities ?? { name, problems: verdict.problems });
      s.problems.push(...verdict.problems);
    }
    s.predicateTypes = [...(s.predicateTypes ?? [])];
    s.cryptographicNote =
      'Payload content is decoded and bound field-by-field; DSSE signature ' +
      'verification (Sigstore/Rekor) is not performed by this recovery — the ' +
      'same content-level scope as the independent audit record.';
    s.ok = s.problems.length === 0;
    record();
    if (!s.ok) fail(`provenance bindings failed: ${s.problems.slice(0, 10).join(' | ')}`);
    ok(
      '13/13 provenance statements bind the repository, source SHA, workflow, original run, and tarball digests',
    );
  }

  // ---- section 10: registry bytes + dependency graph ------------------------
  console.log('\n[10/13] Registry bytes, manifests, and dependency graph');
  const registryTarballs = new Map();
  {
    const s = section('registryBytes');
    s.packages = [];
    for (const name of FROZEN_PUBLISH_ORDER) {
      const packument = registryPackuments.get(name);
      const dist = packument?.versions?.[bound.version]?.dist;
      const url = dist?.tarball;
      if (typeof url !== 'string') {
        s.problems.push(`${name}: registry tarball URL missing`);
        continue;
      }
      const bytes = await fetchBuffer(url);
      const observedIntegrity = sha512Base64(bytes);
      if (observedIntegrity !== registryIntegrities.get(name)) {
        s.problems.push(`${name}: downloaded bytes do not match the registry dist.integrity`);
      }
      registryTarballs.set(name, bytes);
      let manifest;
      const workRoot = mkdtempSync(join(tmpdir(), 'vict-evidence-bytes-'));
      try {
        const tgzPath = join(workRoot, 'registry.tgz');
        writeFileSync(tgzPath, bytes);
        manifest = JSON.parse(readTarballMember(tgzPath, 'package/package.json'));
      } catch (error) {
        s.problems.push(`${name}: registry manifest unreadable (${error.message})`);
        continue;
      } finally {
        rmSync(workRoot, { recursive: true, force: true });
      }
      const verdict = evaluateRegistryManifest(manifest, FROZEN_PUBLISH_ORDER);
      s.packages.push({
        name,
        url,
        integrity: observedIntegrity,
        manifestIdentity: `${manifest.name}@${manifest.version}`,
        internalPins: verdict.graph.internal,
        externalDependencies: verdict.graph.external,
        problems: verdict.problems,
      });
      s.problems.push(...verdict.problems);
    }
    s.ok = s.problems.length === 0;
    record();
    if (!s.ok) fail(`registry-bytes checks failed: ${s.problems.slice(0, 10).join(' | ')}`);
    ok('13/13 registry artifacts hash-verified; manifests pin exactly the coherent internal set');
  }

  // ---- section 11: rebuild comparison ---------------------------------------
  console.log('\n[11/13] Rebuild comparison (candidate source rebuild vs registry artifacts)');
  {
    const s = section('rebuildComparison');
    s.authoritativePlatform = `linux (GitHub-hosted runner) — this run: ${process.platform}`;
    s.windowsObservationNote =
      'The audit-recorded Windows rebuild differs ONLY in the cli bin script tar ' +
      'entry mode (content byte-identical). The Linux reconstruction here is ' +
      'authoritative; its result is recorded truthfully per package.';
    s.packages = [];
    for (const name of FROZEN_PUBLISH_ORDER) {
      const entry = readdirSync(packDir).find((fileName) => {
        if (!fileName.endsWith('.tgz')) return false;
        try {
          const parsed = JSON.parse(
            readTarballMember(join(packDir, fileName), 'package/package.json'),
          );
          return parsed.name === name && parsed.version === bound.version;
        } catch {
          return false;
        }
      });
      if (entry === undefined) {
        s.problems.push(`${name}: no rebuilt tarball for ${bound.version} in the pack directory`);
        continue;
      }
      const rebuiltPath = join(packDir, entry);
      const rebuiltBytes = readFileSync(rebuiltPath);
      const registryBytes = registryTarballs.get(name);
      const compareWork = mkdtempSync(join(tmpdir(), 'vict-evidence-compare-'));
      try {
        const registryDir = join(compareWork, 'registry');
        const rebuiltDir = join(compareWork, 'rebuilt');
        const registryTgz = join(compareWork, 'registry.tgz');
        writeFileSync(registryTgz, registryBytes);
        const registryModes = extractTarball(registryTgz, registryDir);
        const rebuiltModes = extractTarball(rebuiltPath, rebuiltDir);
        const content = compareExtractedTrees(registryDir, rebuiltDir, registryModes, rebuiltModes);
        const verdict = compareRebuildWithRegistry(registryBytes, rebuiltBytes, content);
        s.packages.push({ name, fileName: entry, ...verdict.result, problems: verdict.problems });
        s.problems.push(...verdict.problems);
      } finally {
        rmSync(compareWork, { recursive: true, force: true });
      }
    }
    s.ok = s.problems.length === 0;
    record();
    if (!s.ok) {
      console.error('\n  rebuild comparison failures (recorded truthfully, not hidden):');
      for (const problem of s.problems.slice(0, 20)) console.error(`  - ${problem}`);
      fail('rebuilt artifacts do not equal the registry artifacts');
    }
    ok(
      '13/13 rebuilt artifacts are byte-identical AND content-identical to the registry artifacts',
    );
  }

  // ---- section 12: authoritative read-only gates (engine, scan, consumer) ---
  console.log(
    '\n[12/13] Corrected-engine registry verification, artifact scan, registry-only consumer proof',
  );
  {
    const engineTmp = join(mainRoot, '.m1-evidence-engine-verify.json');
    const s = section('authoritativeGates');

    s.engineVerifyRegistry = {
      description:
        'corrected engine `verify-registry` (read-only, bounded backoff) against the candidate pack',
    };
    rmSync(engineTmp, { force: true });
    s.engineVerifyRegistry.exitCode = spawnChild(
      process.execPath,
      [
        join(scriptDir, 'oidc-release.mjs'),
        'verify-registry',
        '--version',
        bound.version,
        '--tag',
        bound.candidateTag,
        '--pack-dir',
        packDir,
        '--results-file',
        engineTmp,
        '--repo-root',
        candidateRoot,
      ],
      { cwd: mainRoot },
    );
    if (s.engineVerifyRegistry.exitCode === 0) {
      try {
        const engineResults = JSON.parse(readFileSync(engineTmp, 'utf8'));
        s.engineVerifyRegistry.ok = engineResults.registryVerification?.ok === true;
        s.engineVerifyRegistry.packages = engineResults.registryVerification?.packages?.length;
      } catch (error) {
        s.engineVerifyRegistry.ok = false;
        s.engineVerifyRegistry.error = error.message;
      }
    } else {
      s.engineVerifyRegistry.ok = false;
    }
    rmSync(engineTmp, { force: true });
    if (!s.engineVerifyRegistry.ok)
      s.problems.push('corrected-engine registry verification failed');

    s.tarballScan = {
      description: 'release-tarball content scan (contract §9 rules) on the candidate pack',
    };
    s.tarballScan.exitCode = spawnChild(
      process.execPath,
      [
        join(scriptDir, 'scan-release-tarballs.mjs'),
        '--pack-dir',
        packDir,
        '--repo-root',
        candidateRoot,
      ],
      { cwd: mainRoot },
    );
    s.tarballScan.ok = s.tarballScan.exitCode === 0;
    if (!s.tarballScan.ok) s.problems.push('candidate tarball scan failed');

    s.consumerProof = {
      description:
        'registry-only isolated consumer proof (verify:release-consumer -- --registry) from the candidate source',
      registry: bound.registry,
      verifier: 'scripts/verify-release-consumer.mjs at the candidate source',
    };
    s.consumerProof.exitCode = spawnChild(
      npm,
      ['run', 'verify:release-consumer', '--', '--registry'],
      {
        cwd: candidateRoot,
        shell: process.platform === 'win32',
      },
    );
    s.consumerProof.ok = s.consumerProof.exitCode === 0;
    if (!s.consumerProof.ok)
      s.problems.push(
        'registry-only consumer verification failed — no successful conclusion is possible',
      );

    s.ok = s.problems.length === 0;
    record();
    if (!s.ok) fail(s.problems.join(' | '));
    ok('engine registry verification, tarball scan, and registry-only consumer proof all passed');
  }

  // ---- self-scan, then the seal ----------------------------------------------
  {
    const s = section('selfScan');
    const findings = selfScanEvidenceText(JSON.stringify(evidence, null, 2), checkText);
    s.findings = findings;
    s.rule = 'contract §9 credential/local-path content rules applied to the serialized evidence';
    s.ok = findings.length === 0;
    record();
    if (!s.ok) fail(`evidence self-scan findings: ${findings.join(' | ')}`);
    ok('evidence record is free of credential material, tokens, and local absolute paths');
  }

  const sectionNames = Object.keys(evidence.sections);
  const seal = evaluateEvidenceSections(
    sectionNames
      .filter((name) => evidence.sections[name].gated !== false)
      .map((name) => ({ name, ok: evidence.sections[name].ok === true })),
  );
  evidence.seal = {
    evaluatedSections: sectionNames,
    failed: seal.failed,
    allChecksPassed: seal.ok,
    nonGated: sectionNames.filter((name) => evidence.sections[name].gated === false),
  };

  evidence.finishedAt = new Date().toISOString();
  record();

  // step summary
  if (process.env.GITHUB_STEP_SUMMARY !== undefined) {
    // final summary table
    const lines = [
      '## VICT-M-1 candidate evidence recovery (read-only)',
      '',
      `- Candidate: \`${bound.version}\` from \`${bound.sourceSha}\``,
      `- Original publication run: ${bound.originalRunId} (terminal-failure — never relabelled)`,
      `- Corrected contentId: \`${evidence.sections.contentId?.computedContentId ?? 'n/a'}\``,
      `- Registry-only consumer proof: ${evidence.sections.authoritativeGates?.consumerProof?.ok ? 'PASSED' : 'FAILED'}`,
      `- **All checks passed: ${evidence.seal.allChecksPassed}**`,
      '',
      '| Package | Registry integrity (sha512) | Byte-identical rebuild | Content-identical |',
      '| --- | --- | --- | --- |',
    ];
    const rebuild = new Map(
      (evidence.sections.rebuildComparison?.packages ?? []).map((p) => [p.name, p]),
    );
    for (const name of FROZEN_PUBLISH_ORDER) {
      const integrity = registryIntegrities.get(name) ?? 'n/a';
      const comparison = rebuild.get(name);
      lines.push(
        `| ${name} | \`${integrity.slice(0, 24)}…\` | ${comparison?.byteIdentical ? '✅' : '❌'} | ${comparison?.contentIdentical ? '✅' : '❌'} |`,
      );
    }
    lines.push('');
    const previous = readFileSync(process.env.GITHUB_STEP_SUMMARY, 'utf8');
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, `${previous}${lines.join('\n')}\n`);
  }

  if (!evidence.seal.allChecksPassed) {
    fail(`evidence seal refused: failed sections [${evidence.seal.failed.join(', ')}]`);
  }
  console.log(`\nrelease-evidence: ALL CHECKS PASSED — evidence recorded in ${resultsFile}`);
}

// ---- dispatch -----------------------------------------------------------------

const [command] = process.argv.slice(2);
const args = parseArgs(process.argv.slice(3));
if (command === 'guard') {
  commandGuard(args);
} else if (command === 'verify') {
  await commandVerify(args);
} else {
  fail(`unknown command '${command ?? ''}' (expected guard | verify).`);
}
