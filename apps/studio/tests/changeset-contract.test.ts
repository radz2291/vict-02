//
// S9-03 changeset journey CONTRACT SHAPES (node environment; server-side
// pure helpers in isolation). Integration expectations live here BY NAME
// (route paths, envelope shapes, stable codes, closed actor table) against
// the composed Stage 9 machinery — the VICT packages are NEVER imported by
// this test.
import { describe, expect, it } from 'vitest';
import {
  buildAttachEvidenceBody,
  buildCheckBody,
  buildCommitBody,
  buildDecideBody,
  buildProposeBody,
  buildReviseBody,
  commitBannerText,
  failureBannerText,
  asChangesetListRows,
  asChangesetSummary,
  asCheckRun,
  asCommitOutcome,
  asDecisionOutcome,
  isValidChangesetId,
  isValidIdempotencyKey,
} from '$lib/changesets/changesets.js';
import { isChangesetActor, resolveChangesetCredential } from '$lib/server/changeset-transport.js';

const PROPOSE_FIELDS = {
  changesetId: 'cs-demo-1',
  baseKind: 'activation',
  baseSubjectId: 'g.studio-demo',
  baseExpectedVersion: 'av-demo-0001',
  operationKind: 'select-activation',
  graphId: 'g.studio-demo',
  activationVersion: 'av-demo-0001',
  rationale: 'demo proposal',
  riskClass: 'low',
  requiredApproverCount: '1',
  expiresAt: '1700000100000',
};

