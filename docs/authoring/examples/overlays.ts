/**
 * EXAMPLE — overlays: dialog and drawer surfaces with content arrays.
 *
 * Compile-check this file in CI (packages/application/test/authoring-examples.test.ts).
 * Check it locally with:  vict check docs/authoring/examples/overlays.ts
 */
import { APPLICATION_DEFINITION_SCHEMA_V2, defineApplication } from '@victframework/sdk';

export const application = defineApplication({
  schema: APPLICATION_DEFINITION_SCHEMA_V2,
  id: 'app.example.overlays',
  revision: '1',
  name: 'Overlay example',
  routes: [{ id: 'home', path: '/', screenId: 's.home', nav: { label: 'Home', order: 1 } }],
  screens: [
    {
      id: 's.home',
      title: 'Home',
      layout: [
        {
          name: 'main',
          surfaces: [
            { role: 'action', id: 'a.act', actionId: 'act.go', label: 'Go' },
            {
              role: 'dialog',
              id: 'd.confirm',
              title: 'Confirm',
              triggerLabel: 'Open dialog',
              content: [{ role: 'text', id: 't.body', content: 'Proceed?' }],
            },
            {
              role: 'drawer',
              id: 'dr.details',
              title: 'Details',
              triggerLabel: 'Open details',
              content: [{ role: 'text', id: 't.info', content: 'More information.' }],
            },
          ],
        },
      ],
    },
  ],
  views: [],
  forms: [],
  actions: [{ kind: 'navigation', id: 'act.go', revision: '1', routeId: 'home' }],
  resources: [],
  compatibility: { applicationSchema: APPLICATION_DEFINITION_SCHEMA_V2 },
});
