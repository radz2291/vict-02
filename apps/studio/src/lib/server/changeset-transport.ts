import {
  buildAttachEvidenceBody,
  buildCheckBody,
  buildCommitBody,
  buildDecideBody,
  buildProposeBody,
  buildReviseBody,
  CHANGESET_COMMAND_SCHEMA,
  CHANGESET_ACTORS,
  type ChangesetActor,
} from '$lib/changesets/changesets.js';
import { getCredential, getTarget, listTargets } from './targets.js';

/**
 * S9-03 SERVER-SIDE CHANGESET TRANSPORT (server-only module).
 *
 * The Studio server holds the target credentials (D-2/D-7); the browser
 * never talks to a VICT target. This module is the ONLY fetch path of the
 * changeset journey and relays EXACTLY:
 *   - GET  /vict/v1/changesets               (truthful list read)
 *   - GET  /vict/v1/changesets/:changesetId  (truthful record read)
 *   - POST /vict/v1/changesets               (propose — author credential)
 *   - POST /vict/v1/changesets/revise        (author credential)
 *   - POST /vict/v1/changesets/decide        (chosen approver credential,
 *                                             or the author credential for
 *                                             the self-approval NEGATIVE —
 *                                             the target refuses it with
 *                                             VICT_ACTOR_SCOPE_DENIED)
 *   - POST /vict/v1/changesets/commit        (authorized operator credential)
 *   - POST /vict/v1/changesets/check         (evidence run — author credential)
 *   - POST /vict/v1/changesets/evidence      (attach run id — author credential)
 *
 * The actor that issues each relayed call is chosen SERVER-SIDE from a
 * closed table over the server-held credentials — never from raw client
 * bytes (the form only carries a bounded actor key when a choice exists).
 * Unknown/absent targets and under-credentialed actors fail closed
 * 'unreachable'; the response carries ONLY stable codes and the narrowed
 * summaries — never a token, credential, or raw error material.
 */

/** Bounded envelope of a target answer (server projection; never the token). */
export type ChangesetTransportResult =
  | { readonly kind: 'ok'; readonly status: number; readonly data: Record<string, unknown> }
  | { readonly kind: 'envelope-error'; readonly status: number; readonly code: string }
  | { readonly kind: 'http-error'; readonly status: number }
  | { readonly kind: 'unreachable' };

const TARGET_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/;

function validSegment(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && TARGET_ID_PATTERN.test(value);
}

/**
 * Server-side closed table: journey actor key -> the server-held
 * credential ref provisioning must contain. Fixture grants (Local demo
 * target; see apps/studio/scripts/demo-target.mjs):
 *   author     -> changeset.propose + changeset.revise + changeset.read
 *                 (and the read scopes; NO changeset.approve)
 *   approver-a -> changeset.approve + changeset.commit + changeset.read
 *   approver-b -> changeset.approve + changeset.read
 */
const CHANGESET_ACTOR_CREDENTIALS: Readonly<Record<ChangesetActor, string>> = {
  author: 'studio-changeset-author',
  'approver-a': 'studio-changeset-approver-a',
  'approver-b': 'studio-changeset-approver-b',
};

export function isChangesetActor(value: unknown): value is ChangesetActor {
  return (CHANGESET_ACTORS as readonly string[]).includes(value as string);
}

/** An actor credential + target pair resolved by the server (never a token out). */
export interface ResolvedChangesetCredential {
  readonly targetId: string;
  readonly endpoint: string;
  readonly actorLabel: string;
}

/**
 * Resolve the target + credential for one journey actor. NO fallback to a
 * different target: unknown or absent targets and under-credentialed
 * actors FAIL CLOSED (null → 'unreachable').
 */
