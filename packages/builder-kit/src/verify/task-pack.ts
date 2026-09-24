import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { canonicalJsonBytes, packIdentityFromBytes, sha256Hex } from '../canonical.js';
import { buildTaskPack } from '../generate/task-pack.js';
import { CONTEXT_PACK_PATH } from '../generate/context-pack.js';
import { ACCEPTED_TASK_SCOPE_PATH } from '../generate/accepted-task-scope.js';
import { validateAcceptedTaskScope, validateTaskPack } from '../validate/index.js';

/**
 * Active task-pack authority verification (architecture §3.3/§3.9/§4.3).
 *
 * A task pack is generated data: recomputing its `packId` proves only
 * that its bytes are self-consistent, NEVER that its carried scope is
 * accepted authority. This module establishes authority BEFORE the pack's
 * scope is used — by the gate (`verify:builder-kit`) and by the tool
 * wrapper (`run --task-pack …`, which refuses an invalid or stale pack
 * before any scope-dependent decision):
 *
 *   1. closed-vocabulary schema validation (`vict.builder.task-pack@1`);
 *   2. canonical identity (§4.4 exclusion rule);
 *   3. committed base-pack binding (`basePackId`/`basePackPath`);
 *   4. current handoff path and byte digest (the sole task authority);
 *   5. ignore-manifest digest coherence;
 *   6. the pinned `baseTree` exists as an exact commit;
 *   7. carried scope/profile/ignore coverage by the committed
 *      accepted-task-scope record for the SAME handoff bytes;
 *   8. deterministic regeneration from exactly the §3.3 inputs.
 *
 * Failure classes reuse the §4.3 vocabulary: `schema-invalid`,
 * `pack-tamper`, `content-drift`, `baseline-escape`.
 */

export interface TaskPackCheck {
  readonly id: string;
  readonly ok: boolean;
  readonly driftClass: string | null;
  readonly detail: string;
}

export interface TaskPackAuthorityResult {
  readonly ok: boolean;
  readonly checks: readonly TaskPackCheck[];
  readonly baseTree: string | null;
  readonly inScopePaths: readonly string[];
  readonly ignoreManifest: readonly string[];
}

interface ParsedTaskPack {
  readonly schemaMarker: string;
  readonly packId: string;
  readonly basePackId: string;
  readonly basePackPath: string;
  readonly handoff: { readonly path: string; readonly sha256: string };
  readonly baseTree: string;
  readonly inScopePaths: readonly string[];
  readonly ignoreManifest: readonly string[];
  readonly ignoreManifestDigest: string;
  readonly permissionProfile: string;
}

function parseTaskPack(bytes: Buffer): ParsedTaskPack | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString('utf8'));
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const pack = parsed as Record<string, unknown>;
  const handoff = pack['handoff'];
  if (
    typeof pack['schemaMarker'] !== 'string' ||
    typeof pack['packId'] !== 'string' ||
    typeof pack['basePackId'] !== 'string' ||
    typeof pack['basePackPath'] !== 'string' ||
    typeof pack['baseTree'] !== 'string' ||
    !Array.isArray(pack['inScopePaths']) ||
    !Array.isArray(pack['ignoreManifest']) ||
    typeof pack['ignoreManifestDigest'] !== 'string' ||
    typeof pack['permissionProfile'] !== 'string' ||
    handoff === null ||
    typeof handoff !== 'object' ||
    typeof (handoff as Record<string, unknown>)['path'] !== 'string' ||
    typeof (handoff as Record<string, unknown>)['sha256'] !== 'string'
  ) {
    return null;
  }
  const recordedHandoff = handoff as Record<string, unknown>;
  return {
    schemaMarker: pack['schemaMarker'],
    packId: pack['packId'],
    basePackId: pack['basePackId'],
    basePackPath: pack['basePackPath'],
    handoff: {
      path: recordedHandoff['path'] as string,
      sha256: recordedHandoff['sha256'] as string,
    },
    baseTree: pack['baseTree'],
    inScopePaths: (pack['inScopePaths'] as unknown[]).filter(
      (entry): entry is string => typeof entry === 'string',
    ),
    ignoreManifest: (pack['ignoreManifest'] as unknown[]).filter(
      (entry): entry is string => typeof entry === 'string',
    ),
    ignoreManifestDigest: pack['ignoreManifestDigest'],
    permissionProfile: pack['permissionProfile'],
  };
}

