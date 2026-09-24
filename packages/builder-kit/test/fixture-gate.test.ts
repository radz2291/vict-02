import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { generateStableLayer } from '../src/generate/generate.js';
import { verifyBuilderKit } from '../src/verify/verify.js';
import { writeTaskPack } from '../src/generate/task-pack.js';
import {
  buildFixture,
  FIXTURE_PACK_SOURCE_DYNAMIC,
  FIXTURE_PACK_SOURCE_EXTRA_CAPABILITY,
  failures,
} from './helpers/fixture.js';

/**
 * Full gate battery on a miniature repository (handoff Tests #1, #2, #2b,
 * #7): every architecture §4.3 drift class simulated, the
 * negative-of-the-negative (head movement alone stays green), and the
 * baseline comparison classes (committed / renamed / untracked).
 */

// The gate spawns the isolated tsx child; cold starts exceed the 5s default.
vi.setConfig({ testTimeout: 120_000 });

const tempRoots: string[] = [];

function fresh(options: { packSource?: string; git?: boolean } = {}): string {
  const root = buildFixture(options);
  tempRoots.push(root);
  generateStableLayer(root);
  return root;
}

function git(root: string, args: readonly string[]): string {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' });
}

function classes(report: ReturnType<typeof verifyBuilderKit>): readonly string[] {
  return failures(report)
    .map((entry) => entry.driftClass)
    .filter((entry): entry is string => entry !== null);
}

