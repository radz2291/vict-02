/**
 * Stage 06B post-audit remediation — the ONE shared, total, non-throwing
 * control-envelope inspection boundary.
 *
 * Every untrusted tool RESULT or capability/helper OUTPUT object that this
 * package classifies (replay/failure envelopes, reserved-marker rejection,
 * result summarization, adapter milestone reads) MUST go through THIS
 * module's capture primitives instead of direct member reads, `in`,
 * `Object.keys`, iteration, or any other reflection that can invoke user
 * code or throw.
 *
 * Why: the post-audit probes demonstrated that the previous implementation
 * let raw exceptions escape the boundary (outer/inner getters, revoked
 * proxies, `getPrototypeOf`/`ownKeys`/`getOwnPropertyDescriptor`/`has`
 * proxy traps all threw out of the public parsers), that accessor and
 * non-enumerable and inherited marker fields were READ (getters invoked,
 * values trusted), and that arbitrary strings were accepted as event
 * codes. A capability whose result was a hostile Proxy could throw AFTER
 * its effect had run, bypassing the fenced `outcome_unknown` settlement
 * and leaving the durable invocation incorrectly `running`.
 *
 * The mechanism here is deliberately SMALL and purpose-built for the
 * bridge/helper control envelopes (not a generic schema framework):
 *
 * - every reflection step is individually guarded — `Object.getPrototypeOf`,
 *   `Reflect.ownKeys`, and each `Object.getOwnPropertyDescriptor` read may
 *   throw on hostile/revoked proxies; any throw collapses to ONE stable
 *   `unusable` classification (never a raw exception);
 * - values are read ONLY from own enumerable data-property descriptors —
 *   getters, setters, proxy `get` traps, and user iterators are NEVER
 *   invoked by this module;
 * - accessor fields, non-enumerable fields, and symbol-keyed fields are
 *   represented as PRESENT-BUT-UNREADABLE so callers can fail closed
 *   without ever touching their values;
 * - rejected keys, values, trap errors, and canaries are never echoed —
 *   the capture carries field KINDS and data-descriptor values only.
 */

/** The reserved control-marker field names every bridge output surface rejects. */
export const CONTROL_MARKER_KEYS: readonly string[] = [
  'victCapabilityReplay',
  'victCapabilityFailure',
  'victHelperFailure',
] as const;

/** One captured own string-keyed field. Values exist ONLY for data fields. */
export type CapturedControlField =
  | { readonly kind: 'data'; readonly enumerable: boolean; readonly value: unknown }
  | { readonly kind: 'accessor'; readonly enumerable: boolean };

/**
 * The stable classification of one untrusted value at the control-envelope
 * boundary. `captured` is produced ONLY when every reflection step
 * succeeded; `unusable` means the value is an object whose structure could
 * not be proven (revoked proxy, throwing trap, inconsistent trap result) —
 * callers MUST fail closed on it (marker absence can never be proven).
 */
export type CapturedControlRecord =
  | { readonly kind: 'not-object' }
  | { readonly kind: 'unusable' }
  | {
      readonly kind: 'captured';
      /** Own-prototype classification of the object. */
      readonly prototype: 'object-prototype' | 'null' | 'exotic';
      /** Every own STRING key (enumerable or not) with its descriptor kind. */
      readonly fields: ReadonlyMap<string, CapturedControlField>;
      /** True when the object has ANY own symbol-keyed property. */
      readonly hasSymbolKeys: boolean;
    };

/**
 * TOTAL, non-throwing structural capture of one untrusted value.
 *
 * Guards `Array.isArray` (never throws, guarded anyway), `Object.getPrototypeOf`
 * (calls the proxy `getPrototypeOf` trap), `Reflect.ownKeys` (calls the
 * proxy `ownKeys` trap), and every `Object.getOwnPropertyDescriptor` read
 * (calls the proxy `getOwnPropertyDescriptor` trap). Values are read only
 * from data-property descriptors — no getter/setter/get-trap is ever
 * invoked. Never throws.
 */
