import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { canonicalJsonBytes, packIdentity, sha256Hex } from '../canonical.js';
import { ACCEPTED_TASK_SCOPE_SCHEMA } from '../markers.js';

/**
 * Accepted-task-scope generator: the committed, machine-checkable
 * representation of a handoff's accepted scope and profiles.
 *
 * The handoff document is the sole task authority (architecture §3.3),
 * but it is prose. This record — created at handoff acceptance by
 * explicit owner direction, committed next to the stable layer, and
 * identity-bound by the §4.4 rule — is what the gate and the tool
 * wrapper compare an active task pack's carried scope against. Scope
 * fields inside a task pack are never self-certifying: an altered pack
 * that hashes correctly is still only accepted when its carried scope
 * is covered by this record for the SAME handoff bytes.
 */

export interface AcceptedTaskScopeParams {
  readonly handoffPath: string;
  readonly inScopePaths: readonly string[];
  readonly permissionProfiles: readonly string[];
  readonly ignoreManifest: readonly string[];
  readonly notes: string;
}

/** Committed location, beside the stable layer (D-4: auditable at any commit). */
export const ACCEPTED_TASK_SCOPE_PATH = 'docs/builder-kit/accepted-task-scope.json';

export function buildAcceptedTaskScope(
  repoRoot: string,
  params: AcceptedTaskScopeParams,
): Record<string, unknown> {
  const handoffBytes = readFileSync(join(repoRoot, params.handoffPath));
  const record: Record<string, unknown> = {
    schemaMarker: ACCEPTED_TASK_SCOPE_SCHEMA,
    handoff: {
      path: params.handoffPath.replace(/\\/g, '/'),
      sha256: sha256Hex(handoffBytes),
    },
    inScopePaths: [...params.inScopePaths],
    permissionProfiles: [...params.permissionProfiles],
    ignoreManifest: [...params.ignoreManifest],
    ignoreManifestDigest: sha256Hex(canonicalJsonBytes([...params.ignoreManifest])),
    notes: params.notes,
  };
  return { ...record, packId: packIdentity(record) };
}

export function writeAcceptedTaskScope(
  repoRoot: string,
  params: AcceptedTaskScopeParams,
): { readonly path: string; readonly bytes: Buffer } {
  const record = buildAcceptedTaskScope(repoRoot, params);
  const bytes = canonicalJsonBytes(record);
  const path = join(repoRoot, ACCEPTED_TASK_SCOPE_PATH);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
  return { path, bytes };
}
