import { describe, expect, it } from 'vitest';
import { isUiScenario } from '@victframework/ui';
import {
  createScenarioSession,
  decisionActor,
  decisionInput,
  SCENARIO_IDS,
  SCENARIOS,
} from '../src/lib/product/scenarios.js';
import type { ScenarioId } from '../src/lib/product/scenarios.js';

/**
 * U3-02/03/04/07 at the scenario layer: the eight frozen scenarios run
 * through the existing preview orchestration with data operations dispatching
 * through the conforming inspection adapter. Coverage labels are truthful by
 * construction; reset creates a NEW session with the SAME deterministic seed;
 * declared outcomes short-circuit before any adapter call. Domain state is
 * read through the session's OWN adapter (the session orchestrates; the
 * adapter stores).
 */

function freshSession(id: ScenarioId) {
  const { session, adapter } = createScenarioSession(id);
  const rows = async (): Promise<Record<string, unknown>[]> => {
    const result = await adapter.query(
      { op: 'list', resourceId: 'inspection' },
      { permissions: ['qlt.inspection.read'], effect: 'read', actor: 'probe' },
    );
    if (!result.ok) throw new Error(result.message);
    return result.rows as Record<string, unknown>[];
  };
  return { session, adapter, rows };
}

const rowById = async (id: ScenarioId, key: string) =>
  (await freshSessionRow(id, key)) as Record<string, unknown>;

async function freshSessionRow(
  id: ScenarioId,
  key: string,
): Promise<Record<string, unknown> | undefined> {
  const { adapter } = createScenarioSession(id);
  const result = await adapter.query(
    { op: 'get', resourceId: 'inspection', id: key },
    { permissions: ['qlt.inspection.read'], effect: 'read', actor: 'probe' },
  );
  return result.ok ? (result.row as Record<string, unknown>) : undefined;
}

describe('scenario matrix declarations (U3-02/07)', () => {
  it('all eight scenarios are valid vict.ui-scenario@1 documents with truthful approve coverage', () => {
    for (const id of SCENARIO_IDS) {
      const scenario = SCENARIOS[id];
      expect(isUiScenario(scenario), id).toBe(true);
      expect(scenario.resetBoundary, id).toBe('session');
      const approve = scenario.operations.find(
        (operation) => operation.op === 'inspection:approve',
      );
      expect(approve, id).toBeDefined();
      if (id === 'missing') {
        expect(approve?.implementation).toBe('unavailable');
      } else {
        expect(approve?.implementation).toBe('simulated');
      }
      if (id === 'latency') {
        expect(approve?.outcome?.delayMs).toBe(800);
      }
      if (id === 'failure') {
        expect(approve?.outcome?.kind).toBe('failure');
      }
      if (id === 'denied') {
        expect(approve?.outcome?.kind).toBe('denied');
      }
    }
  });

  it('the latency scenario declares the frozen 800 ms; the conflict probe uses a stale revision', () => {
    const record = { id: 'i-101', domainRevision: 3 };
    expect(decisionInput('conflict', record)).toEqual({ id: 'i-101', expectedDomainRevision: 2 });
    expect(decisionInput('normal', record)).toEqual({ id: 'i-101', expectedDomainRevision: 3 });
    expect(decisionActor('denied')).toBe('t.nguyen');
  });
});

