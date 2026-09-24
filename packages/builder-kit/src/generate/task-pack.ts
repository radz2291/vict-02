import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { canonicalJsonBytes, packIdentity, sha256Hex } from '../canonical.js';
import { CONTEXT_PACK_PATH } from './context-pack.js';
import { TASK_PACK_SCHEMA } from '../markers.js';

/**
 * Per-handoff task-pack generator (architecture §3.3).
 *
 * Regeneration requires EXACTLY: the committed base pack (by `packId`),
 * the handoff document (path + SHA-256), the baseline commit SHA, and the
 * ignore-manifest digest. Output is byte-identical for identical inputs;
 * task packs live in isolated, gitignored directories and are never
 * committed.
 */

export interface TaskPackParams {
  readonly handoffPath: string;
  readonly baseTree: string;
  readonly inScopePaths: readonly string[];
  readonly ignoreManifest: readonly string[];
  readonly permissionProfile: string;
}

export function buildTaskPack(repoRoot: string, params: TaskPackParams): Record<string, unknown> {
  const committedPackBytes = readFileSync(join(repoRoot, CONTEXT_PACK_PATH));
  const parsed = JSON.parse(committedPackBytes.toString('utf8')) as Record<string, unknown>;
  const basePackId = parsed['packId'];
  if (typeof basePackId !== 'string') {
    throw new Error('task pack: committed base pack has no packId');
  }
  const handoffBytes = readFileSync(join(repoRoot, params.handoffPath));
  const handoffSha256 = sha256Hex(handoffBytes);
  const ignoreManifestDigest = sha256Hex(canonicalJsonBytes(params.ignoreManifest));

  const pack: Record<string, unknown> = {
    schemaMarker: TASK_PACK_SCHEMA,
    basePackId,
    basePackPath: CONTEXT_PACK_PATH,
    handoff: { path: params.handoffPath.replace(/\\/g, '/'), sha256: handoffSha256 },
    baseTree: params.baseTree,
    inScopePaths: [...params.inScopePaths],
    ignoreManifest: [...params.ignoreManifest],
    ignoreManifestDigest,
    permissionProfile: params.permissionProfile,
  };
  return { ...pack, packId: packIdentity(pack) };
}

/** Isolated output directory: `.builder-kit/packs/<slug>-<first8(handoffSha256)>/`. */
export function taskPackDirectory(
  repoRoot: string,
  handoffPath: string,
  handoffSha256: string,
): string {
  const slug = basename(handoffPath)
    .replace(/\.md$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return join(repoRoot, '.builder-kit', 'packs', `${slug}-${handoffSha256.slice(0, 8)}`);
}

/** Build and write a task pack; returns the written path and bytes. */
export function writeTaskPack(
  repoRoot: string,
  params: TaskPackParams,
): { readonly path: string; readonly bytes: Buffer } {
  const pack = buildTaskPack(repoRoot, params);
  const bytes = canonicalJsonBytes(pack);
  const handoffSha256 = sha256Hex(readFileSync(join(repoRoot, params.handoffPath)));
  const directory = taskPackDirectory(repoRoot, params.handoffPath, handoffSha256);
  mkdirSync(directory, { recursive: true });
  const path = join(directory, 'task-pack.json');
  writeFileSync(path, bytes);
  return { path, bytes };
}