afterAll(() => {
  for (const root of tempRoots) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('verify:builder-kit battery (fixture repository)', () => {
  it('is GREEN on a freshly generated tree (no task pack)', () => {
    const root = fresh();
    const report = verifyBuilderKit(root);
    expect(failures(report)).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('head movement alone is NOT drift: an unrelated commit stays GREEN with no pack churn', () => {
    const root = fresh({ git: true });
    // Unrelated commit: changes no recorded input.
    writeFileSync(join(root, 'README-fixture.md'), '# changed unrelated\n', 'utf8');
    git(root, ['add', '-A']);
    git(root, ['commit', '-m', 'unrelated change']);
    const before = readPack(root);
    const report = verifyBuilderKit(root);
    expect(failures(report)).toEqual([]);
    expect(readPack(root)).toBe(before); // no pack churn
  });

  it('RED content-drift when a recorded input changes without regeneration', () => {
    const root = fresh();
    const referencePath = join(root, 'docs', 'VICT-SYSTEM-REFERENCE.md');
    writeFileSync(
      referencePath,
      readFileSync(referencePath, 'utf8').replace('Fixture principle one.', 'CHANGED principle.'),
      'utf8',
    );
    const report = verifyBuilderKit(root);
    expect(classes(report)).toContain('content-drift');
  });

  it('RED catalog-drift when a capability is added without regenerating', () => {
    const root = fresh();
    // Land the new declaration WITHOUT the regenerated catalog/pack.
    writeFileSync(
      join(root, 'packs', 'fx-pack', 'src', 'index.ts'),
      FIXTURE_PACK_SOURCE_EXTRA_CAPABILITY,
      'utf8',
    );
    const report = verifyBuilderKit(root);
    expect(classes(report)).toContain('catalog-drift');
  });

  it('is GREEN again after declaration + catalog + pack land in one commit set', () => {
    const root = fresh();
    writeFileSync(
      join(root, 'packs', 'fx-pack', 'src', 'index.ts'),
      FIXTURE_PACK_SOURCE_EXTRA_CAPABILITY,
      'utf8',
    );
    generateStableLayer(root); // step 8 of the §4.2 loop
    const report = verifyBuilderKit(root);
    expect(failures(report)).toEqual([]);
  });

  it('RED catalog-unresolved on a computed capability entry (fail closed)', () => {
    const root = fresh();
    writeFileSync(
      join(root, 'packs', 'fx-pack', 'src', 'index.ts'),
      FIXTURE_PACK_SOURCE_DYNAMIC,
      'utf8',
    );
    const report = verifyBuilderKit(root);
    expect(classes(report)).toContain('catalog-unresolved');
  });

  it('RED catalog-dangling when a committed catalog entry loses its contract', () => {
    const root = fresh();
    const catalogPath = join(root, 'docs', 'builder-kit', 'capability-catalog.json');
    const parsed = JSON.parse(readFixtureText(root, catalogPath)) as {
      packs: { contracts: { id: string; revision: string }[] }[];
    };
    parsed.packs[0]?.contracts.splice(0, 1);
    writeFileSync(catalogPath, JSON.stringify(parsed, null, 2) + '\n', 'utf8');
    const report = verifyBuilderKit(root);
    expect(classes(report)).toContain('catalog-dangling');
  });

  it('RED release-identity-drift when the recorded release constant changes', () => {
    const root = fresh();
    const releasePath = join(root, 'docs', 'RELEASE-COMPATIBILITY.md');
    writeFileSync(
      releasePath,
      readFileSync(releasePath, 'utf8').replace(
        'vict-release-set@1/0.0.1',
        'vict-release-set@1/0.0.2',
      ),
      'utf8',
    );
    const report = verifyBuilderKit(root);
    expect(classes(report)).toContain('release-identity-drift');
  });

  it('RED workspace-identity-drift when the root manifest changes', () => {
    const root = fresh();
    const manifestPath = join(root, 'package.json');
    const parsed = JSON.parse(readFixtureText(root, manifestPath)) as Record<string, unknown>;
    parsed['version'] = '0.0.2';
    writeFileSync(manifestPath, JSON.stringify(parsed, null, 2) + '\n', 'utf8');
    const report = verifyBuilderKit(root);
    expect(classes(report)).toContain('workspace-identity-drift');
  });

  it('RED pack-tamper when committed pack bytes are flipped', () => {
    const root = fresh();
    const packPath = join(root, 'docs', 'builder-kit', 'context-pack.json');
    const parsed = JSON.parse(readFixtureText(root, packPath)) as Record<string, unknown>;
    const generatedFrom = parsed['generatedFrom'] as Record<string, unknown>;
    generatedFrom['referenceVersion'] = '9.9.8'; // any byte flip breaks identity
    writeFileSync(packPath, JSON.stringify(parsed, null, 2) + '\n', 'utf8');
    const report = verifyBuilderKit(root);
    expect(classes(report)).toContain('pack-tamper');
  });

  it('RED unregistered-input when a recorded input disappears', () => {
    const root = fresh();
    rmSync(join(root, 'docs', 'RELEASE-COMPATIBILITY.md'));
    const report = verifyBuilderKit(root);
    expect(classes(report)).toContain('unregistered-input');
  });

  describe('baseline comparison versus a pinned baseTree', () => {
    function withTaskPack(): string {
      const root = fresh({ git: true });
      const head = git(root, ['rev-parse', 'HEAD']).trim();
      writeTaskPack(root, {
        handoffPath: 'docs/TASK.md',
        baseTree: head,
        inScopePaths: ['docs/builder-kit/**'],
        ignoreManifest: ['*.tmp.md'],
        permissionProfile: 'builder.change',
      });
      return root;
    }

    it('RED baseline-escape [committed] for an out-of-scope committed edit', () => {
      const root = withTaskPack();
      writeFileSync(join(root, 'README-fixture.md'), '# escaped\n', 'utf8');
      git(root, ['add', '-A']);
      git(root, ['commit', '-m', 'out-of-scope committed change']);
      const report = verifyBuilderKit(root);
      const report_ = failures(report).find((entry) => entry.driftClass === 'baseline-escape');
      expect(report_).toBeDefined();
      expect(baselineDetail(report)).toMatch(/committed/);
    });

    it('RED baseline-escape [renamed] for an out-of-scope rename', () => {
      const root = withTaskPack();
      git(root, ['mv', 'README-fixture.md', 'RENAMED-fixture.md']);
      git(root, ['commit', '-m', 'rename']);
      const report = verifyBuilderKit(root);
      expect(failures(report).some((entry) => entry.driftClass === 'baseline-escape')).toBe(true);
      expect(baselineDetail(report)).toMatch(/renamed/);
    });

    it('RED baseline-escape [untracked] for an out-of-scope untracked file', () => {
      const root = withTaskPack();
      writeFileSync(join(root, 'stray.md'), 'untracked\n', 'utf8');
      const report = verifyBuilderKit(root);
      expect(failures(report).some((entry) => entry.driftClass === 'baseline-escape')).toBe(true);
      expect(baselineDetail(report)).toMatch(/untracked/);
    });

    it('ignore-manifest entries and in-scope changes do NOT flag baseline', () => {
      const root = withTaskPack();
      writeFileSync(join(root, 'scratch.tmp.md'), 'ignored\n', 'utf8');
      writeFileSync(
        join(root, 'docs', 'builder-kit', 'PACK.md'),
        'stale in-scope rendering\n',
        'utf8',
      );
      const report = verifyBuilderKit(root);
      expect(failures(report).some((entry) => entry.driftClass === 'baseline-escape')).toBe(false);
      // The stale in-scope rendering is caught as generated-artifact drift.
      expect(classes(report)).toContain('generated-artifact-drift');
    });
  });
});

/* ---- helpers ---- */

function readPack(root: string): string {
  return readFixtureText(root, join(root, 'docs', 'builder-kit', 'context-pack.json'));
}

function readFixtureText(root: string, path?: string): string {
  return readFileSync(path ?? join(root, 'docs', 'VICT-SYSTEM-REFERENCE.md'), 'utf8');
}

function baselineDetail(report: ReturnType<typeof verifyBuilderKit>): string {
  const entry = report.checks.find((check) => check.id.startsWith('baseline:') && !check.ok);
  return entry?.detail ?? '';
}
