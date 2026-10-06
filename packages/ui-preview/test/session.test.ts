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
        // The registry itself may be consulted (creation-boundary capture);
        // what must NEVER happen is an INVOCATION of the real handler.
        snapshotDoubles: () =>
          new Map([
            [
              'inspection.approve',
              async () => {
                realHandlerRan = true;
                return 'REAL HANDLER MUST NOT RUN';
              },
            ],
          ]),
      } satisfies PreviewRuntimePort,
    });
    realHandlerRan = false;
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

describe('falsification repairs (MAJOR-1 / MINOR-2)', () => {
  it('an actor with an EMPTY permission list is denied capability ops', async () => {
    const session = createPreviewSession({
      scenario: scenario({
        actors: [{ actorId: 'nobody', role: 'none', permissions: [] }],
      }),
      runtime: {
        snapshotDoubles: () => new Map([['inspection.approve', async () => 'MUST NOT RUN']]),
      } satisfies PreviewRuntimePort,
    });
    const result = await session.run('inspection.approve');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('OPERATION_DENIED');
  });

  it('a rejecting async double is a structured failure, never ok:true', async () => {
    const session = createPreviewSession({
      scenario: scenario(),
      runtime: {
        snapshotDoubles: () =>
          new Map([
            [
              'inspection.approve',
              async () => {
                throw new Error('double blew up');
              },
            ],
          ]),
      } satisfies PreviewRuntimePort,
    });
    const result = await session.run('inspection.approve');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('SIMULATED_FAILURE');
  });
});

describe('reopen-round repairs: fencing windows + snapshot immutability (U1-06)', () => {
  function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  function sessionWith(
    held: {
      promise: Promise<unknown>;
      resolve: (value: unknown) => void;
      reject: (reason?: unknown) => void;
    },
    onStale?: (info: { sessionId: string; supersededBy: string }) => void,
  ) {
    return createPreviewSession({
      scenario: scenario(),
      runtime: {
        snapshotDoubles: () =>
          new Map([
            [
              'inspection.approve',
              async () => {
                await held.promise;
                return { decided: true };
              },
            ],
          ]),
      } satisfies PreviewRuntimePort,
      ...(onStale ? { onStale } : {}),
    });
  }

  it('reset while an async double is EXECUTING fences the result after it resolves', async () => {
    const held = deferred<unknown>();
    const staleEvents: string[] = [];
    const session = sessionWith(held, (info) => staleEvents.push(info.sessionId));
    const inFlight = session.run('inspection.approve');
    // let the double start (it is now awaiting the held promise)
    await new Promise((r) => setTimeout(r, 10));
    const current = session.reset(); // new identity + token rotation
    held.resolve({ decided: true });
    const settled = await inFlight;
    // the OLD operation must NOT return ok:true from the old session
    expect(settled.ok).toBe(false);
    if (!settled.ok) expect(settled.code).toBe('SESSION_STALE');
    expect(staleEvents.length).toBe(1);
    // the CURRENT session is untouched and fully usable
    const fresh = await current.run('inspection.approve');
    expect(fresh.ok).toBe(true);
  });

  it('an async double REJECTING after a reset settles as a structured stale result', async () => {
    const held = deferred<unknown>();
    const session = sessionWith(held);
    const inFlight = session.run('inspection.approve');
    await new Promise((r) => setTimeout(r, 10));
    session.reset();
    held.reject(new Error('double blew up after reset'));
    const settled = await inFlight;
    expect(settled.ok).toBe(false);
    if (!settled.ok) expect(settled.code).toBe('SESSION_STALE');
  });

  it('reset during configured pre-invocation latency still fences (window 1 retained)', async () => {
    const session = createPreviewSession({
      scenario: scenario({
        operations: [
          {
            op: 'inspection.approve',
            implementation: 'simulated',
            outcome: { kind: 'success', delayMs: 60 },
          },
          { op: 'inspection:mutate', implementation: 'simulated', outcome: { kind: 'success' } },
        ],
      }),
      runtime: {
        snapshotDoubles: () => new Map([['inspection.approve', async () => ({ decided: true })]]),
      } satisfies PreviewRuntimePort,
    });
    const inFlight = session.run('inspection.approve');
    const current = session.reset();
    const settled = await inFlight;
    expect(settled.ok).toBe(false);
    if (!settled.ok) expect(settled.code).toBe('SESSION_STALE');
    const fresh = await current.run('inspection.approve');
    expect(fresh.ok).toBe(true);
  });

  it('registry changes during an existing session do not change its implementation', async () => {
    let registered = new Map([['inspection.approve', async () => ({ impl: 'original' })]]);
    const runtime = { snapshotDoubles: () => registered } satisfies PreviewRuntimePort;
    const session = createPreviewSession({ scenario: scenario(), runtime });
    // the registry is swapped AFTER the session was created
    registered = new Map([['inspection.approve', async () => ({ impl: 'swapped' })]]);
    const result = await session.run<{ impl: string }>('inspection.approve');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value['impl']).toBe('original');
  });

  it('reset after a registry change captures the NEW implementation', async () => {
    let registered = new Map([['inspection.approve', async () => ({ impl: 'original' })]]);
    const runtime = { snapshotDoubles: () => registered } satisfies PreviewRuntimePort;
    const session = createPreviewSession({ scenario: scenario(), runtime });
    registered = new Map([['inspection.approve', async () => ({ impl: 'swapped' })]]);
    const next = session.reset();
    const result = await next.run<{ impl: string }>('inspection.approve');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value['impl']).toBe('swapped');
  });
});
