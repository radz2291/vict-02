import { createHash } from 'node:crypto';
import type { Contract, VictError } from '@vict/contracts';
import { compileGraph, type CompiledGraph, type GraphIssue } from '@vict/kernel';
import type { ApplicationGraphDefinition } from '@vict/kernel';
import { VictStoreError } from './store-errors.js';
import { VictRuntimeError } from './errors.js';
import { toCanonicalJson } from './serialization.js';
import type { ActivationManifest, StoredActivation } from './store-types.js';
import type { CapabilityRegistry, FrozenCapabilityBinding } from './registry.js';

/**
 * Exact-activation resolution for Stage 03 (handoff §17).
 *
 * A suspended run resolves its graph and bindings ONLY from the stored
 * manifest of its pinned activationVersion, rebuilt against the registry's
 * revision-pinned lookups. Missing artifacts produce structured unavailable
 * errors — never a nearby/substitute revision. Multiple immutable
 * snapshots can coexist, cached by activationVersion.
 */

/** A frozen contract parsing handle captured at resolution time. */
export interface FrozenContractHandle {
  readonly id: string;
  readonly revision: string;
  readonly expected: string;
  readonly parse: (input: unknown) => {
    readonly ok: boolean;
    readonly value?: unknown;
    readonly issues?: readonly { code: string; path: string; message: string }[];
  };
}

export interface ResolvedBindings {
  readonly bindings: ReadonlyMap<string, FrozenCapabilityBinding>;
  readonly contracts: ReadonlyMap<string, FrozenContractHandle>;
}

export type ActivationResolution<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: string; readonly message: string };

function sha256Hex(payload: string): string {
  return createHash('sha256').update(payload).digest('hex');
}

function parseManifestForResolution(stored: StoredActivation): ActivationManifest {
  let parsed: ActivationManifest | null;
  try {
    parsed = JSON.parse(stored.canonicalManifest) as ActivationManifest;
  } catch {
    parsed = null;
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    (parsed.manifestSchema !== 'vict.activation-manifest@1' &&
      parsed.manifestSchema !== 'vict.activation-manifest@2') ||
    typeof parsed.activationVersion !== 'string' ||
    parsed.activationVersion !== stored.activationVersion ||
    typeof parsed.graph !== 'object' ||
    parsed.graph === null
  ) {
    throw new VictStoreError('VICT_STORE_INVALID_RECORD', 'The stored manifest is not readable.', {
      operation: 'orchestration.resolveActivation',
      activationVersion: stored.activationVersion,
    });
  }
  return parsed;
}

export interface ActivationResolverDeps {
  readonly catalog: {
    get(activationVersion: string): Promise<StoredActivation | undefined>;
  };
  readonly registry: CapabilityRegistry;
}

/** Load and validate the stored manifest for an activation version. */
export async function loadManifest(
  deps: Pick<ActivationResolverDeps, 'catalog'>,
  activationVersion: string,
): Promise<ActivationManifest> {
  const stored = await deps.catalog.get(activationVersion);
  if (!stored) {
    throw new VictRuntimeError(
      'VICT_RUNTIME_ACTIVATION_NOT_FOUND',
      `No stored activation '${activationVersion}' exists in the catalog.`,
    );
  }
  return parseManifestForResolution(stored);
}

/**
 * Rebuild the exact compiled graph for a stored activation from the
 * registry's revision-pinned lookups. Cache by activationVersion is the
 * caller's concern (immutable results).
 */
export async function resolveGraphForActivation(
  deps: ActivationResolverDeps,
  activationVersion: string,
): Promise<CompiledGraphResolution> {
  const manifest = await loadManifest(deps, activationVersion);
  const { capabilityRevisions, contractRevisions } = revisionMaps(manifest);
  const definition = manifest.graph as ApplicationGraphDefinition;
  const compiled = compileGraph({
    definition,
    capabilities: deps.registry.capabilityIndexPinned(capabilityRevisions),
    contracts: deps.registry.contractEnvironmentPinned(contractRevisions),
  });
  if (!compiled.ok) {
    return {
      ok: false,
      code: 'VICT_RUNTIME_ACTIVATION_UNAVAILABLE',
      message:
        'The exact pinned activation cannot be resolved from the registered artifacts; required capabilities or contracts are missing.',
      issues: compiled.issues,
    };
  }
  if (compiled.graph.activationVersion !== activationVersion) {
    return {
      ok: false,
      code: 'VICT_RUNTIME_ACTIVATION_MISMATCH',
      message:
        'The registered artifacts do not reproduce the exact pinned activation; no substitute is used.',
      issues: [],
    };
  }
  return { ok: true, graph: compiled.graph };
}

