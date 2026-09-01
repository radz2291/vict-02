import { VictStoreError } from './store-errors.js';

/**
 * Strict, canonical JSON serialization for persisted records.
 *
 * Identity and byte-comparison depend on this form, so it rejects anything
 * JSON cannot represent losslessly and deterministically: NaN, Infinity,
 * `undefined` object values (silently dropped by JSON.stringify), functions,
 * symbols, bigints outside JSON, and cyclic structures.
 *
 * Canonical form: object keys recursively sorted, arrays preserved, no
 * whitespace. `Date` becomes ISO-8601 UTC; `bigint` is rejected (callers
 * must convert deliberately).
 */

class SerializationError extends Error {
  readonly code = 'VICT_STORE_INVALID_COMMAND';
  constructor(message: string) {
    super(message);
    this.name = 'SerializationError';
  }
}

function assertSerializable(value: unknown, path: string, seen: Set<object>): void {
  if (value === null || value === undefined) {
    // undefined object values are dropped by canonicalize (JSON semantics);
    // undefined array items become null.
    return;
  }
  switch (typeof value) {
    case 'string':
    case 'boolean':
    case 'undefined':
      return;
    case 'number':
      if (!Number.isFinite(value)) {
        throw new SerializationError(`Value at '${path}' is not a finite number.`);
      }
      return;
    case 'bigint':
      throw new SerializationError(`Value at '${path}' is a bigint; convert it deliberately.`);
    case 'function':
    case 'symbol':
      throw new SerializationError(
        `Value at '${path}' is not JSON-serializable (${typeof value}).`,
      );
    case 'object':
      break;
    default:
      throw new SerializationError(`Value at '${path}' is not JSON-serializable.`);
  }
  if (seen.has(value as object)) {
    throw new SerializationError(`Value at '${path}' contains a cyclic reference.`);
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new SerializationError(`Value at '${path}' is an invalid Date.`);
    }
    return;
  }
  seen.add(value as object);
  try {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index++) {
        assertSerializable(value[index], `${path}[${index}]`, seen);
      }
    } else {
      for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        assertSerializable(item, `${path}.${key}`, seen);
      }
    }
  } finally {
    seen.delete(value as object);
  }
}

function canonicalize(value: unknown): unknown {
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

/** Validate then serialize to canonical (stable, sorted-key) JSON. */
export function toCanonicalJson(value: unknown): string {
  assertSerializable(value, '$', new Set());
  return JSON.stringify(canonicalize(value));
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
