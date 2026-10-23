/** Canonical source attachment shared by authoring, storage validation and finished replay. */
import { compileApplication, deriveActionInputCatalog } from '@victframework/application';
import type { ApplicationDefinitionV3, ResourceDefinition } from '@victframework/sdk';
import { defaultSemanticElementCatalog, type UiDocument } from '@victframework/ui';
import {
  catalogDescriptors,
  catalogImplementations,
  validateSvelteComponentPlan,
} from '@victframework/ui-svelte';
import { defineContract } from '@victframework/contracts';
import { screenPlacementIssues } from './placement.js';

export const submitInput = defineContract<{ message: string; accepted: boolean }>({
  id: 'studio.demo-input',
  revision: '1',
  presentationFields: { message: 'string', accepted: 'boolean' },
  parse(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
      return {
        ok: false,
        issues: [{ code: 'invalid', path: '', message: 'Expected message and accepted.' }],
      };
    const input = value as Record<string, unknown>;
    return typeof input.message === 'string' &&
      typeof input.accepted === 'boolean' &&
      Object.keys(input).every((key) => ['message', 'accepted'].includes(key))
      ? { ok: true, value: { message: input.message, accepted: input.accepted } }
      : {
          ok: false,
          issues: [
            {
              code: 'invalid',
              path: '',
              message: 'Expected a string message and boolean accepted.',
            },
          ],
        };
  },
});
export const submitOutput = defineContract<string>({
  id: 'studio.demo-output',
  revision: '1',
  parse: (value) =>
    typeof value === 'string'
      ? { ok: true, value }
      : { ok: false, issues: [{ code: 'invalid', path: '', message: 'Expected result text.' }] },
});
export const demoResource: ResourceDefinition = {
  schema: 'vict.resource@1',
  id: 'studio.demo',
  revision: '1',
  identity: { key: 'id' },
  fields: [{ name: 'id', type: 'string', required: true }],
  mutations: [
    {
      op: 'submit',
      effect: 'write',
      inputContractId: submitInput.id,
      outputContractId: submitOutput.id,
      permissions: ['studio.demo.write'],
    },
  ],
};
export const designerActions = [
  {
    kind: 'mutation',
    id: 'demo.submit',
    revision: '1',
    resourceId: demoResource.id,
    resourceRevision: '1',
    op: 'submit',
    inputContractId: submitInput.id,
    inputContractRevision: '1',
    outputContractId: submitOutput.id,
    outputContractRevision: '1',
  },
] as const;
export const contractCatalog = [submitInput, submitOutput].map(
  ({ id, revision, presentationFields }) => ({
    id,
    revision,
    ...(presentationFields ? { presentationFields } : {}),
  }),
);
export const actionInputs = deriveActionInputCatalog(designerActions, contractCatalog);
export const designerCatalogs = {
  elements: defaultSemanticElementCatalog(),
  extensions: catalogDescriptors,
  actionIds: ['demo.submit'],
  actionInputs,
  routeIds: ['screen'],
};
export const screenActionState = {
  'demo.submit': { pending: 'busy', error: 'actionError', result: 'actionResult' },
} as const;
export { catalogDescriptors, catalogImplementations };

export function screenName(document: UiDocument): string {
  const root = document.nodes[document.root];
  return root?.kind === 'element' && typeof root.attributes?.['aria-label'] === 'string'
    ? root.attributes['aria-label']
    : 'Untitled screen';
}
export function screenApplication(document: UiDocument): ApplicationDefinitionV3 {
  return {
    schema: 'vict.application@3',
    id: `studio.${document.id}`,
    revision: '1',
    name: screenName(document),
    compatibility: { applicationSchema: 'vict.application@3' },
    routes: [{ id: 'screen', path: '/', screenId: 'screen' }],
    screens: [
      {
        id: 'screen',
        title: screenName(document),
        uiDocument: { documentId: document.id, revision: document.revision },
      },
    ],
    actions: designerActions,
    resources: [{ resourceId: demoResource.id, revision: '1' }],
    views: [],
    forms: [],
    components: [],
  };
}
export function compileScreen(document: UiDocument) {
  const contextIssues = screenPlacementIssues(document);
  if (contextIssues.length) return { ok: false as const, issues: contextIssues, uiIssues: [] };
  const compiled = compileApplication({
    application: screenApplication(document),
    resources: [demoResource],
    contracts: contractCatalog,
    uiDocuments: [{ document }],
    uiExtensions: catalogDescriptors,
  });
  if (!compiled.ok) return compiled;
  const issues = Object.values(compiled.plan.documentPlans ?? {}).flatMap((plan) =>
    validateSvelteComponentPlan(plan, catalogDescriptors, catalogImplementations),
  );
  return issues.length ? { ok: false as const, issues, uiIssues: [] } : compiled;
}
export function screenIssues(document: UiDocument) {
  try {
    const result = compileScreen(document);
    return result.ok
      ? []
      : [...result.issues, ...(result.uiIssues ?? [])].map((issue) => ({
          code: issue.code,
          message: issue.message,
          severity: 'error',
        }));
  } catch {
    return [
      {
        code: 'STUDIO_SOURCE_INVALID',
        message: 'The source could not be compiled.',
        severity: 'error',
      },
    ];
  }
}
export function newScreen(
  name: string,
  id = `screen-${globalThis.crypto.randomUUID()}`,
): UiDocument {
  return {
    schema: 'vict.ui-document@1',
    id,
    revision: 'r1',
    root: 'screen',
    nodes: {
      screen: {
        kind: 'element',
        id: 'screen',
        tag: 'main',
        attributes: { 'aria-label': name },
        children: [],
        localStyle: Object.entries({
          display: 'flex',
          'flex-direction': 'column',
          gap: '20px',
          padding: '40px',
          'min-height': '560px',
          'background-color': '#ffffff',
          color: '#243047',
          'font-family': 'system-ui, sans-serif',
        }).map(([property, value]) => ({ property, value: { type: 'text', value } })),
      },
    },
    componentDefinitions: {},
    styleSources: {},
    assets: {},
    tokens: {},
    conditions: {
      compact: {
        id: 'compact',
        kind: 'container',
        name: 'studio-screen',
        query: '(max-width: 600px)',
      },
    },
    localState: {
      message: { key: 'message', type: 'string', initial: 'Hello from my screen' },
      accepted: { key: 'accepted', type: 'boolean', initial: false },
      dialogOpen: { key: 'dialogOpen', type: 'boolean', initial: false },
      busy: { key: 'busy', type: 'boolean', initial: false },
      actionError: { key: 'actionError', type: 'string', initial: '' },
      actionResult: { key: 'actionResult', type: 'string', initial: '' },
    },
  };
}
