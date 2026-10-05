/**
 * Joint compilation of the inspection application (the real
 * `compileApplication` with the explicit document catalog) — ONE source of
 * the compiled artifact shared by the product routes and the studio host
 * (U1-02).
 */

import { compileApplication, type ApplicationPlan } from '@victframework/application';
import type { UiRenderPlan } from '@victframework/ui';
import {
  inspectionApplication,
  inspectionDetailDocument,
  evidenceViewerExtension,
  inspectionResource,
  findingResource,
  evidenceResource,
  activityResource,
} from './definitions.js';

let cached: { readonly plan: ApplicationPlan; readonly detailPlan: UiRenderPlan } | undefined;

export function inspectionPlan(): {
  readonly plan: ApplicationPlan;
  readonly detailPlan: UiRenderPlan;
} {
  if (cached !== undefined) return cached;
  const result = compileApplication({
    application: inspectionApplication as never,
    resources: [inspectionResource, findingResource, evidenceResource, activityResource],
    contracts: [
      { id: 'c.unit', revision: '1' },
      { id: 'c.decision', revision: '1' },
    ],
    uiDocuments: [{ document: inspectionDetailDocument }],
    uiExtensions: [evidenceViewerExtension],
  });
  if (!result.ok) {
    throw new Error(
      `inspection application failed to compile: ${JSON.stringify({ issues: result.issues, ui: result.uiIssues }, null, 1)}`,
    );
  }
  const detailKey = 'doc.inspection-detail@1';
  const detailPlan = result.plan.documentPlans?.[detailKey];
  if (detailPlan === undefined) {
    throw new Error('the compiled plan carries no detail document plan');
  }
  cached = { plan: result.plan, detailPlan };
  return cached;
}
