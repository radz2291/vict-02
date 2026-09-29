import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import {
  buildConfirmedRequest,
  buildPrepareBody,
  CONFIRMATION_COMMANDS,
  failureBannerText,
  isValidConfirmationId,
  parseConfirmationStatus,
  type ConfirmationPrepareSummary,
} from '$lib/confirmation/confirmation.js';
import {
  asPrepareSummary,
  confirmCommand,
  prepareConfirmation,
  listConfirmationTargetOptions,
  readConfirmationStatus,
} from '$lib/server/confirmation-transport.js';
import type { PageServerLoad } from './$types';

/**
 * S9-04 CONFIRMATION JOURNEY actions (server-side).
 *
 * The browser NEVER talks to a VICT target: every prepare/confirm/status
 * call is relayed here with the server-held Bearer credential. The
 * Idempotency-Key is operator-supplied (the journey form) and validated
 * before any fetch. Responses carry ONLY stable codes and the parse
 * summary — never credential, token, or raw error material. Session
 * authentication is enforced by `src/hooks.server.ts` (the G1 boundary);
 * these are non-JSON form posts, bound by its same-origin rule.
 */

function _formValueRef(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === 'string' ? value : '';
}

/** Shared command validation across the actions: bounded, closed table. */
function chosenCommand(command: string) {
  if (!(command in CONFIRMATION_COMMANDS)) {
    return null;
  }
  return CONFIRMATION_COMMANDS[command];
}

function _fieldErrorsRef(command: string, data: FormData): string[] {
  const spec = CONFIRMATION_COMMANDS[command];
  const errors: string[] = [];
  for (const field of spec.payloadFields) {
    const value = data.get(field);
    if (typeof value !== 'string' || !isValidConfirmationId(value)) {
      errors.push(field);
    }
  }
  return errors;
}

export const load: PageServerLoad = async () => {
  // Deployment-provisioned options ONLY (ids + labels; never credentials).
  return { targets: listConfirmationTargetOptions() };
};

