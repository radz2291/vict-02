/**
 * Stage 06 H-1 remediation — the ONE recursive, model-facing delivery
 * snapshot boundary for governed capability results.
 *
 * H-1 (post-audit independent closure re-audit): a contract-valid
 * capability output containing a delivery-hostile nested value (for
 * example a Proxy whose property trap throws) passed every top-level
 * bridge check, was settled durably `completed`, and was THEN delivered to
 * Mastra BY REFERENCE — downstream serialization threw and the occurrence
 * normalized as `tool.failed` (VICT_TOOL_FAILED) with zero `tool.completed`
 * while the durable record stayed `completed`. A durably completed
 * invocation must never be delivered in a state that can contradict it.
 *
 * The correction: the exact value returned to Mastra is proven safe BEFORE
 * the fenced `completed` settlement by recursively capturing it into a
 * fresh, VICT-owned, structurally plain snapshot. A value that cannot be
 * captured is rejected BEFORE durable completion (the fenced
 * `outcome_unknown` path in the bridge) — never accepted and then allowed
 * to fail downstream.
 *
 * THE DELIVERY-SAFE DOMAIN (model-facing Mastra delivery boundary only;
 * richer values inside unrelated local VICT capability use are unaffected):
 *
 * ```text
 * null
 * boolean
 * string            (bounded length)
 * finite number     (NaN / ±Infinity rejected)
 * dense arrays of delivery-safe values
 *                   (own keys are exactly the contiguous indices 0..k-1;
 *                   no extra properties, no symbol keys)
 * plain objects containing own enumerable string-keyed data properties
 *                   (prototype Object.prototype or null; every own string
 *                   field an enumerable DATA property)
 * ```
 *
 * Capture rules (ALL enforced here, every reflective operation guarded):
 * - the capture is TOTAL and non-throwing: `Object.getPrototypeOf`,
 *   `Reflect.ownKeys`, and each `Object.getOwnPropertyDescriptor` read may
 *   throw on hostile or revoked proxies; any throw collapses to the single
 *   stable `uninspectable` rejection — no raw exception escapes;
 * - values are read ONLY from own enumerable data-property descriptors —
 *   no getter, setter, proxy `get`/`has` trap, user iterator, `toJSON`
 *   hook, or thenable hook is EVER invoked during structural capture;
 * - `JSON.stringify`, `structuredClone`, and every user-provided
 *   serialization hook are never used for validation;
 * - the result is a FRESH VICT-owned structure: no caller reference or
 *   alias survives at any nesting level, so post-return caller mutation of
 *   the original output can never change the delivered value, the summary,
 *   the events, or the durable record;
 * - cycles are rejected; sparse arrays are rejected; accessor fields,
 *   non-enumerable fields, and symbol keys are rejected WITHOUT being
 *   read; extra array properties are rejected;
 * - functions, BigInt, Symbol, `undefined`, non-finite numbers, and every
 *   non-plain instance (class instances, Date, Map, Set, RegExp, …) are
 *   rejected — nothing is silently stringified or coerced;
 * - recursion depth, total captured nodes, collection lengths, per-object
 *   property counts, and string sizes are bounded; every bound fails
 *   CLOSED;
 * - a nested container that cannot be PROVEN plain (reflection throws or
 *   lies — the descriptor and own-key views disagree, a revoked proxy) is
 *   rejected as `uninspectable`;
 * - a nested proxy whose descriptor reflection is fully transparent
 *   contributes its descriptor DATA to the snapshot — the proxy itself,
 *   its identity, and every trap are left behind: the delivered value is a
 *   plain VICT-owned rebuild against which no caller code can ever run;
 * - own `then` fields (any form) and the reserved bridge control markers
 *   are rejected at every nesting level (defense in depth; the top-level
 *   reserved-marker arbitration in the bridge runs first and unchanged);
 * - Stage 07A N-1 (H-1 audit Low): an own `__proto__` DATA key in any own
 *   form, at any depth, is rejected with the dedicated closed reason
 *   `proto-field` BEFORE any snapshot field is written. Rationale: a plain
 *   rebuilt object can never truthfully carry an own `__proto__` data key —
 *   `snapshot[key] = value` would silently drop scalar values (the inherited
 *   setter ignores non-object values) and turn object values into the
 *   delivered container's PROTOTYPE — so such an output is outside the
 *   delivery domain, never transformed. Safe `constructor` / `prototype`
 *   string keys are unchanged (delivered as plain own data fields), and
 *   null-prototype containers WITHOUT a prohibited own `__proto__` key
 *   remain accepted. The bridge surfaces this rejection through the
 *   EXISTING durable code `VICT_CAPABILITY_UNSAFE_OUTPUT_STRUCTURE`
 *   (model code `VICT_CAPABILITY_OUTCOME_UNKNOWN`) — a documented
 *   specialization of the existing closed durable vocabulary, so no new
 *   durable store value is introduced;
 * - rejection reasons come from ONE closed, stable, non-echoing
 *   vocabulary; rejected keys and values are never retained or surfaced.
 */

