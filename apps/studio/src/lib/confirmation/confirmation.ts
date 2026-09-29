/**
 * S9-04 CONFIRMATION JOURNEY CONTRACT TYPES + PURE HELPERS (Stage 09, G2).
 *
 * These are the Studio-side shapes of the FROZEN G2 controlled-recovery
 * contract (docs/governance/VICT-STAGE-09-G2-PROPOSAL-2026-09-29.md §4–§5;
 * owner acceptance recorded in the G2 ENTRY record, 2026-09-29). The G2
 * command semantics live in the core/transport builders; this module holds
 * ONLY the journey surface shapes: the server-issued prepare summary, the
 * bounded command table (the four migrated commands + the two new
 * receipt-gated interventions), the confirmed consumption body builder, and
 * the truthful failure-banner texts for the VICT_CONFIRMATION_* outcome
 * codes. NOTHING here fabricates state: every status/summary/banner is
 * echoed from a target response or is truthfully absent.
 *
 * Studio remains READ-ONLY for the G1 operator surface; this module is used
 * exclusively by the dedicated S9-04 journey route
 * (`src/routes/confirmations/`) and its server-side transport helper.
 */

/** The server-issued human-reviewable prepare summary (proposal §4.1). */
export interface ConfirmationPrepareSummary {
  readonly receiptId: string;
  readonly command: string;
  readonly payloadDigest: string;
  readonly expectedRevision: string | null;
  readonly expiryAt: string;
  readonly createdBy: string;
  readonly createdAt: string;
}

/** The receipt statuses the single-receipt status read may truthfully answer. */
export type ConfirmationStatusName = 'prepared' | 'consumed' | 'expired' | 'spent' | 'unavailable';

/** A confirmation status read result (GET /vict/v1/confirmations/:receiptId). */
export interface ConfirmationStatusResult {
  readonly name: ConfirmationStatusName;
  readonly command?: string;
  readonly payloadDigest?: string;
  readonly expectedRevision?: string | null;
  readonly expiryAt?: string;
}

/** Bounded command id grammar (matches the VICT transport id pattern). */
export const CONFIRMATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/;

/**
 * One receipt-gated command of the Stage 9 target contract.
 * `payloadFields` are the versioned command fields (proposal §4.2) ALWAYS
 * supplied by the human journey form — nothing is defaulted silently.
 */
export interface ConfirmationCommandSpec {
  /** The registry command name (unchanged from G1 for the four migrated commands). */
  readonly command: string;
  /** The consume route; a function receives the payload and returns the path. */
  readonly route: (payload: Readonly<Record<string, string>>) => string;
  /** Bounded payload field list (exact names of the versioned contract). */
  readonly payloadFields: readonly string[];
  /** Human label shown on the journey page. */
  readonly label: string;
}

function fixedRoute(path: string): (payload: Readonly<Record<string, string>>) => string {
  return () => path;
}

function runRoute(suffix: string): (payload: Readonly<Record<string, string>>) => string {
  return (payload) => `/vict/v1/runs/${payload['runId']}/${suffix}`;
}

/** The six receipt-gated commands (four migrated + two new), per §4.2/§4.3. */
export const CONFIRMATION_COMMANDS: Readonly<Record<string, ConfirmationCommandSpec>> = {
  'run.cancel': {
    command: 'run.cancel',
    route: fixedRoute('/vict/v1/runs/cancel'),
    payloadFields: ['runId', 'reasonCode'],
    label: 'Cancel a blocked run',
  },
  'run.resolve': {
    command: 'run.resolve',
    route: runRoute('resolve'),
    payloadFields: ['runId', 'resolution'],
    label: 'Resolve a blocked run (new, receipt-gated from day one)',
  },
  'run.signal': {
    command: 'run.signal',
    route: runRoute('signal'),
    payloadFields: ['runId', 'signalName'],
    label: 'Deliver a durable signal to a run (new, receipt-gated from day one)',
  },
  'activation.select': {
    command: 'activation.select',
    route: fixedRoute('/vict/v1/activations/select'),
    payloadFields: ['graphId', 'activationVersion'],
    label: 'Select an activation',
  },
  'release.select': {
    command: 'release.select',
    route: fixedRoute('/vict/v1/releases/select'),
    payloadFields: ['applicationId', 'releaseVersion'],
    label: 'Select a release',
  },
  'release.rollback': {
    command: 'release.rollback',
    route: fixedRoute('/vict/v1/releases/rollback'),
    payloadFields: ['applicationId', 'targetReleaseVersion'],
    label: 'Roll back a release selection',
  },
};

/** The values the new `run.resolve` command accepts (pinned set, §4.2). */
export const RUN_RESOLUTIONS = ['retry', 'confirm_applied', 'fail', 'cancel'] as const;

/** Validate one bounded identifier or payload value before it reaches a route. */
export function isValidConfirmationId(value: string): boolean {
  return CONFIRMATION_ID_PATTERN.test(value);
}

/**
 * Prepare body for `POST /vict/v1/confirmations`:
 * `{ command, payload, expectedRevision }`. `expectedRevision` MUST carry
 * the subject's CURRENT revision read through the G1 read surface
 * (proposal §4.4) — the journey form asks for it explicitly; omitting it
 * is rejected by the target.
 */
export function buildPrepareBody(
  command: string,
  payload: Readonly<Record<string, string>>,
  expectedRevision: number | null,
): {
  readonly command: string;
  readonly payload: Record<string, string>;
  readonly expectedRevision: number | null;
} | null {
  const spec = CONFIRMATION_COMMANDS[command];
  if (spec === undefined) {
    return null;
  }
  const cleaned: Record<string, string> = {};
  for (const field of spec.payloadFields) {
    const value = payload[field];
    if (typeof value !== 'string' || value.length === 0 || !isValidConfirmationId(value)) {
      return null;
    }
    cleaned[field] = value;
  }
  return { command, payload: cleaned, expectedRevision };
}