describe('changeset journey contract shapes (control-plane machinery pins)', () => {
  it('builds the propose body on the closed authoring field set', () => {
    const body = buildProposeBody(PROPOSE_FIELDS);
    expect(body?.command).toBe('changeset.propose');
    expect(body?.payload.changesetId).toBe('cs-demo-1');
    expect(body?.payload.base).toEqual({
      kind: 'activation',
      subjectId: 'g.studio-demo',
      expectedVersion: 'av-demo-0001',
    });
    expect(body?.payload.operations).toEqual([
      { kind: 'select-activation', graphId: 'g.studio-demo', activationVersion: 'av-demo-0001' },
    ]);
    expect(body?.payload.riskClass).toBe('low');
    expect(body?.payload.requiredApproverCount).toBe(1);
    expect(body?.payload.expiresAt).toBe(1700000100000);
  });

  it('fails closed BEFORE any fetch on hostile/absent propose fields', () => {
    for (const key of Object.keys(PROPOSE_FIELDS)) {
      expect(buildProposeBody({ ...PROPOSE_FIELDS, [key]: '' })).toBeNull();
    }
    expect(buildProposeBody({ ...PROPOSE_FIELDS, changesetId: '../secret' })).toBeNull();
    expect(buildProposeBody({ ...PROPOSE_FIELDS, requiredApproverCount: '0' })).toBeNull();
    expect(buildProposeBody({ ...PROPOSE_FIELDS, requiredApproverCount: '9' })).toBeNull();
    expect(buildProposeBody({ ...PROPOSE_FIELDS, riskClass: 'catastrophic' })).toBeNull();
    expect(buildProposeBody({ ...PROPOSE_FIELDS, operationKind: 'drop-table' })).toBeNull();
    expect(buildProposeBody({ ...PROPOSE_FIELDS, baseKind: 'graph' })).toBeNull();
    expect(buildProposeBody({ ...PROPOSE_FIELDS, expiresAt: 'not-a-number' })).toBeNull();
  });

  it('builds the revise body WITHOUT changesetId (author-only; new content hash)', () => {
    const revise = buildReviseBody({ ...PROPOSE_FIELDS, rationale: 'CHANGED rationale' });
    expect(revise?.command).toBe('changeset.revise');
    expect(revise?.payload.rationale).toBe('CHANGED rationale');
    expect(Object.keys(revise?.payload ?? {})).toEqual([
      'changesetId',
      'operations',
      'rationale',
      'riskClass',
      'requiredApproverCount',
      'expiresAt',
    ]);
    // The base is NOT re-authorable on revise (the target's closed revise
    // field set excludes it; revision keeps the declared base).
    expect(Object.keys(revise?.payload ?? {})).not.toContain('base');
    expect(buildReviseBody({ ...PROPOSE_FIELDS, changesetId: '' })).toBeNull();
  });

  it('builds the decide body on the closed decision vocabulary', () => {
    expect(buildDecideBody({ changesetId: 'cs-1', decision: 'approved' })).toEqual({
      command: 'changeset.decide',
      payload: { changesetId: 'cs-1', decision: 'approved' },
    });
    expect(buildDecideBody({ changesetId: 'cs-1', decision: 'declined' })).not.toBeNull();
    expect(buildDecideBody({ changesetId: 'cs-1', decision: 'maybe' })).toBeNull();
    expect(buildDecideBody({ changesetId: '', decision: 'approved' })).toBeNull();
  });

  it('builds the commit body as exactly { changesetId }', () => {
    expect(buildCommitBody({ changesetId: 'cs-1' })).toEqual({
      command: 'changeset.commit',
      payload: { changesetId: 'cs-1' },
    });
    expect(buildCommitBody({ changesetId: '' })).toBeNull();
    expect(buildCommitBody({ changesetId: 'cs-1', extra: 'x' })).toEqual({
      command: 'changeset.commit',
      payload: { changesetId: 'cs-1' },
    });
  });

  it('builds the evidence check + attach bodies (author-run-actor binding)', () => {
    expect(buildCheckBody({ changesetId: 'cs-1', kind: 'nonsense' })).toEqual({
      command: 'changeset.execute-check',
      payload: { changesetId: 'cs-1', kind: 'validation' },
    });
    expect(
      buildAttachEvidenceBody({ changesetId: 'cs-1', runId: 'crun-9', kind: 'validation' }),
    ).toEqual({
      command: 'changeset.attach-evidence',
      payload: { changesetId: 'cs-1', kind: 'validation', runId: 'crun-9' },
    });
    expect(buildAttachEvidenceBody({ changesetId: 'cs-1', runId: '' })).toBeNull();
  });

  it('hosts truthfully bounded ids and idempotency keys only', () => {
    expect(isValidChangesetId('cs-demo-1')).toBe(true);
    expect(isValidChangesetId('../secret')).toBe(false);
    expect(isValidChangesetId('')).toBe(false);
    expect(isValidChangesetId('a'.repeat(129))).toBe(false);
    expect(isValidIdempotencyKey('idem-key-1')).toBe(true);
    expect(isValidIdempotencyKey('idem@key')).toBe(false);
    expect(isValidIdempotencyKey('')).toBe(false);
  });

  it('banners restate the stable codes truthfully (nothing invented)', () => {
    // (a) self-approval / scope denial: fail closed, no state change.
    expect(failureBannerText('VICT_ACTOR_SCOPE_DENIED')).toContain('does not hold the');
    expect(failureBannerText('VICT_ACTOR_SCOPE_DENIED')).toContain('No decision was recorded');
    // (b) changed content: approvals stop binding the current hash.
    expect(failureBannerText('VICT_CONTROL_APPROVALS_INVALIDATED')).toContain(
      'bind a CHANGED content hash',
    );
    expect(failureBannerText('VICT_CONTROL_APPROVALS_INVALIDATED')).toContain(
      'nothing was applied',
    );
    // (c) missing approval: NOT_APPROVED, no operation applied.
    expect(failureBannerText('VICT_CONTROL_CHANGESET_NOT_APPROVED')).toContain('never promoted');
    expect(failureBannerText('VICT_CONTROL_CHANGESET_NOT_APPROVED')).toContain(
      'no operation was applied',
    );
    // MACHINERY FACT (verified live against the composed control plane):
    // revise() DEMOTES an approved proposal to 'draft' with a NEW content
    // hash (control-plane.ts revise → status 'draft'), and commit() checks
    // status BEFORE the approvals-binding double-check — so the scripted
    // "changed content" commit reaches VICT_CONTROL_CHANGESET_NOT_APPROVED
    // (fail closed); VICT_CONTROL_APPROVALS_INVALIDATED is the target's
    // defense-in-depth guard and is not reachable through the current
    // public command surface via revision. The journey shows the truthful
    // NOT_APPROVED banner.
    expect(failureBannerText('VICT_CONTROL_CHANGESET_NOT_APPROVED')).toContain('never promoted');
    // Other stable codes the target can issue.
    expect(failureBannerText('VICT_CONTROL_BASE_STALE')).toContain(
      'failed closed before ANY mutation',
    );
    expect(failureBannerText('VICT_COMMAND_IDEMPOTENCY_CONFLICT')).toContain('fresh key');
    expect(failureBannerText('VICT_CONTROL_CHANGESET_MISSING')).toContain('nothing is claimed');
    expect(failureBannerText('SOME_OTHER_TARGET_CODE')).toContain('judge the outcome');
  });

  it('the commit success banner claims exactly-once and never a second effect', () => {
    const banner = commitBannerText(1, 'cs-demo-1');
    expect(banner).toContain('EXACTLY ONCE');
    expect(banner).toContain('IDEMPOTENT REPLAY');
    expect(banner).toContain('SAME receipts');
    expect(banner.toLowerCase()).not.toContain('applied again');
  });

  it('narrow parsers render only truthful record fields; unknown shapes stay empty', () => {
    const record = {
      changesetId: 'cs-demo-1',
      status: 'approved',
      contentHash: 'hash-1',
      authorActorId: 'changeset-author',
      riskClass: 'low',
      requiredApproverCount: 2,
      base: { kind: 'activation', subjectId: 'g.studio-demo', expectedVersion: 'av-1' },
      operations: [
        { kind: 'select-activation', graphId: 'g.studio-demo', activationVersion: 'av-1' },
      ],
      validation: { runId: 'crun-1', outcome: 'passed' },
      simulation: undefined,
    };
    const summary = asChangesetSummary(record);
    expect(summary?.contentHash).toBe('hash-1');
    expect(summary?.status).toBe('approved');
    expect(summary?.requiredApproverCount).toBe('2');
    expect(summary?.operations).toEqual([{ index: 0, kind: 'select-activation', subject: 'av-1' }]);
    expect(summary?.validationOutcome).toBe('passed');
    expect(summary?.simulationOutcome).toBeNull();
    expect(asChangesetSummary(null)).toBeNull();
    expect(asChangesetSummary({ contentHash: 'hash-1' })).toBeNull();

    expect(asChangesetListRows({ changesets: [record] })).toHaveLength(1);
    expect(asChangesetListRows({ changesets: undefined })).toEqual([]);
    expect(asChangesetListRows(null)).toEqual([]);

    expect(
      asDecisionOutcome({
        record,
        decision: { decision: 'approved', approverActorId: 'approver' },
      }),
    ).toEqual({
      changesetId: 'cs-demo-1',
      status: 'approved',
      contentHash: 'hash-1',
      decision: 'approved',
      approverActorId: 'approver',
    });
    expect(asDecisionOutcome({})).toBeNull();

    const committed = asCommitOutcome({
      record: { ...record, status: 'committed' },
      applied: ['select-activation'],
    });
    expect(committed?.status).toBe('committed');
    expect(committed?.appliedCount).toBe(1);
    expect(committed?.appliedKinds).toEqual(['select-activation']);
    expect(asCommitOutcome(null)).toBeNull();
    expect(asCommitOutcome({ record })).toBeNull();

    expect(asCheckRun({ run: { runId: 'crun-1', kind: 'validation', outcome: 'passed' } })).toEqual(
      {
        runId: 'crun-1',
        kind: 'validation',
        outcome: 'passed',
      },
    );
    expect(asCheckRun({ runId: 'crun-1', kind: 'validation', outcome: 'passed' })).toEqual({
      runId: 'crun-1',
      kind: 'validation',
      outcome: 'passed',
    });
    expect(asCheckRun({ runId: 'crun-1' })).toBeNull();
    expect(asCheckRun(null)).toBeNull();
  });
});

