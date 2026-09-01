import { VictStoreError } from './store-errors.js';

/**
 * Strict, canonical JSON serialization for persisted records.
 *
 * Persisted-value domain (enforced, not assumed): JSON primitives (`string`,
 * finite `number`, `boolean`, `null`), arrays, and plain string-keyed
 * objects. `Date` is the single deliberate extension and becomes ISO-8601
 * UTC. Everything else is REJECTED with a structured error — nothing caller
 * supplied is ever silently dropped, replaced, or collapsed:
 *
 * - `undefined` is rejected everywhere (top level, in objects, in arrays).
 *   JSON.stringify would silently drop object values and turn array items
 *   into `null`; both are data changes, so both are forbidden.
 * - `NaN`/`Infinity`/`-Infinity` are rejected (JSON would emit `null`).
 * - functions, symbols, and bigints are rejected (callers convert
 *   deliberately).
 * - `Map`, `Set`, class instances, and other non-plain objects are rejected:
 *   JSON.stringify would collapse them to `{}` or their enumerable fields,
 *   silently losing their semantics.
 * - cyclic structures are rejected.
 *
 * Canonical form: object keys recursively sorted, arrays preserved, no
 * whitespace. Identity and byte-comparison of activation manifests depend on
 * this form.
 */

function invalid(path: string, why: string): VictStoreError {
  return new VictStoreError(
    'VICT_STORE_INVALID_COMMAND',
    `Value at '${path}' cannot be persisted: ${why}`,
    { operation: 'serialization.persistedValue' },
  );
}

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertPersistedValue(value: unknown, path: string, seen: Set<object>): void {
  if (value === null) {
    return;
  }
  if (value === undefined) {
    throw invalid(path, 'undefined is not a persisted value (omit the field explicitly).');
  }
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return;
    case 'number':
      if (!Number.isFinite(value)) {
        throw invalid(path, 'numbers must be finite (NaN/Infinity are not JSON values).');
      }
      return;
    case 'bigint':
      throw invalid(path, 'bigint must be converted deliberately (e.g. to string).');
    case 'function':
    case 'symbol':
      throw invalid(path, `a ${typeof value} is not a persisted value.`);
    case 'object':
      break;
    default:
      throw invalid(path, `the type '${typeof value}' is not a persisted value.`);
  }
  const object = value as object;
  if (object instanceof Date) {
    if (Number.isNaN(object.getTime())) {
      throw invalid(path, 'the Date is invalid (NaN time).');
    }
    // Deliberate extension: preserved as an ISO-8601 UTC string.
    return;
  }
  if (seen.has(object)) {
    throw invalid(path, 'the value contains a cyclic reference.');
  }
  if (!Array.isArray(object) && !isPlainObject(object)) {
    throw invalid(
      path,
      `only plain objects and arrays are persisted (received ${
        object.constructor?.name ?? 'an exotic object'
      }).`,
    );
  }
  seen.add(object);
  try {
    if (Array.isArray(object)) {
      for (let index = 0; index < object.length; index++) {
        assertPersistedValue(object[index], `${path}[${index}]`, seen);
      }
    } else {
      for (const [key, item] of Object.entries(object as Record<string, unknown>)) {
        assertPersistedValue(item, `${path}.${key}`, seen);
      }
    }
  } finally {
    seen.delete(object);
  }
}

function canonicalize(value: unknown): unknown {
  // Callers have validated the value already; canonicalize only sorts keys
  // and applies the documented Date extension.
  if (value === null) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/**
 * Validate against the persisted-value domain, then serialize to canonical
 * (stable, sorted-key) JSON. Rejects — never silently alters — anything
 * outside the domain.
 */
export function toCanonicalJson(value: unknown): string {
  assertPersistedValue(value, '$', new Set());
  return JSON.stringify(canonicalize(value));
}

/**
 * Validate against the persisted-value domain, then return the canonical
 * JS value (sorted plain objects, Dates as ISO strings) — the same shape the
 * SQLite adapter persists and reads back. Adapters stay equivalent: both
 * reject out-of-domain values and both canonicalize identically.
 */
export function canonicalPersistedValue(value: unknown): unknown {
  assertPersistedValue(value, '$', new Set());
  return canonicalize(value);
}

/**
 * Parse stored JSON and hand it back only after a structured validation.
 * Malformed JSON raises a structured invalid-record error, never a raw
 * SyntaxError with file content.
 */
export function parseStoredJson(text: string, context: string): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw new VictStoreError(
      'VICT_STORE_INVALID_RECORD',
      `Persisted ${context} is not valid JSON.`,
      { operation: `parse:${context}` },
      cause,
    );
  }
  return parsed;
}

/**
 * Deeply freeze a freshly built record so callers cannot mutate canonical
 * state through returned references (DATA-012). Returns the same value.
 */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

/** Structural clone followed by deep freezing: an immutable snapshot. */
export function immutableSnapshot<T>(value: T): T {
  return deepFreeze(structuredClone(value)) as T;
}
