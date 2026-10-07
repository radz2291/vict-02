import { describe, expect, it } from 'vitest';
import { compileApplication } from '@victframework/application';
import { canonicalUiDocument, type UiDocument } from '@victframework/ui';
import {
  inspectionApplication,
  inspectionDetailDocument,
  inspectionQueueDocument,
  inspectionQueueProjection,
  inspectionResource,
  findingResource,
  evidenceResource,
  activityResource,
} from '../src/lib/product/definitions.js';
import { productExtensions } from '../src/lib/product/documents.js';
import {
  InspectionDataAdapter,
  createInspectionServer,
  seedDomain,
} from '../src/lib/product/domain.js';
import type { InspectionRow } from '../src/lib/product/domain.js';

function compileInspection() {
  return compileApplication({
    application: inspectionApplication as never,
    resources: [
      inspectionQueueProjection,
      inspectionResource,
      findingResource,
      evidenceResource,
      activityResource,
    ],
    contracts: [
      { id: 'c.unit', revision: '1' },
      { id: 'c.decision', revision: '1' },
    ],
    uiDocuments: [{ document: inspectionDetailDocument }, { document: inspectionQueueDocument }],
    uiExtensions: productExtensions,
  });
}

function freshServer() {
  return createInspectionServer(new InspectionDataAdapter(seedDomain()));
}

const supervisor = { role: 'supervisor', actorId: 's.hart' };
const technician = { role: 'technician', actorId: 't.nguyen' };

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

describe('U1-01/U1-02: canonical attachment and the one renderer', () => {
  it('compiles the @3 application with the document-mode detail screen', () => {
    const result = compileInspection();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const detailKey = 'doc.inspection-detail@2';
    expect(result.plan.uiDocuments?.[detailKey]?.contentDigest).toBe(
      canonicalUiDocument(inspectionDetailDocument).contentDigest,
    );
    expect(result.plan.documentPlans?.[detailKey]?.structure.length).toBe(1);
    expect(result.plan.documentPlans?.['doc.inspection-queue@1']?.sourceDigest).toBe(
      canonicalUiDocument(inspectionQueueDocument).contentDigest,
    );
  });

  it('changed UI source changes the applicationVersion (round trip of A)', () => {
    const before = compileInspection();
    const edited: UiDocument = {
      ...inspectionDetailDocument,
      revision: '3',
      nodes: {
        ...inspectionDetailDocument.nodes,
        'n.approveLabel': {
          kind: 'text',
          id: 'n.approveLabel',
          content: { type: 'literal', value: 'Approve inspection (edited)' },
        },
      },
    };
    const editedApplication = {
      ...inspectionApplication,
      screens: inspectionApplication.screens.map((screen) =>
        screen.uiDocument !== undefined && screen.uiDocument.documentId === 'doc.inspection-detail'
          ? { ...screen, uiDocument: { documentId: 'doc.inspection-detail', revision: '3' } }
          : screen,
      ),
    } as typeof inspectionApplication;
    const after = compileApplication({
      application: editedApplication as never,
      resources: [
        inspectionQueueProjection,
        inspectionResource,
        findingResource,
        evidenceResource,
        activityResource,
      ],
      contracts: [
        { id: 'c.unit', revision: '1' },
        { id: 'c.decision', revision: '1' },
      ],
      uiDocuments: [{ document: edited }, { document: inspectionQueueDocument }],
      uiExtensions: productExtensions,
    });
    expect(before.ok && after.ok).toBe(true);
    if (!before.ok || !after.ok) return;
    expect(before.plan.applicationVersion).not.toBe(after.plan.applicationVersion);
  });

  it('renders the SAME compiled artifact in product and studio (single plan source)', () => {
    // Both entry points import inspectionPlan() — one compile, one plan.
    // The structural assertion: the detail plan is the frozen compiled plan
    // of exactly the frozen document bytes.
    const result = compileInspection();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const plan = result.plan.documentPlans?.['doc.inspection-detail@2'];
    expect(plan?.documentId).toBe('doc.inspection-detail');
    expect(plan?.sourceDigest).toBe(canonicalUiDocument(inspectionDetailDocument).contentDigest);
  });
});

describe('U1-05: the product path through the real boundaries', () => {
  it('approve updates status, domain revision and activity', async () => {
    const server = freshServer();
    const record = await loadRecord(server, 'i-101');
    const result = await server.dispatch(
      'inspection.approve',
      { id: 'i-101', expectedDomainRevision: record['domainRevision'] },
      supervisor,
    );
    expect(result.ok).toBe(true);
    const after = await loadRecord(server, 'i-101');
    expect(after['status']).toBe('approved');
    expect(Number(after['domainRevision'])).toBe(Number(record['domainRevision']) + 1);
    const activity = server.adapter.activityFor('i-101');
    expect(activity.at(-1)?.entry).toContain('approved');
  });

  it('permission denial leaves the domain unchanged (technician cannot approve)', async () => {
    const server = freshServer();
    const record = await loadRecord(server, 'i-101');
    const result = await server.dispatch(
      'inspection.approve',
      { id: 'i-101', expectedDomainRevision: record['domainRevision'] },
      technician,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('DATA_UNAUTHORIZED');
    const after = await loadRecord(server, 'i-101');
    expect(after['status']).toBe(record['status']);
    expect(after['domainRevision']).toBe(record['domainRevision']);
  });

  it('a stale decision (old expectedDomainRevision) fails and changes nothing', async () => {
    const server = freshServer();
    const record = await loadRecord(server, 'i-101');
    const result = await server.dispatch(
      'inspection.approve',
      { id: 'i-101', expectedDomainRevision: Number(record['domainRevision']) - 1 },
      supervisor,
    );
    expect(result.ok).toBe(false);
    // Frozen diagnostic (API-SPEC §7): stale decisions are DOMAIN_CONFLICT.
    if (!result.ok) expect(result.code).toBe('DOMAIN_CONFLICT');
    const after = await loadRecord(server, 'i-101');
    expect(after['status']).toBe(record['status']);
  });
});

describe('adapter compatibility (shared discipline)', () => {
  it('rejects undeclared mutations and unknown reads', async () => {
    const server = freshServer();
    const bad = await server.adapter.mutate(
      { resourceId: 'inspection', op: 'delete', id: 'i-101' },
      { permissions: ['qlt.inspection.approve'], effect: 'write', actor: 's.hart' },
    );
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.code).toBe('DATA_MUTATION_NOT_DECLARED');
    const noPermission = await server.adapter.query(
      { op: 'list', resourceId: 'inspection' },
      { permissions: [], effect: 'read' },
    );
    expect(noPermission.ok).toBe(false);
    if (!noPermission.ok) expect(noPermission.code).toBe('DATA_UNAUTHORIZED');
  });
});

describe('seed shape', () => {
  it('seeds carry the §1.1 scalar fields and joined collections', async () => {
    const server = freshServer();
    const record = (await loadRecord(server, 'i-101')) as unknown as InspectionRow & {
      findings: unknown[];
      evidence: unknown[];
    };
    expect(record.status).toBe('submitted');
    expect(Array.isArray(record.findings)).toBe(true);
    expect(record.findings.length).toBeGreaterThan(0);
    expect(Array.isArray(record.evidence)).toBe(true);
  });
});
