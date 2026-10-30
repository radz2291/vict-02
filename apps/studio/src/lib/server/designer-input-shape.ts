import { types } from 'node:util';
import type { SafeInputValidationIssue } from '@victframework/mastra';

export type StudioInputObservedType =
  | 'object'
  | 'array'
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'undefined'
  | 'missing'
  | 'non-json'
  | 'uninspectable';

export interface StudioInputShape {
  readonly schema: 'studio.tool-input-shape@1';
  readonly rootType: StudioInputObservedType;
  readonly fields: readonly {
    readonly path: readonly (string | number)[];
    readonly observedType: StudioInputObservedType;
  }[];
}

/** No values, field inventory, lengths or parser messages enter the receipt. */
function observedType(value: unknown): StudioInputObservedType {
  if (value === null) return 'null';
  if (typeof value === 'undefined') return 'undefined';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return Number.isFinite(value) ? 'number' : 'non-json';
  if (typeof value !== 'object') return 'non-json';
  // Native proxy detection precedes every reflective operation, even for a
  // revoked proxy. It invokes no user-defined traps.
  if (types.isProxy(value)) return 'uninspectable';
  try {
    const prototype = Object.getPrototypeOf(value);
    if (Array.isArray(value)) return prototype === Array.prototype ? 'array' : 'uninspectable';
    return prototype === Object.prototype || prototype === null ? 'object' : 'uninspectable';
  } catch {
    return 'uninspectable';
  }
}

function ownData(
  container: unknown,
  key: string,
): { value: unknown } | 'missing' | 'uninspectable' {
  const kind = observedType(container);
  if (kind !== 'object' && kind !== 'array') return 'uninspectable';
  try {
    const descriptor = Object.getOwnPropertyDescriptor(container, key);
    if (!descriptor) return 'missing';
    if (!('value' in descriptor) || !descriptor.enumerable) return 'uninspectable';
    return { value: descriptor.value };
  } catch {
    return 'uninspectable';
  }
}

/** This accepts only the already sanitized, host-owned rejection projection.
 * Dynamic parser paths must first pass studioValidationRejection's vocabulary.
 * Bounds and descriptor reads below prevent accidental exotic path execution. */
function capturedPath(value: unknown): readonly (string | number)[] | undefined {
  if (observedType(value) !== 'array') return;
  const length = Object.getOwnPropertyDescriptor(value, 'length');
  if (!length || !('value' in length) || !Number.isInteger(length.value) || length.value > 8)
    return;
  const path: (string | number)[] = [];
  for (let index = 0; index < length.value; index++) {
    const part = ownData(value, String(index));
    if (typeof part === 'string') return;
    const item = part.value;
    if (typeof item === 'number' && Number.isInteger(item) && item >= 0 && item <= 100000)
      path.push(item);
    else if (
      typeof item === 'string' &&
      /^[_a-zA-Z][_a-zA-Z0-9]{0,63}$/.test(item) &&
      !['__proto__', 'prototype', 'constructor'].includes(item)
    )
      path.push(item);
    else return;
  }
  return Object.freeze(path);
}

function atPath(input: unknown, path: readonly (string | number)[]): StudioInputObservedType {
  let current = input;
  for (const key of path) {
    const next = ownData(current, String(key));
    if (typeof next === 'string') return next;
    current = next.value;
  }
  return observedType(current);
}

/** Value-free parser-evaluation evidence, not a tool-call identity or validator.
 * This never accepts/coerces input, changes feedback, or retains input objects.
 * The model-facing guard and its input-free policy remain unchanged. */
export function studioInputShape(
  value: unknown,
  sanitizedRejectionIssues: readonly Pick<SafeInputValidationIssue, 'path' | 'rule'>[],
): StudioInputShape {
  const fields: { path: readonly (string | number)[]; observedType: StudioInputObservedType }[] =
    [];
  if (observedType(sanitizedRejectionIssues) === 'array') {
    for (let index = 0; index < 5; index++) {
      const issue = ownData(sanitizedRejectionIssues, String(index));
      if (typeof issue === 'string') break;
      const rule = ownData(issue.value, 'rule');
      const rawPath = ownData(issue.value, 'path');
      if (typeof rule === 'string' || rule.value !== 'invalid_type' || typeof rawPath === 'string')
        continue;
      const path = capturedPath(rawPath.value);
      if (!path) continue;
      fields.push(Object.freeze({ path, observedType: atPath(value, path) }));
    }
  }
  return Object.freeze({
    schema: 'studio.tool-input-shape@1',
    rootType: observedType(value),
    fields: Object.freeze(fields),
  });
}