describe('changeset journey actor/target resolution (server-side, fail closed)', () => {
  it('the closed actor table exists with exactly the three journey actors', () => {
    expect(isChangesetActor('author')).toBe(true);
    expect(isChangesetActor('approver-a')).toBe(true);
    expect(isChangesetActor('approver-b')).toBe(true);
    expect(isChangesetActor('mutator')).toBe(false);
    expect(isChangesetActor('')).toBe(false);
    expect(isChangesetActor(undefined)).toBe(false);
  });

  it('resolves server-held credentials; unknown/absent targets fail closed', () => {
    const author = resolveChangesetCredential('author', 'local');
    // The credential material itself is never returned — only the server
    // projection (targetId/endpoint/label). No fetch happens here.
    expect(author?.targetId).toBe('local');
    expect(author?.endpoint).toBe('http://127.0.0.1:4310');
    expect(JSON.stringify(author)).not.toContain('token');
    expect(JSON.stringify(author)).not.toContain('vict-studio-demo');
    // Unknown target: NO fallback — fail closed.
    expect(resolveChangesetCredential('author', 'nonexistent-target')).toBeNull();
    expect(resolveChangesetCredential('author', '../secret')).toBeNull();
    // Default target binding works for every closed actor fixture grant.
    for (const actor of ['author', 'approver-a', 'approver-b']) {
      expect(resolveChangesetCredential(actor as never, undefined)?.targetId).toBe('local');
    }
    expect(resolveChangesetCredential('unknown' as never, 'local')).toBeNull();
  });
});
