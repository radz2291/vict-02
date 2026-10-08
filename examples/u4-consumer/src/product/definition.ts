/**
 * The consumer's PRODUCT surface: a small task-review domain. Actions are
 * declared here (the application's declared-action authority — the renderer
 * never invents them); the input contract is declared with the application
 * so `deriveActionInputCatalog` can type output-binding action inputs.
 * View data supplies the select/radio options (array-typed reference-only
 * props bind to `view.*` fields).
 */
import { copyUiValue, isUiValueOfType, type UiValue, type UiValueType, type UiDocument, type UiFieldTypes } from '@victframework/ui';
import { inspectionRoutes, type ConsumerRouteId } from './operations.js';
import { defineContract } from '@victframework/contracts';
import type { ApplicationDefinitionV3, ResourceDefinition } from '@victframework/sdk';

export interface ConsumerAction {
  readonly kind: 'mutation';
  readonly id: string;
  readonly revision: string;
  readonly resourceId: string;
  readonly resourceRevision: string;
  readonly op: string;
  readonly inputContractId: string;
  readonly inputContractRevision: string;
  readonly outputContractId: string;
  readonly outputContractRevision: string;
}

export const consumerActions: readonly ConsumerAction[] = [
  {
    kind: 'mutation',
    id: 'task.approve',
    revision: '1',
    resourceId: 'task',
    resourceRevision: '1',
    op: 'approve',
    inputContractId: 'c.taskAck',
    inputContractRevision: '1',
    outputContractId: 'c.unit',
    outputContractRevision: '1',
  },
  {
    kind: 'mutation',
    id: 'task.submit',
    revision: '1',
    resourceId: 'task',
    resourceRevision: '1',
    op: 'submit',
    inputContractId: 'c.taskSubmit',
    inputContractRevision: '1',
    outputContractId: 'c.unit',
    outputContractRevision: '1',
  },
  {
    kind: 'mutation',
    id: 'task.assign',
    revision: '1',
    resourceId: 'task',
    resourceRevision: '1',
    op: 'assign',
    inputContractId: 'c.taskAssign',
    inputContractRevision: '1',
    outputContractId: 'c.unit',
    outputContractRevision: '1',
  },
  {
    kind: 'mutation',
    id: 'task.region',
    revision: '1',
    resourceId: 'task',
    resourceRevision: '1',
    op: 'region',
    inputContractId: 'c.taskRegion',
    inputContractRevision: '1',
    outputContractId: 'c.unit',
    outputContractRevision: '1',
  },
  ...([
    ['operation', 'c.inspectionOperation'], ['configure', 'c.inspectionConfiguration'],
    ['schedule', 'c.inspectionSchedule'], ['archive', 'c.inspectionArchive'],
  ] as const).map(([op, contract]) => ({ kind: 'mutation' as const, id: `task.${op}`, revision: '1', resourceId: 'task', resourceRevision: '1', op, inputContractId: contract, inputContractRevision: '1', outputContractId: 'c.unit', outputContractRevision: '1' })),
];

/** Executable contracts carry their passive field metadata at the same exact revision. */
function inputContract(id: string, fields: Readonly<Record<string, UiValueType>>) {
  return defineContract<Record<string, UiValue>>({ id, revision: '1', presentationFields: fields,
    parse(input) {
      if (typeof input !== 'object' || input === null || Array.isArray(input)) return { ok: false, issues: [{ code: 'invalid_type', path: '(root)', message: 'Expected declared input fields.' }] };
      const record: Record<string, unknown> = Object.fromEntries(Object.entries(input));
      const value: Record<string, UiValue> = {};
      if (Object.keys(record).some(name => !Object.hasOwn(fields, name))) return { ok: false, issues: [{ code: 'unknown_field', path: '(root)', message: 'Unknown input field.' }] };
      for (const [name, type] of Object.entries(fields)) {
        const candidate = record[name];
        if (!isUiValueOfType(candidate, type)) return { ok: false, issues: [{ code: 'invalid_type', path: name, message: 'Input does not match the declared type.' }] };
        value[name] = copyUiValue(candidate);
      }
      return { ok: true, value };
    },
  });
}
export const consumerContracts = [
  inputContract('c.taskAck', { noteId: 'string', ack: 'boolean' }),
  inputContract('c.taskSubmit', { noteId: 'string', ackFindings: 'boolean', ackPricing: 'boolean', region: 'string' }),
  inputContract('c.taskAssign', { noteId: 'string', reviewer: 'string' }),
  inputContract('c.taskRegion', { region: 'string' }),
  inputContract('c.inspectionOperation', { noteId: 'string', operation: 'string' }),
  inputContract('c.inspectionConfiguration', { noteId: 'string', owner: 'string', allFindings: 'boolean', teams: 'stringList', reviewers: 'stringList', priority: 'string', evidence: 'stringList' }),
  inputContract('c.inspectionSchedule', { noteId: 'string', date: 'isoDate', start: 'isoDate', end: 'isoDate', time: 'isoTime', duration: 'numberList', capacity: 'numberList' }),
  inputContract('c.inspectionArchive', { noteId: 'string' }),
  defineContract<string>({ id: 'c.unit', revision: '1', parse: input => typeof input === 'string'
    ? { ok: true, value: input } : { ok: false, issues: [{ code: 'invalid_type', path: '(root)', message: 'Expected a result message.' }] } }),
];

