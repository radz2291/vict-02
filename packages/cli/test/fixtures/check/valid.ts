import { APPLICATION_DEFINITION_SCHEMA_V2, defineApplication } from '@victframework/sdk';

export const application = defineApplication({
  schema: APPLICATION_DEFINITION_SCHEMA_V2,
  id: 'app.check.valid',
  revision: '1',
  name: 'Valid',
  routes: [{ id: 'home', path: '/', screenId: 's.home', nav: { label: 'Home', order: 1 } }],
  screens: [
    {
      id: 's.home',
      title: 'Home',
      layout: [{ name: 'main', surfaces: [{ role: 'text', id: 't.hi', content: 'Hi' }] }],
    },
  ],
  views: [],
  forms: [],
  actions: [],
  resources: [],
  compatibility: { applicationSchema: APPLICATION_DEFINITION_SCHEMA_V2 },
});
