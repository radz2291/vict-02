import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import prettier from 'prettier';
import {
  canonicalJsonBytes,
  packIdentity,
  packIdentityFromBytes,
  sha256Hex,
  sortKeysDeep,
} from '../src/canonical.js';

/** Permanent negative controls for canonicalization and the identity rule. */

const packShaped = {
  stopConditions: ['stop one', 'stop two'],
  verificationCommands: ['npm run format:check', 'npm run lint', 'npm run typecheck'],
  schemaMarker: 'vict.builder.context-pack@1',
  packId: 'a'.repeat(64),
  generatedFrom: {
    referenceVersion: '9.9.9',
    releaseSetId: 'vict-release-set@1/0.0.1',
    workspaceIdentity: { name: 'vict-fixture', version: '0.0.1', workspaces: ['packs/*'] },
    inputs: [
      { path: 'docs/VICT-SYSTEM-REFERENCE.md', contentSha256: 'b'.repeat(64) },
      { path: 'docs/RELEASE-COMPATIBILITY.md', contentSha256: 'c'.repeat(64) },
    ],
  },
  repositoryMap: [
    {
      name: '@victframework/fx-pack',
      version: '1.0.0',
      main: './src/index.ts',
      types: './src/index.ts',
      private: true,
      internalDependencies: [],
      externalDependencies: ['left-pad'],
    },
  ],
  constitution: [
    {
      sourcePath: 'docs/VICT-SYSTEM-REFERENCE.md',
      anchor: '§2',
      contentSha256: 'd'.repeat(64),
      excerpt: '1. One.\n2. Two.',
    },
  ],
  verifiedBaseline: {
    sourcePath: 'docs/VICT-SYSTEM-REFERENCE.md',
    anchor: '### 24.1',
    contentSha256: 'e'.repeat(64),
    extract: '- final bullet',
  },
  toolManifestRef: {
    schemaMarker: 'vict.builder.tools@1',
    sourcePath: 'packages/builder-kit/data/tools.json',
    contentSha256: 'f'.repeat(64),
  },
  permissionProfilesRef: {
    schemaMarker: 'vict.builder.profile@1',
    sourcePath: 'packages/builder-kit/data/profiles.json',
    contentSha256: '1'.repeat(64),
  },
};

describe('canonical JSON', () => {
  it('is byte-stable across repeated invocations', () => {
    expect(canonicalJsonBytes(packShaped)).toEqual(canonicalJsonBytes(packShaped));
  });

  it('is insertion-order independent (key-sorted)', () => {
    const flipped: Record<string, unknown> = {};
    for (const key of Object.keys(packShaped).reverse()) {
      flipped[key] = (packShaped as Record<string, unknown>)[key];
    }
    expect(canonicalJsonBytes(flipped)).toEqual(canonicalJsonBytes(packShaped));
  });

  it('matches Prettier JSON formatting byte-for-byte (printWidth 100)', async () => {
    const mine = canonicalJsonBytes(packShaped).toString('utf8');
    const formatted = await prettier.format(mine, { parser: 'json', printWidth: 100 });
    expect(mine).toBe(formatted);
  });

  it('sorts nested object keys recursively', () => {
    const sorted = sortKeysDeep({ z: { y: 1, a: 2 }, b: 3 }) as Record<string, unknown>;
    expect(Object.keys(sorted)).toEqual(['b', 'z']);
    expect(Object.keys(sorted['z'] as Record<string, unknown>)).toEqual(['a', 'y']);
  });

  it('carries no timestamps, randomness, host paths, or carrying-commit SHAs', () => {
    const text = canonicalJsonBytes(packShaped).toString('utf8');
    expect(text).not.toMatch(/generatedAt|timestamp|Date\.now|process\.cwd|commit/i);
  });
});

describe('pack identity (architecture §3.3/§4.4 — packId over canonical bytes with packId omitted)', () => {
  it('ignores any packId value present in the object', () => {
    const withoutIdentity = { ...packShaped };
    delete (withoutIdentity as Record<string, unknown>)['packId'];
    const withOther = { ...packShaped, packId: 'f'.repeat(64) };
    expect(packIdentity(withOther)).toBe(packIdentity(withoutIdentity));
  });

  it('differs from the hash over bytes that INCLUDE packId (exclusion enforced)', () => {
    const includingPackId = createHash('sha256')
      .update(canonicalJsonBytes(packShaped))
      .digest('hex');
    const withoutIdentity = { ...packShaped };
    delete (withoutIdentity as Record<string, unknown>)['packId'];
    expect(packIdentity(packShaped)).not.toBe(includingPackId);
    expect(packIdentity(packShaped)).toBe(sha256Hex(canonicalJsonBytes(withoutIdentity)));
  });

  it('recomputes from committed file bytes and detects a flipped byte', () => {
    const bytes = canonicalJsonBytes(packShaped);
    expect(packIdentityFromBytes(bytes)).toBe(packIdentity(packShaped));
    const tampered = Buffer.from(bytes.toString('utf8').replace('9.9.9', '9.9.8'), 'utf8');
    expect(packIdentityFromBytes(tampered)).not.toBe(packIdentity(packShaped));
  });
});