/**
 * The CONFIRMED consumption body for a command route: the command payload
 * plus the REQUIRED `confirmation: { receiptId }` object (there is exactly
 * ONE canonical consumption shape; no separate consume route exists).
 * Returns `null` when any field is missing or hostile (no fetch is made).
 */
export function buildConfirmedRequest(
  command: string,
  payload: Readonly<Record<string, string>>,
  receiptId: string,
): { readonly path: string; readonly body: Record<string, unknown> } | null {
  const spec = CONFIRMATION_COMMANDS[command];
  if (spec === undefined) {
    return null;
  }
  if (
    typeof receiptId !== 'string' ||
    receiptId.length === 0 ||
    !isValidConfirmationId(receiptId)
  ) {
    return null;
  }
  const cleaned: Record<string, string> = {};
  for (const field of spec.payloadFields) {
    const value = payload[field];
    if (typeof value !== 'string' || value.length === 0 || !isValidConfirmationId(value)) {
      return null;
    }
    cleaned[field] = value;
  }
  return {
    path: spec.route(cleaned),
    // The versioned envelope: the semantic fields ride inside the closed
    // `payload` member; the confirmation object is the top-level confirmed
    // shape member (transport contract; one canonical consumption shape).
    body: { payload: cleaned, confirmation: { receiptId } },
  };
}

/**
 * Parse a confirmation status body. NEVER fabricates: any shape other than
 * a known status name is `unavailable` (a truthful non-echo of absence).
 */
export function parseConfirmationStatus(data: unknown): ConfirmationStatusResult {
  if (data === null || typeof data !== 'object') {
    return { name: 'unavailable' };
  }
  const record = data as Record<string, unknown>;
  const name = record['status'];
  if (name !== 'prepared' && name !== 'consumed' && name !== 'expired' && name !== 'spent') {
    return { name: 'unavailable' };
  }
  const expectedRevision = record['expectedRevision'];
  return {
    name,
    ...(typeof record['command'] === 'string' ? { command: record['command'] as string } : {}),
    ...(typeof record['payloadDigest'] === 'string'
      ? { payloadDigest: record['payloadDigest'] as string }
      : {}),
    ...(expectedRevision === null || typeof expectedRevision === 'string'
      ? { expectedRevision: expectedRevision as string | null }
      : {}),
    ...(typeof record['expiryAt'] === 'string' ? { expiryAt: record['expiryAt'] as string } : {}),
  };
}

/**
 * TRUTHFUL failure-banner texts for the frozen Phase-2 outcome table
 * (proposal §5). Every statement is a restatement of a target-issued
 * stable code — the Studio never invents connection or receipt state.
 */
export function failureBannerText(code: string): string {
  switch (code) {
    case 'VICT_CONFIRMATION_REQUIRED':
      return 'The target refused the call: no confirmation receipt was attached (VICT_CONFIRMATION_REQUIRED). Nothing was changed. Every Stage 9 mutation requires prepare → human review → confirm.';
    case 'VICT_CONFIRMATION_UNAVAILABLE':
      return 'No matching receipt is visible to you (VICT_CONFIRMATION_UNAVAILABLE). It may be unknown, held by another actor, or issued by another target. Nothing was changed; the receipt is not echoed.';
    case 'VICT_CONFIRMATION_MISMATCH':
      return 'The receipt does not match this command or its canonical parameters (VICT_CONFIRMATION_MISMATCH). Nothing was changed.';
    case 'VICT_CONFIRMATION_EXPIRED':
      return 'The receipt expired before it was confirmed (VICT_CONFIRMATION_EXPIRED). Nothing was changed. Prepare again to obtain a fresh receipt.';
    case 'VICT_CONFIRMATION_STALE':
      return 'The target changed since the receipt was prepared (VICT_CONFIRMATION_STALE). Nothing was changed. Re-read the subject and prepare again.';
    case 'VICT_CONFIRMATION_SPENT':
      return 'This receipt was already consumed by a different request (VICT_CONFIRMATION_SPENT). No second effect was created. Prepare again for a new intent.';
    case 'VICT_COMMAND_IDEMPOTENCY_CONFLICT':
      return 'The same Idempotency-Key was used for a different confirmation payload (VICT_COMMAND_IDEMPOTENCY_CONFLICT). Use a fresh key for a new intent; nothing was changed.';
    case 'VICT_COMMAND_IDEMPOTENCY_IN_PROGRESS':
      return 'A request with the same Idempotency-Key is still in progress (VICT_COMMAND_IDEMPOTENCY_IN_PROGRESS). Retry later with the same key; no additional effect was created.';
    case 'VICT_SCOPE_DENIED':
      return 'The target denied the scope required for this command (VICT_SCOPE_DENIED). No receipt was issued.';
    default:
      return `The target answered ${code}. No effect is claimed here: judge the outcome from the target's own code and the audit view.`;
  }
}

/** Truthful banner for the receipt-required fence demonstrated in the journey. */
export const MISSING_RECEIPT_CODE = 'VICT_CONFIRMATION_REQUIRED';
/** The expiry negative from the journey plan (wait the 10-minute TTL or past expiryAt). */
export const EXPIRED_CODE = 'VICT_CONFIRMATION_EXPIRED';
/** The replay-after-settle negative (fresh key against a consumed receipt). */
export const SPENT_CODE = 'VICT_CONFIRMATION_SPENT';
/** The stale negative (target revision changed between prepare and confirm). */
export const STALE_CODE = 'VICT_CONFIRMATION_STALE';
