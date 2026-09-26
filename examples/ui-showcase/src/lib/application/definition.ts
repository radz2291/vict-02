import {
  APPLICATION_DEFINITION_SCHEMA_V2,
  type ApplicationDefinition,
} from '@victframework/sdk';
import { compileApplication } from '@victframework/application';
import type { ApplicationPlan } from '@victframework/application';
import { registryContracts, resourceList } from './data.js';
import { showcaseScenario } from './scenarios/showcase.js';
import { operationsScenario } from './scenarios/operations.js';
import { tradingScenario } from './scenarios/trading.js';
import {
  agentScenario,
  quellightScenario,
  workflowScenario,
  analyticsScenario,
} from './scenarios/services.js';
import { galleryScenario } from './scenarios/gallery.js';
import { stressScenario } from './scenarios/stress.js';

/**
 * Assembles the ONE showcase Application Definition from the scenario
 * modules and compiles it into the immutable Application Plan. Every
 * visible scenario is ordinary VICT definition vocabulary; the generic
 * `@victframework/ui-svelte` host renders the compiled plan.
 */

const scenarios = [
  showcaseScenario,
  operationsScenario,
  tradingScenario,
  agentScenario,
  quellightScenario,
  workflowScenario,
  analyticsScenario,
  galleryScenario,
  stressScenario,
];

export const showcaseApplication: ApplicationDefinition = defineApplicationSurface({
  schema: APPLICATION_DEFINITION_SCHEMA_V2,
  id: 'app.ui-showcase',
  revision: '1',
  name: 'VICT UI Showcase',
  routes: scenarios.flatMap((scenario) => scenario.routes),
  screens: scenarios.flatMap((scenario) => scenario.screens),
  views: scenarios.flatMap((scenario) => scenario.views),
  forms: scenarios.flatMap((scenario) => scenario.forms),
  actions: scenarios.flatMap((scenario) => scenario.actions),
  resources: [
    { resourceId: 'tickets', revision: '1' },
    { resourceId: 'instruments', revision: '1' },
    { resourceId: 'signals', revision: '1' },
    { resourceId: 'instrumentSeries', revision: '1' },
    { resourceId: 'agentSessions', revision: '1' },
    { resourceId: 'agentFiles', revision: '1' },
    { resourceId: 'agentMessages', revision: '1' },
    { resourceId: 'worldEntries', revision: '1' },
    { resourceId: 'worldChanges', revision: '1' },
    { resourceId: 'quellightMessages', revision: '1' },
    { resourceId: 'workflowInstances', revision: '1' },
    { resourceId: 'workflowEvents', revision: '1' },
    { resourceId: 'kpi', revision: '1' },
    { resourceId: 'deals', revision: '1' },
    { resourceId: 'galleryMessages', revision: '1' },
    { resourceId: 'emptyInbox', revision: '1' },
    { resourceId: 'gallerySubmissions', revision: '1' },
    { resourceId: 'stressRows', revision: '1' },
    { resourceId: 'stressMessages', revision: '1' },
    { resourceId: 'galleryChartZero', revision: '1' },
    { resourceId: 'galleryChartOne', revision: '1' },
    { resourceId: 'galleryChartWide', revision: '1' },
    { resourceId: 'galleryChartMixed', revision: '1' },
    { resourceId: 'demo', revision: '1' },
  ],
  components: [{ componentId: 'cmp.island', revision: '1' }],
  compatibility: { applicationSchema: APPLICATION_DEFINITION_SCHEMA_V2 },
  theme: {
    reference: 'vict.default-theme',
    tokens: [
      { name: 'color.accent', value: '#0f766e' },
      { name: 'color.focusRing', value: '#0f766e' },
      { name: 'radius.base', value: '10px' },
    ],
  },
});

/** Identity helper (the SDK defineApplication marker, kept local for clarity). */
function defineApplicationSurface(application: ApplicationDefinition): ApplicationDefinition {
  return application;
}

/** Available contract/component bindings for compilation. */
export const bindings = {
  contracts: registryContracts,
  components: [{ componentId: 'cmp.island', revision: '1' }],
} as const;

/** Compile the neutral definition into the immutable plan. */
export function compileShowcasePlan(): ApplicationPlan {
  const result = compileApplication({
    application: showcaseApplication,
    resources: resourceList,
    contracts: [...registryContracts],
    components: bindings.components,
  });
  if (!result.ok) {
    const summary = result.issues
      .map((issue) => `${issue.code}: ${issue.message}${issue.path ? ` @ ${issue.path}` : ''}`)
      .join('\n');
    throw new Error(`showcase definition invalid (${result.issues.length} issues):\n${summary}`);
  }
  return result.plan;
}
