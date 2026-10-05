import { describe, expect, it } from 'vitest';
import { compileApplication, computeApplicationVersion } from '@victframework/application';
import {
  APPLICATION_DEFINITION_SCHEMA,
  APPLICATION_DEFINITION_SCHEMA_V2,
  APPLICATION_DEFINITION_SCHEMA_V3,
  type ApplicationDefinitionV3,
  type ScreenDefinitionV3,
} from '@victframework/sdk';
import type { ResourceDefinition, ViewBinding } from '@victframework/sdk';
import { canonicalUiDocument, type UiDocument } from '@victframework/ui';
import { compileApplicationRelease } from '@victframework/application';

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

function inspectionDocument(revision: string, heading: string): UiDocument {
  return {
    schema: 'vict.ui-document@1',
    id: 'doc.inspection-detail',
    revision,
    root: 'n.root',
    nodes: {
      'n.root': { kind: 'element', id: 'n.root', tag: 'section', children: ['n.h'] },
      'n.h': { kind: 'text', id: 'n.h', content: { type: 'literal', value: heading } },
    },
    componentDefinitions: {},
    styleSources: {},
    tokens: {},
    conditions: {},
    assets: {},
    localState: {},
  };
}

const inspectionResource: ResourceDefinition = {
  schema: 'vict.resource@1',
  id: 'inspection',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Id' },
    { name: 'title', type: 'string', required: true, label: 'Title' },
    { name: 'status', type: 'string', required: true, label: 'Status' },
    { name: 'findings', type: 'json', label: 'Findings' },
  ],
  authorization: {},
} as unknown as ResourceDefinition;

function applicationV3(screens: readonly ScreenDefinitionV3[]): ApplicationDefinitionV3 {
  return {
    schema: APPLICATION_DEFINITION_SCHEMA_V3,
    id: 'app.inspection',
    revision: '1',
    name: 'Inspection proof',
    routes: [
      { id: 'queue', path: '/queue', screenId: 's.queue' },
      { id: 'detail', path: '/inspections/:id', screenId: 's.detail' },
    ],
    screens,
    views: [
      {
        viewId: 'v.inspections',
        resourceId: 'inspection',
        resourceRevision: '1',
        fields: ['id', 'title', 'status', 'findings'],
      } as ViewBinding,
    ],
    actions: [],
    resources: [{ resourceId: 'inspection', revision: '1' }],
  };
}

function detailScreen(revision: string): ScreenDefinitionV3 {
  return {
    id: 's.detail',
    title: 'Detail',
    uiDocument: { documentId: 'doc.inspection-detail', revision },
  };
}

function legacyQueueScreen(): ScreenDefinitionV3 {
  return {
    id: 's.queue',
    title: 'Queue',
    layout: [{ name: 'main', surfaces: [{ role: 'text', id: 't1', content: 'Queue' }] }],
  };
}

function compileV3(documents: readonly UiDocument[], screens?: readonly ScreenDefinitionV3[]) {
  return compileApplication({
    application: applicationV3(
      screens ?? [legacyQueueScreen(), detailScreen(documents[0]?.revision ?? '1')],
    ) as never,
    resources: [inspectionResource],
    uiDocuments: documents.map((document) => ({ document })),
  });
}

/* ------------------------------------------------------------------ */
/* U1-01 — canonical attachment and identity                           */
/* ------------------------------------------------------------------ */

