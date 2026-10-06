/**
 * Canonical bytes and content digests for UI documents (API-SPEC §1).
 *
 * The canonical form is the SAME stable-JSON discipline as the existing
 * `stableJson` in `packages/application/src/compile.ts` (recursively sorted
 * object keys, array order preserved, closed serializable domain) —
 * reimplemented here because `packages/ui` must never depend on
 * `packages/application` (the graph is acyclic: application → ui).
 * `contentDigest` is lowercase hex SHA-256 of the UTF-8 canonical bytes.
 */

import { sha256 } from './sha256.js';
import { CanonicalUiError } from './canonical-error.js';

const seen = new Set<object>();

/** Stable JSON: recursively sorted object keys, arrays preserved in order. */
export function stableJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown, path = '(root)'): unknown {
  if (value === null) return null;
  const type = typeof value;
  if (type === 'string' || type === 'boolean') return value;
  if (type === 'number') {
    if (!Number.isFinite(value)) {
      throw new CanonicalUiError('NON_CANONICAL_VALUE', `non-finite number at '${path}'`, path);
    }
    if (Object.is(value, -0)) {
      throw new CanonicalUiError('NON_CANONICAL_VALUE', `negative zero at '${path}' (use 0)`, path);
    }
    return value;
  }
  if (type === 'bigint' || type === 'function' || type === 'symbol' || type === 'undefined') {
    throw new CanonicalUiError(
      'NON_CANONICAL_VALUE',
      `the canonical serializable domain rejects ${type} at '${path}'`,
      path,
    );
  }
  if (seen.has(value as object)) {
    throw new CanonicalUiError('CYCLIC_STRUCTURE', `cyclic structure at '${path}'`, path);
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) {
        throw new CanonicalUiError('NON_CANONICAL_VALUE', `sparse array at '${path}'`, path);
      }
    }
    seen.add(value as object);
    try {
      return value.map((item, index) => canonicalize(item, `${path}[${index}]`));
    } finally {
      seen.delete(value as object);
    }
  }
  const proto = Object.getPrototypeOf(value as object);
  if (proto !== Object.prototype && proto !== null) {
    throw new CanonicalUiError(
      'NON_CANONICAL_VALUE',
      `unsupported prototype at '${path}' (plain data only)`,
      path,
    );
  }
  const source = value as Record<string, unknown>;
  seen.add(value as object);
  try {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      const item = source[key];
      if (item !== undefined) out[key] = canonicalize(item, `${path}.${key}`);
    }
    return out;
  } finally {
    seen.delete(value as object);
  }
}

export interface CanonicalUiDocument {
  /** Canonical JSON text (sorted keys, ordered arrays). */
  readonly bytes: string;
  /** Lowercase hex SHA-256 of the UTF-8 canonical bytes. */
  readonly contentDigest: string;
}

/** Canonical bytes + contentDigest of one document's semantic content. */
export function canonicalUiDocument(document: unknown): CanonicalUiDocument {
  const bytes = stableJson(document);
  return { bytes, contentDigest: sha256(bytes) };
}

/**
 * The identity payload entry for one catalog document: id + revision +
 * contentDigest of the document's canonical bytes (excluding nothing —
 * the full document is the semantic unit).
 */
export interface UiDocumentIdentityEntry {
  readonly documentId: string;
  readonly revision: string;
  readonly contentDigest: string;
}

/**
 * U0 amendment A-03: deduplicate identity entries by `(documentId,
 * revision)` and totally order them by Unicode code points (equivalent to
 * UTF-8 byte order; deliberately NOT UTF-16 code-unit order). Duplicate
 * entries must carry equal digests (the caller enforces collisions first).
 */
export function orderUiDocumentIdentityEntries(
  entries: readonly UiDocumentIdentityEntry[],
): readonly UiDocumentIdentityEntry[] {
  const byKey = new Map<string, UiDocumentIdentityEntry>();
  for (const entry of entries) {
    const key = `${entry.documentId}\u0000${entry.revision}`;
    const existing = byKey.get(key);
    if (existing !== undefined && existing.contentDigest !== entry.contentDigest) {
      throw new CanonicalUiError(
        'REVISION_COLLISION',
        `two entries for (${entry.documentId}, ${entry.revision}) disagree on contentDigest`,
        `${entry.documentId}@${entry.revision}`,
      );
    }
    byKey.set(key, entry);
  }
  return [...byKey.values()].sort((a, b) => {
    if (a.documentId !== b.documentId) return compareCodePoints(a.documentId, b.documentId);
    return compareCodePoints(a.revision, b.revision);
  });
}

/** True code-point comparison (NOT UTF-16 code-unit order): iterates code points. */
export function compareCodePoints(a: string, b: string): number {
  const pointsA = Array.from(a);
  const pointsB = Array.from(b);
  const length = Math.min(pointsA.length, pointsB.length);
  for (let index = 0; index < length; index += 1) {
    const codeA = (pointsA[index] as string).codePointAt(0) as number;
    const codeB = (pointsB[index] as string).codePointAt(0) as number;
    if (codeA !== codeB) return codeA < codeB ? -1 : 1;
  }
  if (pointsA.length !== pointsB.length) return pointsA.length < pointsB.length ? -1 : 1;
  return 0;
}
