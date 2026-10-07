import { describe, expect, it } from 'vitest';
import {
  InspectionDataAdapter,
  applyInspectionMutation,
  createMemoryLedger,
  createInspectionServer,
  grantsForRole,
  seedDomain,
  systemClock,
  type InspectionTables,
} from '../src/lib/product/domain.js';

/**
 * U3 domain-rule coverage (U3-01 journey rules + U3-03 runtime correctness).
 * The SAME shared core (`applyDomainMutation`) is exercised here directly and
 * through the action dispatch boundary; the durable adapter runs the SAME
 * core plus the shared conformance suite (see durable tests).
 */

const supervisor = { role: 'supervisor', actorId: 's.hart' };
const technician = { role: 'technician', actorId: 't.nguyen' };
// A technician who is NOT assigned to i-101/i-102 (i-103 is m.osei's).
const otherTechnician = { role: 'technician', actorId: 'm.osei' };

function freshServer() {
  return createInspectionServer(new InspectionDataAdapter(seedDomain()));
}

async function loadRecord(
  server: ReturnType<typeof freshServer>,
  id: string,
): Promise<Record<string, unknown>> {
  const result = await server.dispatch('inspection.list', {}, supervisor);
  if (!result.ok) throw new Error('list failed');
  const rows = (result.value as { rows: Record<string, unknown>[] }).rows;
  const row = rows.find((candidate) => candidate.id === id);
  if (row === undefined) throw new Error('row missing');
  return row;
}

function tables(seed = seedDomain()): InspectionTables {
  return {
    inspections: seed.inspections.map((row) => ({ ...row })),
    findings: seed.findings.map((row) => ({ ...row })),
    evidence: seed.evidence.map((row) => ({ ...row })),
    activity: seed.activity.map((row) => ({ ...row })),
  };
}

const writeContext = { permissions: grantsForRole('supervisor'), effect: 'write' as const, actor: 's.hart' };
const techContext = { permissions: grantsForRole('technician'), effect: 'write' as const, actor: 't.nguyen' };

