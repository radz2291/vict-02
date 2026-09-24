import { describe, expect, it, vi, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildFixture, failures } from './helpers/fixture.js';
import { generateStableLayer } from '../src/generate/generate.js';
import { writeAcceptedTaskScope } from '../src/generate/accepted-task-scope.js';
import { writeTaskPack } from '../src/generate/task-pack.js';
import { verifyBuilderKit, type VerifyReport } from '../src/verify/verify.js';
import { verifyTaskPackAuthority } from '../src/verify/task-pack.js';
import { canonicalJsonBytes, packIdentity, sha256Hex } from '../src/canonical.js';
import { buildToolContext } from '../src/cli.js';

// Fixture git operations and gate runs allow for cold starts.
vi.setConfig({ testTimeout: 120_000 });

/**
 * Active task-pack authority (architecture §3.3/§3.9): a recomputed
 * `packId` certifies bytes, NEVER authority. Permanent negative controls
 * for the authority binding — changed handoff, changed base-pack binding,
 * malformed pack, and expanded scope/ignore set with a recomputed packId —
 * plus the green cases (valid active pack; unchanged-input descendant
 * commit) and the wrapper's refuse-before-scope rule.
 */

const tempRoots: string[] = [];
afterAll(() => {
  for (const root of tempRoots) rmSync(root, { recursive: true, force: true });
});

function git(root: string, args: readonly string[]): string {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' });
}

/** Fixture repo with the committed stable layer AND the accepted-scope record. */
function freshWithAcceptedRecord(): string {
  const root = buildFixture({ git: true });
  tempRoots.push(root);
  generateStableLayer(root);
  writeAcceptedTaskScope(root, {
    handoffPath: 'docs/TASK.md',
    inScopePaths: ['docs/builder-kit/**'],
    permissionProfiles: ['builder.change', 'builder.selfhost'],
    ignoreManifest: ['*.tmp.md'],
    notes: 'fixture acceptance record: scope derived from the fixture handoff text.',
  });
  return root;
}

function activePack(
  root: string,
  overrides: Partial<Parameters<typeof writeTaskPack>[1]> = {},
): string {
  const head = git(root, ['rev-parse', 'HEAD']).trim();
  return writeTaskPack(root, {
    handoffPath: 'docs/TASK.md',
    baseTree: head,
    inScopePaths: ['docs/builder-kit/**'],
    ignoreManifest: ['*.tmp.md'],
    permissionProfile: 'builder.change',
    ...overrides,
  }).path;
}

/** Rewrite a task pack's fields, recomputing its packId (self-consistent bytes). */
function rewritePackRecomputeIdentity(
  path: string,
  mutate: (fields: Record<string, unknown>) => void,
): void {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  const fields = { ...parsed };
  delete fields['packId'];
  mutate(fields);
  writeFileSync(path, canonicalJsonBytes({ ...fields, packId: packIdentity(fields) }), 'utf8');
}

function checkOf(report: VerifyReport, idPrefix: string) {
  return report.checks.filter((check) => check.id.startsWith(idPrefix));
}

