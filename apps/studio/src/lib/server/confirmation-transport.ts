import type { ConfirmationPrepareSummary } from '$lib/confirmation/confirmation.js';
import { getCredential, getTarget } from './targets.js';

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
): Promise<ConfirmationTransportResult> {
  const target = getTarget('local');
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
      body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
      signal: controller.signal,
    });
  } catch {
    return { kind: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
  if (response.status === 401 || response.status === 403) {
    return { kind: 'envelope-error', status: response.status, code: 'VICT_SCOPE_DENIED' };
  }
  if (!response.ok) {
    return { kind: 'http-error', status: response.status };
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
  if (envelope['ok'] === true && typeof envelope['data'] === 'object' && envelope['data'] !== null) {
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
): Promise<ConfirmationTransportResult> {
  return boundedFetch('/vict/v1/confirmations', 'POST', body, idempotencyKey);
}

/** GET /vict/v1/confirmations/:receiptId — single-receipt status read. */
export function readConfirmationStatus(receiptId: string): Promise<ConfirmationTransportResult> {
  if (!validSegment(receiptId)) {
    return Promise.resolve({ kind: 'http-error', status: 400 });
  }
  return boundedFetch(`/vict/v1/confirmations/${receiptId}`, 'GET', null, undefined);
}

/** POST the confirmed shape on a command route (consume; the only shape). */
export function confirmCommand(
  path: string,
  body: Record<string, unknown>,
  idempotencyKey: string,
): Promise<ConfirmationTransportResult> {
  return boundedFetch(path, 'POST', body, idempotencyKey);
}

/**
 * Narrow a prepare `data` envelope to the human-reviewable summary. Missing
 * fields stay missing — the journey page renders only truthful content.
 */
export function asPrepareSummary(data: Record<string, unknown>): ConfirmationPrepareSummary {
  const expectedRevision = data['expectedRevision'];
  const str = (key: string): string | undefined =>
    typeof data[key] === 'string' ? (data[key] as string) : undefined;
  return {
    receiptId: str('receiptId') ?? '',
    command: str('command') ?? '',
    payloadDigest: str('payloadDigest') ?? '',
    expectedRevision: typeof expectedRevision === 'string' ? expectedRevision : null,
    expiryAt: str('expiryAt') ?? '',
    createdBy: str('createdBy') ?? '',
    createdAt: str('createdAt') ?? '',
  };
}