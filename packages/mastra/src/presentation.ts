import { Buffer } from 'node:buffer';
import { types } from 'node:util';

/**
 * B-1 remediation — the safe bounded capture of model-facing presentation
 * metadata (frozen contract:
 * `docs/report/VICT-MODEL-FACING-CAPABILITY-SCHEMA-CONTRACT.md` §4;
 * audit-remediation contract:
 * `docs/report/VICT-MODEL-FACING-CAPABILITY-SCHEMA-AUDIT-REMEDIATION-CONTRACT.md`
 * §1.1–§1.4).
 *
 * A capability author declares presentation metadata — the descriptive
 * JSON Schema on the neutral contract and the bounded human-readable
 * description on the capability definition. When a model-facing tool is
 * BUILT, this module captures that metadata as INERT BOUNDED DATA:
 *
 * - plain own enumerable DATA only: own accessors (getters/setters),
 *   functions, symbols, and symbol-keyed fields are rejected;
 * - cycles are rejected; exotic prototypes (anything other than
 *   `Object.prototype` or `null`) are rejected — no proxies, no classed
 *   objects, no hostile containers;
 * - prototype-named keys (`__proto__`, `constructor`, `prototype`) and
 *   keys outside the bounded safe-key vocabulary are rejected;
 * - bounded: depth, per-object field count, array length, string length,
 *   total serialized size, and description length — any excess fails
 *   closed;
 * - the captured value is a DEEP IMMUTABLE SNAPSHOT (deep-frozen plain
 *   data) with deterministic key order: mutation of the author's original
 *   object after tool construction can never alter the built tool;
 * - the capture reads no credentials and no runtime payload values — only
 *   the declaration data authored with the capability;
 * - output is deterministic: the same declaration always yields the same
 *   snapshot;
 * - every violation FAILS CLOSED during tool construction with a stable
 *   non-echoing code (received values are never echoed).
 *
 * The presentation is NEVER authority: capturing it executes nothing and
 * it never replaces `Contract.parse` (the bridge's `~standard.validate`
 * continues to delegate to the bound contract unchanged).
 */

/** Stable, non-echoing presentation-capture failure codes. */
export type PresentationCaptureErrorCode =
  | 'VICT_PRESENTATION_INPUT_SCHEMA_REQUIRED'
  | 'VICT_PRESENTATION_INVALID'
  | 'VICT_PRESENTATION_DESCRIPTION_INVALID';

/** Structured presentation-capture failure (thrown at tool construction). */
export class VictPresentationError extends Error {
  readonly code: PresentationCaptureErrorCode;
  /** Bounded, non-echoing detail: stable labels only, never received values. */
  readonly detail: string;

  constructor(code: PresentationCaptureErrorCode, detail: string) {
    super(`capability presentation rejected (${code}): ${detail}`);
    this.name = 'VictPresentationError';
    this.code = code;
    this.detail = detail;
  }
}

/** The frozen capture bounds (frozen contract §4). */
export const PRESENTATION_BOUNDS: Readonly<{
  readonly maxDepth: 8;
  readonly maxFieldsPerObject: 64;
  readonly maxArrayLength: 64;
  readonly maxStringLength: 2048;
  readonly maxTotalBytes: 32768;
  readonly maxDescriptionChars: 1024;
  readonly keyPattern: RegExp;
}> = Object.freeze({
  maxDepth: 8,
  maxFieldsPerObject: 64,
  maxArrayLength: 64,
  maxStringLength: 2048,
  maxTotalBytes: 32768,
  maxDescriptionChars: 1024,
  // Bounded safe-key vocabulary for JSON-Schema property names; anything
  // outside fails closed (hostile or unrepresentable keys).
  keyPattern: /^[A-Za-z0-9_$.-]{1,64}$/,
});

/** Keys that can never appear in captured presentation data. */
const PROTOTYPE_NAMED_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

