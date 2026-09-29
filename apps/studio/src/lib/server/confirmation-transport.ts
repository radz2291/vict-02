import type { ConfirmationPrepareSummary } from '$lib/confirmation/confirmation.js';
import { getCredential, getTarget, listTargets } from './targets.js';

/**
 * S9-04 SERVER-SIDE CONFIRMATION TRANSPORT (server-only module).
 *
 * The Studio server holds the target credential (D-2/D-7); the browser
 * never talks to a VICT target directly. This module is the ONLY fetch
 * path of the confirmation journey and supports exactly:
 *   - POST /vict/v1/confirmations                     (prepare)
 *   - GET  /vict/v1/confirmations/:receiptId          (status)
 *   - POST of the confirmed shape on each command route (consume)
 * The Studio server reads `prepare`/`status`/`consume` route templates
 * from the pure command table in `$lib/confirmation/confirmation.js` and
 * validates identifier-shaped fields BEFORE any fetch (fail closed).
 */

/** Bounded envelope of a target answer (server projection; never the token). */
export type ConfirmationTransportResult =
  | { readonly kind: 'ok'; readonly status: number; readonly data: Record<string, unknown> }
  | { readonly kind: 'envelope-error'; readonly status: number; readonly code: string }
  | { readonly kind: 'http-error'; readonly status: number }
  | { readonly kind: 'unreachable' };

const TARGET_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/;

function validSegment(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && TARGET_ID_PATTERN.test(value);
}

function boundedPath(path: string): string | null {
  // Only path templates composed of the known VICT route segments pass;
  // every dynamic segment must be identifier-shaped (no traversal).
  const segments = path.split('/').filter((segment) => segment.length > 0);
  for (const segment of segments) {
    if (!validSegment(segment)) {
      return null;
    }
  }
  return `/vict/v1/${path.replace(/^\/vict\/v1\//, '')}`;
}

async function boundedFetch(
  path: string,
  method: 'GET' | 'POST',
  body: Record<string, unknown> | null,
  idempotencyKey: string | undefined,
  targetId?: string,
): Promise<ConfirmationTransportResult> {
  // FAIL-CLOSED target selection. An unknown, invalid, or ABSENT target
  // id NEVER falls back to another target (the earlier invented local
  // fallback silently sent the operator's call against the 'local'
  // target — that was fail-open state invention). The journey forms
  // always submit the target selector, so anything else is treated as
  // unknown and fails closed 'unreachable' below with NO fetch, no
  // receipt, and no echo of the requested id.
  const requested = validSegment(targetId) ? targetId : '';
  const target = getTarget(requested);
  if (target === undefined) {
    return { kind: 'unreachable' };
  }
  const credential = getCredential(target.credentialRef);
  if (credential === undefined) {
    return { kind: 'unreachable' };
  }
  const safePath = boundedPath(path);
  if (safePath === null) {
    return { kind: 'http-error', status: 400 };
  }
  // The target selector is transport-local: NEVER forwarded to the target
  // (an unknown top-level envelope member would fail closed at the body
  // gate). The forwarded body keeps only the contract members.
  const { targetId: _omitted, ...forwardedBody } = body ?? {};
  void _omitted;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  let response: Response;
  try {
    response = await fetch(`${target.endpoint}${safePath}`, {
      method,
      headers: {
        authorization: `Bearer ${credential.token}`,
        ...(method === 'POST'
          ? { 'content-type': 'application/json', 'idempotency-key': idempotencyKey ?? '' }
          : {}),
      },
      body: method === 'POST' ? JSON.stringify(forwardedBody) : undefined,
      signal: controller.signal,
    });
  } catch {
    return { kind: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
  // Authentication/authorization denials are re-classified from the status
  // (the body is not parsed BEFORE this check — see below for structured
  // codes).
  if (!response.ok) {
    // Integrator amendment (truthfulness): a structured non-ok envelope
    // {ok:false, code} restates the STABLE CODE the target issued (the G1
    // convention); only an unparseable body falls back to http-error.
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
    return { kind: 'envelope-error', status: response.status, code: 'VICT_SCOPE_DENIED' };
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
    // The stable VICT_CONFIRMATION_* / VICT_COMMAND_IDEMPOTENCY_* codes are
    // the truthful classification of Phase-2 outcomes (proposal §5) — the
    // operator journey NEEDS them surfaced verbatim (non-echoing beyond the code).
    return {
      kind: 'envelope-error',
      status: response.status,
      code: envelope['code'] as string,
    };
  }
  return { kind: 'http-error', status: response.status };
}

/** POST /vict/v1/confirmations — prepare a receipt for human review. */
export function prepareConfirmation(
  body: Record<string, unknown>,
  idempotencyKey: string,
  targetId?: string,
): Promise<ConfirmationTransportResult> {
  return boundedFetch('/vict/v1/confirmations', 'POST', body, idempotencyKey, targetId);
}

/** GET /vict/v1/confirmations/:receiptId — single-receipt status read. */
export function readConfirmationStatus(
  receiptId: string,
  targetId?: string,
): Promise<ConfirmationTransportResult> {
  if (!validSegment(receiptId)) {
    return Promise.resolve({ kind: 'http-error', status: 400 });
  }
  return boundedFetch(`/vict/v1/confirmations/${receiptId}`, 'GET', null, undefined, targetId);
}

/** POST the confirmed shape on a command route (consume; the only shape). */
export function confirmCommand(
  path: string,
  body: Record<string, unknown>,
  idempotencyKey: string,
  targetId?: string,
): Promise<ConfirmationTransportResult> {
  return boundedFetch(path, 'POST', body, idempotencyKey, targetId);
}

/**
 * Narrow a prepare `data` envelope to the human-reviewable summary. Missing
 * fields stay missing — the journey page renders only truthful content.
 */
export function asPrepareSummary(data: Record<string, unknown>): ConfirmationPrepareSummary {
  // Integrator amendment (truthfulness): numeric members (expiryAt,
  // createdAt, expectedRevision) are rendered as their canonical decimal
  // string — numbers are NEVER silently dropped from the human-review
  // summary. Missing fields stay missing (nothing invented).
  const str = (key: string): string | undefined => {
    const value = data[key];
    return typeof value === 'string'
      ? value
      : typeof value === 'number' && Number.isSafeInteger(value)
        ? String(value)
        : undefined;
  };
  const expectedRevision = data['expectedRevision'];
  return {
    receiptId: str('receiptId') ?? '',
    command: str('command') ?? '',
    payloadDigest: str('payloadDigest') ?? '',
    expectedRevision:
      typeof expectedRevision === 'string'
        ? expectedRevision
        : typeof expectedRevision === 'number'
          ? String(expectedRevision)
          : null,
    expiryAt: str('expiryAt') ?? '',
    createdBy: str('createdBy') ?? '',
    createdAt: str('createdAt') ?? '',
  };
}

/** Deployment-provisioned target options for the journey target select. */
export function listConfirmationTargetOptions(): readonly {
  id: string;
  label: string;
}[] {
  return listTargets().map((entry) => ({ id: entry.id, label: entry.label }));
}