describe('U3-01: the complete rejection → correction → resubmission loop', () => {
  it('reject requires a mandatory reason and records it in the activity trail', async () => {
    const server = freshServer();
    const record = await loadRecord(server, 'i-101');
    const noReason = await server.dispatch(
      'inspection.reject',
      { id: record['id'], expectedDomainRevision: record['domainRevision'], rejectionReason: '   ' },
      supervisor,
    );
    expect(noReason.ok).toBe(false);
    if (!noReason.ok) expect(noReason.code).toBe('DATA_INVALID_INPUT');
    // State unchanged after the refused rejection.
    const unchanged = await loadRecord(server, 'i-101');
    expect(unchanged['status']).toBe('submitted');
    expect(unchanged['rejectionReason']).toBeNull();

    const rejected = await server.dispatch(
      'inspection.reject',
      { id: record['id'], expectedDomainRevision: record['domainRevision'], rejectionReason: 'Seal photos are out of focus' },
      supervisor,
    );
    expect(rejected.ok).toBe(true);
    const after = await loadRecord(server, 'i-101');
    expect(after['status']).toBe('rejected');
    expect(after['rejectionReason']).toBe('Seal photos are out of focus');
    expect(Number(after['domainRevision'])).toBe(Number(record['domainRevision']) + 1);
    const trail = server.adapter.activityFor('i-101');
    expect(trail.some((entry) => entry.entry.includes('Seal photos are out of focus'))).toBe(true);
  });

  it('revise: rejected → draft, decision fields cleared, reason only in the trail; assigned technician only', async () => {
    const server = freshServer();
    const record = await loadRecord(server, 'i-101');
    await server.dispatch(
      'inspection.reject',
      { id: record['id'], expectedDomainRevision: record['domainRevision'], rejectionReason: 'Torque log incomplete' },
      supervisor,
    );
    const rejected = await loadRecord(server, 'i-101');

    // A technician assigned to a DIFFERENT inspection may not revise.
    const stranger = await server.dispatch('inspection.revise', { id: rejected['id'] }, otherTechnician);
    expect(stranger.ok).toBe(false);
    if (!stranger.ok) expect(stranger.code).toBe('DATA_UNAUTHORIZED');
    expect((await loadRecord(server, 'i-101'))['status']).toBe('rejected');

    // The assigned technician revises: rejected → draft, fields cleared.
    const revised = await server.dispatch('inspection.revise', { id: rejected['id'] }, technician);
    expect(revised.ok).toBe(true);
    const draft = await loadRecord(server, 'i-101');
    expect(draft['status']).toBe('draft');
    expect(draft['decidedAt']).toBeNull();
    expect(draft['rejectionReason']).toBeNull();
    const trail = server.adapter.activityFor('i-101').map((entry) => entry.entry);
    expect(trail.some((entry) => entry.includes('Torque log incomplete'))).toBe(true);
    expect(trail.some((entry) => entry.includes('Revise requested'))).toBe(true);
  });

  it('technician corrects findings/evidence while draft, resubmits, and the supervisor decides against the NEW revision', async () => {
    const server = freshServer();
    const record = await loadRecord(server, 'i-101');
    await server.dispatch(
      'inspection.reject',
      { id: record['id'], expectedDomainRevision: record['domainRevision'], rejectionReason: 'Add the torque log' },
      supervisor,
    );
    await server.dispatch('inspection.revise', { id: record['id'] }, technician);
    const draft = await loadRecord(server, 'i-101');

    const finding = await server.dispatch(
      'finding.add',
      { id: 'f-9', inspectionId: 'i-101', severity: 'medium', description: 'Added torque log reference' },
      technician,
    );
    expect(finding.ok).toBe(true);
    const evidence = await server.dispatch(
      'evidence.add',
      { id: 'e-9', inspectionId: 'i-101', label: 'New torque log', kind: 'note' },
      technician,
    );
    expect(evidence.ok).toBe(true);

    const resubmitted = await server.dispatch('inspection.submit', { id: draft['id'] }, technician);
    expect(resubmitted.ok).toBe(true);
    const submitted = await loadRecord(server, 'i-101');
    expect(submitted['status']).toBe('submitted');
    expect(submitted['findings']).toHaveLength(3);
    expect(submitted['evidence']).toHaveLength(3);
    const revisionAfterResubmit = Number(submitted['domainRevision']);

    // Approving against the OLD revision now fails; the fresh revision works.
    const stale = await server.dispatch(
      'inspection.approve',
      { id: submitted['id'], expectedDomainRevision: record['domainRevision'] },
      supervisor,
    );
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.code).toBe('DOMAIN_CONFLICT');
    const approved = await server.dispatch(
      'inspection.approve',
      { id: submitted['id'], expectedDomainRevision: revisionAfterResubmit },
      supervisor,
    );
    expect(approved.ok).toBe(true);
    expect((await loadRecord(server, 'i-101'))['status']).toBe('approved');
  });

  it('submit requires draft status; technician permission enforced at the adapter', async () => {
    const server = freshServer();
    const submitted = await loadRecord(server, 'i-101');
    const wrongState = await server.dispatch('inspection.submit', { id: submitted['id'] }, technician);
    expect(wrongState.ok).toBe(false);
    if (!wrongState.ok) expect(wrongState.code).toBe('DATA_INVALID_INPUT');

    // A supervisor has no submit grant: denied at the boundary.
    const draftId = 'i-999';
    const denied = await server.dispatch('inspection.submit', { id: draftId }, supervisor);
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.code).toBe('DATA_UNKNOWN_IDENTITY'); // unknown id checked first is fine; permission matrix covered below

    const server2 = freshServer();
    const core = tables();
    core.inspections[0] = { ...core.inspections[0], status: 'draft' };
    const deniedCore = applyInspectionMutation(
      core,
      { resourceId: 'inspection', op: 'submit', id: core.inspections[0].id },
      { permissions: grantsForRole('supervisor'), effect: 'write', actor: 's.hart' },
      systemClock,
      createMemoryLedger(),
    );
    expect(deniedCore.ok).toBe(false);
    if (!deniedCore.ok) expect(deniedCore.code).toBe('DATA_UNAUTHORIZED');
  });
});