describe('scenario execution through the conforming adapter', () => {
  it('scenario 1 (normal): approve settles OK and mutates the session domain state', async () => {
    const { session, rows } = freshSession('normal');
    const before = (await rows()).find((row) => row['id'] === 'i-101');
    const result = await session.run(
      'inspection:approve',
      decisionInput('normal', before as Record<string, unknown>),
    );
    expect(result.ok).toBe(true);
    const after = (await rows()).find((row) => row['id'] === 'i-101');
    expect(after?.['status']).toBe('approved');
    expect(Number(after?.['domainRevision'])).toBe(4);
  });

  it('scenario 5 (failure): declared failure settles FAILED; domain state unchanged', async () => {
    const { session, rows } = freshSession('failure');
    const result = await session.run('inspection:approve', {
      id: 'i-101',
      expectedDomainRevision: 3,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('SIMULATED_FAILURE');
    const after = (await rows()).find((row) => row['id'] === 'i-101');
    expect(after?.['status']).toBe('submitted');
  });

  it('scenario 6 (missing): SCENARIO_COVERAGE_MISSING denial; NO adapter call of any kind', async () => {
    let adapterCalls = 0;
    const { session, adapter } = createScenarioSession('missing');
    const original = adapter.mutate.bind(adapter);
    adapter.mutate = ((...args: Parameters<typeof adapter.mutate>) => {
      adapterCalls += 1;
      return original(...args);
    }) as typeof adapter.mutate;
    const result = await session.run('inspection:approve', {
      id: 'i-101',
      expectedDomainRevision: 3,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('SCENARIO_COVERAGE_MISSING');
      expect(result.message).toContain('nothing ran');
    }
    expect(adapterCalls).toBe(0); // the real handler was never invoked
  });

  it('scenario 7 (denied): OPERATION_DENIED for the technician; state unchanged', async () => {
    const { session, rows } = freshSession('denied');
    const result = await session.run('inspection:approve', {
      id: 'i-101',
      expectedDomainRevision: 3,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('OPERATION_DENIED');
    const after = (await rows()).find((row) => row['id'] === 'i-101');
    expect(after?.['status']).toBe('submitted');
  });

  it('scenario 8 (conflict): the adapter rejects the stale revision with DOMAIN_CONFLICT; state unchanged', async () => {
    const { session, rows } = freshSession('conflict');
    const result = await session.run(
      'inspection:approve',
      decisionInput('conflict', { id: 'i-101', domainRevision: 3 }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('DOMAIN_CONFLICT');
    const after = (await rows()).find((row) => row['id'] === 'i-101');
    expect(after?.['status']).toBe('submitted');
  });

  it('scenario 4 (latency): reset during the declared 800 ms window fences the late result', async () => {
    const { session, adapter } = createScenarioSession('latency');
    const inFlight = session.run('inspection:approve', { id: 'i-101', expectedDomainRevision: 3 });
    const next = session.reset(); // mid-flight reset: NEW session identity
    const result = await inFlight;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('SESSION_STALE');
    // The fresh session's adapter is untouched: i-101 still submitted at revision 3.
    const result2 = await adapter.query(
      { op: 'get', resourceId: 'inspection', id: 'i-101' },
      { permissions: ['qlt.inspection.read'], effect: 'read', actor: 'probe' },
    );
    if (!result2.ok) throw new Error(result2.message);
    const after = result2.row as Record<string, unknown>;
    expect(after['status']).toBe('submitted');
    expect(Number(after['domainRevision'])).toBe(3);
  });

  it('scenario 2 (empty): zero seeded rows; list settles with an empty set', async () => {
    const { session, rows } = freshSession('empty');
    const result = await session.run('inspection:list');
    if (!result.ok) throw new Error(result.message);
    expect((result.value as { rows: unknown[] }).rows).toHaveLength(0);
    expect(await rows()).toHaveLength(0);
  });

  it('scenario 3 (long): 40 seeded findings; readable data present', async () => {
    const { session, rows } = freshSession('long');
    const result = await session.run('inspection:list');
    if (!result.ok) throw new Error(result.message);
    const rowsViaSession = (result.value as { rows: Record<string, unknown>[] }).rows;
    expect(rowsViaSession).toHaveLength(1);
    expect(rowsViaSession[0]['findings']).toHaveLength(40);
    expect(String(rowsViaSession[0]['title']).length).toBeGreaterThan(100);
  });

  it('deterministic reset: a fresh session reproduces the exact seeded state', async () => {
    const first = freshSession('normal');
    await first.session.run('inspection:approve', { id: 'i-101', expectedDomainRevision: 3 });
    // The mutated session keeps its state; a FRESH session rebuilds the seed.
    const mutated = (await first.rows()).find((row) => row['id'] === 'i-101');
    expect(mutated?.['status']).toBe('approved');
    const pristine = await rowById('normal', 'i-101');
    expect(pristine?.['status']).toBe('submitted');
    expect(Number(pristine?.['domainRevision'])).toBe(3);
  });

  it('runtime enforcement: a technician actor on SIMULATED approve is denied by the adapter (DATA_UNAUTHORIZED)', async () => {
    // NOT the 'denied' scenario (whose declared outcome short-circuits) — a
    // simulated-coverage session acting as the technician, so the denial
    // comes from the adapter's runtime permission check itself.
    const { createPreviewSession } = await import('@victframework/ui-preview');
    const { SCENARIOS: scenarios, scenarioAdapterPort } =
      await import('../src/lib/product/scenarios.js');
    const { InspectionDataAdapter, seedDomain } = await import('../src/lib/product/domain.js');
    const adapter = new InspectionDataAdapter(seedDomain());
    const session = createPreviewSession({
      scenario: scenarios.normal,
      actorId: 't.nguyen',
      dataAdapter: scenarioAdapterPort(adapter),
    });
    const result = await session.run('inspection:approve', {
      id: 'i-101',
      expectedDomainRevision: 3,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('DATA_UNAUTHORIZED');
    const check = await adapter.query(
      { op: 'get', resourceId: 'inspection', id: 'i-101' },
      { permissions: ['qlt.inspection.read'], effect: 'read', actor: 'probe' },
    );
    if (!check.ok) throw new Error(check.message);
    expect((check.row as Record<string, unknown>)['status']).toBe('submitted');
  });
});