export interface CompiledGraphResolution {
  readonly ok: boolean;
  readonly graph?: CompiledGraph;
  readonly code?: string;
  readonly message?: string;
  readonly issues?: readonly GraphIssue[];
}

function revisionMaps(manifest: ActivationManifest): {
  capabilityRevisions: Map<string, string>;
  contractRevisions: Map<string, string>;
} {
  const capabilityRevisions = new Map<string, string>();
  for (const binding of manifest.bindings) {
    capabilityRevisions.set(binding.capability, binding.revision);
  }
  const contractRevisions = new Map<string, string>();
  for (const contract of manifest.contracts) {
    contractRevisions.set(contract.id, contract.revision);
  }
  return { capabilityRevisions, contractRevisions };
}

/**
 * Resolve the exact execution bindings (invoke handles + captured contract
 * parsing handles) for a run's pinned activation.
 */
export async function resolveBindings(
  deps: ActivationResolverDeps,
  activationVersion: string,
): Promise<ResolvedBindingsResolution> {
  const manifest = await loadManifest(deps, activationVersion);
  const { capabilityRevisions, contractRevisions } = revisionMaps(manifest);
  const bindings = new Map<string, FrozenCapabilityBinding>();
  for (const [capabilityId, revision] of capabilityRevisions) {
    const live = deps.registry.getCapabilityRevision(capabilityId, revision);
    if (!live) {
      return {
        ok: false,
        code: 'VICT_RUNTIME_ACTIVATION_UNAVAILABLE',
        message: `Capability '${capabilityId}' revision '${revision}' required by the pinned activation is not registered.`,
      };
    }
    bindings.set(
      capabilityId,
      Object.freeze({
        id: live.id,
        revision: live.revision,
        effect: live.effect,
        invoke: live.invoke,
        ...(live.idempotency === undefined ? {} : { idempotency: live.idempotency }),
        inputContractId: live.input?.id,
        inputRevision: live.input?.revision,
        outputContractId: live.output?.id,
        outputRevision: live.output?.revision,
      }),
    );
  }
  const contracts = new Map<string, FrozenContractHandle>();
  for (const [contractId, revision] of contractRevisions) {
    const live = deps.registry.getContractRevision(contractId, revision);
    if (!live) {
      return {
        ok: false,
        code: 'VICT_RUNTIME_ACTIVATION_UNAVAILABLE',
        message: `Contract '${contractId}' revision '${revision}' required by the pinned activation is not registered.`,
      };
    }
    // Capture the parse callable BY VALUE: the pinned semantics are frozen.
    contracts.set(
      contractId,
      Object.freeze({
        id: live.id,
        revision: live.revision,
        expected: live.expected,
        parse: live.parse.bind(live) as (input: unknown) => ReturnType<Contract<unknown>['parse']>,
      }),
    );
  }
  return { ok: true, bindings, contracts };
}

export interface ResolvedBindingsResolution {
  readonly ok: boolean;
  readonly bindings?: ReadonlyMap<string, FrozenCapabilityBinding>;
  readonly contracts?: ReadonlyMap<string, FrozenContractHandle>;
  readonly code?: string;
  readonly message?: string;
}

/* ------------------------------------------------------------------ */
/* Deterministic durable identity derivation                           */
/* ------------------------------------------------------------------ */

/** Stable opaque idempotency key from durable identity (handoff §12.2). */
export function deriveIdempotencyKey(parts: {
  runId: string;
  activationVersion: string;
  lineage: string;
  nodeId: string;
  invocationId: string;
}): string {
  return `idem_${sha256Hex(
    toCanonicalJson({
      activationVersion: parts.activationVersion,
      lineage: parts.lineage,
      nodeId: parts.nodeId,
      runId: parts.runId,
      schema: 'vict.idempotency-key@1',
    }),
  ).slice(0, 32)}`;
}

