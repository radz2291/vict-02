/**
 * S9-02 RUN-DETAIL READS (WP-G3-B, G3-B builder lane; files under
 * `src/routes/runs/**` are this lane's exclusive paths).
 *
 * The run-detail route's server-side read surface: every panel on the page
 * renders verbatim from the target's own G1 read endpoints, fetched with
 * the target's SERVER-HELD credential (D-2/D-7 — the browser never sees a
 * target credential). Only the frozen G1 HTTP paths are used:
 *   GET /vict/v1/runs/:runId                            (run.get — the
 *             REDACTED generic projection: stored `output` never crosses it)
 *   GET /vict/v1/runs/:runId/events?afterSeq&limit      (ordered identity reads)
 *   GET /vict/v1/runs/:runId/waits                      (durable waits)
 *   GET /vict/v1/runs/:runId/detail                     (run.detail — the
 *             DISTINCT `run.detail` scope, retention gate, per-access audit)
 *   GET /vict/v1/audit?subjectType=run&subjectId=:runId&limit
 *             (provenance / per-access audit evidence)
 *   GET /vict/v1/runs?limit&offset                      (the S9-02 negative
 *             set's direct-API pagination reader)
 *
 * The protected `run.detail` read resolves the SEPARATE server-held
 * `${target.credentialRef}-detail` credential (the deployment's run.detail
 * grant actor). When no such credential is provisioned the protected read
 * reports truthfully 'unavailable' — it NEVER downsgrades to a lesser
 * credential silently.
 */

import { getTarget, getCredential } from '$lib/server/targets.js';

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/;
const FETCH_TIMEOUT_MS = 4000;

/** A bounded outcome of one target read (never carries credential material). */
export type TargetRead<T> =
  | { readonly kind: 'ok'; readonly status: number; readonly data: T }
  | { readonly kind: 'envelope-error'; readonly status: number; readonly code: string }
  | { readonly kind: 'http-error'; readonly status: number }
  | { readonly kind: 'unreachable' };

/** A run record exactly as the target's REDACTED generic projection returned it. */
export type RunRecord = Record<string, unknown>;
export type RunEventRow = Record<string, unknown>;
export type RunWaitRow = Record<string, unknown>;
export type RunAuditRow = Record<string, unknown>;

/** The protected `run.detail` answer (D-5): protected bytes only under the
 * run.detail scope AND 'full' retention. The target appends its own
 * per-access audit event (`run.detail.accessed`) at the moment of access. */
export interface ProtectedDetail {
  readonly run: RunRecord | null;
  readonly protectedOutput: unknown;
  readonly protectedAvailable: boolean;
  readonly retention: string | null;
}

/** Bounded identifier validation: `null` means invalid — no fetch is made. */
export function boundedId(value: string): string | null {
  return ID_PATTERN.test(value) ? value : null;
}

function credentialForTarget(targetId: string | null) {
  const target = targetId === null ? undefined : getTarget(boundedId(targetId) ?? '');
  if (target === undefined) {
    return null;
  }
  const credential = getCredential(target.credentialRef);
  if (credential === undefined) {
    return null;
  }
  return { target, credential, detailCredential: getCredential(`${target.credentialRef}-detail`) };
}

