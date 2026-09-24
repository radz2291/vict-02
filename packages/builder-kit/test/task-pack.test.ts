import { describe, expect, it, vi } from 'vitest';
import { generateStableLayer } from '../src/generate/generate.js';
import { initExternalApp } from '../src/generate/init-app.js';
import { buildTaskPack, taskPackDirectory, writeTaskPack } from '../src/generate/task-pack.js';
import { BOOTSTRAP_PROTOCOL } from '../src/markers.js';
import { buildFixture, failures } from './helpers/fixture.js';
import { verifyBuilderKit } from '../src/verify/verify.js';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { canonicalJsonBytes, packIdentityFromBytes, sha256Hex } from '../src/canonical.js';
import { execFileSync } from 'node:child_process';
import { afterAll } from 'vitest';

// The gate spawns the isolated tsx child; allow for cold starts.
vi.setConfig({ testTimeout: 120_000 });

/** Task pack regeneration, identity, and the external-app bootstrap (P2 support). */

const tempRoots: string[] = [];
afterAll(() => {
  for (const root of tempRoots) rmSync(root, { recursive: true, force: true });
});

describe('task packs (vict.builder.task-pack@1)', () => {
  it('regenerate byte-identically from exactly the four recorded inputs', () => {
    const root = buildFixture({ git: true });
    tempRoots.push(root);
    generateStableLayer(root);
    const head = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
    const params = {
      handoffPath: 'docs/TASK.md',
      baseTree: head,
      inScopePaths: ['docs/builder-kit/**'],
      ignoreManifest: ['*.tmp.md'],
      permissionProfile: 'builder.change',
    };
    const first = writeTaskPack(root, params);
    const second = writeTaskPack(root, params);
    expect(second.bytes.equals(first.bytes)).toBe(true);
    const rebuilt = canonicalJsonBytes(buildTaskPack(root, params));
    expect(rebuilt.equals(first.bytes)).toBe(true);
  });

  it('carry the identity rule and the input digests', () => {
    const root = buildFixture({ git: true });
    tempRoots.push(root);
    generateStableLayer(root);
    const head = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
    const pack = buildTaskPack(root, {
      handoffPath: 'docs/TASK.md',
      baseTree: head,
      inScopePaths: ['docs/builder-kit/**'],
      ignoreManifest: [],
      permissionProfile: 'builder.selfhost',
    });
    expect(packIdentityFromBytes(canonicalJsonBytes(pack))).toBe(pack['packId']);
    expect(pack['baseTree']).toBe(head);
    const handoff = pack['handoff'] as Record<string, unknown>;
    expect(handoff['sha256']).toBe(sha256Hex(readFileSync(join(root, 'docs', 'TASK.md'))));
    const expectedIgnoreDigest = sha256Hex(canonicalJsonBytes([]));
    expect(pack['ignoreManifestDigest']).toBe(expectedIgnoreDigest);
    expect(String(pack['basePackId'])).toMatch(/^[0-9a-f]{64}$/);
  });

  it('isolate into gitignored directories keyed by handoff digest', () => {
    const root = buildFixture({ git: true });
    tempRoots.push(root);
    generateStableLayer(root);
    const head = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
    const written = writeTaskPack(root, {
      handoffPath: 'docs/TASK.md',
      baseTree: head,
      inScopePaths: ['docs/builder-kit/**'],
      ignoreManifest: [],
      permissionProfile: 'builder.change',
    });
    const directory = taskPackDirectory(
      root,
      'docs/TASK.md',
      sha256Hex(readFileSync(join(root, 'docs', 'TASK.md'))),
    );
    expect(written.path.startsWith(directory)).toBe(true);
    expect(directory).toContain('.builder-kit');
    // Git ignores the pack location entirely.
    const status = execFileSync('git', ['-C', root, 'status', '--porcelain'], { encoding: 'utf8' });
    expect(status).not.toContain('.builder-kit');
    // With a task pack present and a clean tree, the gate stays GREEN.
    const report = verifyBuilderKit(root);
    expect(failures(report)).toEqual([]);
  });
});

describe('external app bootstrap (init-app, P2 support)', () => {
  it('writes a host-neutral BUILDER-KIT.md carrying the protocol identity', () => {
    const root = mkdtempSync(join(tmpdir(), 'vict-init-app-'));
    tempRoots.push(root);
    const [written] = initExternalApp({
      appDir: root,
      releaseSetId: 'vict-release-set@1/0.3.1',
      kitArtifactSpec: '@victframework/builder-kit-0.1.0.tgz',
      kitArtifactSha256: 'a'.repeat(64),
    });
    const text = readFileSync(written ?? '', 'utf8');
    expect(text).toContain(BOOTSTRAP_PROTOCOL);
    expect(text).toContain('vict-release-set@1/0.3.1');
    expect(text).toContain('a'.repeat(64));
    expect(text).toContain('the ONLY product specification');
  });
});
