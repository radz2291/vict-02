/**
 * EXAMPLE — create/edit forms with a select widget and governed feedback.
 *
 * Compile-check this file in CI (packages/application/test/authoring-examples.test.ts).
 * Check it locally with:  vict check docs/authoring/examples/form.ts
 */
import {
  APPLICATION_DEFINITION_SCHEMA_V2,
  RESOURCE_DEFINITION_SCHEMA,
  defineApplication,
  defineResource,
} from '@victframework/sdk';

export const resources = [
  defineResource({
    schema: RESOURCE_DEFINITION_SCHEMA,
    id: 'tasks',
    revision: '1',
    identity: { key: 'id' },
    fields: [
      { name: 'id', type: 'string', required: true, label: 'Id' },
      { name: 'title', type: 'string', required: true, label: 'Title' },
      { name: 'priority', type: 'string', label: 'Priority' },
    ],
    mutations: [
      {
        op: 'create',
        effect: 'write',
        inputContractId: 'task.create.input',
        idempotency: 'keyed',
        permissions: ['tasks.write'],
      },
      {
        op: 'update',
        effect: 'write',
        inputContractId: 'task.update.input',
        permissions: ['tasks.write'],
      },
    ],
    authorization: { effect: 'read' },
  }),
];

export const contracts = [
  { id: 'task.create.input', revision: '1' },
  { id: 'task.update.input', revision: '1' },
];

export const application = defineApplication({
  schema: APPLICATION_DEFINITION_SCHEMA_V2,
  id: 'app.example.form',
  revision: '1',
  name: 'Form example',
  routes: [
    { id: 'new', path: '/tasks/new', screenId: 's.new' },
    { id: 'edit', path: '/tasks/:id', screenId: 's.edit' },
  ],
  screens: [
    {
      id: 's.new',
      title: 'New task',
      layout: [{ name: 'main', surfaces: [{ role: 'form', id: 'f.new', formId: 'f.create' }] }],
    },
    {
      id: 's.edit',
      title: 'Edit task',
      layout: [{ name: 'main', surfaces: [{ role: 'form', id: 'f.edit', formId: 'f.update' }] }],
    },
  ],
  views: [],
  forms: [
    {
      formId: 'f.create',
      resourceId: 'tasks',
      resourceRevision: '1',
      inputContractId: 'task.create.input',
      submitActionId: 'act.create',
      fields: [
        { name: 'title', label: 'Title', required: true, widget: 'text' },
        {
          name: 'priority',
          label: 'Priority',
          required: true,
          widget: 'select',
          options: [
            { value: 'low', label: 'Low' },
            { value: 'high', label: 'High' },
          ],
        },
      ],
    },
    {
      formId: 'f.update',
      resourceId: 'tasks',
      resourceRevision: '1',
      inputContractId: 'task.update.input',
      submitActionId: 'act.update',
      fields: [{ name: 'title', label: 'Title', required: true, widget: 'text' }],
    },
  ],
  actions: [
    {
      kind: 'mutation',
      id: 'act.create',
      revision: '1',
      resourceId: 'tasks',
      resourceRevision: '1',
      op: 'create',
      inputContractId: 'task.create.input',
      feedback: { success: 'The task was created.', failure: 'The task was not created.' },
    },
    {
      kind: 'mutation',
      id: 'act.update',
      revision: '1',
      resourceId: 'tasks',
      resourceRevision: '1',
      op: 'update',
      inputContractId: 'task.update.input',
      feedback: { success: 'The task was saved.', validation: 'Check your details and try again.' },
    },
  ],
  resources: [{ resourceId: 'tasks', revision: '1' }],
  compatibility: { applicationSchema: APPLICATION_DEFINITION_SCHEMA_V2 },
});
