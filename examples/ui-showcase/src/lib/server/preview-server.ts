import { resolveRoute } from '@victframework/ui-svelte';
import {
  compileCompositionPlan,
  requestsApplication,
  workspaceApplication,
} from '$lib/application/composition.js';
import {
  createShowcaseServer,
  createAgentServer,
  getShowcaseServer,
  type ShowcaseAppServer,
} from './application-server.js';

let compositionServers: ShowcaseAppServer[] | undefined;
let productServer: ShowcaseAppServer | undefined;
/** The preview registers independent applications. Each owns its routes and data. */
function servers(): ShowcaseAppServer[] {
  if (process.env.VICT_PRODUCT === '1') {
    productServer ??= createAgentServer();
    return [productServer];
  }
  if (process.env.VICT_COMPOSITION !== '1') return [getShowcaseServer()];
  return (compositionServers ??= [requestsApplication, workspaceApplication].map((application) =>
    createShowcaseServer({ foundation: true, plan: compileCompositionPlan(application) }),
  ));
}
export function serverForPath(path: string): ShowcaseAppServer | undefined {
  return servers().find((server) => resolveRoute(server.plan, path) !== null);
}
export function serverForId(id: string | null): ShowcaseAppServer | undefined {
  if (id === null) {
    return process.env.VICT_PRODUCT === '1' || process.env.VICT_COMPOSITION === '1'
      ? undefined
      : getShowcaseServer();
  }
  return servers().find((server) => server.plan.applicationId === id);
}