function captureValue(value: unknown, label: string, depth: number): unknown {
  if (depth > PRESENTATION_BOUNDS.maxDepth) {
    throw new VictPresentationError(
      'VICT_PRESENTATION_INVALID',
      `${label}: nesting exceeds the depth bound ${PRESENTATION_BOUNDS.maxDepth}`,
    );
  }
  if (value === null) {
    return null;
  }
  const valueType = typeof value;
  if (valueType === 'string') {
    const text = value as string;
    if (text.length > PRESENTATION_BOUNDS.maxStringLength) {
      throw new VictPresentationError(
        'VICT_PRESENTATION_INVALID',
        `${label}: a string exceeds the ${PRESENTATION_BOUNDS.maxStringLength}-character bound`,
      );
    }
    return text;
  }
  if (valueType === 'boolean' || valueType === 'number') {
    if (valueType === 'number' && !Number.isFinite(value as number)) {
      throw new VictPresentationError('VICT_PRESENTATION_INVALID', `${label}: non-finite number`);
    }
    return value;
  }
  if (valueType === 'object') {
    // Audit-remediation B-3: NATIVE proxy rejection BEFORE any inspection
    // of this value — before Array.isArray branching reads, prototype
    // reads, descriptor inspection, and any property or array-element
    // read. Node's stable `types.isProxy` executes ZERO traps of the
    // inspected object (probe-proven; audit-remediation contract §1.4),
    // so a plain-target, array-target, nested, lying-descriptor, or
    // revoked proxy is rejected without executing any attacker-controlled
    // behavior.
    if (types.isProxy(value)) {
      throw new VictPresentationError(
        'VICT_PRESENTATION_INVALID',
        `${label}: proxies cannot be captured (plain data only)`,
      );
    }
    if (Array.isArray(value)) {
      if (value.length > PRESENTATION_BOUNDS.maxArrayLength) {
        throw new VictPresentationError(
          'VICT_PRESENTATION_INVALID',
          `${label}: an array exceeds the ${PRESENTATION_BOUNDS.maxArrayLength}-item bound`,
        );
      }
      // Descriptor-driven element capture: element accessors are rejected
      // before any element value is read (a plain array's index properties
      // are the only readable members; `length` is a non-configurable own
      // data property and can never be an accessor).
      const elementDescriptors = Object.getOwnPropertyDescriptors(value);
      const out: unknown[] = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = elementDescriptors[String(index)];
        if (descriptor !== undefined && (descriptor.get !== undefined || descriptor.set !== undefined)) {
          throw new VictPresentationError(
            'VICT_PRESENTATION_INVALID',
            `${label}: an accessor element (getter/setter) cannot be captured`,
          );
        }
        out.push(captureValue(descriptor?.value, `${label}[${index}]`, depth + 1));
      }
      return Object.freeze(out);
    }
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      throw new VictPresentationError(
        'VICT_PRESENTATION_INVALID',
        `${label}: exotic prototype — presentation captures plain data only`,
      );
    }
    // Audit-remediation B-2: ANY own symbol-keyed property — enumerable or
    // not — is REJECTED, never silently dropped. (`getOwnPropertyDescriptors`
    // reports string keys only, so symbols are checked explicitly.)
    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw new VictPresentationError(
        'VICT_PRESENTATION_INVALID',
        `${label}: symbol-keyed fields cannot be captured (plain data only)`,
      );
    }
    let descriptors: Record<string, PropertyDescriptor>;
    try {
      descriptors = Object.getOwnPropertyDescriptors(value as Record<string, unknown>);
    } catch {
      throw new VictPresentationError(
        'VICT_PRESENTATION_INVALID',
        `${label}: the container could not be inspected`,
      );
    }
    const ownKeys = Object.keys(descriptors);
    if (ownKeys.length > PRESENTATION_BOUNDS.maxFieldsPerObject) {
      throw new VictPresentationError(
        'VICT_PRESENTATION_INVALID',
        `${label}: an object exceeds the ${PRESENTATION_BOUNDS.maxFieldsPerObject}-field bound`,
      );
    }
    const out: Record<string, unknown> = {};
    // Deterministic key order: sorted own enumerable string keys.
    for (const key of ownKeys.slice().sort()) {
      if (!PRESENTATION_BOUNDS.keyPattern.test(key) || PROTOTYPE_NAMED_KEYS.has(key)) {
        throw new VictPresentationError(
          'VICT_PRESENTATION_INVALID',
          `${label}: a field name is outside the bounded presentation vocabulary`,
        );
      }
      const descriptor = descriptors[key]!;
      if (!descriptor.enumerable) {
        // Audit-remediation O-3: hidden members are REJECTED explicitly —
        // never silently skipped (silent dropping is the B-2 defect class).
        throw new VictPresentationError(
          'VICT_PRESENTATION_INVALID',
          `${label}: a non-enumerable field cannot be captured (plain own enumerable data only)`,
        );
      }
      if (descriptor.get !== undefined || descriptor.set !== undefined) {
        throw new VictPresentationError(
          'VICT_PRESENTATION_INVALID',
          `${label}: an accessor field (getter/setter) cannot be captured`,
        );
      }
      out[key] = captureValue(descriptor.value, `${label}.${key}`, depth + 1);
    }
    return Object.freeze(out);
  }
  // functions, symbols, bigints, undefined, and everything else.
  throw new VictPresentationError(
    'VICT_PRESENTATION_INVALID',
    `${label}: ${valueType} values cannot be captured (plain data only)`,
  );
}

