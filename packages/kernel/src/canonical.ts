import { createHash } from 'node:crypto';
import type {
  ApplicationGraphDefinition,
  CapabilityNodeDefinition,
  CapabilityNodeFields,
  ForkNodeDefinition,
  JoinNodeDefinition,
  WaitNodeDefinition,
} from './types.js';

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
/**
 * Stage 03 canonical form for graphs that declare control nodes or control
 * declarations (decision/wait/fork/join, retry, timeout, route/branch keys).
 * The v1 canonical form is never edited: capability-only graphs without any
 * control declaration keep their exact historical identity.
 */
const GRAPH_IDENTITY_SCHEMA_V2 = 'vict.graph@2';
const CAPABILITY_SET_IDENTITY_SCHEMA = 'vict.capability-set@1';
const ACTIVATION_IDENTITY_SCHEMA = 'vict.activation@1';
/** Activation marker for graphs compiled in the Stage 03 control form. */
const ACTIVATION_IDENTITY_SCHEMA_V2 = 'vict.activation@2';

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

interface CanonicalNodeV2 {
  readonly id: string;
  readonly kind: string;
  readonly capability: string | null;
  readonly input: string | null;
  readonly output: string | null;
  readonly retry: CanonicalRetry | null;
  readonly timeoutMs: number | null;
  readonly wait: CanonicalWait | null;
  readonly fork: string | null;
  readonly join: string | null;
  readonly maxConcurrency: number | null;
}

interface CanonicalRetry {
  readonly maxAttempts: number;
  readonly retryOn: readonly string[];
  readonly backoff: CanonicalRetryBackoff;
}

type CanonicalRetryBackoff =
  | { readonly kind: 'fixed'; readonly delayMs: number }
  | {
      readonly kind: 'exponential';
      readonly initialMs: number;
      readonly multiplier: number;
      readonly maxMs: number;
    };

type CanonicalWait =
  | {
      readonly kind: 'signal';
      readonly name: string;
      readonly contract: string | null;
      readonly timeoutMs: number | null;
    }
  | { readonly kind: 'timer'; readonly delayMs: number };

interface CanonicalEdgeV2 {
  readonly from: string;
  readonly to: string;
  readonly kind: string;
  readonly key: string | null;
}

interface CanonicalGraphV2 {
  readonly schema: typeof GRAPH_IDENTITY_SCHEMA_V2;
  readonly id: string;
  readonly entry: string;
  readonly nodes: readonly CanonicalNodeV2[];
  readonly edges: readonly CanonicalEdgeV2[];
}

/** One effective capability/contract binding required by a compiled graph. */
export interface CapabilityBindingFingerprint {
  readonly capability: string;
  readonly revision: string;
  readonly effect: string;
  readonly input: { readonly id: string; readonly revision: string } | null;
  readonly output: { readonly id: string; readonly revision: string } | null;
  /**
   * Declared idempotency semantics ('keyed'); omitted when undeclared so
   * pre-Stage-03 bindings keep their exact historical canonical form.
   */
  readonly idempotency?: 'keyed';
  /**
   * Stage 04 audit remediation: execution-affecting authority declarations
   * (permission/configuration/secret names). Omitted when the capability
   * declares none, so bindings without authority keep their exact
   * historical canonical form. Resolved secret VALUES and runtime GRANTS
   * never enter this fingerprint — only the DECLARED names do.
   */
  readonly authority?: {
    readonly permissions?: readonly string[];
    readonly configuration?: readonly string[];
    readonly requiredConfiguration?: readonly string[];
    readonly secrets?: readonly string[];
    readonly requiredSecrets?: readonly string[];
  };
}

