import type { KernelEvent } from '@vict/kernel';
import {
  canonicalJson,
  canonicalSemanticForm,
  canonicalSemanticFormV2,
  computeActivationVersion,
  computeCapabilitySetVersion,
  computeGraphVersion,
} from '@vict/kernel';
import type { ActivationManifest, PublishActivationCommand } from './store-types.js';
import { VictStoreError } from './store-errors.js';

/**
 * Shared store-level identity validation, executed identically by every
 * conforming adapter (in-memory and SQLite).
 *
 * Identity is CONTENT-derived (Stage 02): the three activation identities
 * are SHA-256 fingerprints computed by the kernel's canonical identity
 * functions. Stores therefore do not trust top-level strings — they
 * recompute every identity from the canonical content and reject any
 * disagreement with a structured, safe error and no partial mutation.
 */

function mismatch(
  operation: string,
  message: string,
  details: Record<string, unknown>,
): VictStoreError {
  return new VictStoreError('VICT_STORE_ACTIVATION_MISMATCH', message, {
    operation,
    ...details,
  });
}

/**
 * Publish-time validation: the supplied canonical JSON must be exactly the
 * canonical representation of the supplied manifest, and every
 * content-derived identity must be reproducible from that content:
 *
 * - `manifest.graph` must already be the canonical semantic form of the
 *   graph declaration;
 * - `graphVersion` must equal the canonical fingerprint of that form;
 * - `capabilitySetVersion` must equal the canonical fingerprint of the
 *   effective bindings;
 * - `activationVersion` must equal the canonical combination of the two.
 *
 * This catches manifests whose top-level identifiers look valid while the
 * binding or graph content differs (the identity would not recompute).
 */
export function assertPublishableManifest(command: PublishActivationCommand): void {
  const manifest: ActivationManifest = command.manifest;
  if (typeof command.canonicalManifest !== 'string' || command.canonicalManifest.length === 0) {
    throw new VictStoreError(
      'VICT_STORE_INVALID_COMMAND',
      'A canonical manifest string is required.',
      { operation: 'catalog.publish' },
    );
  }
  let recomputed: string;
  try {
    recomputed = canonicalJson(manifest);
  } catch {
    throw new VictStoreError(
      'VICT_STORE_INVALID_COMMAND',
      'The manifest is not a persistable canonical value.',
      { operation: 'catalog.publish' },
    );
  }
  if (recomputed !== command.canonicalManifest) {
    throw mismatch(
      'catalog.publish',
      'The supplied canonical manifest is not the canonical representation of the supplied manifest.',
      { activationVersion: manifest.activationVersion },
    );
  }
  const isV2 = (manifest.graph as { schema?: string } | null)?.schema === 'vict.graph@2';
  let canonicalGraph: unknown;
  try {
    // canonicalSemanticForm is idempotent on an already-canonical graph;
    // comparing its JSON against the stored form detects tampering.
    canonicalGraph = isV2
      ? canonicalSemanticFormV2(manifest.graph as Parameters<typeof canonicalSemanticFormV2>[0])
      : canonicalSemanticForm(manifest.graph as Parameters<typeof canonicalSemanticForm>[0]);
  } catch {
    throw mismatch(
      'catalog.publish',
      'The manifest graph declaration is not in canonical semantic form.',
      { activationVersion: manifest.activationVersion },
    );
  }
  if (canonicalJson(canonicalGraph) !== canonicalJson(manifest.graph)) {
    throw mismatch(
      'catalog.publish',
      'The manifest graph declaration is not in canonical semantic form.',
      { activationVersion: manifest.activationVersion },
    );
  }
  let graphVersion: string;
  try {
    graphVersion = computeGraphVersion(manifest.graph as Parameters<typeof computeGraphVersion>[0]);
  } catch {
    throw mismatch(
      'catalog.publish',
      'The graph version could not be recomputed from the manifest content.',
      { activationVersion: manifest.activationVersion },
    );
  }
  if (graphVersion !== manifest.graphVersion) {
    throw mismatch(
      'catalog.publish',
      'The manifest graphVersion does not match its graph content.',
      { activationVersion: manifest.activationVersion },
    );
  }
  let capabilitySetVersion: string;
  try {
    capabilitySetVersion = computeCapabilitySetVersion(manifest.bindings);
  } catch {
    throw mismatch(
      'catalog.publish',
      'The capability-set version could not be recomputed from the manifest bindings.',
      { activationVersion: manifest.activationVersion },
    );
  }
  if (capabilitySetVersion !== manifest.capabilitySetVersion) {
    throw mismatch(
      'catalog.publish',
      'The manifest capabilitySetVersion does not match its bindings.',
      { activationVersion: manifest.activationVersion },
    );
  }
  const activationVersion = computeActivationVersion(
    graphVersion,
    capabilitySetVersion,
    graphVersion.startsWith('v2_') ? 'vict.activation@2' : 'vict.activation@1',
  );
  if (activationVersion !== manifest.activationVersion) {
    throw mismatch(
      'catalog.publish',
      'The manifest activationVersion does not match its graph and capability-set versions.',
      { activationVersion: manifest.activationVersion },
    );
  }
}

