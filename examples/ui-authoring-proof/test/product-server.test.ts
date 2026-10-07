import { describe, expect, it } from 'vitest';
import { getProductServer, scenarioSeed, SCENARIO_IDS } from '../src/lib/server/inspection.js';

/**
 * The server-hosted product singleton: journey coherence across pages
 * (queue → decision → queue refresh), deterministic scenario reseeding, and
 * in-flight fencing on reset (U3-02/U3-04 at the product boundary).
 */

const supervisor = { role: 'supervisor', actorId: 's.hart' };
const technician = { role: 'technician', actorId: 't.nguyen' };

describe('product server singleton', () => {
  it('decisions persist across "navigation" within the process (queue refresh coherence)', async () => {
    const product = getProductServer();
    product.reset('normal');
    const list = await product.dispatch('inspection.list', {}, supervisor);
    expect(list.ok).toBe(true);
    const rows = (list.value as { rows: Record<string, unknown>[] }).rows;
    expect(rows).toHaveLength(3);
    const approved = await product.dispatch(
      'inspection.approve',
      { id: 'i-101', expectedDomainRevision: 3 },
      supervisor,
    );
    expect(approved.ok).toBe(true);
    // A FRESH list call (what the queue load does) sees the decision.
    const refreshed = await product.dispatch('inspection.list', {}, supervisor);
    const row = (refreshed.value as { rows: Record<string, unknown>[] }).rows.find(
      (candidate) => candidate['id'] === 'i-101',
    );
    expect(row?.['status']).toBe('approved');
  });

  it('scenario reset is deterministic: the same seed rebuilds the same state', async () => {
    const product = getProductServer();
    product.reset('empty');
    const empty = await product.dispatch('inspection.list', {}, supervisor);
    expect((empty.value as { rows: unknown[] }).rows).toHaveLength(0);
    product.reset('long');
    const long = await product.dispatch('inspection.list', {}, supervisor);
    const longRows = (long.value as { rows: Record<string, unknown>[] }).rows;
    expect(longRows).toHaveLength(1);
    expect(longRows[0]['findings']).toHaveLength(40);
    expect(String(longRows[0]['title']).length).toBeGreaterThan(100);
    product.reset('normal');
    const normal = await product.dispatch('inspection.list', {}, supervisor);
    expect((normal.value as { rows: Record<string, unknown>[] }).rows).toHaveLength(3);
    // Same seed → identical bytes.
    product.reset('normal');
    const again = await product.dispatch('inspection.list', {}, supervisor);
    expect(again.value).toEqual(normal.value);
  });

  it('a scenario reset fences an in-flight dispatch as SESSION_STALE; state belongs to the new session', async () => {
    const product = getProductServer();
    product.reset('normal');
    const inFlight = product.dispatch(
      'inspection.approve',
      { id: 'i-101', expectedDomainRevision: 3 },
      supervisor,
    );
    // Reset WHILE the dispatch is in flight (the dispatch awaits internal
    // microtasks, so this synchronous reset lands first).
    product.reset('normal');
    const result = await inFlight;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('SESSION_STALE');
    // The fresh session is untouched and usable.
    const after = await product.dispatch('inspection.list', {}, supervisor);
    const row = (after.value as { rows: Record<string, unknown>[] }).rows.find(
      (candidate) => candidate['id'] === 'i-101',
    );
    expect(row?.['status']).toBe('submitted');
    expect(row?.['domainRevision']).toBe(3);
  });

  it('every declared scenario id has a deterministic seed', () => {
    for (const id of SCENARIO_IDS) {
      const first = scenarioSeed(id);
      const second = scenarioSeed(id);
      expect(JSON.stringify(first)).toEqual(JSON.stringify(second));
    }
  });
});