describe('active task-pack authority (gate and wrapper)', () => {
  it('GREEN: a valid active task pack with a filed accepted record', () => {
    const root = freshWithAcceptedRecord();
    activePack(root);
    const authority = verifyTaskPackAuthority(root, activePack(root));
    expect(authority.ok).toBe(true);
    const report = verifyBuilderKit(root);
    expect(failures(report)).toEqual([]);
  });

  it('GREEN: an unchanged-input descendant commit (head movement is not drift)', () => {
    const root = freshWithAcceptedRecord();
    activePack(root);
    git(root, ['commit', '--allow-empty', '-m', 'descendant commit, unchanged inputs']);
    const report = verifyBuilderKit(root);
    expect(failures(report)).toEqual([]);
    const regen = checkOf(report, 'task-pack:regenerate-compare');
    expect(regen.every((check) => check.ok)).toBe(true);
  });

  it('RED content-drift when the handoff bytes change (stale binding)', () => {
    const root = freshWithAcceptedRecord();
    activePack(root);
    writeFileSync(
      join(root, 'docs', 'TASK.md'),
      `${readFileSync(join(root, 'docs', 'TASK.md'), 'utf8')}\n## Amended scope (not re-accepted)\n`,
      'utf8',
    );
    const report = verifyBuilderKit(root);
    const binding = checkOf(report, 'task-pack:handoff-binding');
    expect(binding.some((check) => !check.ok && check.driftClass === 'content-drift')).toBe(true);
    // Regeneration reads the CURRENT handoff bytes: the pack is no longer
    // reproducible from the §3.3 inputs.
    expect(
      checkOf(report, 'task-pack:regenerate-compare').some(
        (check) => !check.ok && check.driftClass === 'content-drift',
      ),
    ).toBe(true);
    // Baseline comparison is withheld for a non-authoritative pack.
    expect(
      checkOf(report, 'baseline:').some((check) => check.driftClass === 'baseline-escape'),
    ).toBe(true);
  });

  it('RED content-drift for a changed base-pack binding, even with a recomputed packId', () => {
    const root = freshWithAcceptedRecord();
    const packPath = activePack(root);
    rewritePackRecomputeIdentity(packPath, (fields) => {
      fields['basePackId'] = 'f'.repeat(64);
    });
    const report = verifyBuilderKit(root);
    const binding = checkOf(report, 'task-pack:base-pack-binding');
    expect(binding.some((check) => !check.ok && check.driftClass === 'content-drift')).toBe(true);
    // The pack hashes correctly — that is exactly NOT the standard for authority.
    const identity = checkOf(report, 'task-pack:identity');
    expect(identity.length).toBeGreaterThan(0);
    expect(identity.every((check) => check.ok)).toBe(true);
    expect(report.ok).toBe(false);
  });

  it('RED schema-invalid for a malformed task pack', () => {
    const root = freshWithAcceptedRecord();
    const packPath = activePack(root);
    writeFileSync(
      packPath,
      JSON.stringify({ schemaMarker: 'vict.builder.task-pack@1', packId: 'x' }),
      'utf8',
    );
    const report = verifyBuilderKit(root);
    expect(checkOf(report, 'task-pack:schema').some((check) => !check.ok)).toBe(true);
    expect(
      checkOf(report, 'task-pack:schema').some((check) => check.driftClass === 'schema-invalid'),
    ).toBe(true);
  });

  it('RED baseline-escape for an EXPANDED scope with a recomputed packId', () => {
    const root = freshWithAcceptedRecord();
    const packPath = activePack(root);
    rewritePackRecomputeIdentity(packPath, (fields) => {
      fields['inScopePaths'] = ['docs/builder-kit/**', 'docs/**'];
    });
    const report = verifyBuilderKit(root);
    const scope = checkOf(report, 'task-pack:accepted-scope');
    expect(scope.some((check) => !check.ok && check.driftClass === 'baseline-escape')).toBe(true);
    expect(scope.some((check) => check.detail.includes('docs/**'))).toBe(true);
    // Identity passes; the accepted-scope check is what refuses authority.
    expect(checkOf(report, 'task-pack:identity').every((check) => check.ok)).toBe(true);
    expect(report.ok).toBe(false);
  });

  it('RED baseline-escape for an EXPANDED ignore set with a recomputed packId', () => {
    const root = freshWithAcceptedRecord();
    const packPath = activePack(root);
    rewritePackRecomputeIdentity(packPath, (fields) => {
      fields['ignoreManifest'] = ['*.tmp.md', '**'];
    });
    const report = verifyBuilderKit(root);
    const scope = checkOf(report, 'task-pack:accepted-scope');
    expect(scope.some((check) => !check.ok && check.driftClass === 'baseline-escape')).toBe(true);
    expect(scope.some((check) => check.detail.includes('ignore not granted'))).toBe(true);
  });

  it('WRAPPER: refuses an invalid or stale task pack BEFORE using its scope', () => {
    const root = freshWithAcceptedRecord();
    const validPath = activePack(root);
    const validContext = buildToolContext(root, 'builder.change', validPath);
    expect(typeof validContext).not.toBe('string');
    if (typeof validContext !== 'string') {
      expect(validContext.inScopePaths).toEqual(['docs/builder-kit/**']);
    }

    const expanded = join(root, '.builder-kit', 'packs', 'expanded', 'task-pack.json');
    const head = git(root, ['rev-parse', 'HEAD']).trim();
    const fields: Record<string, unknown> = {
      schemaMarker: 'vict.builder.task-pack@1',
      basePackId: JSON.parse(
        readFileSync(join(root, 'docs', 'builder-kit', 'context-pack.json'), 'utf8'),
      )['packId'],
      basePackPath: 'docs/builder-kit/context-pack.json',
      handoff: {
        path: 'docs/TASK.md',
        sha256: sha256Hex(readFileSync(join(root, 'docs', 'TASK.md'))),
      },
      baseTree: head,
      inScopePaths: ['docs/builder-kit/**', 'scripts/**'],
      ignoreManifest: ['*.tmp.md'],
      ignoreManifestDigest: sha256Hex(canonicalJsonBytes(['*.tmp.md'])),
      permissionProfile: 'builder.change',
    };
    const expandedPack = { ...fields, packId: packIdentity(fields) };
    mkdirSync(join(root, '.builder-kit', 'packs', 'expanded'), { recursive: true });
    writeFileSync(expanded, canonicalJsonBytes(expandedPack), 'utf8');

    const refused = buildToolContext(root, 'builder.change', expanded);
    expect(typeof refused).toBe('string');
    if (typeof refused === 'string') {
      expect(refused).toMatch(/task pack refused/);
      expect(refused).toMatch(/accepted-scope/);
    }
    // Nothing was written under the un-granted scope: refusal precedes use.
    expect(existsSync(join(root, 'scripts', 'evil.txt'))).toBe(false);
  });
});
