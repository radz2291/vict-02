#!/usr/bin/env node
/**
 * Stage 07A N-1 emitted-package probe (handoff work item 1).
 *
 * Proves, against the EMITTED `@victframework/mastra` build only (no
 * workspace sources), that the delivery-safe snapshot boundary rejects own
 * `__proto__` keys with the dedicated closed reason `proto-field`:
 *
 *   1. a scalar-valued own `__proto__` data key at depth >= 2 is REJECTED
 *      (never silently dropped from the delivered snapshot);
 *   2. an object-valued own `__proto__` data key at depth >= 2 is REJECTED
 *      (never promoted to the delivered container's prototype);
 *   3. `Object.prototype` is unpolluted in every case;
 *   4. safe behavior is preserved: `constructor` / `prototype` own string
 *      keys are delivered as plain own data fields; null-prototype
 *      containers without a prohibited `__proto__` key remain ACCEPTED;
 *   5. every delivered safe snapshot survives deterministic serialization.
 *
 * This script is the N-1 NEGATIVE-CONTROL artifact: run against a build of
 * the pre-correction tip `e0e65b7dc3c11a985ad0524f23aec380b9119c8d` in an
 * isolated worktree it MUST FAIL (the defect reproduces); run against the
 * corrected implementation it MUST PASS.
 *
 * Usage: node scripts/verify-n1-emitted.mjs   (run `npm run build` first)
 * The module is imported by FILE PATH so the probe is independent of the
 * workspace package names (it also runs in trees that predate the
 * `@victframework/*` namespace).
 */
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const distEntry = join(repoRoot, 'packages', 'mastra', 'dist', 'index.js');

if (!existsSync(distEntry)) {
  console.error(
    'verify-n1-emitted: packages/mastra/dist/index.js not found — run `npm run build` first.',
  );
  process.exit(2);
}

const { captureDeliverySafeSnapshot } = await import(pathToFileURL(distEntry).href);

let failures = 0;
function check(condition, label) {
  if (condition) {
    console.log(`  ok: ${label}`);
  } else {
    console.error(`  FAIL: ${label}`);
    failures += 1;
  }
}

/** An object carrying an OWN enumerable `__proto__` DATA property. */
function withOwnProto(value) {
  const obj = { marker: 'payload' };
  Object.defineProperty(obj, '__proto__', {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
  return obj;
}

const snapshotPrototypeBefore = Object.getPrototypeOf(Object.prototype);

// ---- 1. scalar-valued own `__proto__` at depth 2 --------------------------
{
  const hostile = { a: { b: withOwnProto(12345) } };
  const result = captureDeliverySafeSnapshot(hostile);
  check(result.ok === false, 'scalar own __proto__ (depth 2): rejected');
  if (!result.ok) {
    check(
      result.reason === 'proto-field',
      `scalar own __proto__ (depth 2): dedicated closed reason 'proto-field' (got '${result.reason}')`,
    );
  } else {
    // Pre-correction defect signature: the scalar value was silently
    // dropped by the inherited `__proto__` setter.
    const inner = result.value?.a?.b;
    check(
      inner !== undefined &&
        !Object.prototype.hasOwnProperty.call(Object(inner), '__proto__') &&
        JSON.stringify(inner) === JSON.stringify({ marker: 'payload' }),
      'scalar own __proto__ (depth 2): pre-correction defect reproduced (value silently dropped)',
    );
  }
  check(
    Object.getOwnPropertyDescriptor(Object.prototype, 'canaryN1Scalar') === undefined,
    'scalar own __proto__: Object.prototype unpolluted',
  );
}

// ---- 2. object-valued own `__proto__` at depth 2 --------------------------
{
  const payload = { leaked: true };
  const hostile = { outer: { inner: withOwnProto(payload) } };
  const result = captureDeliverySafeSnapshot(hostile);
  check(result.ok === false, 'object own __proto__ (depth 2): rejected');
  if (!result.ok) {
    check(
      result.reason === 'proto-field',
      `object own __proto__ (depth 2): dedicated closed reason 'proto-field' (got '${result.reason}')`,
    );
  } else {
    // Pre-correction defect signature: the captured payload became the
    // delivered container's PROTOTYPE.
    const inner = result.value?.outer?.inner;
    const promoted =
      inner !== null &&
      typeof inner === 'object' &&
      Object.getPrototypeOf(inner) !== Object.prototype &&
      Object.getPrototypeOf(inner) !== null;
    check(
      promoted,
      'object own __proto__ (depth 2): pre-correction defect reproduced (value became the container prototype)',
    );
  }
  check(
    Object.getOwnPropertyDescriptor(Object.prototype, 'leaked') === undefined,
    'object own __proto__: Object.prototype unpolluted',
  );
}

// ---- 3. top-level own `__proto__` (both value forms) ----------------------
{
  const scalar = captureDeliverySafeSnapshot(withOwnProto('top-scalar'));
  check(
    scalar.ok === false && !scalar.ok && scalar.reason === 'proto-field',
    'top-level scalar own __proto__: rejected with proto-field',
  );
  const obj = captureDeliverySafeSnapshot(withOwnProto({ x: 1 }));
  check(
    obj.ok === false && !obj.ok && obj.reason === 'proto-field',
    'top-level object own __proto__: rejected with proto-field',
  );
}

// ---- 4. safe behavior preserved -------------------------------------------
{
  const safe = { constructor: 'c', prototype: 'p', nested: { constructor: 1, list: [1, 2, 3] } };
  const result = captureDeliverySafeSnapshot(safe);
  check(result.ok === true, 'constructor/prototype own string keys: accepted');
  if (result.ok) {
    check(
      Object.getOwnPropertyDescriptor(result.value, 'constructor')?.value === 'c' &&
        Object.getOwnPropertyDescriptor(result.value, 'prototype')?.value === 'p',
      'constructor/prototype delivered as plain own data fields',
    );
    check(
      Object.getPrototypeOf(result.value) === Object.prototype,
      'delivered safe object keeps Object.prototype',
    );
    check(
      JSON.stringify(result.value) === JSON.stringify(safe),
      'safe snapshot serializes identically',
    );
  }

  const nullProto = Object.create(null);
  nullProto.honest = 'value';
  const np = captureDeliverySafeSnapshot({ container: nullProto });
  check(np.ok === true, 'null-prototype container (no prohibited key): still ACCEPTED');
  if (np.ok) {
    check(
      Object.getPrototypeOf(np.value.container) === Object.prototype &&
        np.value.container.honest === 'value',
      'null-prototype container delivered with own data intact',
    );
  }

  const round = { deep: { list: [{ ok: true, n: 1.5, s: 'x' }] } };
  const r1 = captureDeliverySafeSnapshot(round);
  const r2 = captureDeliverySafeSnapshot(round);
  check(
    r1.ok && r2.ok && JSON.stringify(r1.value) === JSON.stringify(r2.value),
    'deterministic repeated serialization of an accepted snapshot',
  );
}

check(
  Object.getPrototypeOf(Object.prototype) === snapshotPrototypeBefore,
  'Object.prototype identity unchanged by the probe',
);

if (failures > 0) {
  console.error(`\nverify-n1-emitted: ${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('\nverify-n1-emitted: ALL CHECKS PASSED');
