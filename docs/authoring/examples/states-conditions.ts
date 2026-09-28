/**
 * EXAMPLE — screen states (loading/empty/validation/denied/failure/stale/
 * partial), status surfaces, tabs, and @2 conditions (visibleWhen/disabledWhen).
 *
 * Compile-check this file in CI (packages/application/test/authoring-examples.test.ts).
 * Check it locally with:  vict check docs/authoring/examples/states-conditions.ts
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
      { name: 'status', type: 'string', label: 'Status' },
    ],
    authorization: { effect: 'read' },
  }),
];

export const application = defineApplication({
  schema: APPLICATION_DEFINITION_SCHEMA_V2,
  id: 'app.example.states',
  revision: '1',
  name: 'States example',
  routes: [{ id: 'home', path: '/', screenId: 's.home', nav: { label: 'Home', order: 1 } }],
  screens: [
    {
      id: 's.home',
      title: 'Home',
      // Closed state keys: loading, empty, validation, denied, failure (+ @2: stale, partial).
      states: {
        loading: { role: 'text', id: 't.loading', content: 'Loading…' },
        empty: { role: 'text', id: 't.empty', content: 'Nothing here yet.' },
        failure: { role: 'text', id: 't.failure', content: 'Something failed safely.' },
      },
      layout: [
        {
          name: 'main',
          surfaces: [
            {
              role: 'view',
              id: 'v.list',
              viewId: 'v.tasks',
              visibleWhen: { viewNonEmpty: 'v.tasks' },
            },
            {
              role: 'status',
              id: 'st.status',
              field: 'status', // record field (a static `value` is the alternative)
              tones: { open: 'info', done: 'success', blocked: 'danger' }, // closed tones
            },
            {
              role: 'tabs',
              id: 'tb.panels',
              tabs: [
                {
                  name: 'details',
                  label: 'Details',
                  surfaces: [{ role: 'text', id: 't.d', content: 'Details.' }],
                },
                {
                  name: 'notes',
                  label: 'Notes',
                  surfaces: [{ role: 'text', id: 't.n', content: 'Notes.' }],
                },
              ],
            },
            {
              role: 'action',
              id: 'a.dangerous',
              actionId: 'act.go',
              label: 'Run',
              // @2 conditions: closed vocabularies.
              disabledWhen: { paramMissing: 'id' },
              visibleWhen: { viewNonEmpty: 'v.tasks' },
            },
          ],
        },
      ],
    },
  ],
  views: [
    {
      viewId: 'v.tasks',
      resourceId: 'tasks',
      resourceRevision: '1',
      fields: ['id', 'title', 'status'],
    },
  ],
  forms: [],
  actions: [{ kind: 'navigation', id: 'act.go', revision: '1', routeId: 'home' }],
  resources: [{ resourceId: 'tasks', revision: '1' }],
  compatibility: { applicationSchema: APPLICATION_DEFINITION_SCHEMA_V2 },
});