async function fetchEnvelope(
  endpoint: string,
  path: string,
  token: string,
): Promise<TargetRead<Record<string, unknown>>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${endpoint}${path}`, {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
  } catch {
    return { kind: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    // Authentication/authorization denials with an unparseable body are
    // classified from the status alone (the confirmation transport's
    // integration-approved pattern).
    if (response.status === 401 || response.status === 403) {
      return { kind: 'envelope-error', status: response.status, code: 'VICT_SCOPE_DENIED' };
    }
    return { kind: 'http-error', status: response.status };
  }
  if (typeof body === 'object' && body !== null && (body as { ok?: unknown })['ok'] === false) {
    // The target's stable G1 code is the truthful classification (e.g.
    // VICT_RUN_MISSING, VICT_ACTOR_SCOPE_DENIED) — restated, never echoed beyond.
    const code = (body as { code?: unknown })['code'];
    if (typeof code === 'string') {
      return { kind: 'envelope-error', status: response.status, code };
    }
  }
  if (
    typeof body === 'object' &&
    body !== null &&
    (body as { ok?: unknown })['ok'] === true &&
    typeof (body as { data?: unknown })['data'] === 'object' &&
    (body as { data?: unknown })['data'] !== null
  ) {
    return {
      kind: 'ok',
      status: response.status,
      data: (body as { data: Record<string, unknown> })['data'],
    };
  }
  return { kind: 'http-error', status: response.status };
}

function noTarget(): { kind: 'unreachable' } {
  // Unprovisioned/absent target: truthful absence, no fetch, no echo.
  return { kind: 'unreachable' };
}

/** GET /vict/v1/runs/:runId — the REDACTED generic run record (read A). */
export async function readRunRecord(
  runId: string,
  targetId: string | null,
): Promise<TargetRead<RunRecord>> {
  if (boundedId(runId) === null) {
    return { kind: 'http-error', status: 400 };
  }
  const resolved = credentialForTarget(targetId);
  if (resolved === null) {
    return noTarget();
  }
  const result = await fetchEnvelope(
    resolved.target.endpoint,
    `/vict/v1/runs/${runId}`,
    resolved.credential.token,
  );
  if (result.kind !== 'ok') {
    return result;
  }
  const run = result.data['run'];
  return run !== null && typeof run === 'object'
    ? { kind: 'ok', status: result.status, data: run as RunRecord }
    : { kind: 'http-error', status: result.status };
}

/** GET /vict/v1/runs/:runId/events — ordered identity/timeline events. */
export async function readRunEvents(
  runId: string,
  targetId: string | null,
  afterSeq = -1,
  limit = 100,
): Promise<TargetRead<{ readonly events: readonly RunEventRow[]; readonly hasMore: boolean }>> {
  if (
    boundedId(runId) === null ||
    !Number.isSafeInteger(afterSeq) ||
    !Number.isSafeInteger(limit)
  ) {
    return { kind: 'http-error', status: 400 };
  }
  const resolved = credentialForTarget(targetId);
  if (resolved === null) {
    return noTarget();
  }
  const result = await fetchEnvelope(
    resolved.target.endpoint,
    `/vict/v1/runs/${runId}/events?afterSeq=${afterSeq}&limit=${limit}`,
    resolved.credential.token,
  );
  return result.kind === 'ok'
    ? {
        kind: 'ok',
        status: result.status,
        data: {
          events: Array.isArray(result.data['events'])
            ? (result.data['events'] as readonly RunEventRow[])
            : [],
          hasMore: result.data['hasMore'] === true,
        },
      }
    : result;
}

/** GET /vict/v1/runs/:runId/waits — the run's durable waits (safe descriptors). */
export async function readRunWaits(
  runId: string,
  targetId: string | null,
): Promise<TargetRead<{ readonly waits: readonly RunWaitRow[] }>> {
  if (boundedId(runId) === null) {
    return { kind: 'http-error', status: 400 };
  }
  const resolved = credentialForTarget(targetId);
  if (resolved === null) {
    return noTarget();
  }
  const result = await fetchEnvelope(
    resolved.target.endpoint,
    `/vict/v1/runs/${runId}/waits`,
    resolved.credential.token,
  );
  return result.kind === 'ok'
    ? {
        kind: 'ok',
        status: result.status,
        data: {
          waits: Array.isArray(result.data['waits'])
            ? (result.data['waits'] as readonly RunWaitRow[])
            : [],
        },
      }
    : result;
}

/** GET /vict/v1/audit?subjectType=run&subjectId=:runId — the run's audit/
 * provenance trail, including any `run.detail.accessed` per-access rows. */
export async function readRunAudit(
  runId: string,
  targetId: string | null,
  limit = 100,
): Promise<TargetRead<{ readonly events: readonly RunAuditRow[] }>> {
  if (boundedId(runId) === null || !Number.isSafeInteger(limit)) {
    return { kind: 'http-error', status: 400 };
  }
  const resolved = credentialForTarget(targetId);
  if (resolved === null) {
    return noTarget();
  }
  const result = await fetchEnvelope(
    resolved.target.endpoint,
    `/vict/v1/audit?subjectType=run&subjectId=${runId}&limit=${limit}`,
    resolved.credential.token,
  );
  return result.kind === 'ok'
    ? {
        kind: 'ok',
        status: result.status,
        data: {
          events: Array.isArray(result.data['events'])
            ? (result.data['events'] as readonly RunAuditRow[])
            : [],
        },
      }
    : result;
}

/** GET /vict/v1/runs/:runId/detail — the D-5 PROTECTED detail read under the
 * DISTINCT `run.detail` scope credential. The caller controls when this is
 * issued (the page's explicit reveal control); the target appends its own
 * per-access audit row for every authorized retrieval. */
export async function readProtectedDetail(
  runId: string,
  targetId: string | null,
): Promise<TargetRead<ProtectedDetail>> {
  if (boundedId(runId) === null) {
    return { kind: 'http-error', status: 400 };
  }
  const resolved = credentialForTarget(targetId);
  if (resolved === null) {
    return noTarget();
  }
  if (resolved.detailCredential === undefined) {
    // Truthful unavailability: the deployment provisions no run.detail
    // grant for this target — no fallback credential is ever used silently.
    return { kind: 'http-error', status: 501 };
  }
  const result = await fetchEnvelope(
    resolved.target.endpoint,
    `/vict/v1/runs/${runId}/detail`,
    resolved.detailCredential.token,
  );
  return result.kind === 'ok'
    ? {
        kind: 'ok',
        status: result.status,
        data: {
          run: (result.data['run'] ?? null) as RunRecord | null,
          protectedOutput: result.data['protectedOutput'] ?? null,
          protectedAvailable: result.data['protectedAvailable'] === true,
          retention: typeof result.data['retention'] === 'string' ? result.data['retention'] : null,
        },
      }
    : result;
}

/**
 * S9-02 NEGATIVE-SET READER (pagination evidence): one page of the run list
 * through the target's own paginated surface (limit/offset honoring,
 * `total`/`hasMore`). Never a page-surface dependency: the /runs list page
 * itself stays on the generic definition host.
 */
export async function readRunsListPage(
  targetId: string | null,
  limit: number,
  offset: number,
): Promise<
  TargetRead<{
    readonly runs: readonly RunRecord[];
    readonly total: number;
    readonly hasMore: boolean;
  }>
> {
  const resolved = credentialForTarget(targetId);
  if (resolved === null) {
    return noTarget();
  }
  if (!Number.isSafeInteger(limit) || !Number.isSafeInteger(offset)) {
    return { kind: 'http-error', status: 400 };
  }
  const result = await fetchEnvelope(
    resolved.target.endpoint,
    `/vict/v1/runs?limit=${limit}&offset=${offset}`,
    resolved.credential.token,
  );
  return result.kind === 'ok'
    ? {
        kind: 'ok',
        status: result.status,
        data: {
          runs: Array.isArray(result.data['runs'])
            ? (result.data['runs'] as readonly RunRecord[])
            : [],
          total: typeof result.data['total'] === 'number' ? result.data['total'] : 0,
          hasMore: result.data['hasMore'] === true,
        },
      }
    : result;
}

/**
 * The honest stale-revision compare: the G1 `run.get` surface does NOT
 * support revision-time reads (a record is read only as it is NOW), so the
 * version-compare design is a DUAL READ: two sequential generic reads of the
 * same run. Identity/version fields (`graphVersion`,
 * `capabilitySetVersion`, `activationVersion`) and the live fields
 * (`status`, `currentNodeId`, `recordRevision`, `updatedAt`) are compared
 * between read A and read B; any difference is the target's own truth that
 * the record MOVED between reads (both snapshots are rendered verbatim;
 * nothing is synthesized into a third state).
 */
export function compareRunRecords(
  first: RunRecord | null,
  second: RunRecord | null,
): {
  readonly fields: readonly {
    readonly key: string;
    readonly first: string;
    readonly second: string;
    readonly changed: boolean;
  }[];
  readonly moved: boolean;
} {
  const keys = [
    'status',
    'currentNodeId',
    'recordRevision',
    'graphVersion',
    'capabilitySetVersion',
    'activationVersion',
    'updatedAt',
  ];
  const asText = (value: unknown): string => {
    if (value === undefined || value === null) return '(absent)';
    if (typeof value === 'number') return String(value);
    return typeof value === 'string' ? value : JSON.stringify(value);
  };
  const fields = keys
    .map((key) => {
      const firstValue = (first ?? {})[key];
      const secondValue = (second ?? {})[key];
      return {
        key,
        first: asText(firstValue),
        second: asText(secondValue),
        changed: firstValue !== secondValue,
      };
    })
    // A field absent from BOTH reads is not part of the compare (the
    // projection defines which fields exist; absence is truthfully
    // rendered as '(absent)' where at least one read reports it).
    .filter((field) => field.first !== '(absent)' || field.second !== '(absent)');
  return { fields, moved: fields.some((field) => field.changed) };
}

/** The truthfully rendered bounded options (reads only; NO actions here —
 * the receipt-gated mutation journey is its own confirmations surface). */
export function boundedOptionsText(
  record: TargetRead<RunRecord>,
  waits: readonly RunWaitRow[],
): string[] {
  if (record.kind !== 'ok') {
    return ['No bounded option is claimed: the run status is unknown from the target reads.'];
  }
  const status = record.data['status'];
  const revision = record.data['recordRevision'];
  const openSignalWaits = waits.filter(
    (wait) => wait['kind'] === 'signal' && wait['status'] === 'open',
  );
  const options: string[] = [];
  switch (status) {
    case 'running':
      options.push(
        `cancel — available for a running run (bounded revision: ${String(revision)}); issued on the confirmations journey, never from this page`,
      );
      break;
    case 'blocked':
      options.push(
        `resolve — available for a blocked run (bounded revision: ${String(revision)}); issued on the confirmations journey, never from this page`,
      );
      break;
    case 'waiting':
      options.push(
        `signal — available for a waiting run (bounded revision: ${String(revision)}); issued on the confirmations journey, never from this page`,
      );
      break;
    case 'completed':
    case 'failed':
    case 'cancelled':
      options.push('none — this run’s status is terminal; it accepts no operator mutation');
      break;
    default:
      options.push(
        `none declared from the target's status read (${String(status)}); no mutation is claimed`,
      );
  }
  for (const wait of openSignalWaits) {
    options.push(
      `signal ${String(wait['signalName'])} — delivers to the open durable wait ${String(wait['waitId'])}`,
    );
  }
  return options;
}
