import { types } from 'node:util';

/**
 * Audit-remediation B-4 — the RAW tool-argument guard
 * (`docs/report/VICT-MODEL-FACING-CAPABILITY-SCHEMA-AUDIT-REMEDIATION-CONTRACT.md`
 * §1.5).
 *
 * Mastra's tool wrapper normalizes every execution input BEFORE validation
 * (`convertUndefinedToNull` builds a fresh object with plain assignment, so
 * a primitive- or null-valued own `__proto__` key is a silent no-op that
 * VANISHES before `Contract.parse` can ever see it; an object-valued one
 * silently poisons the normalized copy). The audit (finding B-4) proved the
 * frozen negative control "prototype-key arguments remain REJECTED with
 * ZERO effect" therefore did not hold for every value shape at the real
 * tool surface.
 *
 * The earliest VICT-owned boundary that still sees UNTOUCHED arguments is
 * the `execute` method of the tool object this bridge RETURNS: Mastra's
 * normalization runs INSIDE that method. This module reassigns that PUBLIC
 * property with a guarded wrapper so VICT inspects the raw arguments
 * BEFORE upstream preprocessing. It never patches Mastra in `node_modules`,
 * never vendors it, and never mutates installed files — the wrapped object
 * is VICT's own returned tool.
 *
 * The inspection is PASSIVE and fail closed:
 *
 * - native proxy rejection FIRST (`node:util` `types.isProxy` — executes
 *   ZERO traps, probe-proven): no getter, setter, iterator, `toJSON`, or
 *   hostile proxy trap ever runs during the guard;
 * - own key NAMES at every reachable depth are checked against the hostile
 *   set `{ __proto__, constructor, prototype }` — REGARDLESS of value shape
 *   (object, primitive number/string/boolean, `null`, `undefined`), inside
 *   arrays, and for own data properties created with
 *   `Object.defineProperty` (enumerable or not: key-name checks precede any
 *   value read, so hidden hostile keys cannot hide);
 * - accessor descriptors are never read (the guard skips them; the
 *   authoritative pipeline classifies the value);
 * - the walk is cycle-safe (a revisited container fails closed) and
 *   depth-bounded;
 * - every violation surfaces as ONE stable, non-echoing structured failure
 *   — `victCapabilityFailure: 'VICT_CAPABILITY_INPUT_CONTRACT_REJECTED'` —
 *   with ZERO durable intent, ZERO invocation, ZERO capability effect, no
 *   prototype pollution, and no raw value echo.
 *
 * `Contract.parse` remains the SOLE authority: the guard is an ADDITIONAL
 * fail-closed pre-normalization boundary, never a replacement, and it never
 * accepts anything the authoritative parse would reject.
 */

/** The own key names that can never appear in raw tool arguments. */
export const HOSTILE_RAW_ARGUMENT_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

/** The stable failure code returned for any hostile raw-argument shape. */
export const RAW_ARGUMENT_REJECTED = 'VICT_CAPABILITY_INPUT_CONTRACT_REJECTED' as const;

/** Bounded walk depth: hostile deep nesting fails closed. */
const MAX_GUARD_DEPTH = 512;

/** Internal rejection signal (never surfaced; the wrapper converts it). */
class VictorRawArgumentRejected extends Error {
  constructor(reason: string) {
    super(`raw tool arguments rejected (${reason})`);
    this.name = 'VictorRawArgumentRejected';
  }
}

/**
 * Inspect one raw tool-argument value (TOTAL over the reachable structure).
 * Throws `VictorRawArgumentRejected` on any hostile shape; never reads a
 * value behind an accessor, never stringifies, never iterates, never
 * invokes user code of any kind. Plain and null-prototype containers
 * WITHOUT prohibited own keys pass unchanged.
 */
export function inspectRawToolArguments(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
  depth = 0,
): void {
  // Primitives and null carry no own keys.
  if (value === null || typeof value !== 'object') {
    return;
  }
  // Native proxy rejection BEFORE any inspection of this value (B-3
  // discipline; executes zero traps — probe-proven).
  if (types.isProxy(value)) {
    throw new VictorRawArgumentRejected('proxy');
  }
  // Cycle-safe: a revisited container is a hostile (or unrepresentable)
  // shape and fails closed.
  if (seen.has(value)) {
    throw new VictorRawArgumentRejected('cycle');
  }
  if (depth > MAX_GUARD_DEPTH) {
    throw new VictorRawArgumentRejected('depth');
  }
  seen.add(value);
  // Own STRING key names — enumerable or not — including JSON.parse- and
  // defineProperty-created own `__proto__`/`constructor`/`prototype` data
  // properties. Name checks run BEFORE any value read.
  const names = Object.getOwnPropertyNames(value);
  for (const name of names) {
    if (HOSTILE_RAW_ARGUMENT_KEYS.has(name)) {
      throw new VictorRawArgumentRejected(`prototype-named key`);
    }
  }
  // Recursion is descriptor-driven: accessor descriptors are never read
  // (skipped — the authoritative pipeline classifies them); only data
  // descriptors of proxy-free containers are walked.
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const name of names) {
    const descriptor = descriptors[name];
    if (descriptor === undefined || descriptor.get !== undefined || descriptor.set !== undefined) {
      continue;
    }
    const child = descriptor.value;
    if (child !== null && typeof child === 'object') {
      inspectRawToolArguments(child, seen, depth + 1);
    }
  }
}

/**
 * Attach the raw-argument guard to a VICT-created tool object by
 * reassigning its PUBLIC `execute` property with a guarded wrapper. The
 * wrapper runs BEFORE Mastra's normalization wrapper (which lives inside
 * the original `execute`), so the raw arguments are inspected untouched.
 * Any guard rejection returns the stable structured failure envelope —
 * identical in shape to the bridge's own governed rejections — with zero
 * durable intent, zero invocation, zero capability effect, and no echo.
 * Valid arguments pass through exactly once, unchanged.
 */
export function attachRawToolArgumentGuard(tool: unknown): unknown {
  if (typeof tool !== 'object' || tool === null) {
    return tool;
  }
  const record = tool as { execute?: unknown };
  const baseExecute = record.execute;
  if (typeof baseExecute !== 'function') {
    return tool;
  }
  const guardedExecute = async (...args: unknown[]): Promise<unknown> => {
    try {
      inspectRawToolArguments(args[0]);
    } catch {
      // ONE stable, non-echoing failure — never the raw reason, never any
      // received value, never a thrown raw error.
      return { victCapabilityFailure: RAW_ARGUMENT_REJECTED };
    }
    return (baseExecute as (...callArgs: unknown[]) => unknown)(...args);
  };
  record.execute = guardedExecute;
  return tool;
}