describe('U1-01: canonical source and identity', () => {
  it('compiles a @3 application with document-mode and legacy screens', () => {
    const result = compileV3([inspectionDocument('1', 'Detail v1')]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.applicationVersion).toMatch(/^v1_[0-9a-f]{64}$/);
    const planKey = 'doc.inspection-detail@1';
    expect(result.plan.uiDocuments?.[planKey]?.contentDigest).toBe(
      canonicalUiDocument(inspectionDocument('1', 'Detail v1')).contentDigest,
    );
    expect(result.plan.documentPlans?.[planKey]?.structure.length).toBe(1);
  });

  it('changed UI content changes applicationVersion (Example A)', () => {
    const v1 = compileV3([inspectionDocument('1', 'Detail v1')]);
    const v2 = compileV3([inspectionDocument('2', 'Detail v2 — edited heading')]);
    expect(v1.ok).toBe(true);
    expect(v2.ok).toBe(true);
    if (!v1.ok || !v2.ok) return;
    expect(v1.plan.applicationVersion).not.toBe(v2.plan.applicationVersion);
    // same document bytes in two revisions with equal content? — revision participates
    const sameContentNewRevision = compileV3([inspectionDocument('2', 'Detail v1')]);
    expect(sameContentNewRevision.ok).toBe(true);
    if (!sameContentNewRevision.ok) return;
    expect(v1.plan.applicationVersion).not.toBe(sameContentNewRevision.plan.applicationVersion);
  });

  it('rejects a dangling screen reference (rule 1)', () => {
    const result = compileV3(
      [inspectionDocument('1', 'Detail v1')],
      [
        legacyQueueScreen(),
        detailScreen('9'), // catalog carries revision 1 only
      ],
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const ui = result.uiIssues ?? [];
    expect(ui.some((issue) => issue.code === 'UI_DOC_REFERENCE_DANGLING')).toBe(true);
  });

  it('rejects competing catalog entries for one key (rule 2, authority catalog)', () => {
    const a = inspectionDocument('1', 'Detail A');
    const b = inspectionDocument('1', 'Detail B'); // same (id, revision), different bytes
    const result = compileV3([a, b]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const collision = (result.uiIssues ?? []).find(
      (issue) => issue.code === 'UI_DOC_REVISION_COLLISION',
    );
    expect(collision).toBeDefined();
    expect(collision?.authority).toBe('catalog');
    expect(collision?.digestA).not.toBe(collision?.digestB);
  });

  it('rejects a pin that disagrees with the catalog entry (rule 2, authority pin)', () => {
    const result = compileApplication({
      application: applicationV3([legacyQueueScreen(), detailScreen('1')]) as never,
      resources: [inspectionResource],
      uiDocuments: [{ document: inspectionDocument('1', 'Detail v1') }],
      uiDocumentPins: [
        { documentId: 'doc.inspection-detail', revision: '1', contentDigest: 'deadbeef' },
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const collision = (result.uiIssues ?? []).find(
      (issue) => issue.code === 'UI_DOC_REVISION_COLLISION',
    );
    expect(collision).toBeDefined();
    expect(collision?.authority).toBe('pin');
  });

  it('an old release binding fails after the document edit (Example B)', () => {
    const before = compileV3([inspectionDocument('1', 'Detail v1')]);
    const after = compileV3([inspectionDocument('2', 'Detail v2')]);
    expect(before.ok && after.ok).toBe(true);
    if (!before.ok || !after.ok) return;
    // Release frozen against the OLD application version:
    const release = {
      schema: 'vict.application-release@1',
      applicationId: before.plan.applicationId,
      applicationRevision: before.plan.applicationRevision,
      applicationVersion: before.plan.applicationVersion,
      renderer: { id: 'renderer.doc', revision: '1' },
      dataAdapter: { id: 'adapter.doc', revision: '1' },
      victCompatibility: '^0.1.0',
      activation: { kind: 'policy' as const, selection: 'latest' as const },
    };
    const result = compileApplicationRelease(release as never, after.plan, {
      renderer: { id: 'renderer.doc', revision: '1' },
      dataAdapter: { id: 'adapter.doc', revision: '1' },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((issue) => issue.code)).toContain('RELEASE_APPLICATION_MISMATCH');
  });

  it('catalog permutation and duplicate identical entries preserve identity (Example D / A-03)', () => {
    const d1 = inspectionDocument('1', 'Detail v1');
    const d2 = inspectionDocument('2', 'Detail v2');
    const screens = [legacyQueueScreen(), detailScreen('1')];
    const reference = compileApplication({
      application: applicationV3(screens) as never,
      resources: [inspectionResource],
      // catalog carries BOTH revisions (screen pins revision 1)
      uiDocuments: [{ document: d1 }, { document: d2 }],
    });
    expect(reference.ok).toBe(true);
    if (!reference.ok) return;
    const permuted = compileApplication({
      application: applicationV3(screens) as never,
      resources: [inspectionResource],
      uiDocuments: [
        { document: d2 },
        { document: structuredClone(d1) }, // byte-identical duplicate of one entry
        { document: structuredClone(d2) }, // duplicate
        { document: d1 },
      ],
    });
    expect(permuted.ok).toBe(true);
    if (!permuted.ok) return;
    expect(permuted.plan.applicationVersion).toBe(reference.plan.applicationVersion);
    // adding/removing a revision entry changes the version
    const removed = compileApplication({
      application: applicationV3(screens) as never,
      resources: [inspectionResource],
      uiDocuments: [{ document: d1 }],
    });
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.plan.applicationVersion).not.toBe(reference.plan.applicationVersion);
  });

  it('the revision ordering inside the payload is code-point order: "10" < "2" < "3"', () => {
    const docs = ['1', '10', '2', '3'].map((revision) =>
      inspectionDocument(revision, `Detail ${revision}`),
    );
    const forward = compileApplication({
      application: applicationV3([legacyQueueScreen(), detailScreen('1')]) as never,
      resources: [inspectionResource],
      uiDocuments: docs.map((document) => ({ document })),
    });
    const backward = compileApplication({
      application: applicationV3([legacyQueueScreen(), detailScreen('1')]) as never,
      resources: [inspectionResource],
      uiDocuments: [...docs].reverse().map((document) => ({ document })),
    });
    expect(forward.ok && backward.ok).toBe(true);
    if (!forward.ok || !backward.ok) return;
    expect(forward.plan.applicationVersion).toBe(backward.plan.applicationVersion);
  });

  it('a valid navigation loop between documents is NOT a cycle (A-01)', () => {
    // detail navigates to queue route; queue screen is legacy. A pure
    // document-level navigation loop must compile cleanly.
    const detail: UiDocument = {
      ...inspectionDocument('1', 'Detail'),
      nodes: {
        'n.root': {
          kind: 'element',
          id: 'n.root',
          tag: 'section',
          children: ['n.h', 'n.back'],
          interactions: [{ on: 'click', action: 'navigate', routeId: 'queue' }],
        } as never,
        'n.h': { kind: 'text', id: 'n.h', content: { type: 'literal', value: 'Detail' } },
        'n.back': {
          kind: 'text',
          id: 'n.back',
          content: { type: 'literal', value: 'Back to queue' },
        },
      },
    };
    const result = compileApplication({
      application: applicationV3([legacyQueueScreen(), detailScreen('1')]) as never,
      resources: [inspectionResource],
      uiDocuments: [{ document: detail }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.plan.uiDiagnostics ?? []).some((issue) => issue.code === 'UI_DOC_CYCLE')).toBe(
        false,
      );
    }
  });

  it('a cross-document definition expansion cycle IS rejected (A-01)', () => {
    // doc A defines cardA whose body instantiates cardB (stored in doc B);
    // doc B's cardB body instantiates cardA.
    const docA: UiDocument = {
      schema: 'vict.ui-document@1',
      id: 'doc.a',
      revision: '1',
      root: 'n.root',
      nodes: {
        'n.root': { kind: 'text', id: 'n.root', content: { type: 'literal', value: 'A' } },
        'n.aBody': {
          kind: 'component',
          id: 'n.aBody',
          definitionId: 'def.cardB',
        },
      },
      componentDefinitions: {
        'def.cardA': { id: 'def.cardA', revision: '1', root: 'n.aBody', props: [], slots: {} },
      },
      styleSources: {},
      tokens: {},
      conditions: {},
      assets: {},
      localState: {},
    };
    const docB: UiDocument = {
      schema: 'vict.ui-document@1',
      id: 'doc.b',
      revision: '1',
      root: 'n.root',
      nodes: {
        'n.root': { kind: 'text', id: 'n.root', content: { type: 'literal', value: 'B' } },
        'n.bBody': { kind: 'component', id: 'n.bBody', definitionId: 'def.cardA' },
      },
      componentDefinitions: {
        'def.cardB': { id: 'def.cardB', revision: '1', root: 'n.bBody', props: [], slots: {} },
      },
      styleSources: {},
      tokens: {},
      conditions: {},
      assets: {},
      localState: {},
    };
    const result = compileApplication({
      application: applicationV3([legacyQueueScreen(), detailScreen('1')]) as never,
      resources: [inspectionResource],
      uiDocuments: [{ document: docA }, { document: docB }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const cycle = (result.uiIssues ?? []).find((issue) => issue.code === 'UI_DOC_CYCLE');
    expect(cycle).toBeDefined();
  });

  it('a @3 identity can never alias a @1/@2 identity (Example C)', () => {
    const legacy = {
      schema: APPLICATION_DEFINITION_SCHEMA,
      id: 'app.inspection',
      revision: '1',
      routes: [{ id: 'queue', path: '/queue', screenId: 's.queue' }],
      screens: [
        {
          id: 's.queue',
          title: 'Queue',
          layout: [{ name: 'main', surfaces: [{ role: 'text', id: 't1', content: 'Queue' }] }],
        },
      ],
      actions: [],
      resources: [{ resourceId: 'inspection', revision: '1' }],
    } as const;
    const asV2 = { ...legacy, schema: APPLICATION_DEFINITION_SCHEMA_V2 };
    const v1 = computeApplicationVersion({
      application: legacy as never,
      resources: [inspectionResource],
    });
    const v2 = computeApplicationVersion({
      application: asV2 as never,
      resources: [inspectionResource],
    });
    expect(v1).not.toBe(v2);
    // And the @3 form (same manifest content where valid) differs again:
    const v3App = {
      ...applicationV3([legacyQueueScreen()]),
      routes: [{ id: 'queue', path: '/queue', screenId: 's.queue' }],
      views: [],
    };
    const v3 = compileApplication({
      application: v3App as never,
      resources: [inspectionResource],
      uiDocuments: [],
    });
    expect(v3.ok).toBe(true);
    if (!v3.ok) return;
    expect(v3.plan.applicationVersion).not.toBe(v1);
    expect(v3.plan.applicationVersion).not.toBe(v2);
  });
});
