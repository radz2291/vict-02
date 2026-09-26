import { resolveRoute } from '@victframework/ui-svelte';
import {
  compileCompositionPlan,
  requestsApplication,
  workspaceApplication,
} from '$lib/application/composition.js';
import {
  createShowcaseServer,
  getShowcaseServer,
  type ShowcaseAppServer,
} from './application-server.js';

let compositionServers: ShowcaseAppServer[] | undefined;
function servers(): ShowcaseAppServer[] {
  if (process.env.VICT_COMPOSITION !== '1') return [getShowcaseServer()];
  return (compositionServers ??= [requestsApplication, workspaceApplication].map((application) =>
    createShowcaseServer({ foundation: true, plan: compileCompositionPlan(application) }),
  ));
}
/** The preview registers independent applications. Each owns its routes and data. */
export function serverForPath(path: string): ShowcaseAppServer | undefined {
  return servers().find((server) => resolveRoute(server.plan, path) !== null);
}
export function serverForId(id: string | null): ShowcaseAppServer | undefined {
  return id === null && process.env.VICT_COMPOSITION !== '1'
    ? getShowcaseServer()
    : servers().find((server) => server.plan.applicationId === id);
}