export function canonicalSemanticForm(definition: ApplicationGraphDefinition): CanonicalGraph {
  const nodes: CanonicalNode[] = definition.nodes
    .map((node) => ({
      id: node.id,
      capability: (node as { capability?: string }).capability ?? '',
      input: (node as { input?: string }).input ?? null,
      output: (node as { output?: string }).output ?? null,
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const edges: CanonicalEdge[] = definition.edges
    .map((edge) => ({
      from: edge.from,
      to: edge.to,
      kind: (edge.kind ?? 'success') as 'success' | 'error',
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

/**
 * True when a definition declares any Stage 03 control semantics: a
 * decision/wait/fork/join node, a route/branch/timeout edge, or a
 * retry/timeout declaration on a capability node. Such graphs compile in
 * the v2 canonical form; capability-only graphs keep the v1 form (and
 * therefore their exact historical identity).
 */
export function declaresControlSemantics(definition: ApplicationGraphDefinition): boolean {
  for (const node of definition.nodes) {
    const kind = (node as { kind?: string }).kind;
    if (kind !== undefined && kind !== 'capability') {
      return true;
    }
    if ((node as { retry?: unknown }).retry !== undefined) {
      return true;
    }
    if ((node as { timeoutMs?: number }).timeoutMs !== undefined) {
      return true;
    }
  }
  for (const edge of definition.edges) {
    const kind = edge.kind;
    if (kind !== undefined && kind !== 'success' && kind !== 'error') {
      return true;
    }
  }
  return false;
}

function canonicalRetry(
  retry: NonNullable<CapabilityNodeFields['retry']> | null | undefined,
): CanonicalRetry | null {
  if (retry === undefined || retry === null) {
    return null;
  }
  return {
    maxAttempts: retry.maxAttempts,
    retryOn: [...retry.retryOn].sort(),
    backoff:
      retry.backoff.kind === 'fixed'
        ? { kind: 'fixed', delayMs: retry.backoff.delayMs }
        : {
            kind: 'exponential',
            initialMs: retry.backoff.initialMs,
            multiplier: retry.backoff.multiplier,
            maxMs: retry.backoff.maxMs,
          },
  };
}

/** Canonical Stage 03 form: full control semantics, nodes/edges sorted, keys sorted. */
export function canonicalSemanticFormV2(definition: ApplicationGraphDefinition): CanonicalGraphV2 {
  const nodes: CanonicalNodeV2[] = definition.nodes
    .map((rawNode) => {
      const node = rawNode as CapabilityNodeDefinition &
        Partial<WaitNodeDefinition> &
        Partial<ForkNodeDefinition> &
        Partial<JoinNodeDefinition>;
      const kind: string = node.kind ?? 'capability';
      const wait = node.wait ?? null;
      const isControl = kind === 'wait' || kind === 'fork' || kind === 'join';
      const isFork = kind === 'fork';
      const isJoin = kind === 'join';
      return {
        id: node.id,
        kind,
        capability: isControl ? null : node.capability,
        input: node.input ?? null,
        output: node.output ?? null,
        retry: canonicalRetry(node.retry),
        timeoutMs: node.timeoutMs ?? null,
        wait:
          wait === undefined || wait === null
            ? null
            : wait.kind === 'signal'
              ? {
                  kind: 'signal' as const,
                  name: wait.name,
                  contract: wait.contract ?? null,
                  timeoutMs: wait.timeoutMs ?? null,
                }
              : { kind: 'timer' as const, delayMs: wait.delayMs },
        fork: isFork ? (node.join ?? node.fork ?? null) : null,
        join: isJoin ? (node.fork ?? node.join ?? null) : null,
        maxConcurrency: isFork ? (node.maxConcurrency ?? null) : null,
      };
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const edges: CanonicalEdgeV2[] = definition.edges
    .map((edge) => ({
      from: edge.from,
      to: edge.to,
      kind: edge.kind ?? 'success',
      key: (edge as { key?: string }).key ?? null,
    }))
    .sort((a, b) => {
      const keyA = `${a.from}|${a.to}|${a.kind}|${a.key ?? ''}`;
      const keyB = `${b.from}|${b.to}|${b.kind}|${b.key ?? ''}`;
      return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
    });

  return {
    schema: GRAPH_IDENTITY_SCHEMA_V2,
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

/**
 * Structured rejection for values outside the canonical serializable domain.
 * Identity inputs are declarations: numbers must be finite (no NaN, no
 * ±Infinity, no negative zero), and BigInt, Date, function, symbol, sparse
 * array, cyclic, and exotic-prototype values are rejected — never silently
 * coerced into `null`, strings, or omissions.
 */
export class CanonicalizationError extends Error {
  readonly code: string;
  readonly path: string;

  constructor(code: string, message: string, path: string) {
    super(message);
    this.name = 'CanonicalizationError';
    this.code = code;
    this.path = path;
  }
}

const CANONICAL_PATH_ROOT = '(root)';

function rejectNonCanonical(description: string, path: string): never {
  throw new CanonicalizationError(
    'NON_CANONICAL_VALUE',
    `The canonical serializable domain rejects ${description} at '${path}'; identity inputs must be canonical JSON values (null, boolean, finite number, string, array, plain object).`,
    path,
  );
}

function canonicalize(value: unknown, path: string = CANONICAL_PATH_ROOT): unknown {
  if (value === null) {
    return null;
  }
  const type = typeof value;
  if (type === 'string' || type === 'boolean') {
    return value;
  }
  if (type === 'number') {
    if (!Number.isFinite(value)) {
      rejectNonCanonical(`the non-finite number ${String(value)}`, path);
    }
    if (Object.is(value, -0)) {
      rejectNonCanonical('negative zero (use 0)', path);
    }
    return value;
  }
  if (type === 'bigint') {
    rejectNonCanonical('a BigInt (use a number or string)', path);
  }
  if (type === 'function') {
    rejectNonCanonical('a function', path);
  }
  if (type === 'symbol') {
    rejectNonCanonical('a symbol', path);
  }
  if (type === 'undefined') {
    rejectNonCanonical('undefined (omit the field or use null)', path);
  }
  // Objects and arrays.
  if (value instanceof Date) {
    rejectNonCanonical('a Date object (declare an ISO string instead)', path);
  }
  const seen = canonicalSeen;
  if (seen.has(value as object)) {
    throw new CanonicalizationError(
      'CYCLIC_STRUCTURE',
      `The value at '${path}' is part of a cyclic structure; cyclic values cannot be canonicalized.`,
      path,
    );
  }
  if (Array.isArray(value)) {
    const source = value as unknown[];
    seen.add(value as object);
    try {
      return source.map((item, index) => canonicalize(item, `${path}[${index}]`));
    } finally {
      seen.delete(value as object);
    }
  }
  const proto = Object.getPrototypeOf(value as object);
  if (proto !== Object.prototype && proto !== null) {
    rejectNonCanonical('an object with an unsupported prototype', path);
  }
  const source = value as Record<string, unknown>;
  let keys: string[];
  try {
    keys = Object.keys(source);
  } catch {
    throw new CanonicalizationError(
      'NON_CANONICAL_VALUE',
      `The value at '${path}' could not be enumerated (hostile getter or proxy); identity inputs must be plain data.`,
      path,
    );
  }
  seen.add(value as object);
  try {
    const out: Record<string, unknown> = {};
    for (const key of keys.sort()) {
      let item: unknown;
      try {
        item = source[key];
      } catch {
        rejectNonCanonical('a throwing getter', `${path}.${key}`);
      }
      if (item !== undefined) {
        out[key] = canonicalize(item, `${path}.${key}`);
      }
    }
    return out;
  } finally {
    seen.delete(value as object);
  }
}

/** Cycle-detection scratch set (per canonicalJson call). */
const canonicalSeen = new Set<object>();

function sha256Hex(payload: string): string {
  return createHash('sha256').update(payload).digest('hex');
}

export function computeGraphVersion(definition: ApplicationGraphDefinition): string {
  if (declaresControlSemantics(definition)) {
    return `v2_${sha256Hex(canonicalJson(canonicalSemanticFormV2(definition)))}`;
  }
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
      ...(binding.idempotency === undefined ? {} : { idempotency: binding.idempotency }),
      ...(binding.authority === undefined
        ? {}
        : {
            authority: {
              ...(binding.authority.permissions !== undefined
                ? { permissions: [...binding.authority.permissions].sort() }
                : {}),
              ...(binding.authority.configuration !== undefined
                ? { configuration: [...binding.authority.configuration].sort() }
                : {}),
              ...(binding.authority.requiredConfiguration !== undefined
                ? { requiredConfiguration: [...binding.authority.requiredConfiguration].sort() }
                : {}),
              ...(binding.authority.secrets !== undefined
                ? { secrets: [...binding.authority.secrets].sort() }
                : {}),
              ...(binding.authority.requiredSecrets !== undefined
                ? { requiredSecrets: [...binding.authority.requiredSecrets].sort() }
                : {}),
            },
          }),
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

/** Identity of the exact executable activation: topology + effective capability set, under a versioned schema marker. */
export function computeActivationVersion(
  graphVersion: string,
  capabilitySetVersion: string,
  schema: string = graphVersion.startsWith('v2_')
    ? ACTIVATION_IDENTITY_SCHEMA_V2
    : ACTIVATION_IDENTITY_SCHEMA,
): string {
  return `${schema.endsWith('@2') ? 'v2' : 'v1'}_${sha256Hex(
    canonicalJson({
      schema,
      graphVersion,
      capabilitySetVersion,
    }),
  )}`;
}
