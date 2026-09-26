import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import {
  BOUND_CANDIDATE,
  EVIDENCE_WORKFLOW_PATH,
  auditEvidenceWorkflow,
  compareRebuildWithRegistry,
  evaluateEvidenceSections,
  evaluateRegistryManifest,
  evaluateRegistryMemberState,
  evaluateMemberSet,
  evaluateSlsaProvenance,
  selfScanEvidenceText,
} from '../lib/evidence-rules.mjs';
import { deriveReleaseSetContentId, FROZEN_PUBLISH_ORDER } from '../lib/release-set.mjs';
import { checkText } from '../lib/tarball-scan-rules.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..', '..');
const WORKFLOW_PATH = join(repoRoot, EVIDENCE_WORKFLOW_PATH);

const GOOD_INTEGRITY =
  'sha512-jW5zpBmQZizIrFnLXe9VpAJXD2MBqvlKV9c3N2i1VJa0y7INSoGKU74pjAJXlcg/S5VpE4SlAXb8iWQG1JSz+g==';

// The observed SLSA v1 shape on the live registry (decoded from the
// attestation endpoint's DSSE envelope payload).
function slsaPayload() {
  const base = {
    _type: 'https://in-toto.io/Statement/v1',
    subject: [
      {
        name: 'pkg:npm/%40victframework/contracts@0.3.1',
        digest: {
          sha512: Buffer.from(GOOD_INTEGRITY.replace(/^sha512-/, ''), 'base64').toString('hex'),
        },
      },
    ],
    predicateType: 'https://slsa.dev/provenance/v1',
    predicate: {
      buildDefinition: {
        buildType: 'https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1',
        externalParameters: {
          workflow: {
            ref: 'refs/heads/main',
            repository: 'https://github.com/radz2291/vict-02',
            path: '.github/workflows/release.yml',
          },
        },
        internalParameters: { github: { event_name: 'workflow_dispatch' } },
        resolvedDependencies: [
          {
            uri: 'git+https://github.com/radz2291/vict-02@refs/heads/main',
            digest: { gitCommit: BOUND_CANDIDATE.sourceSha },
          },
        ],
      },
      runDetails: {
        builder: { id: 'https://github.com/actions/runner/github-hosted' },
        metadata: {
          invocationId: `https://github.com/radz2291/vict-02/actions/runs/${BOUND_CANDIDATE.originalRunId}/attempts/1`,
        },
      },
    },
  };
  return structuredClone(base);
}