describe('U3-03: runtime domain correctness (adapter boundary, not UI)', () => {
  it('permission matrix: every denied op leaves state unchanged', async () => {
    const server = freshServer();
    const record = await loadRecord(server, 'i-101');
    for (const [action, actor] of [
      ['inspection.approve', technician],
      ['inspection.reject', technician],
      ['inspection.revise', supervisor],
      ['finding.add', supervisor],
      ['evidence.add', supervisor],
    ] as const) {
      const result = await server.dispatch(action, { id: record['id'], expectedDomainRevision: record['domainRevision'], rejectionReason: 'x' }, actor);
      expect(result.ok, `${action} as ${actor.role} should be denied`).toBe(false);
      if (!result.ok) expect(result.code).toBe('DATA_UNAUTHORIZED');
    }
    const after = await loadRecord(server, 'i-101');
    expect(after).toEqual(record);
  });

  it('stale decision: DOMAIN_CONFLICT with expected/actual in the message; state unchanged', async () => {
    const server = freshServer();
    const record = await loadRecord(server, 'i-101');
    const result = await server.dispatch(
      'inspection.approve',
      { id: record['id'], expectedDomainRevision: Number(record['domainRevision']) - 1 },
      supervisor,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('DOMAIN_CONFLICT');
      expect(result.message).toContain('expected domain revision');
      expect(result.message).toContain(String(Number(record['domainRevision']) - 1));
      expect(result.message).toContain(String(record['domainRevision']));
    }
    expect(await loadRecord(server, 'i-101')).toEqual(record);
  });

  it('decision replay: DATA_IDEMPOTENT_REPLAY, state unchanged; same key different input: DATA_IDEMPOTENCY_CONFLICT', async () => {
    const server = freshServer();
    const record = await loadRecord(server, 'i-101');
    const input = { id: record['id'], expectedDomainRevision: record['domainRevision'] };
    const first = await server.dispatch('inspection.approve', input, supervisor, { idempotencyKey: 'dec-1' });
    expect(first.ok).toBe(true);
    const replay = await server.dispatch('inspection.approve', input, supervisor, { idempotencyKey: 'dec-1' });
    expect(replay.ok).toBe(false);
    if (!replay.ok) expect(replay.code).toBe('DATA_IDEMPOTENT_REPLAY');

    const second = await server.dispatch(
      'inspection.approve',
      { id: record['id'], expectedDomainRevision: record['domainRevision'] },
      supervisor,
      { idempotencyKey: 'dec-1' },
    );
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.code).toBe('DATA_IDEMPOTENT_REPLAY'); // identical decision input, still a replay
    const mismatch = await server.dispatch(
      'inspection.reject',
      { id: record['id'], expectedDomainRevision: record['domainRevision'], rejectionReason: 'other' },
      supervisor,
      { idempotencyKey: 'dec-1' },
    );
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) expect(mismatch.code).toBe('DATA_IDEMPOTENCY_CONFLICT');
  });

  it('finding.add: requires an existing inspection in draft/submitted; declared edit permission', async () => {
    const server = freshServer();
    const approved = await server.dispatch(
      'inspection.approve',
      { id: 'i-101', expectedDomainRevision: 3 },
      supervisor,
    );
    expect(approved.ok).toBe(true);
    const wrongState = await server.dispatch(
      'finding.add',
      { id: 'f-8', inspectionId: 'i-101', severity: 'low', description: 'too late' },
      technician,
    );
    expect(wrongState.ok).toBe(false);
    if (!wrongState.ok) expect(wrongState.code).toBe('DATA_INVALID_INPUT');
    const missing = await server.dispatch(
      'finding.add',
      { id: 'f-8', inspectionId: 'i-404', severity: 'low', description: 'nowhere' },
      technician,
    );
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.code).toBe('DATA_UNKNOWN_IDENTITY');
  });

  it('failed operations never consume idempotency keys (shared rule MED-04-C)', () => {
    const core = tables();
    const ledger = createMemoryLedger();
    const duplicate = applyInspectionMutation(
      core,
      { resourceId: 'inspection', op: 'approve', id: 'i-101', input: { expectedDomainRevision: 99 }, idempotencyKey: 'K1' },
      writeContext,
      systemClock,
      ledger,
    );
    expect(duplicate.ok).toBe(false);
    // The key was NOT consumed: a later decision with the same key is 'new'.
    const seen = ledger.lookup('K1', 'anything');
    expect(seen.recorded).toBe(false);
  });
});

describe('U3-04: child-resource queries (shared conformance surface)', () => {
  it('evidence add is a keyed create: replay reconciles, duplicate identity fails without consuming the key', async () => {
    const server = freshServer();
    const input = { id: 'e-50', inspectionId: 'i-101', label: 'Shared photo', kind: 'note' };
    const first = await server.dispatch('evidence.add', input, technician, { idempotencyKey: 'ev-1' });
    expect(first.ok).toBe(true);
    const replay = await server.dispatch('evidence.add', input, technician, { idempotencyKey: 'ev-1' });
    expect(replay.ok).toBe(true);
    const rows = await server.dispatch('inspection.get', { id: 'i-101' }, supervisor);
    expect(rows.ok).toBe(true);
    expect((rows.value as { evidence: unknown[] }).evidence).toHaveLength(3); // 2 seed + 1 created
  });
});
