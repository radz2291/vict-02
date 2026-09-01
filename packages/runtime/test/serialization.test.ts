import { describe, expect, it } from 'vitest';
import { toCanonicalJson, canonicalPersistedValue } from '../src/serialization.js';
import { VictStoreError } from '../src/store-errors.js';

/**
 * Focused tests for the strict persisted-value domain (finding: persisted
 * values must be honest and lossless within their declared domain — never
 * silently dropped, replaced, or collapsed by serialization).
 */

function expectInvalid(value: unknown, why: RegExp): void {
  let error: unknown;
  try {
    toCanonicalJson(value);
  } catch (caught) {
    error = caught;
  }
  expect(error).toBeInstanceOf(VictStoreError);
  expect((error as VictStoreError).code).toBe('VICT_STORE_INVALID_COMMAND');
  expect((error as VictStoreError).message).toMatch(why);
}

describe('strict persisted-value domain', () => {
  it('accepts the declared domain: primitives, arrays, plain objects, null, Date', () => {
    expect(toCanonicalJson('text')).toBe('"text"');
    expect(toCanonicalJson(42)).toBe('42');
    expect(toCanonicalJson(-0.5)).toBe('-0.5');
    expect(toCanonicalJson(true)).toBe('true');
    expect(toCanonicalJson(null)).toBe('null');
    expect(toCanonicalJson([])).toBe('[]');
    expect(toCanonicalJson({})).toBe('{}');
    expect(toCanonicalJson({ b: 1, a: [1, 'x', null] })).toBe('{"a":[1,"x",null],"b":1}');
    // The single deliberate extension: Date becomes ISO-8601 UTC.
    expect(toCanonicalJson({ when: new Date(Date.UTC(2026, 0, 2, 3, 4, 5)) })).toBe(
      '{"when":"2026-01-02T03:04:05.000Z"}',
    );
    // Null-prototype objects are plain objects.
    const nullProto = Object.assign(Object.create(null), { ok: 1 });
    expect(toCanonicalJson(nullProto)).toBe('{"ok":1}');
  });

  it('rejects undefined everywhere it could hide', () => {
    expectInvalid(undefined, /undefined is not a persisted value/);
    expectInvalid({ x: undefined }, /undefined is not a persisted value/);
    expectInvalid([undefined], /undefined is not a persisted value/);
    expectInvalid({ a: { b: [undefined] } }, /undefined is not a persisted value/);
  });

  it('rejects non-finite numbers (JSON would emit null)', () => {
    expectInvalid(NaN, /finite/);
    expectInvalid(Infinity, /finite/);
    expectInvalid(-Infinity, /finite/);
    expectInvalid({ nested: [NaN] }, /finite/);
  });

  it('rejects functions, symbols, and bigints', () => {
    expectInvalid(() => 1, /function/);
    expectInvalid(Symbol('tag'), /symbol/);
    expectInvalid(10n, /bigint/);
    expectInvalid({ fn: () => 1 }, /function/);
  });

  it('rejects cyclic structures', () => {
    const cycle: Record<string, unknown> = { name: 'root' };
    cycle.self = cycle;
    expectInvalid(cycle, /cyclic/);
  });

  it('rejects Map, Set, and class instances instead of collapsing them', () => {
    expectInvalid(new Map([['k', 'v']]), /plain objects and arrays/);
    expectInvalid(new Set([1, 2]), /plain objects and arrays/);
    class Wrapper {
      value = 1;
    }
    expectInvalid(new Wrapper(), /plain objects and arrays/);
    expectInvalid({ when: new Map() }, /plain objects and arrays/);
  });

  it('rejects invalid Dates', () => {
    expectInvalid(new Date(Number.NaN), /Date is invalid/);
  });

  it('canonicalizes deterministically: sorted keys, no whitespace', () => {
    expect(toCanonicalJson({ z: 1, a: { y: 2, b: 3 } })).toBe('{"a":{"b":3,"y":2},"z":1}');
    expect(toCanonicalJson([2, 1])).toBe('[2,1]'); // array order is preserved
  });

  it('canonicalPersistedValue returns the canonical JS value adapters store', () => {
    const value = { when: new Date(Date.UTC(2026, 0, 1)), b: 2, a: 1 };
    expect(canonicalPersistedValue(value)).toEqual({
      a: 1,
      b: 2,
      when: '2026-01-01T00:00:00.000Z',
    });
  });
});
