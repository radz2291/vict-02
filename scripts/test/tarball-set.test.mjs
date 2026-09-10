import { describe, expect, it } from 'vitest';
import { canonicalTarballName, matchTarballSet } from '../lib/tarball-set.mjs';

/**
 * Permanent regression coverage for the packed-tarball identity rules used
 * by the release verifiers (Phase F4 repair of F3 finding MD-1: the stale
 * pre-migration `vict-*` name matchers in scripts/verify-stage4.mjs).
 *
 * The current canonical namespace is `@victframework/*`; npm pack emits
 * `victframework-<name>-<version>.tgz`. Identity is decided by the
 * metadata INSIDE each tarball, never by the filename alone, and every
 * failure mode produces a stable diagnostic instead of an undefined
 * dereference.
 */

const CONTRACTS = { name: '@victframework/contracts', version: '0.2.0' };
const SDK = { name: '@victframework/sdk', version: '0.2.0' };
const APPLICATION = { name: '@victframework/application', version: '0.2.0' };
const EXPECTED = [CONTRACTS, SDK, APPLICATION];

function packed(name, version, fileName) {
  return { fileName: fileName ?? canonicalTarballName(name, version), name, version };
}

describe('canonical npm-pack tarball naming', () => {
  it('derives the canonical filename from a current namespaced identity', () => {
    expect(canonicalTarballName('@victframework/sdk', '0.2.0')).toBe('victframework-sdk-0.2.0.tgz');
  });

  it('derives the canonical filename from an unscoped identity', () => {
    expect(canonicalTarballName('left-pad', '1.3.0')).toBe('left-pad-1.3.0.tgz');
  });

  it('keeps the full name segment of a scoped package (no truncation at the hyphen)', () => {
    expect(canonicalTarballName('@victframework/store-sqlite', '0.1.1')).toBe(
      'victframework-store-sqlite-0.1.1.tgz',
    );
  });
});

describe('matchTarballSet — a valid current namespaced set passes', () => {
  it('resolves every expected identity exactly once under canonical filenames', () => {
    const found = [
      packed(CONTRACTS.name, CONTRACTS.version),
      packed(SDK.name, SDK.version),
      packed(APPLICATION.name, APPLICATION.version),
    ];
    const result = matchTarballSet(EXPECTED, found);
    expect(result.ok).toBe(true);
    expect(result.problems).toEqual([]);
    expect(result.byName.get(SDK.name)?.fileName).toBe('victframework-sdk-0.2.0.tgz');
    expect(result.byName.get(APPLICATION.name)?.version).toBe('0.2.0');
    expect(result.byName.size).toBe(3);
  });

  it('accepts the set regardless of the order tarballs appear in the directory', () => {
    const found = [
      packed(SDK.name, SDK.version),
      packed(APPLICATION.name, APPLICATION.version),
      packed(CONTRACTS.name, CONTRACTS.version),
    ];
    expect(matchTarballSet(EXPECTED, found).ok).toBe(true);
  });
});

describe('matchTarballSet — every failure mode fails with stable diagnostics', () => {
  it('fails when a tarball is missing', () => {
    const result = matchTarballSet(EXPECTED, [packed(CONTRACTS.name), packed(SDK.name)]);
    expect(result.ok).toBe(false);
    expect(
      result.problems.some((p) =>
        p.includes(`no packed tarball found for ${APPLICATION.name}@0.2.0`),
      ),
    ).toBe(true);
  });

  it('fails when a tarball is duplicated', () => {
    const result = matchTarballSet(EXPECTED, [
      packed(CONTRACTS.name),
      packed(SDK.name),
      packed(SDK.name),
    ]);
    expect(result.ok).toBe(false);
    expect(result.problems.some((p) => p.includes(`duplicate tarball for ${SDK.name}`))).toBe(true);
    expect(
      result.problems.some((p) => p.includes(`no packed tarball found for ${APPLICATION.name}`)),
    ).toBe(true);
  });

  it('fails when a tarball file is misnamed (right content, non-canonical filename)', () => {
    const result = matchTarballSet(EXPECTED, [
      packed(CONTRACTS.name),
      packed(SDK.name),
      packed(APPLICATION.name, APPLICATION.version, 'application-0.2.0.tgz'),
    ]);
    expect(result.ok).toBe(false);
    expect(result.problems.some((p) => p.includes('tarball filename is not canonical'))).toBe(true);
  });

  it('fails when a tarball carries the wrong version under a canonical filename', () => {
    const result = matchTarballSet(EXPECTED, [
      packed(CONTRACTS.name),
      packed(SDK.name),
      packed(APPLICATION.name, '0.1.1'),
    ]);
    expect(result.ok).toBe(false);
    expect(
      result.problems.some((p) =>
        p.includes(`expected ${APPLICATION.name}@0.2.0 but the tarball contains`),
      ),
    ).toBe(true);
  });

  it('fails when a foreign package is substituted into the pack directory', () => {
    const result = matchTarballSet(EXPECTED, [
      packed(CONTRACTS.name),
      packed(SDK.name),
      packed('@victframework/mastra', '0.2.0'),
    ]);
    expect(result.ok).toBe(false);
    expect(result.problems.some((p) => p.includes('not part of the expected package set'))).toBe(
      true,
    );
    expect(
      result.problems.some((p) => p.includes(`no packed tarball found for ${APPLICATION.name}`)),
    ).toBe(true);
  });

  it('fails when the pack directory is empty', () => {
    const result = matchTarballSet(EXPECTED, []);
    expect(result.ok).toBe(false);
    expect(result.problems.length).toBe(3);
  });

  it('fails with a stable diagnostic when a tarball cannot be parsed (never an undefined dereference)', () => {
    const result = matchTarballSet(EXPECTED, [
      packed(CONTRACTS.name),
      packed(SDK.name),
      {
        fileName: 'victframework-application-0.2.0.tgz',
        error: 'tarball package.json is not parseable JSON',
      },
    ]);
    expect(result.ok).toBe(false);
    expect(result.problems.some((p) => p.includes('unreadable tarball metadata'))).toBe(true);
    expect(result.byName.has(APPLICATION.name)).toBe(false);
  });

  it('fails when metadata is parseable but has no name/version', () => {
    const result = matchTarballSet(EXPECTED, [
      packed(CONTRACTS.name),
      packed(SDK.name),
      { fileName: 'victframework-application-0.2.0.tgz' },
    ]);
    expect(result.ok).toBe(false);
    expect(result.problems.some((p) => p.includes('tarball metadata has no name/version'))).toBe(
      true,
    );
  });
});