import { captureControlRecord } from './control-envelope.js';

/** The bounded capture limits for one delivery snapshot. */
export interface DeliverySnapshotBounds {
  /** Maximum container nesting depth (the root container is depth 0). */
  readonly maxDepth: number;
  /** Maximum total number of captured values (containers AND scalars). */
  readonly maxNodes: number;
  /** Maximum number of elements in one array. */
  readonly maxCollectionLength: number;
  /** Maximum number of own enumerable fields in one object. */
  readonly maxPropertyCount: number;
  /** Maximum length of one string value (in UTF-16 code units). */
  readonly maxStringLength: number;
}

/**
 * The delivery-snapshot bounds. Chosen to bound any single delivered
 * capability result far below framework serialization limits while
 * admitting every realistic governed output; exceeded bounds fail closed
 * (`VICT_CAPABILITY_UNSAFE_OUTPUT_STRUCTURE` at the bridge).
 */
export const DELIVERY_SNAPSHOT_BOUNDS: DeliverySnapshotBounds = Object.freeze({
  maxDepth: 16,
  maxNodes: 4096,
  maxCollectionLength: 1024,
  maxPropertyCount: 128,
  maxStringLength: 8192,
});

/**
 * The CLOSED vocabulary of delivery-unsafe reasons. Stable and non-echoing:
 * a reason never carries keys, values, or content from the rejected output.
 */
export type DeliveryUnsafeReason =
  /** Reflection threw or lied (hostile/revoked proxy, descriptor/own-key disagreement). */
  | 'uninspectable'
  /** A reserved bridge control marker in any own form. */
  | 'reserved-marker'
  /** An own `then` field in any form (data, accessor, hidden). */
  | 'then-field'
  /** An own `__proto__` key in any own form (Stage 07A N-1 hardening). */
  | 'proto-field'
  /** A non-plain instance (class instance, Date, Map, Set, RegExp, …). */
  | 'exotic-prototype'
  /** An own accessor (getter/setter) field — present, never read. */
  | 'accessor-field'
  /** An own non-enumerable field — present, never read. */
  | 'non-enumerable-field'
  /** An own symbol-keyed property. */
  | 'symbol-key'
  /** A function value. */
  | 'function-value'
  /** A BigInt value. */
  | 'bigint-value'
  /** A Symbol value. */
  | 'symbol-value'
  /** An `undefined` value (not part of the delivery domain). */
  | 'undefined-value'
  /** A non-finite number (NaN, +Infinity, -Infinity). */
  | 'non-finite-number'
  /** A cyclic container reference. */
  | 'cycle'
  /** An array with holes (non-contiguous index keys). */
  | 'sparse-array'
  /** An array with extra non-index own properties. */
  | 'extra-array-property'
  /** Container nesting deeper than `maxDepth`. */
  | 'depth-exceeded'
  /** More captured values than `maxNodes`. */
  | 'node-limit-exceeded'
  /** An array longer than `maxCollectionLength`. */
  | 'collection-length-exceeded'
  /** An object with more fields than `maxPropertyCount`. */
  | 'property-count-exceeded'
  /** A string longer than `maxStringLength`. */
  | 'string-length-exceeded';

/** The outcome of one delivery-snapshot capture. */
export type DeliverySnapshotResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly reason: DeliveryUnsafeReason };

/** Canonical (own) array-index key: a non-negative integer without leading zeros. */
const ARRAY_INDEX_PATTERN = /^(?:0|[1-9][0-9]*)$/;

