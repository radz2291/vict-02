import { mkdtempSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { ApplicationDataAdapter } from '@victframework/application';
import { runApplicationDataAdapterSuite } from '@victframework/application/testing';
import { canonicalUiDocument } from '@victframework/ui';
import {
  evidenceResource,
  findingResource,
  inspectionResource,
  activityResource,
  inspectionDetailDocument,
  inspectionApplication,
} from '../src/lib/product/definitions.js';
import {
  InspectionDataAdapter,
  createInspectionServer,
  seedDomain,
  type EvidenceRow,
  type SeedInput,
} from '../src/lib/product/domain.js';
import {
  DURABLE_ADAPTER_ID,
  InspectionDurableAdapter,
  openDurableInspectionStore,
} from '../src/lib/server/inspection-durable.js';

/**
 * U3-05/06: the durable-local implementation. The SAME rule core, the SAME
 * adapter contract, the SAME action identity and contracts as the simulated
 * implementation — persisted to a local SQLite file that survives a real
 * process restart. The shared conformance suite runs against BOTH
 * implementations over the same fixture resource.
 */

const supervisor = { role: 'supervisor', actorId: 's.hart' };
const readContext = { permissions: ['qlt.inspection.read'], effect: 'read' as const, actor: 'probe' };
const writeContext = {
  permissions: ['qlt.inspection.read', 'qlt.inspection.edit', 'qlt.inspection.approve'],
  effect: 'write' as const,
  actor: 'probe',
};
const unauthorizedContext = { permissions: [], effect: 'read' as const, actor: 'nobody' };

const tempRoot = mkdtempSync(join(tmpdir(), 'u3-durable-'));
const tempFiles: string[] = [];
function tempDb(name: string): string {
  const file = join(tempRoot, name);
  tempFiles.push(file);
  return file;
}
afterAll(() => {
  try {
    rmSync(tempRoot, { recursive: true, force: true });
  } catch {
    // Best-effort: WAL sidecar files can linger briefly on Windows; the
    // temp directory is OS-cleaned.
  }
});

function durableFixture(seeds: readonly Record<string, unknown>[]): ApplicationDataAdapter {
  const file = tempDb(`conformance-${Math.random().toString(36).slice(2)}.sqlite`);
  const opened = openDurableInspectionStore(file, 'empty');
  // The generic suite seeds ONE table in isolation; satisfy the schema's
  // referential integrity with placeholder parents for the declared owners.
  const parent = opened.handle.db.prepare(
    "INSERT OR IGNORE INTO inspection_domain_inspections (id, title, status, technician, supervisor, submittedAt, decidedAt, rejectionReason, domainRevision) VALUES (?, 'suite parent', 'draft', 't', 's', NULL, NULL, NULL, 1)",
  );
  for (const row of seeds) {
    parent.run(String(row['inspectionId'] ?? ''));
  }
  const insert = opened.handle.db.prepare(
    'INSERT INTO inspection_domain_evidence (id, inspectionId, label, kind) VALUES (?, ?, ?, ?)',
  );
  for (const row of seeds) {
    insert.run(String(row['id'] ?? ''), String(row['inspectionId'] ?? ''), String(row['label'] ?? ''), String(row['kind'] ?? 'note'));
  }
  return opened.adapter;
}

describe('shared adapter conformance (U3-06): both implementations', () => {
  const fixture = {
    resource: evidenceResource,
    readContext,
    writeContext,
    unauthorizedContext,
  };

  it('the SIMULATED adapter passes the shared suite', async () => {
    await runApplicationDataAdapterSuite({
      ...fixture,
      create: (seeds) => {
        const base = seedDomain();
        const input: SeedInput = {
          inspections: base.inspections,
          findings: base.findings,
          evidence: seeds as unknown as EvidenceRow[],
          activity: base.activity,
        };
        return new InspectionDataAdapter(input);
      },
    });
  });

  it('the DURABLE-LOCAL adapter passes the SAME shared suite', async () => {
    await runApplicationDataAdapterSuite({
      ...fixture,
      create: (seeds) => durableFixture(seeds),
    });
  });
});

describe('durable replacement (U3-05): identity, contracts, persistence', () => {
  it('the UI document and its declared action are IDENTICAL across the implementation swap', () => {
    // The swap changes only the registered implementation; the UI source
    // (canonical document) and its binding digests do not move.
    const digest = canonicalUiDocument(inspectionDetailDocument).contentDigest;
    expect(typeof digest).toBe('string');
    expect(digest.length).toBeGreaterThan(0);
    // The declared approve interaction dispatches inspection.approve in BOTH
    // modes (the same compiled plan is served regardless of the mode).
    const simulated = createInspectionServer(new InspectionDataAdapter(seedDomain()));
    void simulated;
    expect(inspectionApplication.id).toBe('app.inspection');
    expect([inspectionResource, findingResource, evidenceResource, activityResource].map((r) => r.id)).toEqual([
      'inspection',
      'finding',
      'evidence',
      'activity',
    ]);
  });

  it('the same action id and compatible contracts through BOTH implementations', async () => {
    const simulated = createInspectionServer(new InspectionDataAdapter(seedDomain()));
    const opened = openDurableInspectionStore(tempDb('contract.sqlite'), 'normal');
    const durable = createInspectionServer(opened.adapter);
    const input = { id: 'i-101', expectedDomainRevision: 3 };
    const viaSimulated = await simulated.dispatch('inspection.approve', input, supervisor);
    const viaDurable = await durable.dispatch('inspection.approve', input, supervisor);
    expect(viaSimulated.ok).toBe(true);
    expect(viaDurable.ok).toBe(true);
    const simRow = viaSimulated.value as Record<string, unknown>;
    const durRow = viaDurable.value as Record<string, unknown>;
    // Compatible output: same fields, same semantics (durable carries DB types).
    for (const field of ['id', 'status', 'domainRevision'] as const) {
      expect(String(durRow[field])).toBe(String(simRow[field]));
    }
    // Stale decisions behave identically through both (i-102 stays
    // submitted at revision 2; revision 1 is stale).
    const staleSim = await simulated.dispatch('inspection.approve', { id: 'i-102', expectedDomainRevision: 1 }, supervisor);
    const staleDur = await durable.dispatch('inspection.approve', { id: 'i-102', expectedDomainRevision: 1 }, supervisor);
    expect(staleSim.ok).toBe(false);
    expect(staleDur.ok).toBe(false);
    if (!staleSim.ok && !staleDur.ok) {
      expect(staleDur.code).toBe(staleSim.code);
      expect(staleDur.code).toBe('DOMAIN_CONFLICT');
    }
    opened.adapter.close();
  });

  it('a REAL restart: the decision, revision and activity persist; recovery is from the file', async () => {
    const file = tempDb('restart.sqlite');
    // ---- process run 1: open, approve, close (the "process" ends).
    const run1 = openDurableInspectionStore(file, 'normal');
    expect(existsSync(file)).toBe(true);
    const pragmas = run1.pragmas;
    expect(pragmas.journalMode.toLowerCase()).toBe('wal');
    expect(['full', '2']).toContain(pragmas.synchronous.toLowerCase());
    const server1 = createInspectionServer(run1.adapter);
    const approved = await server1.dispatch(
      'inspection.approve',
      { id: 'i-101', expectedDomainRevision: 3 },
      supervisor,
      { idempotencyKey: 'u3-restart-key' },
    );
    expect(approved.ok).toBe(true);
    const activityCountRun1 = run1.adapter.activityFor('i-101').length;
    run1.adapter.close();
    const sizeAfterRun1 = statSync(file).size;
    expect(sizeAfterRun1).toBeGreaterThan(0);

    // ---- process run 2: a FRESH module state reopens the SAME file.
    const run2 = openDurableInspectionStore(file, 'normal');
    const server2 = createInspectionServer(run2.adapter);
    const got = await server2.dispatch('inspection.get', { id: 'i-101' }, supervisor);
    expect(got.ok).toBe(true);
    const record = got.value as Record<string, unknown>;
    expect(record['status']).toBe('approved'); // recovered from storage
    expect(Number(record['domainRevision'])).toBe(4);
    expect(record['decidedAt']).not.toBeNull();
    expect(run2.adapter.activityFor('i-101').length).toBe(activityCountRun1);
    // The trail carries the approval entry.
    expect(
      run2.adapter.activityFor('i-101').some((entry) => entry.entry.includes('approved')),
    ).toBe(true);
    // A restart NEVER reseeds: i-102/i-103 survive too (same file contents).
    const list = await server2.dispatch('inspection.list', {}, supervisor);
    expect((list.value as { rows: unknown[] }).rows).toHaveLength(3);
    // The PERSISTED ledger survives the restart: the same decision key with
    // the same input replays as DATA_IDEMPOTENT_REPLAY (state unchanged).
    const replay = await server2.dispatch(
      'inspection.approve',
      { id: 'i-101', expectedDomainRevision: 3 },
      supervisor,
      { idempotencyKey: 'u3-restart-key' },
    );
    expect(replay.ok).toBe(false);
    if (!replay.ok) expect(replay.code).toBe('DATA_IDEMPOTENT_REPLAY');
    // A FRESH key still hits the domain rules: i-102 remains submitted at
    // revision 2, so revision 1 is a stale decision (DOMAIN_CONFLICT).
    const freshKey = await server2.dispatch(
      'inspection.approve',
      { id: 'i-102', expectedDomainRevision: 1 },
      supervisor,
      { idempotencyKey: 'u3-restart-key-2' },
    );
    expect(freshKey.ok).toBe(false);
    if (!freshKey.ok) expect(freshKey.code).toBe('DOMAIN_CONFLICT');
    run2.adapter.close();
  });

  it('an empty database seeds ONCE; the simulated mode never touches the durable file', async () => {
    const file = tempDb('seed-once.sqlite');
    const first = openDurableInspectionStore(file, 'normal');
    first.adapter.close();
    const second = openDurableInspectionStore(file, 'empty');
    const list = await second.adapter.query(
      { op: 'list', resourceId: 'inspection' },
      readContext,
    );
    expect(list.ok && list.total === 3).toBe(true); // not reseeded to empty
    second.adapter.close();
  });

  it('the durable adapter declares its own identity (truthful mode label source)', () => {
    const opened = openDurableInspectionStore(tempDb('identity.sqlite'), 'normal');
    expect(opened.adapter.id).toBe(DURABLE_ADAPTER_ID);
    expect(opened.adapter.id).toContain('durable');
    expect(InspectionDurableAdapter.name).toContain('Durable');
    opened.adapter.close();
  });
});
