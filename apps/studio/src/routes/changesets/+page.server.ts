import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
  asChangesetListRows,
  asChangesetSummary,
  asCheckRun,
  asCommitOutcome,
  asDecisionOutcome,
  failureBannerText,
  isValidChangesetId,
  isValidIdempotencyKey,
} from '$lib/changesets/changesets.js';
import {
  attachChangesetEvidence,
  commitChangeset,
  decideChangeset,
  executeChangesetCheck,
  isChangesetActor,
  listChangesetTargetOptions,
  listChangesets,
  proposeChangeset,
  readChangeset,
  reviseChangeset,
} from '$lib/server/changeset-transport.js';

/**
 * S9-03 CHANGESET JOURNEY actions (server-side).
 *
 * The browser NEVER talks to a VICT target: every propose/revise/decide/
 * commit/check/evidence call is relayed here with a SERVER-CHOSEN actor's
 * server-held Bearer credential. Idempotency keys are operator-supplied
 * and validated before any fetch. Responses carry ONLY stable codes and
 * narrowed summaries — never credential, token, or raw error material.
 * Failed views show truthful banners ONLY (no invented state); anything
 * absent fails closed. Session auth is enforced by src/hooks.server.ts.
 */

const failure = (
  bannerText: string,
  extra: Record<string, unknown> = {},
): { success?: undefined; bannerText: string; [key: string]: unknown } => ({
  bannerText,
  ...extra,
});

function formFields(data: FormData, keys: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of keys) {
    const value = data.get(key);
    out[key] = typeof value === 'string' ? value : '';
  }
  return out;
}

const AUTHORING_FIELDS = [
  'changesetId',
  'baseKind',
  'baseSubjectId',
  'baseExpectedVersion',
  'operationKind',
  'graphId',
  'activationVersion',
  'rationale',
  'riskClass',
  'requiredApproverCount',
  'expiresAt',
] as const;

export const load: PageServerLoad = async () => {
  // Deployment-provisioned options ONLY (ids + labels; never credentials),
  // plus the truthful changeset list (changeset.read via the author
  // credential). A failed read stays an empty list with no invented rows.
  const result = await listChangesets();
  return {
    targets: listChangesetTargetOptions(),
    changesets: result.kind === 'ok' ? asChangesetListRows(result.data) : [],
  };
};

