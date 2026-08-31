import { createHash } from 'node:crypto';
import type { ApplicationGraphDefinition } from './types.js';

/**
 * Deterministic graph identity.
 *
 * The graph version is a SHA-256 content hash over a canonicalized *semantic*
 * form of the definition: object keys are sorted, node and edge arrays are
 * sorted by their identity fields, absent optionals become `null`. Whitespace
 * and object key insertion order therefore cannot change the version.
 */

const GRAPH_IDENTITY_SCHEMA = 'vict.graph@1';

interface CanonicalNode {
  readonly id: string;
  readonly capability: string;
  readonly input: string | null;
  readonly output: string | null;
}

interface CanonicalEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: 'success' | 'error';
}

interface CanonicalGraph {
  readonly schema: string;
  readonly id: string;
  readonly entry: string;
  readonly nodes: readonly CanonicalNode[];
  readonly edges: readonly CanonicalEdge[];
}

export function canonicalSemanticForm(definition: ApplicationGraphDefinition): CanonicalGraph {
  const nodes: CanonicalNode[] = definition.nodes
    .map((node) => ({
      id: node.id,
      capability: node.capability,
      input: node.input ?? null,
      output: node.output ?? null,
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const edges: CanonicalEdge[] = definition.edges
    .map((edge) => ({
      from: edge.from,
      to: edge.to,
      kind: edge.kind ?? 'success',
    }))
    .sort((a, b) => {
      const keyA = `${a.from}|${a.to}|${a.kind}`;
      const keyB = `${b.from}|${b.to}|${b.kind}`;
      return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
    });

  return {
    schema: GRAPH_IDENTITY_SCHEMA,
    id: definition.id,
    entry: definition.entry,
    nodes,
    edges,
  };
}

/** Stable JSON: recursively sorted object keys, arrays preserved. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    if (value === undefined) {
      return null;
    }
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) {
    const item = source[key];
    if (item !== undefined) {
      out[key] = canonicalize(item);
    }
  }
  return out;
}

export function computeGraphVersion(definition: ApplicationGraphDefinition): string {
  const digest = createHash('sha256')
    .update(canonicalJson(canonicalSemanticForm(definition)))
    .digest('hex');
  return `v1_${digest}`;
}
