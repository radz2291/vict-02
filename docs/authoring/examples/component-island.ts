/**
 * EXAMPLE — component islands with context bindings (record fields and route params).
 *
 * `props` carry static scalars; `input` maps island inputs to closed
 * context-binding objects: exactly one of `{ param }`, `{ record }` or
 * `{ view }` with a non-empty string name. Referenced components must be
 * declared in the application's `components` member (references) — the
 * compile input carries the same entries as the registry.
 * Compile-check this file in CI (packages/application/test/authoring-examples.test.ts).
 * Check it locally with:  vict check docs/authoring/examples/component-island.ts
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
    authorization: { effect: 'read' },
  }),
];

export const components = [
  { componentId: 'app.priority-badge', revision: '1' },
  { componentId: 'app.task-summary', revision: '1' },
];

export const application = defineApplication({
  schema: APPLICATION_DEFINITION_SCHEMA_V2,
  id: 'app.example.islands',
  revision: '1',
  name: 'Island example',
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
              role: 'component',
              id: 'c.summary',
              componentId: 'app.task-summary',
              revision: '1',
              // Static scalar props only.
              props: { compact: true, heading: 'Task' },
              // Context bindings are closed objects: exactly one of
              // { param }, { record } or { view } with a field/route-param name.
              input: {
                taskId: { param: 'id' },
                title: { record: 'title' },
                priority: { record: 'priority' },
              },
            },
          ],
        },
      ],
      // `viewId` on a view surface binds the record context; component islands
      // read `record:*` from the view bound by the SAME screen's view surface.
      states: {},
    },
  ],
  components: [
    { componentId: 'app.task-summary', revision: '1' },
  ],
  views: [
    {
      viewId: 'v.task',
      resourceId: 'tasks',
      resourceRevision: '1',
      fields: ['id', 'title', 'priority'],
    },
  ],
  forms: [],
  actions: [],
  resources: [{ resourceId: 'tasks', revision: '1' }],
  compatibility: { applicationSchema: APPLICATION_DEFINITION_SCHEMA_V2 },
});
