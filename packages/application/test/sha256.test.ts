import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sha256 } from '../src/sha256.js';

/**
 * The pure-TS SHA-256 used for canonical identity must be byte-identical to
 * the platform implementation across edge cases (empty, block boundaries,
 * multi-byte UTF-8, long inputs).
 */
describe('Stage 04: pure sha256 matches node:crypto', () => {
  const vectors = [
    '',
    'abc',
    'vict application identity',
    'a'.repeat(55),
    'a'.repeat(56),
    'a'.repeat(63),
    'a'.repeat(64),
    'a'.repeat(65),
    'a'.repeat(1000),
    'ünïcodé ✓ 日本語',
  ];

  it.each(
    vectors.map(
      (input) =>
        [input.length > 20 ? `${input.slice(0, 10)}…(${input.length})` : input, input] as const,
    ),
  )('hashes %j identically', (_label, input) => {
    const expected = createHash('sha256').update(input, 'utf8').digest('hex');
    expect(sha256(input)).toBe(expected);
  });
});
