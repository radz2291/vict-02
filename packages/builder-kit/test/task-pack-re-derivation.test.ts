import { describe, expect, it, vi, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { copyFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildFixture,
  failures,
  FIXTURE_PACK_SOURCE_EXTRA_CAPABILITY,
  readFixture,
} from './helpers/fixture.js';
import { generateStableLayer } from '../src/generate/generate.js';
import { writeAcceptedTaskScope } from '../src/generate/accepted-task-scope.js';
import { buildTaskPack, writeTaskPack } from '../src/generate/task-pack.js';
import { verifyTaskPackAuthority } from '../src/verify/task-pack.js';
import { canonicalJsonBytes, packIdentity } from '../src/canonical.js';

vi.setConfig({ testTimeout: 120_000 });

/**
 * Task-pack RE-DERIVATION rule (governance:
 * docs/governance/VICT-STAGE-08-P1-TASK-PACK-RE-DERIVATION-2026-09-25.md).
 *
 * When a task's accepted scope legitimately includes the GENERATED stable
 * layer, executing the task changes the committed base pack, which
 * necessarily stales the issued task pack's `basePackId` binding (the
 * gate's base-pack-binding and regenerate-compare checks compare against
 * the CURRENT committed base pack). The rule:
 *
 * 1. the ISSUED pack is preserved verbatim as evidence (never overwritten);
 * 2. the successor is generated from EXACTLY the same §3.3 inputs — same
 *    handoff bytes, same baseline commit, same scope, same ignore
 *    manifest, same permission profile — so the ONLY fields that differ
 *    are the derived identity pair `basePackId` + `packId`;
 * 3. changing any TASK AUTHORITY field (scope, ignore manifest, profile,
 *    handoff) is NOT routine re-derivation: with a recomputed packId it
 *    still fails authority verification against the accepted record.
 */

const tempRoots: string[] = [];
afterAll(() => {
  for (const root of tempRoots) rmSync(root, { recursive: true, force: true });
});

function git(root: string, args: readonly string[]): string {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' });
}

const PARAMS = {
  handoffPath: 'docs/TASK.md',
  inScopePaths: ['docs/builder-kit/**'],
  ignoreManifest: ['*.tmp.md'],
  permissionProfile: 'builder.change',
} as const;

function freshFixtureWithIssuedPack(): {
  root: string;
  issuedPath: string;
  issuedEvidencePath: string;
  issuedBytes: string;
  baseline: string;
} {
  const root = buildFixture({ git: true });
  tempRoots.push(root);
  writeAcceptedTaskScope(root, {
    handoffPath: PARAMS.handoffPath,
    inScopePaths: [...PARAMS.inScopePaths],
    permissionProfiles: ['builder.change', 'builder.selfhost'],
    ignoreManifest: [...PARAMS.ignoreManifest],
    notes: 'fixture acceptance record: scope derived from the fixture handoff text.',
  });
  const baseline = git(root, ['rev-parse', 'HEAD']).trim();
  const issued = writeTaskPack(root, { ...PARAMS, baseTree: baseline });
  // Rule 1 is procedural: BEFORE re-derivation the issued pack bytes are
  // copied to a preserved evidence path (re-derivation writes to the same
  // per-handoff directory, so the copy must come first).
  const issuedEvidencePath = issued.path.replace('.json', '.issued.json');
  copyFileSync(issued.path, issuedEvidencePath);
  return {
    root,
    issuedPath: issued.path,
    issuedEvidencePath,
    issuedBytes: readFileSync(issued.path, 'utf8'),
    baseline,
  };
}

describe('task-pack re-derivation for a legitimate generated base-pack change', () => {
  it('GREEN: the successor differs from the issued pack ONLY in basePackId + packId, and is authoritative', () => {
    const { root, issuedEvidencePath, issuedBytes, baseline } = freshFixtureWithIssuedPack();

    // The legitimate change: scoped capability-pack content evolves, the
    // stable layer is regenerated, and the change is committed.
    const sourcePath = join(root, 'packs', 'fx-pack', 'src', 'index.ts');
    expect(readFixture(root, 'packs/fx-pack/src/index.ts')).not.toContain('fx.extra');
    writeFileSync(sourcePath, FIXTURE_PACK_SOURCE_EXTRA_CAPABILITY, 'utf8');
    generateStableLayer(root);
    git(root, ['add', '-A']);
    git(root, ['commit', '-m', 'feat(fixture): extra pack capability (legitimate scoped change)']);

    // Re-derivation: EXACTLY the same §3.3 inputs — same handoff bytes,
    // same baseline commit, same scope, same ignore manifest, same
    // profile. Only the committed base pack has moved.
    const successor = writeTaskPack(root, { ...PARAMS, baseTree: baseline });

    const issued = JSON.parse(issuedBytes) as Record<string, unknown>;
    const next = JSON.parse(readFileSync(successor.path, 'utf8')) as Record<string, unknown>;

    // Exactly which derived identity fields change: basePackId + packId.
    expect(next['basePackId']).not.toEqual(issued['basePackId']);
    expect(next['packId']).not.toEqual(issued['packId']);
    // Every task-authority and issuance field is byte-identical.
    for (const field of [
      'schemaMarker',
      'basePackPath',
      'handoff',
      'baseTree',
      'inScopePaths',
      'ignoreManifest',
      'ignoreManifestDigest',
      'permissionProfile',
    ]) {
      expect(next[field]).toEqual(issued[field]);
    }

    // The successor is authoritative under the SAME accepted record.
    const authority = verifyTaskPackAuthority(root, successor.path);
    expect(authority.ok).toBe(true);

    // Rule 1: the issued pack is preserved verbatim as evidence (the copy
    // taken BEFORE re-derivation still holds the issued bytes).
    expect(readFileSync(issuedEvidencePath, 'utf8')).toEqual(issuedBytes);
  });

  it('RED: changing a task authority field does not pass as routine re-derivation', () => {
    const { root, issuedEvidencePath, issuedBytes, baseline } = freshFixtureWithIssuedPack();

    // Legitimate base-pack change + committed.
    writeFileSync(
      join(root, 'packs', 'fx-pack', 'src', 'index.ts'),
      FIXTURE_PACK_SOURCE_EXTRA_CAPABILITY,
      'utf8',
    );
    generateStableLayer(root);
    git(root, ['add', '-A']);
    git(root, ['commit', '-m', 'feat(fixture): extra pack capability (legitimate scoped change)']);

    // A "successor" that ALSO expands scope — a task-authority change —
    // with a recomputed, self-consistent packId. The recomputed packId
    // certifies the bytes; it does NOT confer authority.
    const issued = JSON.parse(issuedBytes) as Record<string, unknown>;
    const smuggled: Record<string, unknown> = {
      ...issued,
      basePackId: buildTaskPack(root, { ...PARAMS, baseTree: baseline })['basePackId'],
      inScopePaths: [...PARAMS.inScopePaths, 'examples/**'],
    };
    delete smuggled['packId'];
    const smuggledPack = { ...smuggled, packId: packIdentity(smuggled) };
    const smuggledPath = issuedEvidencePath.replace('.issued.json', '.smuggled.json');
    writeFileSync(smuggledPath, canonicalJsonBytes(smuggledPack), 'utf8');

    const authority = verifyTaskPackAuthority(root, smuggledPath);
    expect(authority.ok).toBe(false);
    // failures() returns the failing checks only; the accepted-scope
    // binding is what rejects the smuggled expansion.
    const scopeFailure = failures(authority).find((failure) =>
      failure.id.startsWith('task-pack:accepted-scope'),
    );
    expect(scopeFailure).toBeDefined();

    // And the ISSUED pack remains the preserved evidence, untouched.
    expect(readFileSync(issuedEvidencePath, 'utf8')).toEqual(issuedBytes);
  });

  it('RED: the ISSUED pack (not re-derived) fails the gate after the base-pack change', () => {
    // The negative that MOTIVATES the rule: without re-derivation the
    // stale base-pack binding fails authority verification.
    const { root, issuedPath } = freshFixtureWithIssuedPack();
    writeFileSync(
      join(root, 'packs', 'fx-pack', 'src', 'index.ts'),
      FIXTURE_PACK_SOURCE_EXTRA_CAPABILITY,
      'utf8',
    );
    generateStableLayer(root);
    git(root, ['add', '-A']);
    git(root, ['commit', '-m', 'feat(fixture): extra pack capability (legitimate scoped change)']);
    const authority = verifyTaskPackAuthority(root, issuedPath);
    expect(authority.ok).toBe(false);
    expect(
      failures(authority).some(
        (failure) =>
          failure.id.startsWith('task-pack:base-pack-binding') ||
          failure.id.startsWith('task-pack:regenerate-compare'),
      ),
    ).toBe(true);
  });
});
