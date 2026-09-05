import { describe, expect, it } from 'vitest';
import { VictStoreError, storeUnavailable } from '../src/store-errors.js';

/**
 * Stage 06A Linux-closure adversarial regressions — `driverCause`
 * diagnostic-safety boundary:
 *
 * `VictStoreError.driverCause` is documented as protected
 * development-only information. The safety boundary is enforced by the
 * property's SHAPE: it is defined non-enumerable, non-writable, and
 * non-configurable, so raw driver detail can never enter default
 * serialized surfaces (JSON.stringify, Object.keys, object spread,
 * structured/persistable diagnostics) — while authorized programmatic
 * access (`error.driverCause`) keeps working for local development.
 *
 * Every test below plants unique canaries in the raw cause and asserts
 * they are ABSENT from every default serialized surface, present only
 * through explicit programmatic property access.
 */

const CANARY = {
  object: 'NC-DRIVERCAUSE-PLAIN-OBJECT-CANARY',
  error: 'NC-DRIVERCAUSE-ERROR-MESSAGE-CANARY',
  nested: 'NC-DRIVERCAUSE-NESTED-CAUSE-CANARY',
  getter: 'NC-DRIVERCAUSE-GETTER-CANARY',
  sqlite: 'NC-DRIVERCAUSE-SQLITE-CANARY',
} as const;

/** Every default serialized surface a caller might reach for. */
function serializedSurfaces(error: VictStoreError): Array<{ surface: string; text: string }> {
  const spread = { ...error };
  return [
    { surface: 'JSON.stringify(error)', text: JSON.stringify(error) },
    { surface: 'JSON.stringify(spread)', text: JSON.stringify(spread) },
    { surface: 'Object.keys(error)', text: JSON.stringify(Object.keys(error)) },
    { surface: 'Object.keys(spread)', text: JSON.stringify(Object.keys(spread)) },
    {
      surface: 'Object.getOwnPropertyNames(error) (enumerable view)',
      text: JSON.stringify(
        Object.getOwnPropertyNames(error).filter(
          (name) => Object.getOwnPropertyDescriptor(error, name)?.enumerable,
        ),
      ),
    },
    {
      surface: 'entries via Object.entries(error)',
      text: JSON.stringify(Object.entries(error)),
    },
    {
      surface: 'structuredClone snapshot',
      text: JSON.stringify(
        Object.keys(structuredClone(error) as unknown as Record<string, unknown>),
      ),
    },
    {
      surface: 'toJSON-agnostic string coercion',
      text: `${error}`,
    },
  ];
}

