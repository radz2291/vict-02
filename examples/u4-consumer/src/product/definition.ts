/**
 * The consumer's PRODUCT surface: a small task-review domain. Actions are
 * declared here (the application's declared-action authority — the renderer
 * never invents them); the input contract is declared with the application
 * so `deriveActionInputCatalog` can type output-binding action inputs.
 * View data supplies the select/radio options (array-typed reference-only
 * props bind to `view.*` fields).
 */
import type { UiFieldTypes } from '@victframework/ui';

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
];

export const consumerContracts: readonly { id: string; revision: string }[] = [
  { id: 'c.taskAck', revision: '1' },
  { id: 'c.taskSubmit', revision: '1' },
  { id: 'c.taskAssign', revision: '1' },
  { id: 'c.taskRegion', revision: '1' },
  { id: 'c.unit', revision: '1' },
];

/**
 * Declarative input types per contract (amendment §3.5): the neutral
 * contracts API carries `parse` functions, so the application declares the
 * input NAMES AND TYPES its contracts accept; the derived catalog types
 * output-binding action inputs against these.
 */
export const consumerContractInputTypes: Readonly<
  Record<string, Readonly<Record<string, 'string' | 'number' | 'boolean'>>>
> = {
  'c.taskAck': { noteId: 'string', ack: 'boolean' },
  'c.taskSubmit': { noteId: 'string' },
  'c.taskAssign': { noteId: 'string' },
  'c.taskRegion': { region: 'string' },
};

export const consumerActionIds: readonly string[] = consumerActions.map((action) => action.id);

export const consumerViewFields: UiFieldTypes = {
  regions: 'array',
  reviewers: 'array',
};

/** View data: option objects for the select/radio-group array props. */
export const consumerViewData: Record<string, unknown> = {
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
