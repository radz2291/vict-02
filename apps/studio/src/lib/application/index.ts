import { APPLICATION_DEFINITION_SCHEMA_V2, defineApplication } from '@victframework/sdk';
import { compileApplication } from '@victframework/application';
import type { ApplicationPlan } from '@victframework/application';

/**
 * STUDIO APPLICATION DEFINITION — BUILDER TRACK `studio-app` OWNS THIS FILE.
 *
 * This scaffold stub exists only so the other track (studio-server) can
 * integrate and typecheck against the agreed signature before the real
 * definition lands. Replace it with the real Studio Application
 * Definition/Plan: resources per `RESOURCE_BINDINGS` in
 * `$lib/shared/contract.ts`, routes/screens/views for the operator read
 * surface, the named custom component binding(s), and this exact export.
 *
 * REQUIRED EXPORT (signature is the interface; do not change it):
 *   compileStudioPlan(): ApplicationPlan
 */
export const studioApplication = defineApplication({
  schema: APPLICATION_DEFINITION_SCHEMA_V2,
  id: 'app.vict-studio',
  revision: '1',
  name: 'VICT Studio',
  routes: [{ id: 'home', path: '/', screenId: 's.home' }],
  screens: [
    {
      id: 's.home',
      title: 'VICT Studio',
      layout: [
        {
          name: 'main',
          surfaces: [
            {
              role: 'text',
              id: 't.scaffold',
              content: 'Studio scaffold: the application definition replaces this screen.',
              level: 1,
            },
          ],
        },
      ],
    },
  ],
  views: [],
  actions: [],
  resources: [],
});

export function compileStudioPlan(): ApplicationPlan {
  const result = compileApplication({
    application: studioApplication,
    resources: [],
    contracts: [],
    capabilities: [],
    components: [],
  });
  if (!result.ok) {
    throw new Error(`studio definition invalid: ${JSON.stringify(result.issues)}`);
  }
  return result.plan;
}