describe('VictStoreError.driverCause never serializes by default', () => {
  it('a plain object cause with enumerable canary fields is absent from every serialized surface', () => {
    const error = new VictStoreError(
      'VICT_STORE_UNAVAILABLE',
      'The store could not complete the operation.',
      { operation: 'probe' },
      {
        message: CANARY.object,
        path: '/secret/database.db',
        nested: { token: CANARY.nested },
      },
    );
    for (const { surface, text } of serializedSurfaces(error)) {
      expect(text.includes(CANARY.object), surface).toBe(false);
      expect(text.includes(CANARY.nested), surface).toBe(false);
      expect(text.includes('/secret/database.db'), surface).toBe(false);
      expect(text.includes('driverCause'), surface).toBe(false);
    }
    // Public safe fields remain usable in the same surfaces.
    expect(JSON.stringify(error)).toContain('VICT_STORE_UNAVAILABLE');
    expect(JSON.stringify(error)).toContain('probe');
  });

  it('a normal Error cause with a canary message and nested cause is absent from every serialized surface', () => {
    const cause = new Error(CANARY.error);
    (cause as Error & { cause?: unknown }).cause = new Error(CANARY.nested);
    const error = new VictStoreError(
      'VICT_STORE_UNAVAILABLE',
      'The store could not complete the operation.',
      { operation: 'probe' },
      cause,
    );
    for (const { surface, text } of serializedSurfaces(error)) {
      expect(text.includes(CANARY.error), surface).toBe(false);
      expect(text.includes(CANARY.nested), surface).toBe(false);
      expect(text.includes('driverCause'), surface).toBe(false);
    }
    // The raw cause was NOT copied into the standard Error.cause (which
    // would create another observable serialization path).
    expect((error as Error & { cause?: unknown }).cause).toBeUndefined();
    expect(JSON.stringify(error)).not.toContain('cause');
  });

  it('a hostile getter cause is never read during serialization and never leaks', () => {
    let reads = 0;
    const hostile = {
      get secret() {
        reads += 1;
        return CANARY.getter;
      },
    };
    const error = new VictStoreError(
      'VICT_STORE_BUSY',
      'The store is busy; the operation did not complete within the configured busy timeout.',
      { operation: 'probe' },
      hostile,
    );
    for (const { surface, text } of serializedSurfaces(error)) {
      expect(text.includes(CANARY.getter), surface).toBe(false);
      expect(text.includes('driverCause'), surface).toBe(false);
    }
    // Non-enumerability means default serialization never even reads the
    // getter.
    expect(reads).toBe(0);
    // Explicit programmatic access still reaches the raw cause.
    expect((error.driverCause as typeof hostile).secret).toBe(CANARY.getter);
    expect(reads).toBe(1);
  });

  it('a representative SQLite driver error is absent from every serialized surface', () => {
    const driverError = {
      code: 'ERR_SQLITE_ERROR',
      errcode: 26,
      message: `file is not a database: ${CANARY.sqlite}`,
      stack: `Error: ${CANARY.sqlite}\n    at /secret/database.db:1:1`,
    };
    const wrapped = storeUnavailable('store.commit', driverError);
    expect(wrapped.code).toBe('VICT_STORE_UNAVAILABLE');
    for (const { surface, text } of serializedSurfaces(wrapped)) {
      expect(text.includes(CANARY.sqlite), surface).toBe(false);
      expect(text.includes('ERR_SQLITE_ERROR'), surface).toBe(false);
      expect(text.includes('/secret/database.db'), surface).toBe(false);
      expect(text.includes('driverCause'), surface).toBe(false);
    }
    // Authorized programmatic access keeps working after wrapping.
    expect((wrapped.driverCause as typeof driverError).errcode).toBe(26);
  });

  it('the storeUnavailable BUSY classification still reaches its driver cause programmatically', () => {
    const busy = { errcode: 5, message: 'database is locked' };
    const wrapped = storeUnavailable('store.commitTransition', busy);
    expect(wrapped.code).toBe('VICT_STORE_BUSY');
    expect(wrapped.driverCause).toBe(busy);
    expect(JSON.stringify(wrapped)).not.toContain('database is locked');
  });
});

describe('VictStoreError.driverCause property shape enforces the boundary', () => {
  it('the property is non-enumerable, non-writable, and non-configurable', () => {
    const raw = { message: CANARY.object };
    const error = new VictStoreError('VICT_STORE_UNAVAILABLE', 'safe', { operation: 'probe' }, raw);
    const descriptor = Object.getOwnPropertyDescriptor(error, 'driverCause');
    expect(descriptor).toBeDefined();
    expect(descriptor?.enumerable).toBe(false);
    expect(descriptor?.writable).toBe(false);
    expect(descriptor?.configurable).toBe(false);
    expect(descriptor?.value).toBe(raw);
  });

  it('reassignment is rejected (strict mode throws; value unchanged)', () => {
    const error = new VictStoreError(
      'VICT_STORE_UNAVAILABLE',
      'safe',
      { operation: 'probe' },
      { message: CANARY.object },
    );
    const replacement = { message: 'REPLACEMENT-ATTEMPT' };
    expect(() => {
      (error as { driverCause?: unknown }).driverCause = replacement;
    }).toThrow(TypeError);
    expect((error.driverCause as { message: string }).message).toBe(CANARY.object);
    // Configuration attempts fail closed too.
    expect(() => {
      Object.defineProperty(error, 'driverCause', { enumerable: true });
    }).toThrow(TypeError);
  });

  it('an undefined cause is still non-enumerable (no key appears at all)', () => {
    const error = new VictStoreError('VICT_STORE_UNAVAILABLE', 'safe', { operation: 'probe' });
    expect(Object.getOwnPropertyDescriptor(error, 'driverCause')).toBeDefined();
    expect(Object.keys(error)).not.toContain('driverCause');
    expect('driverCause' in JSON.parse(JSON.stringify(error))).toBe(false);
  });

  it('structured-clone snapshots (persistable diagnostic path) drop the raw cause', () => {
    const error = new VictStoreError(
      'VICT_STORE_UNAVAILABLE',
      'safe',
      { operation: 'probe' },
      { message: CANARY.object },
    );
    const snapshot = structuredClone(error) as unknown as Record<string, unknown>;
    expect(snapshot.driverCause).toBeUndefined();
    expect(JSON.stringify(snapshot)).not.toContain(CANARY.object);
  });
});