export function resolveChangesetCredential(
  actor: ChangesetActor,
  targetId?: string,
): ResolvedChangesetCredential | null {
  if (!isChangesetActor(actor)) {
    return null;
  }
  const requested = targetId === undefined || targetId.length === 0 ? 'local' : targetId;
  // A non-empty segment that fails the bounded pattern fails closed (no
  // silent default-to-local); an unknown target id fails closed too.
  if (!validSegment(requested)) {
    return null;
  }
  const target = getTarget(requested);
  if (target === undefined) {
    return null;
  }
  const credentialRef = CHANGESET_ACTOR_CREDENTIALS[actor];
  const credential = getCredential(credentialRef);
  if (credential === undefined) {
    return null;
  }
  return { targetId: target.id, endpoint: target.endpoint, actorLabel: credential.actorLabel };
}

function boundedPath(path: string): string | null {
  const segments = path.split('/').filter((segment) => segment.length > 0);
  for (const segment of segments) {
    if (!validSegment(segment)) {
      return null;
    }
  }
  return `/vict/v1/${path.replace(/^\/vict\/v1\//, '')}`;
}

async function changesetFetch(
  actor: ChangesetActor,
  path: string,
  method: 'GET' | 'POST',
  body: Record<string, unknown> | null,
  idempotencyKey: string | undefined,
  targetId?: string,
): Promise<ChangesetTransportResult> {
  const resolved = resolveChangesetCredential(actor, targetId);
  if (resolved === null) {
    return { kind: 'unreachable' };
  }
  const token = getCredential(CHANGESET_ACTOR_CREDENTIALS[actor])?.token ?? '';
  const safePath = boundedPath(path);
  if (safePath === null) {
    return { kind: 'http-error', status: 400 };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  let response: Response;
  try {
    response = await fetch(`${resolved.endpoint}${safePath}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(method === 'POST'
          ? { 'content-type': 'application/json', 'idempotency-key': idempotencyKey ?? '' }
          : {}),
      },
      body: method === 'POST' ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    return { kind: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    let parsedEarly: unknown;
    try {
      parsedEarly = await response.json();
    } catch {
      void parsedEarly;
    }
    if (
      typeof parsedEarly === 'object' &&
      parsedEarly !== null &&
      (parsedEarly as Record<string, unknown>)['ok'] === false &&
      typeof (parsedEarly as Record<string, unknown>)['code'] === 'string'
    ) {
      const code = (parsedEarly as Record<string, unknown>)['code'] as string;
      return { kind: 'envelope-error', status: response.status, code };
    }
    return { kind: 'http-error', status: response.status };
  }
  if (response.status === 401 || response.status === 403) {
    return { kind: 'envelope-error', status: response.status, code: 'VICT_ACTOR_SCOPE_DENIED' };
  }
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    return { kind: 'http-error', status: response.status };
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return { kind: 'http-error', status: response.status };
  }
  const envelope = parsed as Record<string, unknown>;
  if (
    envelope['ok'] === true &&
    typeof envelope['data'] === 'object' &&
    envelope['data'] !== null
  ) {
    return {
      kind: 'ok',
      status: response.status,
      data: envelope['data'] as Record<string, unknown>,
    };
  }
  if (envelope['ok'] === false && typeof envelope['code'] === 'string') {
    return { kind: 'envelope-error', status: response.status, code: envelope['code'] as string };
  }
  return { kind: 'http-error', status: response.status };
}

/** The standard versioned command envelope body (closed three members). */
function commandEnvelope(
  command: string,
  payload: Record<string, unknown>,
): { schema: string; command: string; payload: Record<string, unknown> } {
  return { schema: CHANGESET_COMMAND_SCHEMA, command, payload };
}

/** GET /vict/v1/changesets — truthful list read (changeset.read). */
export function listChangesets(targetId?: string): Promise<ChangesetTransportResult> {
  return changesetFetch('author', '/vict/v1/changesets', 'GET', null, undefined, targetId);
}

/** GET /vict/v1/changesets/:changesetId — truthful record read. */
export function readChangeset(
  changesetId: string,
  targetId?: string,
): Promise<ChangesetTransportResult> {
  if (!validSegment(changesetId)) {
    return Promise.resolve({ kind: 'http-error', status: 400 });
  }
  return changesetFetch(
    'author',
    `/vict/v1/changesets/${changesetId}`,
    'GET',
    null,
    undefined,
    targetId,
  );
}

function proposeLike(
  actor: ChangesetActor,
  path: string,
  commandFields: { command: string; payload: Record<string, unknown> } | null,
  idempotencyKey: string,
  targetId?: string,
): Promise<ChangesetTransportResult> {
  if (commandFields === null || !validSegment(idempotencyKey)) {
    return Promise.resolve({ kind: 'http-error', status: 400 });
  }
  return changesetFetch(
    actor,
    path,
    'POST',
    commandEnvelope(commandFields.command, commandFields.payload),
    idempotencyKey,
    targetId,
  );
}

/** POST /vict/v1/changesets — propose (author credential; changeset.propose). */
export function proposeChangeset(
  fields: Record<string, unknown>,
  idempotencyKey: string,
  targetId?: string,
): Promise<ChangesetTransportResult> {
  return proposeLike(
    'author',
    '/vict/v1/changesets',
    buildProposeBody(fields),
    idempotencyKey,
    targetId,
  );
}

/** POST /vict/v1/changesets/revise — author-only revise (new content hash). */
export function reviseChangeset(
  fields: Record<string, unknown>,
  idempotencyKey: string,
  targetId?: string,
): Promise<ChangesetTransportResult> {
  return proposeLike(
    'author',
    '/vict/v1/changesets/revise',
    buildReviseBody(fields),
    idempotencyKey,
    targetId,
  );
}

/**
 * POST /vict/v1/changesets/decide — the actor is chosen by the SERVER.
 * Approver actors hold changeset.approve; the self-approval negative
 * relays the author credential whose lack of changeset.approve the target
 * refuses with VICT_ACTOR_SCOPE_DENIED (fail closed, no state change).
 */
export function decideChangeset(
  actor: ChangesetActor,
  fields: Record<string, unknown>,
  idempotencyKey: string,
  targetId?: string,
): Promise<ChangesetTransportResult> {
  return proposeLike(
    actor,
    '/vict/v1/changesets/decide',
    buildDecideBody(fields),
    idempotencyKey,
    targetId,
  );
}

/** POST /vict/v1/changesets/commit — authorized operator ONLY (approver-a). */
export function commitChangeset(
  fields: Record<string, unknown>,
  idempotencyKey: string,
  targetId?: string,
): Promise<ChangesetTransportResult> {
  return proposeLike(
    'approver-a',
    '/vict/v1/changesets/commit',
    buildCommitBody(fields),
    idempotencyKey,
    targetId,
  );
}

/** POST /vict/v1/changesets/check — execute the validation evidence run. */
export function executeChangesetCheck(
  fields: Record<string, unknown>,
  idempotencyKey: string,
  targetId?: string,
): Promise<ChangesetTransportResult> {
  return proposeLike(
    'author',
    '/vict/v1/changesets/check',
    buildCheckBody(fields),
    idempotencyKey,
    targetId,
  );
}

/** POST /vict/v1/changesets/evidence — attach the executed run as evidence. */
export function attachChangesetEvidence(
  fields: Record<string, unknown>,
  idempotencyKey: string,
  targetId?: string,
): Promise<ChangesetTransportResult> {
  return proposeLike(
    'author',
    '/vict/v1/changesets/evidence',
    buildAttachEvidenceBody(fields),
    idempotencyKey,
    targetId,
  );
}

/** Deployment-provisioned target options for the journey target selects. */
export function listChangesetTargetOptions(): readonly { id: string; label: string }[] {
  return listTargets().map((entry) => ({ id: entry.id, label: entry.label }));
}
