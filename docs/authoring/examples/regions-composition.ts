/**
 * EXAMPLE — responsive regions: split layout, region presentation, and
 * application/page composition choices.
 *
 * Compile-check this file in CI (packages/application/test/authoring-examples.test.ts).
 * Check it locally with:  vict check docs/authoring/examples/regions-composition.ts
 */
import { APPLICATION_DEFINITION_SCHEMA_V2, defineApplication } from '@victframework/sdk';

export const application = defineApplication({
  schema: APPLICATION_DEFINITION_SCHEMA_V2,
  id: 'app.example.regions',
  revision: '1',
  name: 'Regions example',
  // Application composition: navigation arrangement, width, density,
  // and the breakpoint below which primary navigation collapses to a drawer.
  composition: { navigation: 'sidebar', contentWidth: 'wide', density: 'comfortable', responsive: { navigationAt: 'medium' } },
  routes: [{ id: 'home', path: '/', screenId: 's.home', nav: { label: 'Home', order: 1 } }],
  screens: [
    {
      id: 's.home',
      title: 'Home',
      layoutMode: 'split', // closed vocabulary: 'stack' | 'split'
      // Page composition refines the application defaults on this screen.
      composition: { contentWidth: 'standard', supportingWidth: 'narrow', stackAt: 'large' },
      layout: [
        {
          name: 'main',
          // Region presentation is declared flat on the region (closed: size,
          // appearance, flow).
          size: 'main',
          appearance: 'panel',
          flow: 'stack',
          surfaces: [{ role: 'text', id: 't.main', content: 'Primary content.' }],
        },
        {
          name: 'supporting',
          size: 'aside',
          appearance: 'plain',
          surfaces: [{ role: 'text', id: 't.aside', content: 'Supporting content.' }],
        },
      ],
    },
  ],
  views: [],
  forms: [],
  actions: [],
  resources: [],
  compatibility: { applicationSchema: APPLICATION_DEFINITION_SCHEMA_V2 },
});
