import { describe, expect, it } from 'vitest';
import { extractRecordedSetVersion } from '../src/verify/app-verify.js';

describe('extractRecordedSetVersion', () => {
  it('extracts a full semver set version (0.3.1 regression)', () => {
    expect(extractRecordedSetVersion('vict-release-set@1/0.3.1')).toBe('0.3.1');
  });

  it('extracts a semver prerelease set version (0.4.0-rc.1 regression)', () => {
    expect(extractRecordedSetVersion('vict-release-set@1/0.4.0-rc.1')).toBe('0.4.0-rc.1');
  });

  it('extracts other prerelease shapes', () => {
    expect(extractRecordedSetVersion('vict-release-set@1/1.0.0-beta.11')).toBe('1.0.0-beta.11');
    expect(extractRecordedSetVersion('vict-release-set@1/2.3.4-rc.1.2.3')).toBe('2.3.4-rc.1.2.3');
  });

  it('fails closed on partial versions and junk', () => {
    expect(extractRecordedSetVersion('vict-release-set@1/0.4')).toBe(null);
    expect(extractRecordedSetVersion('vict-release-set@1/0.4.0-rc.1 extra')).toBe(null);
    expect(extractRecordedSetVersion('vict-release-set@2/0.4.0-rc.1')).toBe(null);
    expect(extractRecordedSetVersion('not-a-set-id')).toBe(null);
    expect(extractRecordedSetVersion('')).toBe(null);
  });
});
