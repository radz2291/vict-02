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
 * string            (no host-imposed length quota)
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
 * - caller values never reach `JSON.stringify`, `structuredClone`, or user
 *   serialization hooks. Only the fresh, validated owned snapshot is probed for
 *   actual downstream JSON encoding failure before durable completion;
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
 * - capture uses an explicit work stack, without default depth/count/size quotas;
 *   a caller may explicitly request the legacy bounds. Actual runtime serialization
 *   failure still rejects before durable completion, without retaining caller data;
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

/** Optional explicit caller policy; the shared delivery boundary has no default quotas. */
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

/** Historical explicit bounds, retained for callers that deliberately opt in.
 * @deprecated These are not applied by default. Size alone is not unsafe structure.
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

/** Capture plain data completely without recursive traversal or implicit size quotas.
 * The H-1 completion fence and N-1 proto/control-marker rejection remain shared
 * package responsibilities, not duplicated Studio policy.
 */
export function captureDeliverySafeSnapshot(
  value: unknown,
  bounds?: DeliverySnapshotBounds,
): DeliverySnapshotResult {
  type Task =
    | {
        kind: 'value';
        input: unknown;
        depth: number;
        target: Record<string, unknown> | unknown[];
        key: string | number;
      }
    | { kind: 'leave'; container: object };
  try {
    const root: Record<string, unknown> = {};
    const ancestors = new Set<object>();
    const tasks: Task[] = [{ kind: 'value', input: value, depth: 0, target: root, key: 'value' }];
    let nodes = 0;
    const set = (
      target: Record<string, unknown> | unknown[],
      key: string | number,
      captured: unknown,
    ) => {
      Object.defineProperty(target, key, {
        value: captured,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    };
    while (tasks.length) {
      const task = tasks.pop()!;
      if (task.kind === 'leave') {
        ancestors.delete(task.container);
        continue;
      }
      const input = task.input;
      nodes++;
      if (bounds && nodes > bounds.maxNodes) return { ok: false, reason: 'node-limit-exceeded' };
      if (
        input === null ||
        typeof input === 'boolean' ||
        typeof input === 'string' ||
        typeof input === 'number'
      ) {
        if (typeof input === 'number' && !Number.isFinite(input))
          return { ok: false, reason: 'non-finite-number' };
        if (typeof input === 'string' && bounds && input.length > bounds.maxStringLength)
          return { ok: false, reason: 'string-length-exceeded' };
        set(task.target, task.key, input);
        continue;
      }
      if (typeof input === 'undefined') return { ok: false, reason: 'undefined-value' };
      if (typeof input === 'bigint') return { ok: false, reason: 'bigint-value' };
      if (typeof input === 'symbol') return { ok: false, reason: 'symbol-value' };
      if (typeof input === 'function') return { ok: false, reason: 'function-value' };
      if (typeof input !== 'object') return { ok: false, reason: 'uninspectable' };
      if (ancestors.has(input)) return { ok: false, reason: 'cycle' };
      if (bounds && task.depth >= bounds.maxDepth) return { ok: false, reason: 'depth-exceeded' };
      const isArray = Array.isArray(input);
      const capture = captureControlRecord(input);
      if (capture.kind !== 'captured') return { ok: false, reason: 'uninspectable' };
      if (capture.hasSymbolKeys) return { ok: false, reason: 'symbol-key' };
      const fields: [string, unknown][] = [];
      let snapshot: Record<string, unknown> | unknown[];
      if (isArray) {
        const indices: number[] = [];
        for (const [key, field] of capture.fields) {
          if (key === 'length' && !field.enumerable) continue;
          if (!ARRAY_INDEX_PATTERN.test(key)) return { ok: false, reason: 'extra-array-property' };
          indices.push(Number(key));
        }
        indices.sort((left, right) => left - right);
        for (let index = 0; index < indices.length; index++)
          if (indices[index] !== index) return { ok: false, reason: 'sparse-array' };
        if (bounds && indices.length > bounds.maxCollectionLength)
          return { ok: false, reason: 'collection-length-exceeded' };
        for (const [key, field] of capture.fields) {
          if (key === 'length' && !field.enumerable) continue;
          if (field.kind === 'accessor') return { ok: false, reason: 'accessor-field' };
          if (!field.enumerable) return { ok: false, reason: 'non-enumerable-field' };
        }
        for (const index of indices) {
          const field = capture.fields.get(String(index));
          if (!field || field.kind !== 'data') return { ok: false, reason: 'sparse-array' };
          fields.push([String(index), field.value]);
        }
        snapshot = new Array(indices.length);
      } else {
        if (capture.prototype === 'exotic') return { ok: false, reason: 'exotic-prototype' };
        // Preserve N-1 precedence: no nested forbidden proto key is ever written.
        for (const key of capture.fields.keys())
          if (key === '__proto__') return { ok: false, reason: 'proto-field' };
        for (const [key, field] of capture.fields) {
          if (isReservedOrThenKey(key))
            return { ok: false, reason: key === 'then' ? 'then-field' : 'reserved-marker' };
          if (field.kind === 'accessor') return { ok: false, reason: 'accessor-field' };
          if (!field.enumerable) return { ok: false, reason: 'non-enumerable-field' };
          fields.push([key, field.value]);
        }
        if (bounds && fields.length > bounds.maxPropertyCount)
          return { ok: false, reason: 'property-count-exceeded' };
        snapshot = {};
      }
      set(task.target, task.key, snapshot);
      ancestors.add(input);
      tasks.push({ kind: 'leave', container: input });
      for (let index = fields.length - 1; index >= 0; index--) {
        const [key, child] = fields[index]!;
        tasks.push({ kind: 'value', input: child, depth: task.depth + 1, target: snapshot, key });
      }
    }
    // Probe only owned plain data. A changed intrinsic serialization hook must
    // never run here; actual VM serialization failure is not a task quota.
    for (const prototype of [Object.prototype, Array.prototype]) {
      const hook = Object.getOwnPropertyDescriptor(prototype, 'toJSON');
      if (hook && (!('value' in hook) || typeof hook.value === 'function'))
        return { ok: false, reason: 'uninspectable' };
    }
    JSON.stringify(root.value);
    return { ok: true, value: root.value };
  } catch {
    return { ok: false, reason: 'uninspectable' };
  }
}

function isReservedOrThenKey(key: string): boolean {
  return (
    key === 'then' ||
    key === 'victCapabilityReplay' ||
    key === 'victCapabilityFailure' ||
    key === 'victHelperFailure'
  );
}