/** Deterministic logical invocation id: invariant across retries and restarts. */
export function deriveInvocationId(parts: {
  runId: string;
  activationVersion: string;
  lineage: string;
  nodeId: string;
}): string {
  return `inv_${sha256Hex(
    toCanonicalJson({
      activationVersion: parts.activationVersion,
      lineage: parts.lineage,
      nodeId: parts.nodeId,
      runId: parts.runId,
      schema: 'vict.logical-invocation@1',
    }),
  ).slice(0, 24)}`;
}

export function deriveAttemptId(invocationId: string, attemptNumber: number): string {
  return `att_${sha256Hex(toCanonicalJson({ attemptNumber, invocationId })).slice(0, 24)}`;
}

/** Deterministic token ids from stable run/node/branch identity. */
export function rootTokenId(runId: string): string {
  return `tok_${sha256Hex(toCanonicalJson({ runId, role: 'root' })).slice(0, 24)}`;
}

export function forkChildTokenId(runId: string, forkId: string, branchKey: string): string {
  return `tok_${sha256Hex(toCanonicalJson({ branchKey, forkId, runId, role: 'branch' })).slice(0, 24)}`;
}

export function joinTokenId(runId: string, joinId: string): string {
  return `tok_${sha256Hex(toCanonicalJson({ joinId, runId, role: 'join' })).slice(0, 24)}`;
}

export function waitIdFor(runId: string, lineage: string, nodeId: string): string {
  return `wait_${sha256Hex(toCanonicalJson({ lineage, nodeId, runId })).slice(0, 24)}`;
}

export function canonicalBranchLineage(
  parentLineage: string,
  forkId: string,
  branchKey: string,
): string {
  return parentLineage.length === 0
    ? `${forkId}.${branchKey}`
    : `${parentLineage}.${forkId}.${branchKey}`;
}

/** Branch lineage of the post-join continuation: the fork's own lineage. */
export function forkLineageOf(childLineage: string, forkId: string, branchKey: string): string {
  const suffix = `.${forkId}.${branchKey}`;
  return childLineage.endsWith(suffix)
    ? childLineage.slice(0, childLineage.length - suffix.length)
    : childLineage;
}

/* ------------------------------------------------------------------ */
/* Idempotent-command hashes (safe identity metadata only)             */
/* ------------------------------------------------------------------ */

export function signalCommandHash(command: {
  runId: string;
  waitId: string;
  signalId: string;
  signalName?: string;
  payload: unknown;
}): string {
  return `sig_${sha256Hex(
    toCanonicalJson({
      payloadHash: sha256Hex(safeJson(command.payload)),
      runId: command.runId,
      schema: 'vict.signal-command@1',
      signalId: command.signalId,
      signalName: command.signalName ?? null,
      waitId: command.waitId,
    }),
  ).slice(0, 32)}`;
}

export function cancellationCommandHash(command: {
  runId: string;
  requestId: string;
  reasonCode: string;
}): string {
  return `cancel_${sha256Hex(
    toCanonicalJson({
      reasonCode: command.reasonCode,
      runId: command.runId,
      schema: 'vict.cancellation-command@1',
    }),
  ).slice(0, 24)}`;
}

export function resolutionCommandHash(command: {
  runId: string;
  resolutionId: string;
  action: string;
  reasonCode: string;
  expectedRunRevision?: number;
  hasOutput: boolean;
}): string {
  return `res_${sha256Hex(
    toCanonicalJson({
      action: command.action,
      expectedRunRevision: command.expectedRunRevision ?? null,
      hasOutput: command.hasOutput,
      reasonCode: command.reasonCode,
      runId: command.runId,
      schema: 'vict.resolution-command@1',
    }),
  ).slice(0, 24)}`;
}

function safeJson(value: unknown): string {
  try {
    return toCanonicalJson(value);
  } catch {
    // Out-of-domain payloads were already rejected before this point; the
    // hash then only covers the type identity, never the content.
    return `unserializable:${typeof value}`;
  }
}