/** Internal mutable capture state (node budget, ancestors on the current path). */
interface CaptureState {
  nodes: number;
  readonly ancestors: Set<object>;
  readonly bounds: DeliverySnapshotBounds;
}

/**
 * Capture a contract-validated capability result into a fresh VICT-owned
 * delivery-safe snapshot. TOTAL (never throws) and passive (never invokes
 * getter/setter/iterator/`toJSON`/proxy `get`/`has`/thenable code): object
 * structure is read exclusively through the shared guarded descriptor
 * capture, and every produced value is either a captured scalar or a newly
 * built plain container.
 *
 * Returns `{ ok: false, reason }` for ANY value outside the documented
 * delivery-safe domain or beyond any bound — the caller (the bridge) MUST
 * reject such outputs before durable completion.
 */
export function captureDeliverySafeSnapshot(
  value: unknown,
  bounds: DeliverySnapshotBounds = DELIVERY_SNAPSHOT_BOUNDS,
): DeliverySnapshotResult {
  try {
    return captureValue(value, 0, {
      nodes: 0,
      ancestors: new Set<object>(),
      bounds,
    });
  } catch {
    // Absolute backstop: no capture failure can ever escape this module.
    return { ok: false, reason: 'uninspectable' } as const;
  }
}

function captureValue(value: unknown, depth: number, state: CaptureState): DeliverySnapshotResult {
  // ---- Node budget (every captured value counts) -------------------------
  state.nodes += 1;
  if (state.nodes > state.bounds.maxNodes) {
    return { ok: false, reason: 'node-limit-exceeded' } as const;
  }
  // ---- Scalars ------------------------------------------------------------
  if (value === null) {
    return { ok: true, value: null } as const;
  }
  switch (typeof value) {
    case 'string':
      if (value.length > state.bounds.maxStringLength) {
        return { ok: false, reason: 'string-length-exceeded' } as const;
      }
      return { ok: true, value } as const;
    case 'boolean':
      return { ok: true, value } as const;
    case 'number':
      if (!Number.isFinite(value)) {
        return { ok: false, reason: 'non-finite-number' } as const;
      }
      return { ok: true, value } as const;
    case 'undefined':
      return { ok: false, reason: 'undefined-value' } as const;
    case 'bigint':
      return { ok: false, reason: 'bigint-value' } as const;
    case 'symbol':
      return { ok: false, reason: 'symbol-value' } as const;
    case 'function':
      return { ok: false, reason: 'function-value' } as const;
    case 'object':
      break;
    default:
      return { ok: false, reason: 'uninspectable' } as const;
  }
  // ---- Containers (guarded, descriptor-only, fresh rebuild) ---------------
  const container = value as object;
  if (state.ancestors.has(container)) {
    return { ok: false, reason: 'cycle' } as const;
  }
  if (depth >= state.bounds.maxDepth) {
    return { ok: false, reason: 'depth-exceeded' } as const;
  }
  let isArray: boolean;
  try {
    isArray = Array.isArray(container);
  } catch {
    return { ok: false, reason: 'uninspectable' } as const;
  }
  const capture = captureControlRecord(container);
  if (capture.kind !== 'captured') {
    return { ok: false, reason: 'uninspectable' } as const;
  }
  if (capture.hasSymbolKeys) {
    return { ok: false, reason: 'symbol-key' } as const;
  }
  if (isArray) {
    return captureArray(container, capture, depth, state);
  }
  if (capture.prototype === 'exotic') {
    // Class instances, Date, Map, Set, RegExp, boxed primitives, and every
    // other non-plain instance are OUTSIDE the delivery domain — rejected,
    // never coerced. (A transparently-behaving proxy over a plain target
    // reports `Object.prototype` here and therefore contributes its
    // descriptor DATA to the snapshot; the proxy itself never survives.)
    return { ok: false, reason: 'exotic-prototype' } as const;
  }
  // Reserved bridge markers, own `then` fields, and — since the Stage 07A
  // N-1 hardening — own `__proto__` keys are rejected at EVERY nesting
  // level, in ANY own form (data, accessor, hidden) — never read. The own
  // `__proto__` rejection is a DEDICATED FIRST PASS over the captured key
  // set, so the closed `proto-field` reason fires deterministically for
  // any object carrying an own `__proto__` key regardless of the other
  // fields' shapes, and BEFORE the snapshot is built (no captured field is
  // ever written through the inherited `__proto__` setter, which would
  // drop scalar values and promote object values to the delivered
  // container's prototype). Arrays cannot carry an own `__proto__` index;
  // an array-side own `__proto__` property is already rejected as
  // `extra-array-property` below.
  for (const key of capture.fields.keys()) {
    if (key === '__proto__') {
      return { ok: false, reason: 'proto-field' } as const;
    }
  }
  for (const [key, field] of capture.fields) {
    if (isReservedOrThenKey(key)) {
      return {
        ok: false,
        reason: key === 'then' ? ('then-field' as const) : ('reserved-marker' as const),
      } as const;
    }
    if (field.kind === 'accessor') {
      return { ok: false, reason: 'accessor-field' } as const;
    }
    if (!field.enumerable) {
      return { ok: false, reason: 'non-enumerable-field' } as const;
    }
  }
  if (capture.fields.size > state.bounds.maxPropertyCount) {
    return { ok: false, reason: 'property-count-exceeded' } as const;
  }
  const snapshot: Record<string, unknown> = {};
  state.ancestors.add(container);
  try {
    for (const [key, field] of capture.fields) {
      if (field.kind !== 'data') {
        return { ok: false, reason: 'accessor-field' } as const;
      }
      const captured = captureValue(field.value, depth + 1, state);
      if (!captured.ok) {
        return captured;
      }
      snapshot[key] = captured.value;
    }
  } finally {
    state.ancestors.delete(container);
  }
  return { ok: true, value: snapshot } as const;
}

