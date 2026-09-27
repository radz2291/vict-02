import { APPLICATION_DEFINITION_SCHEMA_V2, defineApplication } from '@victframework/sdk';

// This fixture is INTENTIONALLY INVALID: the unknown surface field `colour`
// (APPLICATION_UNKNOWN_FIELD) and the unknown surface role `gauge`
// (UNKNOWN_SURFACE_ROLE) must both be reported by `vict check` with exit 4.
// The invalid entries are injected as an untyped patch over an otherwise
// well-typed definition so this fixture file still typechecks — the
// compiler, not tsc, is the authority that rejects them at runtime.
const invalidSurfaces: readonly Record<string, unknown>[] = [
  { role: 'text', id: 't.hi', content: 'Hi', colour: 'red' },
  { role: 'gauge', id: 'g.one', viewId: 'v.x' },
];

export const application = defineApplication({
  schema: APPLICATION_DEFINITION_SCHEMA_V2,
  id: 'app.check.broken',
  revision: '1',
  name: 'Broken',
  routes: [{ id: 'home', path: '/', screenId: 's.home', nav: { label: 'Home', order: 1 } }],
  screens: [
    {
      id: 's.home',
      title: 'Home',
      layout: [
        {
          name: 'main',
          surfaces: invalidSurfaces as never,
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