function slsaAttestation(payload) {
  return {
    predicateType: payload.predicateType,
    bundle: {
      dsseEnvelope: {
        payloadType: 'application/vnd.in-toto+json',
        payload: Buffer.from(JSON.stringify(payload), 'utf8').toString('base64'),
        signatures: [{ sig: 'not-verified-in-this-recovery' }],
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Bound candidate identity (amendment §4)
// ---------------------------------------------------------------------------

describe('BOUND_CANDIDATE', () => {
  it('is exactly the amendment-bound recovery identity', () => {
    expect(BOUND_CANDIDATE.version).toBe('0.3.1');
    expect(BOUND_CANDIDATE.sourceSha).toBe('446453fc4f6837e50a0bf3254b47d6a208f5b491');
    expect(BOUND_CANDIDATE.originalRunId).toBe(35688234026);
    expect(BOUND_CANDIDATE.packageCount).toBe(13);
    expect(BOUND_CANDIDATE.registry).toBe('https://registry.npmjs.org/');
    expect(BOUND_CANDIDATE.correctedEngineSha).toBe('446453fc4f6837e50a0bf3254b47d6a208f5b491');
    expect(BOUND_CANDIDATE.candidateTag).toBe('latest');
    expect(BOUND_CANDIDATE.expectedLatest).toBe('0.3.1');
    expect(BOUND_CANDIDATE.forbiddenStableVersion).toBe(null);
    expect(BOUND_CANDIDATE.retainedTags).toEqual({ 'vict-0.3.1-rc': '0.3.1-rc.2' });
  });

  it('binds its own PRE-amendment 13-member order (never retro-expanded by the 2026-09-26 §14 amendment)', () => {
    expect(BOUND_CANDIDATE.order).toHaveLength(13);
    expect(BOUND_CANDIDATE.order[0]).toBe('@victframework/contracts');
    expect(BOUND_CANDIDATE.order.at(-1)).toBe('@victframework/cli');
    expect(BOUND_CANDIDATE.order).not.toContain('@victframework/ui');
    expect(BOUND_CANDIDATE.order).not.toContain('@victframework/ui-svelte');
    // The amended frozen order (15 members) deliberately DIVERGES from the
    // bound historical order: the historical candidate must keep being
    // verified against its own recorded inventory.
    expect(FROZEN_PUBLISH_ORDER).toHaveLength(15);
    expect(FROZEN_PUBLISH_ORDER).toContain('@victframework/ui');
    expect(FROZEN_PUBLISH_ORDER).toContain('@victframework/ui-svelte');
  });

  it('the expected contentId equals the corrected algorithm over the bound historical set at the bound version', () => {
    const list = BOUND_CANDIDATE.order.map((name) => `${name}@${BOUND_CANDIDATE.version}`);
    expect(BOUND_CANDIDATE.expectedContentId).toBe(deriveReleaseSetContentId(list));
    expect(BOUND_CANDIDATE.expectedContentId).toBe(
      'v1_1c695280d3afec5e91bfc75d3c99a5a85bc27f6d91127c4d0ce7bd51563c2583',
    );
  });

  it('the AMENDED 15-member frozen set derives its own distinct recorded identity', () => {
    // Regression coupling for the 2026-09-26 contract §14 amendment: the
    // current 0.3.1 release set (15 members) must derive the newly
    // recorded contentId — distinct from the historical bound candidate.
    const list = FROZEN_PUBLISH_ORDER.map((name) => `${name}@0.3.1`);
    expect(deriveReleaseSetContentId(list)).toBe(
      'v1_3a82c0651bb4b0d554009c87ffe4b3038cf8c51b208648572caf510373fdafaa',
    );
  });

  it('the original run is bound as terminal-failure (never relabelled)', () => {
    expect(BOUND_CANDIDATE.originalRunConclusion).toBe('failure');
  });
});

// ---------------------------------------------------------------------------
// Registry member state (amendment §5)
// ---------------------------------------------------------------------------

describe('evaluateRegistryMemberState', () => {
  const good = () => ({
    versions: {
      '0.3.0': { dist: { integrity: 'sha512-AAA=' } },
      '0.3.1-rc.1': { dist: { integrity: 'sha512-CCC=' } },
      '0.3.1-rc.2': { dist: { integrity: 'sha512-DDD=' } },
      '0.3.1': { dist: { integrity: GOOD_INTEGRITY } },
    },
    'dist-tags': {
      latest: '0.3.1',
      'vict-0.3.0-rc': '0.3.0-rc.1',
      'vict-0.3.1-rc': '0.3.1-rc.2',
    },
  });

  it('accepts the bound stable state (retained candidate tags exact)', () => {
    const verdict = evaluateRegistryMemberState('@victframework/contracts', good());
    expect(verdict.ok).toBe(true);
    expect(verdict.state.integrity).toBe(GOOD_INTEGRITY);
    expect(verdict.state.stableAbsent).toBe('not-applicable-stable-release');
    expect(verdict.state.retainedTags).toEqual({ 'vict-0.3.1-rc': true });
  });

  it('negative control: a missing bound version fails', () => {
    const packument = good();
    delete packument.versions['0.3.1'];
    const verdict = evaluateRegistryMemberState('@victframework/contracts', packument);
    expect(verdict.ok).toBe(false);
    expect(verdict.problems.join(' ')).toContain('missing from the registry');
  });

  it('negative control: a moved retained candidate tag fails', () => {
    const packument = good();
    packument['dist-tags']['vict-0.3.1-rc'] = '0.3.1';
    const verdict = evaluateRegistryMemberState('@victframework/contracts', packument);
    expect(verdict.ok).toBe(false);
    expect(verdict.problems.join(' ')).toContain(
      "retained dist-tag 'vict-0.3.1-rc' is '0.3.1', expected '0.3.1-rc.2'",
    );
  });

  it('negative control: latest not at the bound stable version fails', () => {
    const packument = good();
    packument['dist-tags'].latest = '0.3.1-rc.2';
    const verdict = evaluateRegistryMemberState('@victframework/contracts', packument);
    expect(verdict.ok).toBe(false);
    expect(verdict.problems.join(' ')).toContain("'latest' is '0.3.1-rc.2'");
  });

  it('negative control: a missing retained candidate tag fails', () => {
    const missing = good();
    delete missing['dist-tags']['vict-0.3.1-rc'];
    expect(evaluateRegistryMemberState('@victframework/contracts', missing).ok).toBe(false);
  });

  it('negative control: missing registry integrity fails', () => {
    const packument = good();
    packument.versions['0.3.1'].dist = {};
    expect(evaluateRegistryMemberState('@victframework/contracts', packument).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Member set (missing / extra package negative controls)
// ---------------------------------------------------------------------------

describe('evaluateMemberSet', () => {
  it('accepts exactly the frozen member set', () => {
    expect(evaluateMemberSet(FROZEN_PUBLISH_ORDER, FROZEN_PUBLISH_ORDER)).toEqual([]);
  });

  it('negative control: a missing member fails', () => {
    const problems = evaluateMemberSet(FROZEN_PUBLISH_ORDER.slice(1), FROZEN_PUBLISH_ORDER);
    expect(problems.join(' ')).toContain("member '@victframework/contracts' is missing");
    expect(problems.join(' ')).toContain('member count is 14');
  });

  it('negative control: an extra member fails', () => {
    const problems = evaluateMemberSet(
      [...FROZEN_PUBLISH_ORDER, '@victframework/ghost'],
      FROZEN_PUBLISH_ORDER,
    );
    expect(problems.join(' ')).toContain("unexpected extra member '@victframework/ghost'");
    expect(problems.join(' ')).toContain('member count is 16');
  });
});

// ---------------------------------------------------------------------------
// SLSA provenance (amendment §3.4/§5)
// ---------------------------------------------------------------------------

describe('evaluateSlsaProvenance', () => {
  const evalFor = (payload, integrity = GOOD_INTEGRITY) =>
    evaluateSlsaProvenance('@victframework/contracts', integrity, slsaAttestation(payload));

  it('accepts the observed live provenance shape with all five bindings', () => {
    const verdict = evalFor(slsaPayload());
    expect(verdict.ok).toBe(true);
    expect(verdict.identities.gitCommit).toBe(BOUND_CANDIDATE.sourceSha);
    expect(verdict.identities.workflowPath).toBe('.github/workflows/release.yml');
    expect(verdict.identities.repository).toBe('https://github.com/radz2291/vict-02');
    expect(verdict.identities.invocationId).toContain('/35688234026/');
    expect(verdict.identities.builderId).toBe('https://github.com/actions/runner/github-hosted');
  });

  it('refuses a non-SLSA attestation', () => {
    const verdict = evaluateSlsaProvenance('@victframework/contracts', GOOD_INTEGRITY, {
      predicateType: 'https://github.com/npm/attestation/tree/main/specs/publish/v0.1',
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.problems.join(' ')).toContain('expected SLSA provenance');
  });

  it('negative control: a different source SHA fails', () => {
    const payload = slsaPayload();
    payload.predicate.buildDefinition.resolvedDependencies[0].digest.gitCommit =
      'ece30fe0ae1ce904ca45d66ddd510a851f4f6235';
    const verdict = evalFor(payload);
    expect(verdict.ok).toBe(false);
    expect(verdict.problems.join(' ')).toContain('provenance gitCommit');
  });

  it('negative control: a different repository fails', () => {
    const payload = slsaPayload();
    payload.predicate.buildDefinition.externalParameters.workflow.repository =
      'https://github.com/other/vict-02';
    const verdict = evalFor(payload);
    expect(verdict.ok).toBe(false);
    expect(verdict.problems.join(' ')).toContain('workflow.repository');
  });

  it('negative control: a different workflow path fails', () => {
    const payload = slsaPayload();
    payload.predicate.buildDefinition.externalParameters.workflow.path =
      '.github/workflows/release-evidence.yml';
    const verdict = evalFor(payload);
    expect(verdict.ok).toBe(false);
    expect(verdict.problems.join(' ')).toContain('workflow.path');
  });

  it('negative control: a different source run in the invocationId fails', () => {
    const payload = slsaPayload();
    payload.predicate.runDetails.metadata.invocationId =
      'https://github.com/radz2291/vict-02/actions/runs/1/attempts/1';
    expect(evalFor(payload).ok).toBe(false);
  });

  it('negative control: a self-hosted builder fails', () => {
    const payload = slsaPayload();
    payload.predicate.runDetails.builder.id = 'https://example.com/self-hosted';
    expect(evalFor(payload).ok).toBe(false);
  });

  it('negative control: a subject digest that does not bind the registry integrity fails', () => {
    const payload = slsaPayload();
    payload.subject[0].digest.sha512 = '0'.repeat(128);
    const verdict = evalFor(payload);
    expect(verdict.ok).toBe(false);
    expect(verdict.problems.join(' ')).toContain('subject');
  });

  it('negative control: an undecodable payload fails closed', () => {
    const verdict = evaluateSlsaProvenance('@victframework/contracts', GOOD_INTEGRITY, {
      predicateType: 'https://slsa.dev/provenance/v1',
      bundle: { dsseEnvelope: { payloadType: 'application/vnd.in-toto+json' } },
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.problems.join(' ')).toContain('undecodable');
  });
});

// ---------------------------------------------------------------------------
// Registry manifest pins and dependency graph (amendment §5)
// ---------------------------------------------------------------------------

describe('evaluateRegistryManifest', () => {
  const manifest = (dependencies) => ({
    name: '@victframework/server',
    version: '0.3.1',
    dependencies,
  });

  it('accepts exact internal pins and extracts the graph', () => {
    const verdict = evaluateRegistryManifest(
      manifest({
        '@victframework/runtime': '0.3.1',
        '@victframework/control': '0.3.1',
        '@victframework/application': '0.3.1',
        '@victframework/store-sqlite': '0.3.1',
        fastify: '5.6.2',
      }),
      FROZEN_PUBLISH_ORDER,
    );
    expect(verdict.ok).toBe(true);
    expect(Object.keys(verdict.graph.internal)).toHaveLength(4);
    expect(verdict.graph.external.fastify).toBe('5.6.2');
  });

  it('negative control: a range pin on an internal member fails', () => {
    const verdict = evaluateRegistryManifest(
      manifest({ '@victframework/runtime': '^0.3.1' }),
      FROZEN_PUBLISH_ORDER,
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.problems.join(' ')).toContain("pinned '^0.3.1'");
  });

  it('negative control: a wrong exact pin fails', () => {
    const verdict = evaluateRegistryManifest(
      manifest({ '@victframework/runtime': '0.3.0' }),
      FROZEN_PUBLISH_ORDER,
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.problems.join(' ')).toContain("pinned '0.3.0'");
  });

  it('negative control: workspace/file/link/git specifiers fail', () => {
    for (const spec of ['workspace:*', 'file:../runtime', 'link:../runtime', 'git+ssh://x/y']) {
      const verdict = evaluateRegistryManifest(
        manifest({ '@victframework/runtime': spec }),
        FROZEN_PUBLISH_ORDER,
      );
      expect(verdict.ok, spec).toBe(false);
      expect(verdict.problems.join(' '), spec).toContain('forbidden specifier');
    }
  });

  it('negative control: a manifest at a different version fails', () => {
    const verdict = evaluateRegistryManifest(
      { name: '@victframework/server', version: '0.3.1-rc.9', dependencies: {} },
      FROZEN_PUBLISH_ORDER,
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.problems.join(' ')).toContain('identity');
  });
});

// ---------------------------------------------------------------------------
// Rebuild comparison (byte + content, mode observations truthful)
// ---------------------------------------------------------------------------

describe('compareRebuildWithRegistry', () => {
  const contentOk = {
    registryList: ['package/package.json'],
    rebuiltList: ['package/package.json'],
    contentIdentical: true,
    contentDifferences: [],
    modeDifferences: [],
  };

  it('accepts byte-identical, content-identical artifacts', () => {
    const buffer = Buffer.from('tarball-bytes');
    const verdict = compareRebuildWithRegistry(buffer, Buffer.from(buffer), contentOk);
    expect(verdict.ok).toBe(true);
    expect(verdict.result.byteIdentical).toBe(true);
    expect(verdict.result.contentIdentical).toBe(true);
  });

  it('negative control: different tarball bytes fail', () => {
    const verdict = compareRebuildWithRegistry(
      Buffer.from('registry-bytes'),
      Buffer.from('rebuilt-bytes'),
      contentOk,
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.problems.join(' ')).toContain('rebuilt tarball sha512');
  });

  it('negative control: content differences fail', () => {
    const verdict = compareRebuildWithRegistry(Buffer.from('x'), Buffer.from('x'), {
      ...contentOk,
      contentIdentical: false,
      contentDifferences: ['content differs: package/dist/i.js'],
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.problems.join(' ')).toContain('content differences');
  });

  it('records an exec-bit-only mode difference truthfully (and still fails the gate)', () => {
    const verdict = compareRebuildWithRegistry(Buffer.from('registry'), Buffer.from('rebuilt'), {
      ...contentOk,
      modeDifferences: [
        { path: 'package/bin/vict.mjs', registryMode: '-rwxr-xr-x', rebuiltMode: '-rw-r--r--' },
      ],
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.result.modeDifferences[0].path).toBe('package/bin/vict.mjs');
    expect(verdict.result.contentIdentical).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Seal (consumer failure prevents success) and self-scan
// ---------------------------------------------------------------------------

describe('evaluateEvidenceSections', () => {
  it('refuses the seal when the consumer proof failed', () => {
    const verdict = evaluateEvidenceSections([
      { name: 'registryState', ok: true },
      { name: 'provenance', ok: true },
      { name: 'authoritativeGates', ok: false },
    ]);
    expect(verdict.ok).toBe(false);
    expect(verdict.failed).toEqual(['authoritativeGates']);
  });

  it('accepts the seal only when every gated section passed', () => {
    const verdict = evaluateEvidenceSections([
      { name: 'a', ok: true },
      { name: 'b', ok: true },
    ]);
    expect(verdict.ok).toBe(true);
  });
});

describe('selfScanEvidenceText', () => {
  it('accepts realistic clean evidence text (integrity values, URLs, run ids)', () => {
    const clean = JSON.stringify({
      bound: BOUND_CANDIDATE,
      packages: [{ name: '@victframework/contracts', integrity: GOOD_INTEGRITY }],
      urls: [
        'https://registry.npmjs.org/@victframework/contracts',
        'https://github.com/radz2291/vict-02',
      ],
    });
    expect(selfScanEvidenceText(clean, checkText)).toEqual([]);
  });

  it('negative control: planted token material is detected', () => {
    const dirty = JSON.stringify({ note: 'token=npm_a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8' });
    expect(selfScanEvidenceText(dirty, checkText).length).toBeGreaterThan(0);
  });

  it('negative control: planted local absolute paths are detected', () => {
    expect(
      selfScanEvidenceText(JSON.stringify({ p: 'C:\\Users\\rz1\\repo' }), checkText).length,
    ).toBeGreaterThan(0);
    expect(
      selfScanEvidenceText(
        JSON.stringify({ p: '/home/runner/work/vict-02/vict-02/candidate-src' }),
        checkText,
      ).length,
    ).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// The committed evidence workflow (structure + security audit)
// ---------------------------------------------------------------------------

describe('release-evidence.yml workflow definition', () => {
  it('exists', () => {
    expect(existsSync(WORKFLOW_PATH)).toBe(true);
  });

  const raw = existsSync(WORKFLOW_PATH) ? readFileSync(WORKFLOW_PATH, 'utf8') : '';
  const doc = yaml.load(raw);

  it('passes the dependency-free security audit', () => {
    const audit = auditEvidenceWorkflow(raw);
    expect(audit.problems).toEqual([]);
    expect(audit.ok).toBe(true);
  });

  it('declares exactly contents: read and nothing else', () => {
    expect(doc.permissions).toEqual({ contents: 'read' });
    const job = doc.jobs['evidence-recovery'];
    expect(job.permissions).toBeUndefined();
  });

  it('has workflow_dispatch as the only trigger, with bound defaults', () => {
    const triggers = doc[true] ?? doc.on;
    expect(Object.keys(triggers)).toEqual(['workflow_dispatch']);
    const inputs = triggers.workflow_dispatch.inputs;
    expect(inputs.source_sha.default).toBe(BOUND_CANDIDATE.sourceSha);
    expect(inputs.version.default).toBe(BOUND_CANDIDATE.version);
    expect(inputs.npm_tag.default).toBe(BOUND_CANDIDATE.candidateTag);
    expect(inputs.source_sha.required).toBe(false);
  });

  it('runs on the pinned supported Linux runner with the release toolchain', () => {
    const job = doc.jobs['evidence-recovery'];
    expect(job['runs-on']).toBe('ubuntu-latest');
    const setupNode = job.steps.find((step) =>
      String(step.uses ?? '').startsWith('actions/setup-node'),
    );
    expect(setupNode.with['node-version']).toBe('24');
    expect(setupNode.with['package-manager-cache']).toBe(false);
    const npmPin = job.steps.find((step) => String(step.run ?? '').includes('npm install -g npm@'));
    expect(npmPin.run).toContain('npm@11.19.1');
  });

  it('contains no secret references, no OIDC write, and no credential material', () => {
    expect(raw).not.toContain('${{ secrets.');
    expect(raw.toLowerCase()).not.toContain('id-token');
    expect(raw).not.toContain('NODE_AUTH_TOKEN');
    expect(raw).not.toContain('NPM_TOKEN');
    expect(raw).not.toContain('_authToken');
    expect(raw).not.toMatch(/^\s*environment:\s*$/m);
  });

  it('uses the corrected engine only through non-mutating subcommands and records the artifact', () => {
    const job = doc.jobs['evidence-recovery'];
    const runs = job.steps.map((step) => step.run ?? '').join('\n');
    expect(runs).toContain('node scripts/release-evidence.mjs guard');
    expect(runs).toContain('node scripts/oidc-release.mjs pack');
    expect(runs).toContain('node scripts/scan-release-tarballs.mjs');
    expect(runs).toContain('node scripts/release-evidence.mjs verify');
    expect(runs).toContain(
      'git worktree add --detach "$EVIDENCE_CANDIDATE_ROOT" "$EVIDENCE_SOURCE_SHA"',
    );
    const upload = job.steps.find((step) =>
      String(step.uses ?? '').startsWith('actions/upload-artifact'),
    );
    expect(upload['if']).toBe('always()');
    expect(upload.with.name).toBe('m1-candidate-evidence-recovery');
  });

  it('checks out nothing with persisted credentials and holds no publication step', () => {
    const job = doc.jobs['evidence-recovery'];
    const checkout = job.steps.find((step) =>
      String(step.uses ?? '').startsWith('actions/checkout'),
    );
    expect(checkout.with['persist-credentials']).toBe(false);
    expect(checkout.with['fetch-depth']).toBe(0);
    const runs = job.steps.map((step) => step.run ?? '').join('\n');
    expect(runs).not.toContain('publish');
    expect(runs).not.toContain('dist-tag');
  });
});

// ---------------------------------------------------------------------------
// Guard negative controls (mutated workflow fixtures fail closed)
// ---------------------------------------------------------------------------

describe('auditEvidenceWorkflow negative controls', () => {
  const base = () => readFileSync(WORKFLOW_PATH, 'utf8');

  it('refuses added OIDC write authority', () => {
    const mutated = base().replace(
      'permissions:\n  contents: read',
      'permissions:\n  contents: read\n  id-token: write',
    );
    const audit = auditEvidenceWorkflow(mutated);
    expect(audit.ok).toBe(false);
    expect(audit.problems.join(' ')).toContain('id-token');
  });

  it('refuses a registry-mutating npm command', () => {
    const mutated =
      base() +
      '\n      - name: smuggled\n        run: npm deprecate @victframework/sdk@0.3.1 --message x\n';
    const audit = auditEvidenceWorkflow(mutated);
    expect(audit.ok).toBe(false);
  });

  it('refuses the publication subcommand of the shared engine', () => {
    const mutated = base().replace(
      'node scripts/oidc-release.mjs pack',
      'node scripts/oidc-release.mjs publish',
    );
    const audit = auditEvidenceWorkflow(mutated);
    expect(audit.ok).toBe(false);
    expect(audit.problems.join(' ')).toContain("subcommand 'publish'");
  });

  it('refuses mutated dispatch defaults (the recovery is bound)', () => {
    const mutated = base().replace("default: '0.3.1'", "default: '0.3.1-rc.9'");
    const audit = auditEvidenceWorkflow(mutated);
    expect(audit.ok).toBe(false);
    expect(audit.problems.join(' ')).toContain("input 'version'");
  });

  it('refuses a job-level permissions override', () => {
    const mutated = base().replace(
      '    runs-on: ubuntu-latest',
      '    runs-on: ubuntu-latest\n    permissions:\n      contents: write',
    );
    const audit = auditEvidenceWorkflow(mutated);
    expect(audit.ok).toBe(false);
  });

  it('refuses shell interpolation of inputs into run commands', () => {
    const mutated = base().replace(
      'run: npm install -g npm@11.19.1',
      'run: echo "${{ inputs.version }}" && npm install -g npm@11.19.1',
    );
    const audit = auditEvidenceWorkflow(mutated);
    expect(audit.ok).toBe(false);
    expect(audit.problems.join(' ')).toContain('interpolation');
  });

  it('refuses a non-dispatch trigger', () => {
    const mutated = base().replace(
      'on:\n  workflow_dispatch:',
      'on:\n  workflow_dispatch:\n  schedule:',
    );
    const audit = auditEvidenceWorkflow(mutated);
    expect(audit.ok).toBe(false);
    expect(audit.problems.join(' ')).toContain('schedule');
  });
});