export const actions: Actions = {
  /** propose: POST /vict/v1/changesets — author credential. */
  propose: async ({ request }) => {
    const data = await request.formData();
    const targetId = String(data.get('targetId') ?? '');
    const idempotencyKey = String(data.get('idempotencyKey') ?? '');
    if (!isValidIdempotencyKey(idempotencyKey)) {
      return fail(400, failure('A bounded Idempotency-Key is required to propose.'));
    }
    const result = await proposeChangeset(
      formFields(data, AUTHORING_FIELDS),
      idempotencyKey,
      targetId,
    );
    switch (result.kind) {
      case 'ok': {
        const summary = asChangesetSummary(result.data);
        if (summary === null) {
          return fail(
            502,
            failure(
              'The target answered without a recognizable changeset record. Nothing more is claimed.',
            ),
          );
        }
        return { success: true as const, kind: 'propose' as const, summary, bannerText: '' };
      }
      case 'envelope-error':
        return fail(409, failure(failureBannerText(result.code)));
      case 'http-error':
        return fail(
          502,
          failure('The target returned an unexpected error status. Nothing was proposed.'),
        );
      case 'unreachable':
        return fail(
          502,
          failure(
            'The target is unreachable (absent or under-credentialed). Nothing was proposed and nothing was changed.',
          ),
        );
    }
  },

  /** revise: POST /vict/v1/changesets/revise — author only; NEW content hash. */
  revise: async ({ request }) => {
    const data = await request.formData();
    const targetId = String(data.get('targetId') ?? '');
    const idempotencyKey = String(data.get('idempotencyKey') ?? '');
    if (!isValidIdempotencyKey(idempotencyKey)) {
      return fail(400, failure('A bounded Idempotency-Key is required to revise.'));
    }
    const result = await reviseChangeset(
      formFields(data, AUTHORING_FIELDS),
      idempotencyKey,
      targetId,
    );
    switch (result.kind) {
      case 'ok': {
        const summary = asChangesetSummary(result.data);
        if (summary === null) {
          return fail(
            502,
            failure(
              'The target answered without a recognizable changeset record. Nothing more is claimed.',
            ),
          );
        }
        return { success: true as const, kind: 'revise' as const, summary, bannerText: '' };
      }
      case 'envelope-error':
        return fail(409, failure(failureBannerText(result.code)));
      case 'http-error':
        return fail(
          502,
          failure('The target returned an unexpected error status. Nothing was revised.'),
        );
      case 'unreachable':
        return fail(
          502,
          failure('The target is unreachable (absent or under-credentialed). Nothing was revised.'),
        );
    }
  },

  /** decide: POST /vict/v1/changesets/decide — server-chosen approver credential. */
  decide: async ({ request }) => {
    const data = await request.formData();
    const targetId = String(data.get('targetId') ?? '');
    const actor = String(data.get('actor') ?? '');
    if (!isChangesetActor(actor)) {
      return fail(
        400,
        failure(
          'The decision actor must be a journey actor (author for the self-approval negative, approver-a or approver-b for a real decision).',
        ),
      );
    }
    const idempotencyKey = String(data.get('idempotencyKey') ?? '');
    if (!isValidIdempotencyKey(idempotencyKey)) {
      return fail(400, failure('A bounded Idempotency-Key is required to decide.'));
    }
    const result = await decideChangeset(
      actor,
      {
        changesetId: String(data.get('changesetId') ?? ''),
        decision: String(data.get('decision') ?? 'approved'),
      },
      idempotencyKey,
      targetId,
    );
    switch (result.kind) {
      case 'ok': {
        const summary = asDecisionOutcome(result.data);
        if (summary === null) {
          return fail(
            502,
            failure(
              'The target answered without a recognizable decision record. Nothing more is claimed.',
            ),
          );
        }
        return { success: true as const, kind: 'decide' as const, summary, bannerText: '' };
      }
      case 'envelope-error':
        return fail(409, failure(failureBannerText(result.code)));
      case 'http-error':
        return fail(
          502,
          failure('The target returned an unexpected error status. No decision was recorded.'),
        );
      case 'unreachable':
        return fail(
          502,
          failure(
            'The target is unreachable (absent or under-credentialed). No decision was recorded.',
          ),
        );
    }
  },

  /** commit: POST /vict/v1/changesets/commit — authorized operator credential. */
  commit: async ({ request }) => {
    const data = await request.formData();
    const targetId = String(data.get('targetId') ?? '');
    const idempotencyKey = String(data.get('idempotencyKey') ?? '');
    if (!isValidIdempotencyKey(idempotencyKey)) {
      return fail(400, failure('A bounded Idempotency-Key is required to commit.'));
    }
    const result = await commitChangeset(
      { changesetId: String(data.get('changesetId') ?? '') },
      idempotencyKey,
      targetId,
    );
    switch (result.kind) {
      case 'ok': {
        // Two truthful success shapes exist:
        //  - fresh key: { result: { record, applied } } (first commit OR
        //    the control-plane committed-status replay — SAME receipts);
        //  - the SAME Idempotency-Key: the command-receipt replay returns
        //    { changeset: record } from the stored safe projection.
        // Both are the idempotent replay discipline; NO shape ever claims
        // a second application.
        const replaySummary = asChangesetSummary(result.data['changeset']);
        if (
          typeof result.data['result'] !== 'object' &&
          replaySummary !== null &&
          replaySummary.status === 'committed'
        ) {
          return {
            success: true as const,
            kind: 'commit' as const,
            summary: null,
            bannerText: `Idempotent replay for ${replaySummary.changesetId}: this Idempotency-Key was already settled — the target replayed the recorded outcome with NO new effect. The changeset is committed; its operations were already applied EXACTLY ONCE (receipt-backed, never a second effect).`,
          };
        }
        const summary = asCommitOutcome(result.data);
        if (summary === null || summary.status !== 'committed') {
          return fail(
            502,
            failure(
              'The target answered without a recognizable committed record. No effect is claimed here.',
            ),
          );
        }
        return {
          success: true as const,
          kind: 'commit' as const,
          summary,
          bannerText: `Commit accepted for ${summary.changesetId}: ${summary.appliedCount} durable operation receipt(s); every operation was applied EXACTLY ONCE. Repeating this commit is the IDEMPOTENT REPLAY of the first — the target returns the SAME receipts with one outcome and never applies a second effect. Judge the applied effect in the target's audit/activation views.`,
        };
      }
      case 'envelope-error':
        return fail(409, failure(failureBannerText(result.code)));
      case 'http-error':
        return fail(
          502,
          failure('The target returned an unexpected error status. No effect is claimed.'),
        );
      case 'unreachable':
        return fail(
          502,
          failure(
            'The target is unreachable (absent or under-credentialed). No effect was applied.',
          ),
        );
    }
  },

  /**
   * evidence: execute the validation evidence run (check) and attach its
   * run id — BOTH with the author credential (the same actor must execute
   * and attach; the target derives every evidence field server-side).
   */
  evidence: async ({ request }) => {
    const data = await request.formData();
    const targetId = String(data.get('targetId') ?? '');
    const idempotencyKey = String(data.get('idempotencyKey') ?? '');
    if (!isValidIdempotencyKey(idempotencyKey)) {
      return fail(
        400,
        failure('A bounded Idempotency-Key is required to execute the evidence run.'),
      );
    }
    const changesetId = String(data.get('changesetId') ?? '');
    const check = await executeChangesetCheck({ changesetId }, idempotencyKey, targetId);
    if (check.kind !== 'ok') {
      switch (check.kind) {
        case 'envelope-error':
          return fail(409, {
            kind: 'evidence' as const,
            bannerText: failureBannerText(check.code),
            runSummary: null,
            summary: null,
          });
        case 'unreachable':
          return fail(502, {
            kind: 'evidence' as const,
            bannerText: 'The target is unreachable. No governance run was executed.',
            runSummary: null,
            summary: null,
          });
        default:
          return fail(502, {
            kind: 'evidence' as const,
            bannerText:
              'The target returned an unexpected error status. No governance run was executed.',
            runSummary: null,
            summary: null,
          });
      }
    }
    const run = asCheckRun(check.data);
    if (run === null) {
      return fail(502, {
        kind: 'evidence' as const,
        bannerText:
          'The target answered without a recognizable run record. Nothing further was attached.',
        runSummary: null,
        summary: null,
      });
    }
    if (!isValidChangesetId(run.runId)) {
      return fail(502, {
        kind: 'evidence' as const,
        bannerText:
          'The executed run id was unusable; no evidence was attached. Re-check on the target directly.',
        runSummary: run,
        summary: null,
      });
    }
    const attach = await attachChangesetEvidence(
      { changesetId, runId: run.runId },
      `${idempotencyKey}.attach`.slice(0, 128),
      targetId,
    );
    if (attach.kind !== 'ok') {
      const code = attach.kind === 'envelope-error' ? attach.code : '';
      return fail(409, {
        kind: 'evidence' as const,
        bannerText:
          code.length > 0
            ? failureBannerText(code)
            : `The evidence run executed (${run.kind}: ${run.outcome}, run ${run.runId}) but the attach step could not be completed — nothing was claimed beyond the run.`,
        runSummary: run,
        summary: null,
      });
    }
    const summary = asChangesetSummary(attach.data);
    if (summary === null) {
      return fail(502, {
        kind: 'evidence' as const,
        bannerText:
          'The target answered without a recognizable changeset record after attaching evidence.',
        runSummary: run,
        summary: null,
      });
    }
    return {
      success: true as const,
      kind: 'evidence' as const,
      runSummary: run,
      summary,
      bannerText: '',
    };
  },

  /** inspect: GET the single changeset record (truthful review panel). */
  inspect: async ({ request }) => {
    const data = await request.formData();
    const targetId = String(data.get('targetId') ?? '');
    const changesetId = String(data.get('changesetId') ?? '');
    if (!isValidChangesetId(changesetId)) {
      return fail(400, failure('A bounded changeset id is required for the review read.'));
    }
    const result = await readChangeset(changesetId, targetId);
    switch (result.kind) {
      case 'ok': {
        const summary = asChangesetSummary(result.data);
        if (summary === null) {
          return fail(
            502,
            failure(
              'The target answered without a recognizable changeset record. Nothing is claimed.',
            ),
          );
        }
        return {
          success: true as const,
          kind: 'inspect' as const,
          summary,
          bannerText:
            summary.status === 'committed'
              ? 'This changeset is COMMITTED on the target: its operations are already applied exactly once (receipt-backed). A repeated commit is the idempotent replay of the first — never a second effect.'
              : '',
        };
      }
      case 'envelope-error':
        return fail(404, failure(failureBannerText(result.code)));
      case 'http-error':
      case 'unreachable':
        return fail(
          502,
          failure(
            'The review read could not be completed on the target. No changeset state is claimed.',
          ),
        );
    }
  },
};