export const consumerResource: ResourceDefinition = {
  schema: 'vict.resource@1', id: 'task', revision: '1', identity: { key: 'noteId' },
  fields: [{ name: 'noteId', type: 'string', required: true }],
  mutations: consumerActions.map(action => ({ op: action.op, effect: 'write', inputContractId: action.inputContractId,
    outputContractId: action.outputContractId, permissions: ['task.write'] })),
};
export function consumerApplication(documents: readonly UiDocument[]): ApplicationDefinitionV3 {
  return {
    schema: 'vict.application@3', id: 'u4.consumer', revision: '1', name: 'Inspection Operations',
    compatibility: { applicationSchema: 'vict.application@3' },
    composition: { navigation: 'sidebar', responsive: { navigationAt: 'small' } },
    routes: inspectionRoutes.filter(route => documents.some(document => document.id === route.documentId)).map(route => ({ id: route.id, path: route.id === 'controls' ? '/' : `/${route.id}`, screenId: route.id, nav: { label: route.label } })),
    screens: documents.map(document => ({ id: inspectionRoutes.find(route => route.documentId === document.id)?.id ?? document.id, title: 'Inspection Operations',
      uiDocument: { documentId: document.id, revision: document.revision } })),
    actions: consumerActions, resources: [{ resourceId: 'task', revision: '1' }], views: [], forms: [], components: [],
  };
}

export const consumerActionIds: readonly string[] = consumerActions.map((action) => action.id);

export const consumerViewFields: UiFieldTypes = {
  regions: 'array',
  reviewers: 'array',
  shellNavigation: 'array',
  path: 'string',
  navigationMode: 'string',
  navigationAt: 'string',
};

/** View data: option objects for the select/radio-group array props. */
export const consumerViewData: Record<string, unknown> = {
  shellNavigation: [],
  path: '/app.html',
  navigationMode: 'sidebar',
  navigationAt: 'small',
  regions: [
    { value: 'eu', label: 'EU West' },
    { value: 'us', label: 'US East' },
    { value: 'apac', label: 'APAC' },
  ],
  reviewers: [
    { value: 'ada', label: 'Ada' },
    { value: 'ben', label: 'Ben' },
    { value: 'cy', label: 'Cy' },
  ],
};

/** Runtime presentation connections; they never mutate document source or revision. */
export const consumerActionState = {
  'task.submit': { pending: 'approving', error: 'submissionError', result: 'submissionResult' },
  'task.approve': { successValues: { assignOpen: true } },
  'task.assign': { successValues: { assignOpen: false } },
  'task.operation': { pending: 'busy', error: 'lastError', result: 'lastResult' },
  'task.configure': { pending: 'busy', error: 'lastError', result: 'lastResult' },
  'task.schedule': { pending: 'busy', error: 'lastError', result: 'lastResult' },
  'task.archive': { pending: 'busy', error: 'lastError', result: 'lastResult', successValues: { archiveOpen: false } },
} as const;

/** Browser URL routing is a consumer concern; navigation labels/composition come from the manifest. */
export function consumerViewFor(documents: readonly UiDocument[], id: ConsumerRouteId) {
  const application = consumerApplication(documents);
  const href = (routeId: string) => `/app.html?doc=${routeId}`;
  return { ...consumerViewData, path: href(id),
    shellNavigation: application.routes.filter(route => route.nav).map(route => ({ label: route.nav?.label, href: href(route.id) })),
    navigationMode: application.composition?.navigation ?? 'sidebar', navigationAt: application.composition?.responsive?.navigationAt ?? 'small' };
}
