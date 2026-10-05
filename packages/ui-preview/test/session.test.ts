import { describe, expect, it } from 'vitest';
import { createPreviewSession, type PreviewRuntimePort } from '../src/session.js';
import type { UiScenario } from '@victframework/ui';

function scenario(overrides: Partial<UiScenario> = {}): UiScenario {
  return {
    schema: 'vict.ui-scenario@1',
    scenarioId: 'scn.normal',
    references: {
      application: { id: 'app.inspection', revision: '1' },
      documents: { 'doc.detail': '1' },
    },
    seeds: {
      domain: {
        rows: {
          inspection: [
            { id: 'i-1', title: 'A', status: 'submitted', domainRevision: 3 },
            { id: 'i-2', title: 'B', status: 'submitted', domainRevision: 1 },
          ],
        },
      },
    },
    actors: [
      {
        actorId: 'supervisor',
        role: 'supervisor',
        permissions: ['qlt.inspection.approve', 'qlt.inspection.read'],
      },
      {
        actorId: 'technician',
        role: 'technician',
        permissions: ['qlt.inspection.submit', 'qlt.inspection.read'],
      },
    ],
    operations: [
      { op: 'inspection.approve', implementation: 'simulated', outcome: { kind: 'success' } },
      { op: 'inspection:list', implementation: 'simulated', outcome: { kind: 'rows' } },
      { op: 'inspection:mutate', implementation: 'simulated', outcome: { kind: 'success' } },
    ],
    resetBoundary: 'session',
    ...overrides,
  };
}

describe('PreviewSession isolation (U1-06)', () => {
  it('denies a missing required double with SCENARIO_COVERAGE_MISSING and no real-handler effect', async () => {
    let realHandlerRan = false;
    const session = createPreviewSession({
      scenario: scenario({
        operations: [{ op: 'inspection.approve', implementation: 'unavailable' }],
      }),
      runtime: {
        snapshotDoubles: () => {
          realHandlerRan = true;
          return new Map([['inspection.approve', async () => 'REAL HANDLER MUST NOT RUN']]);
        },
      } satisfies PreviewRuntimePort,
    });
    const result = await session.run('inspection.approve');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('SCENARIO_COVERAGE_MISSING');
    expect(realHandlerRan).toBe(false);
    expect(session.coverage.some((entry) => !entry.available)).toBe(true);
  });

  it('denies an undeclared operation without invoking anything', async () => {
    const session = createPreviewSession({ scenario: scenario() });
    const result = await session.run('inspection.reject');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('SCENARIO_COVERAGE_MISSING');
  });

  it('fences a reset during latency: old results become SESSION_STALE', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let session = createPreviewSession({
      scenario: scenario({
        operations: [
          {
            op: 'inspection.approve',
            implementation: 'simulated',
            outcome: { kind: 'success', delayMs: 5 },
          },
        ],
      }),
      runtime: {
        snapshotDoubles: () => new Map([['inspection.approve', async () => ({ decided: true })]]),
      } satisfies PreviewRuntimePort,
      delay: () => gate,
    });
    const oldSessionId = session.id;
    const inFlight = session.run('inspection.approve');
    session = session.reset();
    release();
    const result = await inFlight;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('SESSION_STALE');
      expect(result.sessionId).toBe(oldSessionId);
    }
    // the NEW session works with fresh identity
    const fresh = await session.run('inspection.approve');
    expect(fresh.ok).toBe(true);
    if (fresh.ok) expect(fresh.sessionId).toBe(session.id);
  });

  it('resets seeds coherently: mutations revert to the declared seed state', async () => {
    let session = createPreviewSession({ scenario: scenario() });
    await session.run('inspection:mutate', { id: 'i-1', input: { status: 'approved' } });
    expect(session.rows('inspection')[0]?.status).toBe('approved');
    session = session.reset();
    expect(session.rows('inspection')[0]?.status).toBe('submitted');
    expect(session.rows('inspection')[0]?.domainRevision).toBe(3);
  });

  it('stale decisions produce DOMAIN_CONFLICT and leave state unchanged', async () => {
    const session = createPreviewSession({ scenario: scenario() });
    const conflict = await session.run('inspection:mutate', {
      id: 'i-1',
      expectedDomainRevision: 2,
      input: { status: 'approved' },
    });
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) expect(conflict.code).toBe('DOMAIN_CONFLICT');
    expect(session.rows('inspection')[0]?.status).toBe('submitted');
  });

  it('permission denial leaves state unchanged (OPERATION_DENIED)', async () => {
    const session = createPreviewSession({ scenario: scenario(), actorId: 'technician' });
    const denied = await session.run('inspection.approve');
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.code).toBe('OPERATION_DENIED');
    expect(session.rows('inspection')[0]?.status).toBe('submitted');
  });
});
