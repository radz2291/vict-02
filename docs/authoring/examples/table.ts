/**
 * EXAMPLE — table with declared sort, row action, and a component-island cell.
 *
 * Compile-check this file in CI (packages/application/test/authoring-examples.test.ts).
 * Check it locally with:  vict check docs/authoring/examples/table.ts
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
      { name: 'status', type: 'string', label: 'Status' },
      { name: 'createdAt', type: 'string', label: 'Created' },
    ],
    mutations: [
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

/** The compiler reads identity entries for contracts; real apps declare them via defineContract. */
export const contracts = [
  { id: 'task.update.input', revision: '1' },
  { id: 'task.update.output', revision: '1' },
];
export const capabilities = [{ id: 'task.complete', revision: '1' }];
export const components = [{ componentId: 'app.priority-badge', revision: '1' }];

export const application = defineApplication({
  schema: APPLICATION_DEFINITION_SCHEMA_V2,
  id: 'app.example.table',
  revision: '1',
  name: 'Table example',
  routes: [{ id: 'tasks', path: '/tasks', screenId: 's.tasks', nav: { label: 'Tasks', order: 1 } }],
  screens: [
    {
      id: 's.tasks',
      title: 'Tasks',
      layout: [
        {
          name: 'main',
          surfaces: [
            {
              role: 'table',
              id: 'tb.tasks',
              viewId: 'v.tasks',
              queryActionId: 'act.queryTasks',
              // Governed row action: dispatches a declared capability action per row.
              rowAction: { actionId: 'act.completeTask', label: 'Complete', input: { id: 'id' } },
              columns: [
                { field: 'title', label: 'Title', sortable: true },
                // Island cell: a registered component renders this column.
                {
                  field: 'priority',
                  label: 'Priority',
                  sortable: true,
                  componentId: 'app.priority-badge',
                  revision: '1',
                  props: { priority: 'priority' },
                },
                { field: 'status', label: 'Status' },
              ],
              searchFields: ['title'],
              pageSize: 5,
              emptyMessage: 'No tasks yet.',
            },
          ],
        },
      ],
    },
  ],
  components: [{ componentId: 'app.priority-badge', revision: '1' }],
  views: [
    {
      viewId: 'v.tasks',
      resourceId: 'tasks',
      resourceRevision: '1',
      fields: ['id', 'title', 'priority', 'status', 'createdAt'],
      // Declared deterministic sort: the table uses it until the user picks another.
      sort: [{ field: 'createdAt', direction: 'desc' }],
    },
  ],
  forms: [],
  actions: [
    {
      kind: 'query',
      id: 'act.queryTasks',
      revision: '1',
      resourceId: 'tasks',
      resourceRevision: '1',
    },
    {
      kind: 'capability',
      id: 'act.completeTask',
      revision: '1',
      capabilityId: 'task.complete',
      capabilityRevision: '1',
      inputContractId: 'task.update.input',
      outputContractId: 'task.update.output',
    },
  ],
  resources: [{ resourceId: 'tasks', revision: '1' }],
  compatibility: { applicationSchema: APPLICATION_DEFINITION_SCHEMA_V2 },
});
