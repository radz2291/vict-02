import { createHash } from 'node:crypto';

/**
 * Canonical JSON serialization for Builder Kit generated artifacts.
 *
 * The VICT canonicalization discipline (architecture §3.3): no sparse
 * containers, no exotic members, key-sorted, insertion-order independent,
 * byte-stable. The printer additionally reproduces the repository's
 * Prettier JSON style exactly (printWidth 100: arrays of primitives are
 * kept on one line when they fit, objects are always expanded, empty
 * containers print as `{}`/`[]`), so generated `.json` artifacts are
 * byte-stable AND `format:check`-clean. A permanent test asserts byte
 * parity with Prettier for generated shapes.
 */

const PRINT_WIDTH = 100;

type Primitive = string | number | boolean | null;

function isPrimitive(value: unknown): value is Primitive {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function pad(width: number): string {
  return ' '.repeat(width);
}

/** Recursively sort object keys (arrays keep their semantic order). */
export function sortKeysDeep(value: unknown): unknown {
  if (isPrimitive(value)) return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  const out: Record<string, unknown> = {};
  for (const [key, val] of entries) {
    out[key] = sortKeysDeep(val);
  }
  return out;
}

function printValue(value: unknown, col: number, indent: number): string {
  if (isPrimitive(value)) return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (value.every(isPrimitive)) {
      const inline = '[' + value.map((item) => JSON.stringify(item)).join(', ') + ']';
      if (col + inline.length <= PRINT_WIDTH) return inline;
    }
    const inner = indent + 2;
    const items = value.map((item) => pad(inner) + printValue(item, inner, inner));
    return '[\n' + items.join(',\n') + '\n' + pad(indent) + ']';
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return '{}';
  const inner = indent + 2;
  const lines = entries.map(([key, val]) => {
    const keyText = JSON.stringify(key);
    return pad(inner) + keyText + ': ' + printValue(val, inner + keyText.length + 2, inner);
  });
  return '{\n' + lines.join(',\n') + '\n' + pad(indent) + '}';
}

/**
 * Canonical bytes for a value: keys sorted, Prettier-style layout,
 * trailing newline, LF line endings. Deterministic and
 * insertion-order independent.
 */
export function canonicalJsonBytes(value: unknown): Buffer {
  return Buffer.from(printValue(sortKeysDeep(value), 0, 0) + '\n', 'utf8');
}

export function sha256Hex(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Pack identity (architecture §3.3/§4.4): SHA-256 over the canonical
 * pack bytes with the `packId` member OMITTED. The exclusion is
 * normative: computing the identity over bytes that include `packId`
 * is a rule violation, never a valid alternative identity.
 */
export function packIdentity(pack: Record<string, unknown>): string {
  const withoutIdentity: Record<string, unknown> = { ...pack };
  delete withoutIdentity['packId'];
  return sha256Hex(canonicalJsonBytes(withoutIdentity));
}

/**
 * Recompute the identity from the exact committed file bytes: parse,
 * remove `packId`, re-canonicalize, hash. This proves the committed
 * bytes carry an identity consistent with their own content.
 */
export function packIdentityFromBytes(fileBytes: Buffer): string {
  const parsed: unknown = JSON.parse(fileBytes.toString('utf8'));
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('pack identity: file is not a JSON object');
  }
  return packIdentity(parsed as Record<string, unknown>);
}

/** True when the value tree contains no function values (handler safety). */
export function containsFunction(value: unknown, path = '(root)'): string | null {
  if (typeof value === 'function') return path;
  if (value === null || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const hit = containsFunction(value[index], `${path}[${String(index)}]`);
      if (hit !== null) return hit;
    }
    return null;
  }
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    const hit = containsFunction(val, `${path}.${key}`);
    if (hit !== null) return hit;
  }
  return null;
}