export const actions: Actions = {
  /** prepare: POST /vict/v1/confirmations — issue a receipt for review. */
  prepare: async ({ request }) => {
    const data = await request.formData();
    const command = String(data.get('command') ?? '');
    if (chosenCommand(command) === null) {
      return fail(400, {
        bannerText: failureBannerText('VICT_CONFIRMATION_UNAVAILABLE'),
        summary: null,
        status: null,
      });
    }
    const expectedRevisionRaw = String(data.get('expectedRevision') ?? '');
    // Bounded revision: `null` only where the contract says truthfully none;
    // a decimal string parses to a SAFE integer; anything else fails closed
    // below-transport with no fetch (the target requires number|null).
    const expectedRevision: number | null =
      expectedRevisionRaw === 'null' || expectedRevisionRaw === ''
        ? null
        : /^\d{1,15}$/.test(expectedRevisionRaw)
          ? Number(expectedRevisionRaw)
          : null;
    if (expectedRevision === null && expectedRevisionRaw !== '' && expectedRevisionRaw !== 'null') {
      // A decimal string parses to a safe integer; anything else fails
      // closed below-transport with NO fetch and no receipt.
      return fail(400, {
        bannerText:
          "expectedRevision must be the subject's CURRENT revision (a bounded non-negative integer) or the literal null.",
        summary: null,
        status: null,
        command,
      });
    }
    const idempotencyKey = String(data.get('idempotencyKey') ?? '');
    if (!isValidConfirmationId(idempotencyKey)) {
      return fail(400, {
        bannerText: 'A bounded Idempotency-Key is required to prepare.',
        summary: null,
        status: null,
        command,
      });
    }
    const payload: Record<string, string> = {};
    for (const field of CONFIRMATION_COMMANDS[command].payloadFields) {
      payload[field] = String(data.get(field) ?? '');
    }
    const body = buildPrepareBody(command, payload, expectedRevision);
    if (body === null) {
      return fail(400, {
        bannerText: 'All command payload fields are required and must be bounded identifiers.',
        summary: null,
        status: null,
        command,
      });
    }
    const targetId = String(data.get('targetId') ?? '');
    const result = await prepareConfirmation(
      body,
      idempotencyKey,
      targetId.length > 0 ? targetId : undefined,
    );
    switch (result.kind) {
      case 'ok': {
        const summary = asPrepareSummary(result.data);
        return {
          success: true as const,
          summary,
          bannerText: '',
          status: null,
        };
      }
      case 'envelope-error':
        return fail(409, {
          bannerText: failureBannerText(result.code),
          summary: null,
          status: null,
          command,
        });
      case 'http-error':
        return fail(502, {
          bannerText: 'The target returned an unexpected error status. No receipt was issued here.',
          summary: null,
          status: null,
          command,
        });
      case 'unreachable':
        return fail(502, {
          bannerText: 'The target is unreachable. No receipt was issued; nothing was changed.',
          summary: null,
          status: null,
          command,
        });
    }
  },

  /** status: GET /vict/v1/confirmations/:receiptId — truthful status read. */
  status: async ({ request }) => {
    const data = await request.formData();
    const receiptId = String(data.get('receiptId') ?? '');
    if (!isValidConfirmationId(receiptId)) {
      return fail(400, {
        bannerText: 'A valid receiptId is required for a status read.',
        summary: null,
        status: null,
      });
    }
    const statusTargetId = String(data.get('targetId') ?? '');
    const result = await readConfirmationStatus(
      receiptId,
      statusTargetId.length > 0 ? statusTargetId : undefined,
    );
    switch (result.kind) {
      case 'ok': {
        const status = parseConfirmationStatus(result.data);
        return { success: true as const, status, summary: null, bannerText: '' };
      }
      case 'envelope-error':
        return fail(404, {
          bannerText: failureBannerText(result.code),
          summary: null,
          status: null,
        });
      case 'http-error':
      case 'unreachable':
        return fail(502, {
          bannerText:
            'The status read could not be completed on the target. No receipt state is claimed.',
          summary: null,
          status: null,
        });
    }
  },

  /** confirm: POST the confirmed shape on the command route (consume). */
  confirm: async ({ request }) => {
    const data = await request.formData();
    const command = String(data.get('command') ?? '');
    const receiptId = String(data.get('receiptId') ?? '');
    const idempotencyKey = String(data.get('idempotencyKey') ?? '');
    if (chosenCommand(command) === null) {
      return fail(400, {
        bannerText: 'The command is not part of the confirmation journey.',
        summary: null,
        status: null,
      });
    }
    if (!isValidConfirmationId(idempotencyKey)) {
      return fail(400, {
        bannerText: 'A bounded Idempotency-Key is REQUIRED for the confirmed call.',
        summary: null,
        status: null,
        command,
      });
    }
    const payload: Record<string, string> = {};
    for (const field of CONFIRMATION_COMMANDS[command].payloadFields) {
      payload[field] = String(data.get(field) ?? '');
    }
    const confirmed = buildConfirmedRequest(command, payload, receiptId);
    if (confirmed === null) {
      return fail(400, {
        bannerText:
          'The confirmed call needs a valid receiptId and every command payload field (bounded identifiers).',
        summary: null,
        status: null,
        command,
      });
    }
    const confirmTargetId = String(data.get('targetId') ?? '');
    const result = await confirmCommand(
      confirmed.path,
      confirmed.body,
      idempotencyKey,
      confirmTargetId.length > 0 ? confirmTargetId : undefined,
    );
    switch (result.kind) {
      case 'ok': {
        return {
          success: true as const,
          bannerText: `The target accepted the confirmed ${command} call (HTTP ${result.status}). The effect and its audit record are on the target; judge the outcome there and in the audit view.`,
          summary: null,
          status: null,
        };
      }
      case 'envelope-error':
        return fail(409, {
          bannerText: failureBannerText(result.code),
          summary: null,
          status: null,
          command,
        });
      case 'http-error':
        return fail(502, {
          bannerText:
            'The target returned an unexpected error status for the confirmed call. No effect is claimed here.',
          summary: null,
          status: null,
          command,
        });
      case 'unreachable':
        return fail(502, {
          bannerText: 'The target is unreachable. No effect is claimed; nothing was changed.',
          summary: null,
          status: null,
          command,
        });
    }
  },
};

/** Type shape used by the page for the prepare summary. */
export type ConfirmationFormResult =
  | {
      readonly success: true;
      readonly summary: ConfirmationPrepareSummary;
      readonly bannerText: string;
      readonly status: null;
    }
  | { success?: undefined; bannerText?: string; summary?: null; status?: null; command?: string };
