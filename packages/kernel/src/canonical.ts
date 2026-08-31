import { createHash } from 'node:crypto';
import type { ApplicationGraphDefinition } from './types.js';

/**
 * Deterministic identity for Vict activations.
 *
 * Three distinct, layered identities:
 *
 * - `graphVersion` (see `computeGraphVersion`): SHA-256 over a canonicalized
 *   *topology/declaration* form of the definition. It says nothing about
 *   executable semantics.
 * - `capabilitySetVersion` (see `computeCapabilitySetVersion`): SHA-256 over
 *   the effective capability/contract bindings the graph requires — capability
 *   id + revision + effect class + effective input/output contract id +
 *   revision. Function bodies, zod internals, memory addresses, timestamps
 *   and object insertion order are never hashed.
 * - `activationVersion` (see `computeActivationVersion`): SHA-256 over
 *   graphVersion + capabilitySetVersion + an activation schema marker — the
 *   identity of the exact executable activation.
 *
 * Revisions are author/build responsibility: changing handler logic or
 * contract semantics without changing the revision is invisible to identity.
 */

const GRAPH_IDENTITY_SCHEMA = 'vict.graph@1';
const CAPABILITY_SET_IDENTITY_SCHEMA = 'vict.capability-set@1';
const ACTIVATION_IDENTITY_SCHEMA = 'vict.activation@1';

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

/** One effective capability/contract binding required by a compiled graph. */
export interface CapabilityBindingFingerprint {
  readonly capability: string;
  readonly revision: string;
  readonly effect: string;
  readonly input: { readonly id: string; readonly revision: string } | null;
  readonly output: { readonly id: string; readonly revision: string } | null;
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

function sha256Hex(payload: string): string {
  return createHash('sha256').update(payload).digest('hex');
}

export function computeGraphVersion(definition: ApplicationGraphDefinition): string {
  return `v1_${sha256Hex(canonicalJson(canonicalSemanticForm(definition)))}`;
}

/**
 * Identity of the effective capability/contract set required by a graph.
 * Bindings are canonically sorted and deduplicated so node multiplicity and
 * registration order cannot change the version; only execution-relevant
 * metadata can.
 */
export function computeCapabilitySetVersion(
  bindings: readonly CapabilityBindingFingerprint[],
): string {
  const sorted = bindings
    .map((binding) => ({
      capability: binding.capability,
      revision: binding.revision,
      effect: binding.effect,
      input:
        binding.input === null ? null : { id: binding.input.id, revision: binding.input.revision },
      output:
        binding.output === null
          ? null
          : { id: binding.output.id, revision: binding.output.revision },
    }))
    .sort((a, b) => {
      const keyA = canonicalJson(a);
      const keyB = canonicalJson(b);
      return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
    });
  const deduped: typeof sorted = [];
  let previous: string | undefined;
  for (const binding of sorted) {
    const key = canonicalJson(binding);
    if (key !== previous) {
      deduped.push(binding);
      previous = key;
    }
  }
  return `v1_${sha256Hex(canonicalJson({ schema: CAPABILITY_SET_IDENTITY_SCHEMA, bindings: deduped }))}`;
}

/** Identity of the exact executable activation: topology + effective capability set. */
export function computeActivationVersion(
  graphVersion: string,
  capabilitySetVersion: string,
): string {
  return `v1_${sha256Hex(
    canonicalJson({
      schema: ACTIVATION_IDENTITY_SCHEMA,
      graphVersion,
      capabilitySetVersion,
    }),
  )}`;
}
