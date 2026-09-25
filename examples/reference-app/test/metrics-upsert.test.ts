import { describe, expect, it } from 'vitest';
import {
  createInMemoryApplicationData,
  type ApplicationDataAdapter,
} from '@victframework/application';
import { dataContracts, resources } from '$lib/application/definition.js';
import { createReferenceServer } from '$lib/server/application-server';

/**
 * Permanent negative evidence for the metrics upsert repair (P1 host-a,
 * corrected-integrated): the `metrics` resource declares create/update
 * with NO keyed idempotency, and the application-data adapter REJECTS any
 * idempotency key on a non-keyed mutation (DATA_INVALID_REQUEST). The
 * pre-repair upsert carried `idempotencyKey: 'metric:<id>'` on create and
 * never checked the result — so every metrics create was rejected and the
 * failure was swallowed (no metric ever persisted). These tests establish
 * that the repair respects the DECLARED mutation idempotency and failure
 * behavior, on the adapter's shared validation layer (both the in-memory
 * and SQLite adapters validate through the same rules).
 */

const SEED_PROJECTS: Record<string, unknown>[] = [
  { id: 'alpha-1', name: 'Alpha', status: 'active', budget: 100, owner: 'Ada', notes: 'first' },
];

function makeData(): ApplicationDataAdapter {
  return createInMemoryApplicationData(resources, {
    contracts: dataContracts,
    seeds: { projects: SEED_PROJECTS },
  });
}

// Resource-level authorization requires metrics.read for ANY access;
// the write mutations additionally require metrics.write.
const writeCtx = { permissions: ['metrics.read', 'metrics.write'], effect: 'write' as const };
const readCtx = { permissions: ['metrics.read'], effect: 'read' as const };

async function metricRows(data: ApplicationDataAdapter): Promise<Record<string, unknown>[]> {
  const result = await data.query({ op: 'list', resourceId: 'metrics' }, readCtx);
  expect(result.ok).toBe(true);
  return (result.rows ?? []) as Record<string, unknown>[];
}

describe('metrics upsert: declared idempotency and failure behavior (negative controls)', () => {
  it('NEGATIVE: the adapter rejects an idempotency key on the non-keyed metrics create', async () => {
    const data = makeData();
    const rejected = await data.mutate(
      {
        resourceId: 'metrics',
        op: 'create',
        input: { id: 'm-1', label: 'M', value: 'v' },
        idempotencyKey: 'metric:m-1',
      },
      writeCtx,
    );
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.code).toBe('DATA_INVALID_REQUEST');
    }
    // Nothing was created by the rejected request.
    expect(await metricRows(data)).toHaveLength(0);
  });

  it('NEGATIVE: the pre-repair upsert (key on create) could never persist a metric', async () => {
    // Replays the pre-repair sequence exactly: keyed create (rejected,
    // result unchecked) — then proves the store holds no row. This is the
    // failure mode the repair removed.
    const data = makeData();
    await data.mutate(
      {
        resourceId: 'metrics',
        op: 'create',
        input: { id: 'rt-alpha-1', label: 'Reading time — Alpha', value: '1 min (1 words)' },
        idempotencyKey: 'metric:rt-alpha-1',
      },
      writeCtx,
    );
    expect(await metricRows(data)).toHaveLength(0);
  });

  it('the repaired upsert persists on create and updates in place on repeat (no duplicates)', async () => {
    const { server, data } = (() => {
      const data = makeData();
      return { server: createReferenceServer({ data }), data };
    })();
    try {
      // First estimate: creates the metrics rows through the repaired
      // keyless get→update/else→create upsert.
      const first = await server.dispatch('act.noteReadingTime');
      expect(first.ok).toBe(true);
      const afterFirst = await metricRows(data);
      expect(afterFirst).toHaveLength(1);
      expect(afterFirst[0]).toMatchObject({ id: 'rt-alpha-1', value: '1 min (1 words)' });

      // Second estimate for the SAME record: the upsert must UPDATE the
      // existing row — never create a duplicate (the metrics mutation
      // declares no keyed idempotency, so the upsert is the dedup
      // mechanism).
      const second = await server.dispatch('act.noteReadingTime');
      expect(second.ok).toBe(true);
      const afterSecond = await metricRows(data);
      expect(afterSecond).toHaveLength(1);
      expect(afterSecond[0]).toMatchObject({ id: 'rt-alpha-1', value: '1 min (1 words)' });
    } finally {
      server.close();
    }
  });

  it('the upsert update path replaces the value in place (row identity stable, no duplicates)', async () => {
    // The metrics upsert's update branch relies on the declared update
    // mutation replacing the value of the EXISTING row. The projects'
    // notes field is seed-only in this application (the declared project
    // input contract carries id/name/status/budget), so the value change
    // is exercised directly against the same declared mutation the upsert
    // calls.
    const data = makeData();
    const created = await data.mutate(
      {
        resourceId: 'metrics',
        op: 'create',
        input: { id: 'rt-alpha-1', label: 'Reading time — Alpha', value: '1 min (1 words)' },
      },
      writeCtx,
    );
    expect(created.ok).toBe(true);
    const updated = await data.mutate(
      {
        resourceId: 'metrics',
        op: 'update',
        id: 'rt-alpha-1',
        input: { id: 'rt-alpha-1', label: 'Reading time — Alpha', value: '2 min (250 words)' },
      },
      writeCtx,
    );
    expect(updated.ok).toBe(true);
    const rows = await metricRows(data);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 'rt-alpha-1', value: '2 min (250 words)' });
  });

  it('update on a nonexistent id fails with a structured, surfaced error (no silent swallow)', async () => {
    const data = makeData();
    const result = await data.mutate(
      {
        resourceId: 'metrics',
        op: 'update',
        id: 'missing',
        input: { id: 'missing', label: 'M', value: 'v' },
      },
      writeCtx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('DATA_UNKNOWN_IDENTITY');
    }
  });
});
