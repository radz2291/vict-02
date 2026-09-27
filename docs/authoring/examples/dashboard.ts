/**
 * EXAMPLE — count, chart, and text on a dashboard screen (with an empty state).
 *
 * Compile-check this file in CI (packages/application/test/authoring-examples.test.ts).
 * Check it locally with:  vict check docs/authoring/examples/dashboard.ts
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
      { name: 'status', type: 'string', label: 'Status' },
      { name: 'day', type: 'string', label: 'Day' },
      { name: 'qty', type: 'number', label: 'Count' },
    ],
    authorization: { effect: 'read' },
  }),
];

export const application = defineApplication({
  schema: APPLICATION_DEFINITION_SCHEMA_V2,
  id: 'app.example.dashboard',
  revision: '1',
  name: 'Dashboard example',
  routes: [{ id: 'home', path: '/', screenId: 's.dashboard', nav: { label: 'Dashboard', order: 1 } }],
  screens: [
    {
      id: 's.dashboard',
      title: 'Dashboard',
      layout: [
        {
          name: 'main',
          surfaces: [
            // Count of one filtered view.
            { role: 'count', id: 'n.open', viewId: 'v.open', label: 'Open tasks' },
            { role: 'text', id: 't.title', content: 'Completions per day', level: 3 },
            {
              role: 'chart',
              id: 'c.days',
              viewId: 'v.byDay',
              kind: 'bar', // closed vocabulary: 'bar' | 'line'
              xField: 'day',
              yField: 'qty',
              summary: 'Completed tasks per day',
              title: 'Completed per day',
            },
          ],
        },
      ],
      states: {
        empty: { role: 'text', id: 't.empty', content: 'Nothing recorded yet.' },
      },
    },
  ],
  views: [
    { viewId: 'v.open', resourceId: 'tasks', resourceRevision: '1', fields: ['id'], filters: { status: 'open' } },
    {
      viewId: 'v.byDay',
      resourceId: 'tasks',
      resourceRevision: '1',
      fields: ['day', 'qty'],
      sort: [{ field: 'day', direction: 'asc' }],
    },
  ],
  forms: [],
  actions: [],
  resources: [{ resourceId: 'tasks', revision: '1' }],
  compatibility: { applicationSchema: APPLICATION_DEFINITION_SCHEMA_V2 },
});
