/**
 * EXAMPLE — navigation: nav labels/groups/order, a parameter route, and a
 * @2 redirect route.
 *
 * Compile-check this file in CI (packages/application/test/authoring-examples.test.ts).
 * Check it locally with:  vict check docs/authoring/examples/navigation.ts
 */
import { APPLICATION_DEFINITION_SCHEMA_V2, defineApplication } from '@victframework/sdk';

export const application = defineApplication({
  schema: APPLICATION_DEFINITION_SCHEMA_V2,
  id: 'app.example.navigation',
  revision: '1',
  name: 'Navigation example',
  routes: [
    { id: 'home', path: '/', screenId: 's.home', nav: { label: 'Overview', group: 'Work', order: 1 } },
    { id: 'tasks', path: '/tasks', screenId: 's.tasks', nav: { label: 'Tasks', group: 'Work', order: 2 } },
    { id: 'task', path: '/tasks/:id', screenId: 's.task' }, // deep route: no nav entry
    { id: 'legacy', path: '/legacy', redirect: 'tasks' }, // @2 redirect route (screenId optional)
  ],
  screens: [
    {
      id: 's.home',
      title: 'Overview',
      layout: [{ name: 'main', surfaces: [{ role: 'text', id: 't.hello', content: 'Overview.' }] }],
    },
    {
      id: 's.tasks',
      title: 'Tasks',
      layout: [{ name: 'main', surfaces: [{ role: 'text', id: 't.tasks', content: 'Tasks.' }] }],
    },
    {
      id: 's.task',
      title: 'Task',
      breadcrumbs: [{ label: 'Home', routeId: 'home' }, { label: 'Tasks', routeId: 'tasks' }, { label: 'Detail' }],
      layout: [{ name: 'main', surfaces: [{ role: 'text', id: 't.task', content: 'One task.' }] }],
    },
  ],
  views: [],
  forms: [],
  actions: [],
  resources: [],
  compatibility: { applicationSchema: APPLICATION_DEFINITION_SCHEMA_V2 },
});