/**
 * Conservative glob-coverage: is `packGlob` provably within an accepted
 * glob? Equality always covers; an accepted `prefix/**` covers any pack
 * glob under `prefix/` (including another `prefix/**`). Anything else is
 * NOT provably covered and fails closed — an acceptance record must be
 * widened by its owner, never stretched by the consumer.
 */
export function globCoveredBy(packGlob: string, acceptedGlobs: readonly string[]): boolean {
  for (const accepted of acceptedGlobs) {
    if (accepted === packGlob) return true;
    if (accepted.endsWith('/**')) {
      const prefix = accepted.slice(0, -3);
      if (packGlob.startsWith(`${prefix}/`)) return true;
    }
  }
  return false;
}

function commitExists(repoRoot: string, sha: string): boolean {
  const result = spawnSync('git', ['-C', repoRoot, 'cat-file', '-e', `${sha}^{commit}`, '--'], {
    encoding: 'utf8',
  });
  return result.status === 0;
}

function acceptedRecordFor(
  repoRoot: string,
  handoff: { readonly path: string; readonly sha256: string },
): { readonly check: TaskPackCheck; readonly record: ParsedAcceptedWithProfiles | null } {
  let bytes: Buffer;
  try {
    bytes = readFileSync(join(repoRoot, ACCEPTED_TASK_SCOPE_PATH));
  } catch {
    return {
      check: {
        id: 'task-pack:accepted-scope',
        ok: false,
        driftClass: 'baseline-escape',
        detail: `no committed accepted-task-scope record at ${ACCEPTED_TASK_SCOPE_PATH}; the task pack is not accepted authority`,
      },
      record: null,
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    return {
      check: {
        id: 'task-pack:accepted-scope',
        ok: false,
        driftClass: 'schema-invalid',
        detail: `accepted-task-scope record unparsable: ${(error as Error).message}`,
      },
      record: null,
    };
  }
  const schema = validateAcceptedTaskScope(parsed);
  if (!schema.ok) {
    return {
      check: {
        id: 'task-pack:accepted-scope',
        ok: false,
        driftClass: 'schema-invalid',
        detail: `accepted-task-scope record invalid: ${schema.issues
          .map((entry) => `${entry.code} at ${entry.path}`)
          .join('; ')
          .slice(0, 300)}`,
      },
      record: null,
    };
  }
  const record = parsed as Record<string, unknown>;
  let identityOk: boolean;
  try {
    identityOk = packIdentityFromBytes(bytes) === record['packId'];
  } catch {
    identityOk = false;
  }
  if (!identityOk) {
    return {
      check: {
        id: 'task-pack:accepted-scope',
        ok: false,
        driftClass: 'pack-tamper',
        detail: 'accepted-task-scope record fails its own canonical identity rule',
      },
      record: null,
    };
  }
  const recordedHandoff = record['handoff'] as Record<string, unknown>;
  if (recordedHandoff['path'] !== handoff.path || recordedHandoff['sha256'] !== handoff.sha256) {
    return {
      check: {
        id: 'task-pack:accepted-scope',
        ok: false,
        driftClass: 'content-drift',
        detail: `accepted-task-scope record binds a different handoff (${String(
          recordedHandoff['path'],
        )} @ ${String(recordedHandoff['sha256']).slice(0, 12)}…) than the task pack`,
      },
      record: null,
    };
  }
  return {
    check: {
      id: 'task-pack:accepted-scope',
      ok: true,
      driftClass: null,
      detail: `accepted record present and identity-valid for ${handoff.path} @ ${handoff.sha256.slice(0, 12)}…`,
    },
    record: {
      schemaMarker: 'vict.builder.accepted-task-scope@1',
      packId: record['packId'] as string,
      basePackId: '',
      basePackPath: '',
      handoff: { path: handoff.path, sha256: handoff.sha256 },
      baseTree: '',
      inScopePaths: (record['inScopePaths'] as unknown[]).filter(
        (entry): entry is string => typeof entry === 'string',
      ),
      ignoreManifest: (record['ignoreManifest'] as unknown[]).filter(
        (entry): entry is string => typeof entry === 'string',
      ),
      ignoreManifestDigest: record['ignoreManifestDigest'] as string,
      permissionProfile: '',
      permissionProfiles: (record['permissionProfiles'] as unknown[]).filter(
        (entry): entry is string => typeof entry === 'string',
      ),
    },
  };
}

interface ParsedAcceptedWithProfiles extends ParsedTaskPack {
  readonly permissionProfiles: readonly string[];
}

/**
 * Verify one active task pack's authority. Returns every check with its
 * §4.3 class; `ok` is false when ANY check fails.
 */
export function verifyTaskPackAuthority(
  repoRoot: string,
  taskPackPath: string,
): TaskPackAuthorityResult {
  const checks: TaskPackCheck[] = [];
  const add = (check: TaskPackCheck): void => {
    checks.push(check);
  };

  let bytes: Buffer;
  try {
    bytes = readFileSync(taskPackPath);
  } catch (error) {
    add({
      id: 'task-pack:schema',
      ok: false,
      driftClass: 'schema-invalid',
      detail: `task pack unreadable: ${(error as Error).message}`,
    });
    return { ok: false, checks, baseTree: null, inScopePaths: [], ignoreManifest: [] };
  }

  // 1. schema (closed vocabulary).
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    add({
      id: 'task-pack:schema',
      ok: false,
      driftClass: 'schema-invalid',
      detail: `task pack unparsable: ${(error as Error).message}`,
    });
    return { ok: false, checks, baseTree: null, inScopePaths: [], ignoreManifest: [] };
  }
  const schema = validateTaskPack(parsedJson);
  add({
    id: 'task-pack:schema',
    ok: schema.ok,
    driftClass: schema.ok ? null : 'schema-invalid',
    detail: schema.ok
      ? 'valid vict.builder.task-pack@1 (closed vocabulary)'
      : `invalid: ${schema.issues
          .map((entry) => `${entry.code} at ${entry.path}`)
          .join('; ')
          .slice(0, 300)}`,
  });

  const pack = parseTaskPack(bytes);
  if (pack === null) {
    add({
      id: 'task-pack:identity',
      ok: false,
      driftClass: 'schema-invalid',
      detail: 'task pack structure unusable for authority verification',
    });
    return { ok: false, checks, baseTree: null, inScopePaths: [], ignoreManifest: [] };
  }

  // 2. canonical identity (§4.4 exclusion rule is normative).
  let recomputed: string | null = null;
  let includingPackId: string | null = null;
  try {
    recomputed = packIdentityFromBytes(bytes);
    includingPackId = sha256Hex(canonicalJsonBytes(parsedJson as Record<string, unknown>));
  } catch (error) {
    add({
      id: 'task-pack:identity',
      ok: false,
      driftClass: 'pack-tamper',
      detail: `identity recomputation failed: ${(error as Error).message}`,
    });
  }
  if (recomputed !== null && includingPackId !== null) {
    const ok = recomputed === pack.packId && includingPackId !== pack.packId;
    add({
      id: 'task-pack:identity',
      ok,
      driftClass: ok ? null : 'pack-tamper',
      detail: ok
        ? 'packId matches canonical bytes with packId omitted'
        : `recorded ${pack.packId.slice(0, 12)}… ≠ recomputed ${recomputed.slice(0, 12)}…`,
    });
  }

  // 3. committed base-pack binding.
  let basePackId: string | null;
  try {
    const committed = JSON.parse(readFileSync(join(repoRoot, CONTEXT_PACK_PATH), 'utf8')) as Record<
      string,
      unknown
    >;
    basePackId = typeof committed['packId'] === 'string' ? committed['packId'] : null;
  } catch {
    basePackId = null;
  }
  const bindingOk =
    basePackId !== null &&
    pack.basePackId === basePackId &&
    pack.basePackPath === CONTEXT_PACK_PATH;
  add({
    id: 'task-pack:base-pack-binding',
    ok: bindingOk,
    driftClass: bindingOk ? null : 'content-drift',
    detail: bindingOk
      ? `bound to the committed base pack ${String(basePackId).slice(0, 12)}…`
      : `recorded base-pack binding (${pack.basePackId.slice(0, 12)}… @ ${pack.basePackPath}) does not match the committed base pack${basePackId === null ? ' (unreadable)' : ` ${basePackId.slice(0, 12)}…`}`,
  });

  // 4. current handoff path and byte digest.
  let handoffOk = false;
  let handoffDetail: string;
  try {
    const current = sha256Hex(readFileSync(join(repoRoot, pack.handoff.path)));
    handoffOk = current === pack.handoff.sha256;
    handoffDetail = handoffOk
      ? `handoff ${pack.handoff.path} @ ${pack.handoff.sha256.slice(0, 12)}… is current`
      : `handoff ${pack.handoff.path} changed: recorded ${pack.handoff.sha256.slice(0, 12)}… ≠ current ${current.slice(0, 12)}…`;
  } catch (error) {
    handoffDetail = `handoff ${pack.handoff.path} unreadable: ${(error as Error).message}`;
  }
  add({
    id: 'task-pack:handoff-binding',
    ok: handoffOk,
    driftClass: handoffOk ? null : 'content-drift',
    detail: handoffDetail,
  });

  // 5. ignore-manifest digest coherence.
  const ignoreDigest = sha256Hex(canonicalJsonBytes([...pack.ignoreManifest]));
  const ignoreOk = ignoreDigest === pack.ignoreManifestDigest;
  add({
    id: 'task-pack:ignore-manifest',
    ok: ignoreOk,
    driftClass: ignoreOk ? null : 'pack-tamper',
    detail: ignoreOk
      ? `ignore manifest digest coherent (${String(pack.ignoreManifest.length)} entr${pack.ignoreManifest.length === 1 ? 'y' : 'ies'})`
      : 'recorded ignore manifest does not match its recorded digest',
  });

  // 6. pinned baseline commit exists (exact commit SHA, §3.3).
  const baselineOk = commitExists(repoRoot, pack.baseTree);
  add({
    id: 'task-pack:baseline-commit',
    ok: baselineOk,
    driftClass: baselineOk ? null : 'content-drift',
    detail: baselineOk
      ? `pinned baseTree ${pack.baseTree.slice(0, 12)}… exists`
      : `pinned baseTree ${pack.baseTree.slice(0, 12)}… is not an existing commit`,
  });

  // 7. accepted-scope coverage (the authority binding).
  const accepted = acceptedRecordFor(repoRoot, pack.handoff);
  const scopeRecord = accepted.record;
  if (scopeRecord !== null) {
    const uncoveredScope = pack.inScopePaths.filter(
      (glob) => !globCoveredBy(glob, scopeRecord?.inScopePaths ?? []),
    );
    const uncoveredIgnore = pack.ignoreManifest.filter(
      (glob) => !globCoveredBy(glob, scopeRecord?.ignoreManifest ?? []),
    );
    const profileOk = (scopeRecord?.permissionProfiles ?? []).includes(pack.permissionProfile);
    const covered = uncoveredScope.length === 0 && uncoveredIgnore.length === 0 && profileOk;
    add({
      id: 'task-pack:accepted-scope',
      ok: covered,
      driftClass: covered ? null : 'baseline-escape',
      detail: covered
        ? `carried scope (${String(pack.inScopePaths.length)} glob(s)), ignore manifest, and profile '${pack.permissionProfile}' are covered by the accepted record`
        : `carried authority exceeds the accepted record: ${[
            uncoveredScope.length > 0 ? `in-scope not granted: ${uncoveredScope.join(', ')}` : null,
            uncoveredIgnore.length > 0 ? `ignore not granted: ${uncoveredIgnore.join(', ')}` : null,
            profileOk
              ? null
              : `profile '${pack.permissionProfile}' not accepted (accepted: ${(scopeRecord?.permissionProfiles ?? []).join(', ')})`,
          ]
            .filter((entry) => entry !== null)
            .join('; ')}`,
    });
  } else {
    add(accepted.check);
  }

  // 8. deterministic regeneration from exactly the §3.3 inputs.
  try {
    const regenerated = canonicalJsonBytes(
      buildTaskPack(repoRoot, {
        handoffPath: pack.handoff.path,
        baseTree: pack.baseTree,
        inScopePaths: pack.inScopePaths,
        ignoreManifest: pack.ignoreManifest,
        permissionProfile: pack.permissionProfile,
      }),
    );
    const ok = regenerated.equals(bytes);
    add({
      id: 'task-pack:regenerate-compare',
      ok,
      driftClass: ok ? null : 'content-drift',
      detail: ok
        ? 'regeneration from base pack + handoff + task parameters reproduces the pack byte-for-byte'
        : 'regenerated task pack differs from the stored bytes (non-canonical edit or stale parameters)',
    });
  } catch (error) {
    add({
      id: 'task-pack:regenerate-compare',
      ok: false,
      driftClass: 'content-drift',
      detail: `regeneration failed: ${(error as Error).message}`,
    });
  }

  const usable = checks.every((check) => check.ok);
  return {
    ok: usable,
    checks,
    baseTree: pack.baseTree,
    inScopePaths: pack.inScopePaths,
    ignoreManifest: pack.ignoreManifest,
  };
}