/**
 * Capture one presentation value (a descriptive JSON Schema) as a deep
 * immutable bounded snapshot. TOTAL and fail closed: any violation throws
 * `VictPresentationError` with a stable non-echoing code.
 *
 * Audit-remediation B-1: the total §4 bound is enforced as the TRUE
 * serialized UTF-8 byte length of the deterministic serialization of the
 * captured snapshot — values, keys, punctuation, containers, and JSON
 * string escaping included — never as JavaScript `.length` (UTF-16 code
 * units) or per-value approximations. The snapshot's key order is sorted
 * by construction, so `JSON.stringify` over it is deterministic and the
 * measurement is reproducible byte-for-byte.
 */
export function capturePresentationSchema(value: unknown, label: string): unknown {
  if (value === undefined) {
    throw new VictPresentationError('VICT_PRESENTATION_INVALID', `${label}: no schema is declared`);
  }
  const captured = captureValue(value, label, 0);
  if (typeof captured !== 'object' || captured === null || Array.isArray(captured)) {
    throw new VictPresentationError(
      'VICT_PRESENTATION_INVALID',
      `${label}: the schema root must be a plain object`,
    );
  }
  // The authoritative total bound: actual UTF-8 bytes of the deterministic
  // serialized presentation (audit finding B-1).
  const serializedBytes = Buffer.byteLength(JSON.stringify(captured), 'utf8');
  if (serializedBytes > PRESENTATION_BOUNDS.maxTotalBytes) {
    throw new VictPresentationError(
      'VICT_PRESENTATION_INVALID',
      `the serialized presentation exceeds the ${PRESENTATION_BOUNDS.maxTotalBytes}-byte bound (measured as serialized UTF-8 bytes)`,
    );
  }
  return captured;
}

/**
 * Capture the bounded capability description. `undefined` (not declared)
 * is valid and returns `undefined`; any non-string or overbound value
 * fails closed. The description is never rewritten, trimmed, or echoed
 * into errors.
 */
export function captureCapabilityDescription(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new VictPresentationError(
      'VICT_PRESENTATION_DESCRIPTION_INVALID',
      'the capability description must be a string',
    );
  }
  if (value.length === 0 || value.length > PRESENTATION_BOUNDS.maxDescriptionChars) {
    throw new VictPresentationError(
      'VICT_PRESENTATION_DESCRIPTION_INVALID',
      `the capability description must be 1..${PRESENTATION_BOUNDS.maxDescriptionChars} characters`,
    );
  }
  return value;
}
