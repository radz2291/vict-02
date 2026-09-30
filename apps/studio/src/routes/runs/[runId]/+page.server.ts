import { error, fail, type ActionFailure } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
  boundedId,
  boundedOptionsText,
  compareRunRecords,
  readProtectedDetail,
  readRunAudit,
  readRunEvents,
  readRunRecord,
  readRunWaits,
  type TargetRead,
  type RunAuditRow,
  type RunEventRow,
  type RunWaitRow,
} from './run-detail-reads.js';

/**
 * S9-02 RUN-DETAIL PAGE SERVER (WP-G3-B, G3-B builder lane).
 *
 * The dedicated SvelteKit detail route for `/runs/:runId` (reached by the
 * FT-1 row-link navigation bound on the run-list surface). All data on the
 * page is read server-side through the target's own G1 read endpoints with
 * the server-held operator credential (`run-detail-reads.ts`); the protected
 * `run.detail` read happens ONLY through this route's explicit `reveal`
 * action — the page's default state is the REDACTED generic projection,
 * which never carries stored `output` bytes.
 *
 * Session authentication and same-origin rules are the G1 hooks boundary.
 */

export const load: PageServerLoad = async ({ params, url }) => {
  const runId = boundedId(params.runId ?? '');
  if (runId === null) {
    error(404, 'VICT_RUN_ID_INVALID');
  }
  const rawTarget = url.searchParams.get('target');
  const targetId = rawTarget === null ? 'local' : boundedId(rawTarget);
  if (targetId === null) {
    error(404, 'VICT_TARGET_ID_INVALID');
  }

  const record = await readRunRecord(runId, targetId);
  // Events and waits: independent reads; failures render as truthful banners.
  const eventsRead = await readRunEvents(runId, targetId);
  const waitsRead = await readRunWaits(runId, targetId);
  // READ B (the honest dual read for the revision-movement / version panel):
  // the target's own answer to the SAME generic read again.
  const recordAgain = await readRunRecord(runId, targetId);
  // Audit/provenance trail for this run (includes any run.detail.accessed).
  const auditRead = await readRunAudit(runId, targetId);
  const compare = compareRunRecords(
    record.kind === 'ok' ? record.data : null,
    recordAgain.kind === 'ok' ? recordAgain.data : null,
  );

  /** The target's own stable code for a failed envelope, or 'unreachable'. */
  function failureCode(read: TargetRead<unknown>): string | null {
    if (read.kind === 'ok') return null;
    return read.kind === 'envelope-error' ? read.code : 'unreachable';
  }

  return {
    runId,
    targetId,
    record: record.kind === 'ok' ? (record.data as Record<string, unknown>) : null,
    readFailure: failureCode(record),
    recordAgain: recordAgain.kind === 'ok' ? (recordAgain.data as Record<string, unknown>) : null,
    recordAgainFailure: failureCode(recordAgain),
    compare,
    events: eventsRead.kind === 'ok' ? eventsRead.data.events : [],
    eventsFailure: failureCode(eventsRead),
    waits: waitsRead.kind === 'ok' ? waitsRead.data.waits : [],
    waitsFailure: failureCode(waitsRead),
    audit: auditRead.kind === 'ok' ? auditRead.data.events : [],
    auditFailure: failureCode(auditRead),
    options: boundedOptionsText(record, waitsRead.kind === 'ok' ? waitsRead.data.waits : []),
  };
};

export const actions: Actions = {
  /**
   * The ONLY protected-detail path of this page: the D-5 separately scoped
   * authorized request. Default (no reveal) = the redacted generic detail.
   * The target itself records a per-access audit row
   * (`run.detail.accessed`) for every retrieval it authorizes, and the
   * returned evidence carries those rows read back after the access.
   */
  reveal: async ({ request }): Promise<RevealFormResult> => {
    const data = await request.formData();
    const runId = boundedId(String(data.get('runId') ?? ''));
    const rawTarget = String(data.get('targetId') ?? '');
    const targetId = rawTarget === '' ? 'local' : boundedId(rawTarget);
    if (runId === null || targetId === null) {
      return fail(400, { bannerText: 'The reveal control needs a valid run and target id.' });
    }
    const detail = await readProtectedDetail(runId, targetId);
    switch (detail.kind) {
      case 'ok': {
        if (!detail.data.protectedAvailable) {
          // RETENTION behavior: a summary-retention run truthfully reports
          // that no protected bytes are available — nothing is synthesized.
          return {
            reveal: {
              kind: 'retention' as const,
              bannerText:
                'Protected detail NOT available: this run’s retention does not keep protected bytes. The target truthfully reported that nothing is retained here; no protected material was read.',
              retention: detail.data.retention,
              protectedOutput: null,
              accessAuditRows: await detailAccessRows(runId, targetId),
            },
          };
        }
        return {
          reveal: {
            kind: 'revealed' as const,
            bannerText:
              'Protected detail retrieved under the run.detail scope: ONE authorized retrieval; the target recorded its own per-access audit row (read back below).',
            retention: detail.data.retention,
            protectedOutput: detail.data.protectedOutput,
            accessAuditRows: await detailAccessRows(runId, targetId),
          },
        };
      }
      case 'envelope-error':
        return {
          reveal: {
            kind: 'denied' as const,
            bannerText: `Protected detail was not retrieved: the target refused the read with its own code ${detail.code}. No protected material was read and nothing was changed.`,
            retention: null,
            protectedOutput: null,
            accessAuditRows: [],
          },
        };
      case 'http-error':
        return {
          reveal: {
            kind: 'unavailable' as const,
            bannerText:
              'The protected detail read could not be completed on the target (unprovisioned grant or an unusable answer). No protected material is claimed.',
            retention: null,
            protectedOutput: null,
            accessAuditRows: [],
          },
        };
      case 'unreachable':
        return {
          reveal: {
            kind: 'unreachable' as const,
            bannerText: 'The target is unreachable. Nothing was read; nothing was changed.',
            retention: null,
            protectedOutput: null,
            accessAuditRows: [],
          },
        };
    }
  },
};

/** Read back the target's own `run.detail.accessed` rows for this run. */
async function detailAccessRows(runId: string, targetId: string): Promise<readonly RunAuditRow[]> {
  const audit = await readRunAudit(runId, targetId);
  if (audit.kind !== 'ok') {
    return [];
  }
  return audit.data.events.filter((row) => row['action'] === 'run.detail.accessed').slice(-5);
}

export interface RevealOutcome {
  readonly kind: 'revealed' | 'retention' | 'denied' | 'unavailable' | 'unreachable';
  readonly bannerText: string;
  readonly retention: string | null;
  readonly protectedOutput: unknown;
  readonly accessAuditRows: readonly RunAuditRow[];
}

export type RevealFormResult =
  | { readonly reveal: RevealOutcome }
  | { readonly bannerText: string }
  | ActionFailure<{ readonly bannerText: string }>;

export type RunDetailEventRows = readonly RunEventRow[];
export type RunDetailWaitRows = readonly RunWaitRow[];
export type RunDetailAuditRows = readonly RunAuditRow[];
