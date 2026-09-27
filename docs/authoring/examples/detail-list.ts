/**
 * EXAMPLE — detail and list surfaces bound to a view.
 *
 * Compile-check this file in CI (packages/application/test/authoring-examples.test.ts).
 * Check it locally with:  vict check docs/authoring/examples/detail-list.ts
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
      { name: 'notes', type: 'string', label: 'Notes' },
    ],
    authorization: { effect: 'read' },
  }),
];

export const application = defineApplication({
  schema: APPLICATION_DEFINITION_SCHEMA_V2,
  id: 'app.example.detail',
  revision: '1',
  name: 'Detail example',
  routes: [{ id: 'task', path: '/tasks/:id', screenId: 's.task' }],
  screens: [
    {
      id: 's.task',
      title: 'Task',
      layout: [
        {
          name: 'main',
          surfaces: [
            {
              role: 'detail',
              id: 'dt.task',
              viewId: 'v.task',
              fields: ['title', 'notes'], // subset projection of the view
              emptyMessage: 'Task not found.',
            },
            {
              role: 'list',
              id: 'li.related',
              viewId: 'v.related',
              titleField: 'title',
              secondaryField: 'notes',
              emptyMessage: 'No related tasks.',
            },
          ],
        },
      ],
    },
  ],
  views: [
    { viewId: 'v.task', resourceId: 'tasks', resourceRevision: '1', fields: ['id', 'title', 'notes'] },
    { viewId: 'v.related', resourceId: 'tasks', resourceRevision: '1', fields: ['id', 'title', 'notes'] },
  ],
  forms: [],
  actions: [],
  resources: [{ resourceId: 'tasks', revision: '1' }],
  compatibility: { applicationSchema: APPLICATION_DEFINITION_SCHEMA_V2 },
});