function captureArray(
  container: object,
  capture: Extract<ReturnType<typeof captureControlRecord>, { kind: 'captured' }>,
  depth: number,
  state: CaptureState,
): DeliverySnapshotResult {
  // Array own string keys must be EXACTLY the contiguous indices 0..k-1
  // plus the INTRINSIC non-enumerable `length` (never read — a proxy-array
  // `get` trap must never fire; density is proven from the own-key set
  // alone, so an array whose length exceeds its highest contiguous index is
  // delivered as its DENSE VICT-owned prefix — the sparse shape itself is
  // never delivered). Any other string key is an extra array property; any
  // missing index is a hole (a sparse array). Symbol keys were already
  // rejected.
  const indices: number[] = [];
  for (const [key, field] of capture.fields) {
    if (key === 'length' && !field.enumerable) {
      // Intrinsic array length: present-but-unread, never captured.
      continue;
    }
    if (!ARRAY_INDEX_PATTERN.test(key)) {
      return { ok: false, reason: 'extra-array-property' } as const;
    }
    indices.push(Number(key));
  }
  indices.sort((a, b) => a - b);
  for (let i = 0; i < indices.length; i += 1) {
    if (indices[i] !== i) {
      return { ok: false, reason: 'sparse-array' } as const;
    }
  }
  const length = indices.length;
  if (length > state.bounds.maxCollectionLength) {
    return { ok: false, reason: 'collection-length-exceeded' } as const;
  }
  for (const [key, field] of capture.fields) {
    if (key === 'length' && !field.enumerable) {
      continue;
    }
    if (field.kind === 'accessor') {
      return { ok: false, reason: 'accessor-field' } as const;
    }
    if (!field.enumerable) {
      return { ok: false, reason: 'non-enumerable-field' } as const;
    }
  }
  const snapshot: unknown[] = new Array(length);
  state.ancestors.add(container);
  try {
    for (let i = 0; i < length; i += 1) {
      const field = capture.fields.get(String(i));
      if (field === undefined || field.kind !== 'data') {
        return { ok: false, reason: 'sparse-array' } as const;
      }
      const captured = captureValue(field.value, depth + 1, state);
      if (!captured.ok) {
        return captured;
      }
      snapshot[i] = captured.value;
    }
  } finally {
    state.ancestors.delete(container);
  }
  return { ok: true, value: snapshot } as const;
}

/** Reserved bridge marker or own `then` field (rejected in any own form). */
function isReservedOrThenKey(key: string): boolean {
  return (
    key === 'then' ||
    key === 'victCapabilityReplay' ||
    key === 'victCapabilityFailure' ||
    key === 'victHelperFailure'
  );
}
