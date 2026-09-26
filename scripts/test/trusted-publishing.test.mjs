import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import {
  deriveReleaseInventory,
  deriveReleaseSetContentId,
  EXPECTED_RELEASE_PACKAGE_COUNT,
  FROZEN_PUBLISH_ORDER,
  FROZEN_TRUST_TARGET,
  npmVersionSatisfiesMinimum,
  normalizeResumeInput,
  publishArgv,
  SOURCE_SHA_PATTERN,
  trustGithubArgv,
  validateFrozenOrderIsTopological,
  validateVersionTagPair,
} from '../lib/release-set.mjs';
import {
  classifyRelationships,
  collectRelationships,
  describeRelationship,
  originMatchesFrozenRepository,
  sanitize,
} from '../lib/trust-config.mjs';
import {
  checkPathAllowlist,
  checkPackedManifest,
  checkText,
  stripComments,
} from '../lib/tarball-scan-rules.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..', '..');
const WORKFLOW_PATH = join(repoRoot, '.github', 'workflows', FROZEN_TRUST_TARGET.workflowFile);

// ---------------------------------------------------------------------------
// Closed version/tag rule (contract §7)
// ---------------------------------------------------------------------------

describe('validateVersionTagPair', () => {
  it('accepts a stable version under latest', () => {
    expect(validateVersionTagPair('0.3.0', 'latest')).toEqual({ ok: true, tag: 'latest' });
  });

  it('accepts a candidate version under its exact candidate tag', () => {
    expect(validateVersionTagPair('0.3.0-rc.1', 'vict-0.3.0-rc')).toEqual({
      ok: true,
      tag: 'vict-0.3.0-rc',
    });
    expect(validateVersionTagPair('1.2.3-rc.17', 'vict-1.2.3-rc')).toEqual({
      ok: true,
      tag: 'vict-1.2.3-rc',
    });
  });

  it('refuses a candidate under latest (latest never moves to a candidate)', () => {
    const verdict = validateVersionTagPair('0.3.0-rc.1', 'latest');
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain('candidate');
    expect(verdict.reason).toContain('latest');
  });

  it('refuses a stable version under a candidate tag', () => {
    expect(validateVersionTagPair('0.3.0', 'vict-0.3.0-rc').ok).toBe(false);
  });

  it('refuses a candidate tag that does not match the version', () => {
    expect(validateVersionTagPair('0.3.0-rc.1', 'vict-0.4.0-rc').ok).toBe(false);
  });

  it('refuses non-coordinated version shapes entirely', () => {
    for (const version of ['0.3', 'v0.3.0', '0.3.0-beta.1', '0.3.0-rc', 'latest', '', '1.2.3.4']) {
      expect(validateVersionTagPair(version, 'latest').ok).toBe(false);
      expect(validateVersionTagPair(version, 'vict-0.3.0-rc').ok).toBe(false);
    }
  });

  it('refuses malformed tags', () => {
    expect(validateVersionTagPair('0.3.0', '').ok).toBe(false);
    expect(validateVersionTagPair('0.3.0', 'x'.repeat(65)).ok).toBe(false);
    expect(validateVersionTagPair('0.3.0', undefined).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Source SHA shape (contract §6)
// ---------------------------------------------------------------------------

describe('SOURCE_SHA_PATTERN', () => {
  it('accepts exactly 40 lowercase hex characters', () => {
    expect(SOURCE_SHA_PATTERN.test('18d8b50546a880e097274a32bec781a8fc6a7cdd')).toBe(true);
    expect(SOURCE_SHA_PATTERN.test('0123456789abcdef0123456789abcdef01234567')).toBe(true);
  });

  it('refuses short, long, uppercase, and non-hex references', () => {
    expect(SOURCE_SHA_PATTERN.test('18d8b50')).toBe(false);
    expect(SOURCE_SHA_PATTERN.test('18d8b50546a880e097274a32bec781a8fc6a7cdd0')).toBe(false);
    expect(SOURCE_SHA_PATTERN.test('18D8B50546A880E097274A32BEC781A8FC6A7CDD')).toBe(false);
    expect(SOURCE_SHA_PATTERN.test('main')).toBe(false);
    expect(SOURCE_SHA_PATTERN.test('')).toBe(false);
    expect(SOURCE_SHA_PATTERN.test(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Resume-point input normalization (regression: an OMITTED workflow_dispatch
// input arrives as the empty string and must mean NO resume point, never a
// non-member resume refusal — observed in release run 35529329279)
// ---------------------------------------------------------------------------

describe('deriveReleaseSetContentId', () => {
  it('derives the RECORDED identity: sha256 over the sorted newline-joined list', () => {
    const list = ['@victframework/sdk@0.3.0-rc.1', '@victframework/contracts@0.3.0-rc.1'];
    const newline = String.fromCharCode(10);
    const expected = `v1_${createHash('sha256')
      .update(list.slice().sort().join(newline), 'utf8')
      .digest('hex')}`;
    expect(deriveReleaseSetContentId(list)).toBe(expected);
    // Order-independent (the canonical list is sorted).
    expect(deriveReleaseSetContentId([...list].reverse())).toBe(expected);
    // Divergent members produce a divergent identity.
    expect(deriveReleaseSetContentId(['@victframework/sdk@0.2.0'])).not.toBe(expected);
  });
});

describe('normalizeResumeInput', () => {
  it('normalizes an omitted/empty/blank resume input to NO resume point', () => {
    expect(normalizeResumeInput(undefined)).toBeUndefined();
    expect(normalizeResumeInput('')).toBeUndefined();
    expect(normalizeResumeInput('   ')).toBeUndefined();
  });

  it('preserves a real resume-point member name unchanged', () => {
    expect(normalizeResumeInput('@victframework/sdk')).toBe('@victframework/sdk');
    expect(normalizeResumeInput('sdk')).toBe('sdk');
  });
});

// ---------------------------------------------------------------------------
// npm minimum-version gate (contract §3/§11)
// ---------------------------------------------------------------------------

describe('npmVersionSatisfiesMinimum', () => {
  it('enforces >= 11.15.0 for the trust interface', () => {
    expect(npmVersionSatisfiesMinimum('11.15.0')).toBe(true);
    expect(npmVersionSatisfiesMinimum('11.19.1')).toBe(true);
    expect(npmVersionSatisfiesMinimum('12.0.2')).toBe(true);
    expect(npmVersionSatisfiesMinimum('11.14.1')).toBe(false);
    expect(npmVersionSatisfiesMinimum('10.9.2')).toBe(false);
    expect(npmVersionSatisfiesMinimum('11.15.0', '11.15.0')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Frozen inventory (contract §5)
// ---------------------------------------------------------------------------

describe('deriveReleaseInventory (real repository)', () => {
  const inventory = deriveReleaseInventory(repoRoot);

  it('derives exactly the frozen 15-package set (contract §5 as amended 2026-09-26, §14) with no problems', () => {
    expect(inventory.problems).toEqual([]);
    expect(inventory.order).toEqual(FROZEN_PUBLISH_ORDER);
    expect(inventory.order).toHaveLength(EXPECTED_RELEASE_PACKAGE_COUNT);
    expect(EXPECTED_RELEASE_PACKAGE_COUNT).toBe(15);
    // The amended members sit exactly where the contract amendment placed
    // them: ui immediately before its only internal dependent.
    expect(inventory.order[6]).toBe('@victframework/ui');
    expect(inventory.order[7]).toBe('@victframework/ui-svelte');
    expect(inventory.order[8]).toBe('@victframework/renderer-svelte');
  });

  it('shares ONE coherent release-set version of the coordinated shape', () => {
    expect(inventory.version).toMatch(/^\d+\.\d+\.\d+(?:-rc\.\d+)?$/);
  });

  it('validates the frozen order as a real topological linearization', () => {
    expect(validateFrozenOrderIsTopological(inventory.byName)).toEqual([]);
  });
});

describe('deriveReleaseInventory (synthetic drift fixtures)', () => {
  // A minimal packages/ fixture: only the frozen-order edges matter, so a
  // three-package inventory is enough to exercise the ordering rule.
  function makeFixtureRoot(manifests) {
    const root = mkdtempSync(join(tmpdir(), 'vict-release-set-fixture-'));
    for (const [name, version, extra] of manifests) {
      const dirName = name.replace('@victframework/', '').replace('/', '_');
      const dir = join(root, 'packages', dirName);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, version, ...extra }));
    }
    return root;
  }
  function makeFixture(manifests) {
    const root = makeFixtureRoot(manifests);
    try {
      return deriveReleaseInventory(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  it('reports a frozen-order violation when a manifest depends on a later member', () => {
    const fixture = makeFixture([
      // contracts now (wrongly) depends on sdk, which publishes LATER in
      // the frozen order (contracts position 1, sdk position 2).
      ['@victframework/contracts', '1.0.0', { dependencies: { '@victframework/sdk': '1.0.0' } }],
      ['@victframework/sdk', '1.0.0', {}],
      ['@victframework/kernel', '1.0.0', {}],
    ]);
    const problems = fixture.problems.join('\n');
    expect(problems).toContain('frozen publication order violated');
    expect(problems).toContain('expected exactly 15');
  });

  it('reports an extra publishable member outside the frozen inventory', () => {
    const fixture = makeFixture([
      ['@victframework/contracts', '1.0.0', {}],
      ['@victframework/ghost-package', '1.0.0', {}],
    ]);
    const problems = fixture.problems.join('\n');
    expect(problems).toContain(
      "'@victframework/ghost-package' is not in the frozen 15-package inventory",
    );
    expect(problems).toContain('release-set inventory is 2 packages, expected exactly 15');
  });

  it('reports a missing frozen inventory member', () => {
    const fixture = makeFixture([['@victframework/contracts', '1.0.0', {}]]);
    const problems = fixture.problems.join('\n');
    expect(problems).toContain(
      "frozen inventory member '@victframework/sdk' has no publishable manifest",
    );
    expect(problems).toContain('release-set inventory is 1 packages, expected exactly 15');
  });

  it('reports an internal dependency edge to a non-member', () => {
    const fixture = makeFixture([
      ['@victframework/contracts', '1.0.0', { dependencies: { '@victframework/ghost': '1.0.0' } }],
    ]);
    expect(fixture.problems.join('\n')).toContain(
      "'@victframework/contracts' depends on internal '@victframework/ghost', which is not a release-set member",
    );
  });

  it('honors explicit inventory-rule overrides (historical evidence bindings only)', () => {
    // The release-evidence ladder verifies the PRE-amendment 13-member
    // bound candidate with the SAME engine; the override must relax only
    // the recorded rule, never the default release path.
    const historicalOrder = ['@victframework/alpha', '@victframework/beta', '@victframework/gamma'];
    const root = makeFixtureRoot([
      ['@victframework/alpha', '1.0.0', {}],
      ['@victframework/beta', '1.0.0', { dependencies: { '@victframework/alpha': '1.0.0' } }],
      ['@victframework/gamma', '1.0.0', { dependencies: { '@victframework/beta': '1.0.0' } }],
    ]);
    try {
      const overridden = deriveReleaseInventory(root, {
        expectedCount: 3,
        frozenOrder: historicalOrder,
      });
      expect(overridden.problems).toEqual([]);
      expect(overridden.order).toEqual(historicalOrder);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports a non-member manifest name', () => {
    const fixture = makeFixture([['@other/name', '1.0.0', {}]]);
    expect(fixture.problems.join('\n')).toContain('is not an @victframework/* release-set member');
  });

  it('reports an incoherent version split', () => {
    const fixture = makeFixture([
      ['@victframework/contracts', '1.0.0', {}],
      ['@victframework/sdk', '2.0.0', {}],
    ]);
    expect(fixture.problems.join('\n')).toContain('ONE coherent version');
  });
});

// ---------------------------------------------------------------------------
// Exact registry argv (contract §10/§11) — never a token
// ---------------------------------------------------------------------------

describe('publishArgv', () => {
  it('publishes the exact tarball, public, tagged, public registry', () => {
    expect(publishArgv('/tmp/pack/victframework-sdk-0.3.0.tgz', 'vict-0.3.0-rc')).toEqual([
      'publish',
      '/tmp/pack/victframework-sdk-0.3.0.tgz',
      '--access',
      'public',
      '--tag',
      'vict-0.3.0-rc',
      '--registry',
      'https://registry.npmjs.org/',
    ]);
  });

  it('never contains token or auth material', () => {
    const argv = publishArgv('x.tgz', 'latest');
    for (const part of argv) {
      expect(part.toLowerCase()).not.toContain('token');
      expect(part.toLowerCase()).not.toContain('_auth');
      expect(part.toLowerCase()).not.toContain('secret');
    }
  });
});

describe('trustGithubArgv', () => {
  it('trusts exactly the frozen repository, workflow, and publish permission', () => {
    expect(trustGithubArgv('@victframework/sdk', FROZEN_TRUST_TARGET)).toEqual([
      'trust',
      'github',
      '@victframework/sdk',
      '--repo',
      'radz2291/vict-02',
      '--file',
      'release.yml',
      '--allow-publish',
      '--yes',
    ]);
  });

  it('passes no environment and no stage-publish permission', () => {
    const argv = trustGithubArgv('@victframework/sdk', FROZEN_TRUST_TARGET);
    expect(argv).not.toContain('--env');
    expect(argv).not.toContain('--environment');
    expect(argv).not.toContain('--allow-stage-publish');
  });
});

// ---------------------------------------------------------------------------
// Trust-relationship interpretation (contract §11; defensive against the
// registry's actual JSON shape, fail closed on anything unrecognized)
// ---------------------------------------------------------------------------

describe('collectRelationships', () => {
  it('finds relationship objects in nested registry-style shapes', () => {
    const shape = {
      '@victframework/sdk': {
        repository: 'radz2291/vict-02',
        trustedPublishers: [
          { provider: 'github', repository: 'radz2291/vict-02', file: 'release.yml' },
        ],
      },
    };
    const found = collectRelationships(shape);
    expect(found).toHaveLength(1);
    expect(found[0].provider).toBe('github');
  });

  it('returns empty for empty objects and scalar payloads', () => {
    expect(collectRelationships({})).toEqual([]);
    expect(collectRelationships('text')).toEqual([]);
    expect(collectRelationships(null)).toEqual([]);
  });
});

describe('classifyRelationships', () => {
  const EXACT = {
    provider: 'github',
    repository: 'radz2291/vict-02',
    workflow: 'release.yml',
    allowPublish: true,
  };

  it('accepts the exact frozen relationship (field-shape variants)', () => {
    expect(classifyRelationships([EXACT]).exact).toHaveLength(1);
    expect(
      classifyRelationships([
        {
          type: 'github',
          repo: 'radz2291/vict-02',
          file: 'release.yml',
          'allow-publish': true,
        },
      ]).exact,
    ).toHaveLength(1);
    expect(
      classifyRelationships([
        {
          provider: 'github',
          repository: 'radz2291/vict-02',
          workflowFile: 'release.yml',
          permissions: ['publish'],
        },
      ]).exact,
    ).toHaveLength(1);
  });

  it('classifies a different repository as a conflict (never auto-replaced)', () => {
    const verdict = classifyRelationships([{ ...EXACT, repository: 'other/repo' }]);
    expect(verdict.exact).toHaveLength(0);
    expect(verdict.conflicting).toHaveLength(1);
  });

  it('classifies a different workflow filename as a conflict', () => {
    const verdict = classifyRelationships([{ ...EXACT, workflow: 'other.yml' }]);
    expect(verdict.exact).toHaveLength(0);
    expect(verdict.conflicting).toHaveLength(1);
  });

  it('classifies an environment binding as a conflict', () => {
    const verdict = classifyRelationships([{ ...EXACT, environment: 'release' }]);
    expect(verdict.exact).toHaveLength(0);
    expect(verdict.conflicting).toHaveLength(1);
  });

  it('classifies a non-publish relationship as a conflict', () => {
    const verdict = classifyRelationships([{ ...EXACT, allowPublish: false }]);
    expect(verdict.exact).toHaveLength(0);
    expect(verdict.conflicting).toHaveLength(1);
  });

  it('classifies a non-GitHub provider as a conflict', () => {
    const verdict = classifyRelationships([
      {
        provider: 'gitlab',
        repository: 'radz2291/vict-02',
        workflow: 'release.yml',
        allowPublish: true,
      },
    ]);
    expect(verdict.exact).toHaveLength(0);
    expect(verdict.conflicting).toHaveLength(1);
  });
});

describe('sanitize', () => {
  it('redacts token-shaped material from tool output', () => {
    const token36 = `npm_${'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'}`;
    expect(token36).toHaveLength(40);
    const output = sanitize(`logged value ${token36} end`);
    expect(output).toContain('[redacted]');
    expect(output).not.toContain(token36);
    const github = sanitize(`ghp_${'A'.repeat(36)}`);
    expect(github).toBe('[redacted]');
    const fine = sanitize(`github_pat_${'B'.repeat(30)}`);
    expect(fine).toBe('[redacted]');
  });

  it('leaves ordinary release text untouched', () => {
    expect(sanitize('published @victframework/sdk@0.3.0')).toBe(
      'published @victframework/sdk@0.3.0',
    );
  });
});

describe('describeRelationship', () => {
  it('reports only the four non-sensitive config fields', () => {
    const text = describeRelationship({
      provider: 'github',
      repository: 'other/repo',
      workflow: 'x.yml',
      environment: 'prod',
      secretValue: 'npm_zzz',
    });
    expect(text).toContain('other/repo');
    expect(text).not.toContain('secretValue');
    expect(text).not.toContain('npm_zzz');
  });
});

describe('originMatchesFrozenRepository', () => {
  it('accepts the frozen repository in https and ssh forms', () => {
    expect(originMatchesFrozenRepository('https://github.com/radz2291/vict-02.git')).toBe(true);
    expect(originMatchesFrozenRepository('https://github.com/radz2291/vict-02')).toBe(true);
    expect(originMatchesFrozenRepository('git@github.com:radz2291/vict-02.git')).toBe(true);
  });

  it('refuses any other repository', () => {
    expect(originMatchesFrozenRepository('https://github.com/other/vict-02.git')).toBe(false);
    expect(originMatchesFrozenRepository('https://gitlab.com/radz2291/vict-02.git')).toBe(false);
    expect(originMatchesFrozenRepository('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tarball-scan rules (contract §9)
// ---------------------------------------------------------------------------

describe('checkPathAllowlist', () => {
  const files = ['dist'];
  let findings;

  it('allows declared files and npm-mandated roots', () => {
    findings = [];
    checkPathAllowlist(
      [
        'package/dist/index.js',
        'package/dist/a/b.js',
        'package/package.json',
        'package/README.md',
        'package/LICENSE',
      ],
      files,
      findings,
      'sdk.tgz',
    );
    expect(findings).toEqual([]);
  });

  it('flags undeclared paths and dotfiles', () => {
    findings = [];
    checkPathAllowlist(
      ['package/src/private.ts', 'package/.npmrc', 'package/dist/.env', 'evil.js'],
      files,
      findings,
      'sdk.tgz',
    );
    expect(findings.join('\n')).toContain("archived file 'src/private.ts' is outside");
    expect(findings.join('\n')).toContain('dotfile archived: .npmrc');
    expect(findings.join('\n')).toContain('dotfile archived: dist/.env');
    expect(findings.join('\n')).toContain('archived path outside package/');
  });
});

describe('checkPackedManifest', () => {
  const base = {
    name: '@victframework/sdk',
    version: '0.3.0',
    license: 'Apache-2.0',
    files: ['dist'],
    dependencies: { '@victframework/contracts': '0.3.0' },
  };

  it('accepts an equal packed manifest', () => {
    const findings = [];
    checkPackedManifest(base, base, findings, 'sdk.tgz');
    expect(findings).toEqual([]);
  });

  it('flags any differing compared field', () => {
    const findings = [];
    checkPackedManifest({ ...base, license: 'MIT' }, base, findings, 'sdk.tgz');
    expect(findings.join('\n')).toContain("packed manifest 'license' differs");
  });

  it('flags workspace/file/link/git protocol specifiers', () => {
    const findings = [];
    checkPackedManifest(
      { ...base, dependencies: { '@victframework/contracts': 'workspace:*' } },
      base,
      findings,
      'sdk.tgz',
    );
    expect(findings.join('\n')).toContain('forbidden protocol specifier');
  });
});

describe('forbidden-content and local-path patterns', () => {
  function findingsFor(text) {
    const findings = [];
    checkText(text, findings, 'x.tgz', 'dist/index.js');
    return findings;
  }

  it('detects every forbidden credential pattern', () => {
    expect(findingsFor('//registry.npmjs.org/:_authToken=npm_token').join(' ')).toContain(
      'auth-token-config-line',
    );
    expect(findingsFor('registry=npm\n_authToken: abc123').join(' ')).toContain(
      'auth-token-assignment',
    );
    expect(findingsFor('env.NODE_AUTH_TOKEN').join(' ')).toContain('node-auth-token-name');
    expect(findingsFor('process.env.NPM_TOKEN').join(' ')).toContain('npm-token-name');
    expect(findingsFor(`token=${`npm_${'a'.repeat(36)}`}`).join(' ')).toContain(
      'npm-granular-token-format',
    );
    expect(findingsFor(`k=${`ghp_${'a'.repeat(36)}`}`).join(' ')).toContain('github-token-format');
    expect(findingsFor(`k=${`github_pat_${'a'.repeat(24)}`}`).join(' ')).toContain(
      'github-fine-grained-token-format',
    );
    expect(findingsFor('k=AKIAIOSFODNN7EXAMPLE').join(' ')).toContain('aws-access-key-id-format');
    expect(findingsFor('-----BEGIN RSA PRIVATE KEY-----').join(' ')).toContain('private-key-block');
    expect(findingsFor('k=xoxb-123456789012-abcdef').join(' ')).toContain('slack-token-format');
  });

  it('detects every forbidden local-path pattern', () => {
    expect(findingsFor('C:\\Users\\rz1\\repo\\file.ts').join(' ')).toContain('windows-users-path');
    expect(findingsFor('C:\\Windows\\system32').join(' ')).toContain('windows-system-path');
    expect(
      findingsFor('/home/runner/work/vict-02/vict-02/packages/sdk/src/index.ts').join(' '),
    ).toContain('unix-home-path');
    expect(findingsFor('/Users/rz1/Desktop/x').join(' ')).toContain('unix-macos-user-path');
    expect(findingsFor('/mnt/c/data').join(' ')).toContain('wsl-or-runner-mnt-path');
  });

  it('does not false-positive on legitimate release content', () => {
    // The scaffolder embeds code-generation templates containing `\${...}`
    // escapes (observed in the real 0.2.0 scaffolder dist) — these must
    // never trip the local-path or credential rules.
    const scaffolderLine =
      "idempotencyKey: action.op === 'create' && typeof payload.id === 'string' ? `create:\\${payload.id}` : undefined,";
    expect(findingsFor(scaffolderLine)).toEqual([]);
    // Ordinary registry URLs, README text, and code are clean.
    expect(findingsFor('fetch("https://registry.npmjs.org/@victframework/sdk")')).toEqual([]);
    expect(findingsFor('Apache-2.0; see LICENSE for the full notice.')).toEqual([]);
  });

  it('ignores forbidden material inside stripped comments but not real code', () => {
    const commented = stripComments('// TODO: rotate NPM_TOKEN before release\nconst x = 1;');
    expect(findingsFor(commented)).toEqual([]);
    expect(findingsFor('const x = process.env.NPM_TOKEN;').length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// The committed workflow file (contract §2/§3/§4/§6)
// ---------------------------------------------------------------------------

describe('release.yml workflow definition', () => {
  it('exists under the frozen filename', () => {
    expect(existsSync(WORKFLOW_PATH)).toBe(true);
  });

  const raw = existsSync(WORKFLOW_PATH) ? readFileSync(WORKFLOW_PATH, 'utf8') : '';
  const doc = yaml.load(raw);

  it('parses as YAML with only a manual dispatch trigger', () => {
    // YAML 1.1 parses the bare key `on` as boolean true (js-yaml).
    const triggers = doc[true] ?? doc.on;
    expect(Object.keys(triggers)).toEqual(['workflow_dispatch']);
    expect(triggers.workflow_dispatch.inputs.source_sha.required).toBe(true);
    expect(triggers.workflow_dispatch.inputs.version.required).toBe(true);
    expect(triggers.workflow_dispatch.inputs.npm_tag.required).toBe(true);
    expect(triggers.workflow_dispatch.inputs.resume_from_package.required).toBe(false);
    expect(triggers.workflow_dispatch.inputs.validate_only.type).toBe('boolean');
    expect(triggers.workflow_dispatch.inputs.validate_only.default).toBe(false);
  });

  it('declares exactly contents:read and id-token:write', () => {
    expect(doc.permissions).toEqual({ contents: 'read', 'id-token': 'write' });
  });

  it('runs on a GitHub-hosted runner with publication concurrency', () => {
    expect(doc.jobs['publish-release-set']['runs-on']).toBe('ubuntu-latest');
    expect(doc.concurrency.group).toBe('vict-release-set-publication');
    expect(doc.concurrency['cancel-in-progress']).toBe(false);
  });

  it('pins Node >= 22.14 and an explicit npm >= 11.15, with no dependency cache', () => {
    const steps = doc.jobs['publish-release-set'].steps;
    const setupNode = steps.find((step) =>
      String(step.uses ?? '').startsWith('actions/setup-node'),
    );
    expect(setupNode.with['node-version']).toBe('24');
    expect(setupNode.with['package-manager-cache']).toBe(false);
    const npmPin = steps.find((step) => String(step.run ?? '').includes('npm install -g npm@'));
    expect(npmPin.run).toContain('npm@11.19.1');
  });

  it('checks out the main lineage and detaches at the exact input SHA without persisting credentials', () => {
    const steps = doc.jobs['publish-release-set'].steps;
    const checkout = steps.find((step) => String(step.uses ?? '').startsWith('actions/checkout'));
    expect(checkout.with.ref).toBe('main');
    expect(checkout.with['fetch-depth']).toBe(0);
    expect(checkout.with['persist-credentials']).toBe(false);
    // The detach step pins HEAD to the EXACT requested release source and
    // self-verifies the pinned identity (the engine's lineage validation
    // re-proves ancestry against the freshly fetched origin/main). The
    // checkout therefore never depends on GitHub's SHA-isolated fetch
    // cache (run-losses 35529604540 / 35529798221).
    const detach = steps.find((step) =>
      String(step.name ?? '').startsWith('Detach at the exact release-source SHA'),
    );
    expect(detach).toBeDefined();
    expect(detach.env.RELEASE_SOURCE_SHA).toBe('${{ inputs.source_sha }}');
    expect(detach.run).toContain('git checkout --detach "$RELEASE_SOURCE_SHA"');
    expect(detach.run).toContain('test "$(git rev-parse HEAD)" = "$RELEASE_SOURCE_SHA"');
  });

  it('contains no secret references and no token material anywhere', () => {
    expect(raw).not.toContain('${{ secrets.');
    expect(raw).not.toContain('NODE_AUTH_TOKEN');
    expect(raw).not.toContain('NPM_TOKEN');
    expect(raw).not.toContain('_authToken');
  });

  it('drives the repository release engine and gates publication behind validate_only', () => {
    const steps = doc.jobs['publish-release-set'].steps;
    const runs = steps.map((step) => step.run ?? '').join('\n');
    expect(runs).toContain('node scripts/oidc-release.mjs validate');
    expect(runs).toContain('node scripts/oidc-release.mjs pack');
    expect(runs).toContain('node scripts/scan-release-tarballs.mjs');
    expect(runs).toContain('node scripts/oidc-release.mjs publish');
    expect(runs).toContain('node scripts/oidc-release.mjs verify-registry');
    expect(runs).toContain('npm run verify:release-set');
    expect(runs).toContain('npm run verify:release-consumer');
    const publishStep = steps.find((step) => (step.run ?? '').includes('oidc-release.mjs publish'));
    expect(publishStep.if).toBe('${{ inputs.validate_only != true }}');
  });

  it('carries the AMENDED 15-package wording (contract §14, 2026-09-26) with no stale 13-package claims', () => {
    expect(raw).toContain('coordinated 15-package `@victframework/*` set');
    expect(raw).toContain('must equal all 15 manifests');
    expect(raw).toContain('Build all 15 packages');
    // No normative 13-package claim survives anywhere in the workflow.
    expect(raw).not.toMatch(/13-package|all 13\b|Build all 13/);
  });

  it('passes release inputs as environment variables, never by shell interpolation', () => {
    const steps = doc.jobs['publish-release-set'].steps;
    const inputByEnv = {
      RELEASE_SOURCE_SHA: 'source_sha',
      RELEASE_VERSION: 'version',
      RELEASE_NPM_TAG: 'npm_tag',
    };
    for (const step of steps) {
      const run = step.run ?? '';
      // No workflow input may ever be interpolated into a shell command.
      expect(run).not.toMatch(/\$\{\{\s*inputs\./);
      for (const [envKey, inputName] of Object.entries(inputByEnv)) {
        if (step.env?.[envKey] !== undefined) {
          expect(step.env[envKey]).toBe('${{ inputs.' + inputName + ' }}');
        }
      }
    }
  });

  it('is coupled to the release engine environment-variable contract', () => {
    const engine = readFileSync(join(repoRoot, 'scripts', 'oidc-release.mjs'), 'utf8');
    for (const envKey of [
      'RELEASE_SOURCE_SHA',
      'RELEASE_VERSION',
      'RELEASE_NPM_TAG',
      'RELEASE_RESUME_FROM',
    ]) {
      expect(engine).toContain(envKey);
    }
  });
});

// ---------------------------------------------------------------------------
// Trust bootstrap (contract §11 as amended) — the amended 15-package
// inventory must flow into the bootstrap, and the two packages added by
// the 2026-09-26 §14 amendment must be treated EXACTLY like the original
// thirteen (same argv shape, same allowlist, same order position rules).
// ---------------------------------------------------------------------------

describe('trust-bootstrap amended inventory coupling', () => {
  const bootstrap = readFileSync(join(repoRoot, 'scripts', 'trust-bootstrap.mjs'), 'utf8');

  it('derives its exact allowlist from the shared amended release-set rules', () => {
    expect(bootstrap).toContain("from './lib/release-set.mjs'");
    expect(bootstrap).toContain('deriveReleaseInventory(repoRoot)');
    expect(bootstrap).toContain('EXPECTED_RELEASE_PACKAGE_COUNT');
    expect(bootstrap).toContain('FROZEN_PUBLISH_ORDER[index]');
    // No stale hardcoded 13 anywhere in the bootstrap.
    expect(bootstrap).not.toMatch(/exactly 13|ALL 13|13-package/);
  });

  it('plans the EXACT same trust relationship for every member, including the two amended packages', () => {
    const original = [
      '@victframework/contracts',
      '@victframework/sdk',
      '@victframework/kernel',
      '@victframework/runtime',
      '@victframework/store-sqlite',
      '@victframework/application',
      '@victframework/renderer-svelte',
      '@victframework/appdata-sqlite',
      '@victframework/scaffolder',
      '@victframework/control',
      '@victframework/mastra',
      '@victframework/server',
      '@victframework/cli',
    ];
    const amended = ['@victframework/ui', '@victframework/ui-svelte'];
    const shape = (name) => {
      const argv = trustGithubArgv(name, FROZEN_TRUST_TARGET);
      return argv.map((part) => (part === name ? '<package>' : part));
    };
    const reference = shape(original[0]);
    for (const name of [...original, ...amended]) {
      expect(trustGithubArgv(name, FROZEN_TRUST_TARGET)).toEqual([
        'trust',
        'github',
        name,
        '--repo',
        'radz2291/vict-02',
        '--file',
        'release.yml',
        '--allow-publish',
        '--yes',
      ]);
      expect(shape(name)).toEqual(reference);
    }
    expect(amended.every((name) => FROZEN_PUBLISH_ORDER.includes(name))).toBe(true);
    // Position invariants: each amended member sits AFTER everything it
    // depends on and the facade stays directly after ui-svelte.
    const pos = new Map(FROZEN_PUBLISH_ORDER.map((name, index) => [name, index]));
    expect(pos.get('@victframework/ui')).toBeLessThan(pos.get('@victframework/ui-svelte'));
    expect(pos.get('@victframework/ui-svelte')).toBeLessThan(
      pos.get('@victframework/renderer-svelte'),
    );
    expect(pos.get('@victframework/application')).toBeLessThan(pos.get('@victframework/ui-svelte'));
  });
});