export interface ActivationIdentity {
  readonly graphId: string;
  readonly graphVersion: string;
  readonly capabilitySetVersion: string;
  readonly activationVersion: string;
}

/**
 * Run-creation validation: the run's graph, graph version, capability-set
 * version, and activation version must describe ONE coherent published
 * activation — the exact stored one.
 */
export function assertRunMatchesActivation(
  stored: ActivationIdentity,
  identity: ActivationIdentity,
  operation: string,
): void {
  if (
    stored.graphId !== identity.graphId ||
    stored.graphVersion !== identity.graphVersion ||
    stored.capabilitySetVersion !== identity.capabilitySetVersion ||
    stored.activationVersion !== identity.activationVersion
  ) {
    throw mismatch(
      operation,
      'The run identity does not describe the referenced published activation.',
      {
        activationVersion: identity.activationVersion,
        graphId: identity.graphId,
      },
    );
  }
}

/**
 * Selection validation: an activation may only be selected for the graph it
 * belongs to.
 */
export function assertActivationBelongsToGraph(
  stored: { readonly graphId: string; readonly activationVersion: string },
  graphId: string,
  operation: string,
): void {
  if (stored.graphId !== graphId) {
    throw mismatch(operation, 'The activation does not belong to the graph being selected for.', {
      activationVersion: stored.activationVersion,
      graphId,
    });
  }
}

export interface RunIdentityColumns {
  readonly runId: string;
  readonly graphId: string;
  readonly graphVersion: string;
  readonly capabilitySetVersion: string;
  readonly activationVersion: string;
}

/**
 * Event-append validation: every appended event must carry exactly its
 * stored run's identity columns.
 */
export function assertEventMatchesRun(event: KernelEvent, run: RunIdentityColumns): void {
  if (
    event.runId !== run.runId ||
    event.graphId !== run.graphId ||
    event.graphVersion !== run.graphVersion ||
    event.capabilitySetVersion !== run.capabilitySetVersion ||
    event.activationVersion !== run.activationVersion
  ) {
    throw new VictStoreError(
      'VICT_STORE_INVALID_COMMAND',
      'An event references a different run or activation identity than the transition targets.',
      { operation: 'execution.appendEvents', runId: run.runId, eventRunId: event.runId },
    );
  }
}

/**
 * Read-time validation for a stored activation: recompute every identity
 * from the persisted canonical manifest and reject corrupt content instead
 * of silently normalizing it. Used defensively on read paths.
 */
export function assertStoredActivationReadable(row: {
  activationVersion: string;
  graphId: string;
  graphVersion: string;
  capabilitySetVersion: string;
  canonicalManifest: string;
  manifest: ActivationManifest;
}): void {
  const fail = (): VictStoreError =>
    new VictStoreError(
      'VICT_STORE_INVALID_RECORD',
      'A stored activation manifest disagrees with its identity columns.',
      { operation: 'catalog.readActivation', activationVersion: row.activationVersion },
    );
  const manifest = row.manifest;
  if (
    manifest.activationVersion !== row.activationVersion ||
    manifest.graphId !== row.graphId ||
    manifest.graphVersion !== row.graphVersion ||
    manifest.capabilitySetVersion !== row.capabilitySetVersion
  ) {
    throw fail();
  }
  try {
    const isV2 = (manifest.graph as { schema?: string } | null)?.schema === 'vict.graph@2';
    const canonicalGraph = isV2
      ? canonicalSemanticFormV2(manifest.graph as Parameters<typeof canonicalSemanticFormV2>[0])
      : canonicalSemanticForm(manifest.graph as Parameters<typeof canonicalSemanticForm>[0]);
    if (
      canonicalJson(canonicalGraph) !== canonicalJson(manifest.graph) ||
      computeGraphVersion(manifest.graph as Parameters<typeof computeGraphVersion>[0]) !==
        manifest.graphVersion ||
      computeCapabilitySetVersion(manifest.bindings) !== manifest.capabilitySetVersion ||
      computeActivationVersion(
        manifest.graphVersion,
        manifest.capabilitySetVersion,
        manifest.graphVersion.startsWith('v2_') ? 'vict.activation@2' : 'vict.activation@1',
      ) !== manifest.activationVersion
    ) {
      throw fail();
    }
  } catch (cause) {
    if (cause instanceof VictStoreError) {
      throw cause;
    }
    throw fail();
  }
}