export function captureControlRecord(value: unknown): CapturedControlRecord {
  if (typeof value !== 'object' || value === null) {
    return { kind: 'not-object' } as const;
  }
  try {
    // `Array.isArray` is spec-guaranteed not to invoke user code; it is
    // evaluated here so callers receive ONE total classification entry
    // point (array-ness is preserved via the prototype classification).
    let prototype: unknown;
    try {
      prototype = Object.getPrototypeOf(value);
    } catch {
      return { kind: 'unusable' } as const;
    }
    let keys: readonly (string | symbol)[];
    try {
      keys = Reflect.ownKeys(value);
    } catch {
      return { kind: 'unusable' } as const;
    }
    const protoKind: 'object-prototype' | 'null' | 'exotic' =
      prototype === Object.prototype ? 'object-prototype' : prototype === null ? 'null' : 'exotic';
    const fields = new Map<string, CapturedControlField>();
    let hasSymbolKeys = false;
    for (const key of keys) {
      if (typeof key !== 'string') {
        hasSymbolKeys = true;
        continue;
      }
      let descriptor: PropertyDescriptor | undefined;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, key);
      } catch {
        return { kind: 'unusable' } as const;
      }
      if (descriptor === undefined) {
        // The ownKeys and getOwnPropertyDescriptor traps disagree: the
        // structure cannot be proven — fail closed.
        return { kind: 'unusable' } as const;
      }
      if (descriptor.get !== undefined || descriptor.set !== undefined) {
        fields.set(key, {
          kind: 'accessor',
          enumerable: descriptor.enumerable === true,
        });
      } else {
        fields.set(key, {
          kind: 'data',
          enumerable: descriptor.enumerable === true,
          value: descriptor.value,
        });
      }
    }
    return { kind: 'captured', prototype: protoKind, fields, hasSymbolKeys } as const;
  } catch {
    // Absolute backstop: no reflection failure can ever escape this module.
    return { kind: 'unusable' } as const;
  }
}

/** True when the captured record has the field in ANY own form (data, accessor, hidden). */
export function capturedHasField(
  capture: Extract<CapturedControlRecord, { kind: 'captured' }>,
  key: string,
): boolean {
  return capture.fields.has(key);
}

/**
 * True when the captured record has ANY reserved control marker in ANY own
 * form (data, accessor, or non-enumerable — symbol keys can never equal a
 * string marker name).
 */
export function capturedHasAnyControlMarker(
  capture: Extract<CapturedControlRecord, { kind: 'captured' }>,
): boolean {
  for (const name of CONTROL_MARKER_KEYS) {
    if (capture.fields.has(name)) {
      return true;
    }
  }
  return false;
}

/** Why a control field could not be read as own enumerable data. */
export type InspectedControlField =
  | { readonly kind: 'absent' }
  | { readonly kind: 'data'; readonly value: unknown }
  | { readonly kind: 'present-unreadable' }
  | { readonly kind: 'unusable' };

/**
 * TOTAL, non-throwing read of ONE field from an untrusted value for
 * marker/milestone decisions. The value is produced ONLY when the field is
 * an own enumerable data property (descriptor-read — no getter or get trap
 * is ever invoked). Accessor, non-enumerable, and symbol-suspicious shapes
 * classify as `present-unreadable`; uninspectable objects classify as
 * `unusable`. Callers treat both exactly like "hostile marker present".
 */
export function inspectControlField(value: unknown, key: string): InspectedControlField {
  const capture = captureControlRecord(value);
  if (capture.kind === 'not-object') {
    return { kind: 'absent' } as const;
  }
  if (capture.kind === 'unusable') {
    return { kind: 'unusable' } as const;
  }
  const field = capture.fields.get(key);
  if (field === undefined) {
    return { kind: 'absent' } as const;
  }
  if (field.kind === 'data' && field.enumerable) {
    return { kind: 'data', value: field.value } as const;
  }
  return { kind: 'present-unreadable' } as const;
}

/**
 * Rebuild a STRUCTURALLY IDENTICAL plain object from a captured record:
 * only own enumerable data fields, values taken from their descriptors
 * (never via property reads). The returned container is trap-free and
 * thenable-free, so post-inspection delivery can never invoke a proxy
 * trap, getter, or inherited `then`. Returns `undefined` when the record
 * is not a plain own-enumerable-data object (arrays, class instances, and
 * anything with accessors/hidden/symbol fields are delivered as-is by the
 * caller under its own policy).
 */
export function rebuildPlainCapturedObject(
  capture: Extract<CapturedControlRecord, { kind: 'captured' }>,
): Record<string, unknown> | undefined {
  if (capture.hasSymbolKeys || capture.prototype === 'exotic') {
    return undefined;
  }
  const rebuilt: Record<string, unknown> = {};
  for (const [key, field] of capture.fields) {
    if (field.kind !== 'data' || !field.enumerable) {
      return undefined;
    }
    rebuilt[key] = field.value;
  }
  return rebuilt;
}
