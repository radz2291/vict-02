/**
 * Joint compilation of the inspection application (the real
 * `compileApplication` with the explicit document catalog) — ONE source of
 * the compiled artifact shared by the product routes and the studio host
 * (U1-02).
 */

import { compileApplication, type ApplicationPlan } from '@victframework/application';
import { compileUiDocument, type UiRenderPlan } from '@victframework/ui';
import {
  inspectionApplication,
  inspectionDetailDocument,
  inspectionQueueDocument,
  inspectionQueueProjection,
  evidenceViewerExtension,
  inspectionResource,
  findingResource,
  evidenceResource,
  activityResource,
} from './definitions.js';
import { productExtensions } from './documents.js';

/**
 * The studio-side compile context for the detail document (working-plan
 * compile AND the authoring store compatibility gate use the SAME
 * declared context — a saved document must compile exactly where it was
 * edited).
 */
export const studioDocumentCatalogs: Parameters<typeof compileUiDocument>[3] = {
  actionIds: [
    'inspection.approve',
    'inspection.reject',
    'inspection.revise',
    'inspection.submit',
    'finding.add',
    'evidence.add',
    'inspection.get',
  ],
  routeIds: ['queue', 'detail'],
  viewFields: {
    id: 'string',
    technician: 'string',
    supervisor: 'string',
    inspections: 'array',
    'inspections.id': 'string',
    'inspections.title': 'string',
    'inspections.status': 'string',
    'inspections.technician': 'string',
    title: 'string',
    status: 'string',
    domainRevision: 'number',
    findings: 'array',
    'findings.id': 'string',
    'findings.severity': 'string',
    'findings.description': 'string',
    evidence: 'array',
    'evidence.id': 'string',
    'evidence.kind': 'string',
    'evidence.label': 'string',
    activity: 'array',
    'activity.id': 'string',
    'activity.at': 'string',
    'activity.entry': 'string',
    'activity.actor': 'string',
  },
};

let cached:
  | {
      readonly plan: ApplicationPlan;
      readonly detailPlan: UiRenderPlan;
      readonly queuePlan: UiRenderPlan;
    }
  | undefined;

export function inspectionPlan(document = inspectionDetailDocument): {
  readonly plan: ApplicationPlan;
  readonly detailPlan: UiRenderPlan;
  readonly queuePlan: UiRenderPlan;
} {
  if (cached !== undefined && document === inspectionDetailDocument) return cached;
  const result = compileApplication({
    application: {
      ...inspectionApplication,
      screens: inspectionApplication.screens.map((screen) =>
        screen.id === 's.detail'
          ? { ...screen, uiDocument: { documentId: document.id, revision: document.revision } }
          : screen,
      ),
    } as never,
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
    uiDocuments: [{ document }, { document: inspectionQueueDocument }],
    uiExtensions: productExtensions,
  });
  if (!result.ok) {
    throw new Error(
      `inspection application failed to compile: ${JSON.stringify({ issues: result.issues, ui: result.uiIssues }, null, 1)}`,
    );
  }
  const detailKey = `${document.id}@${document.revision}`;
  const detailPlan = result.plan.documentPlans?.[detailKey];
  if (detailPlan === undefined) {
    throw new Error('the compiled plan carries no detail document plan');
  }
  const queuePlan = result.plan.documentPlans?.['doc.inspection-queue@1'];
  if (!queuePlan) throw new Error('No queue plan');
  const compiled = { plan: result.plan, detailPlan, queuePlan };
  if (document === inspectionDetailDocument) cached = compiled;
  return compiled;
}
