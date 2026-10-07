import type { PageServerLoad } from './$types.js';
import {
  getProductServer,
  actorFrom,
  SCENARIO_IDS,
  type ScenarioId,
} from '$lib/server/inspection.js';

export const load: PageServerLoad = ({ url }) => {
  const product = getProductServer();
  const actor = actorFrom(url);
  const scenario = url.searchParams.get('scenario');
  if (
    scenario !== null &&
    (SCENARIO_IDS as readonly string[]).includes(scenario) &&
    scenario !== product.scenario
  ) {
    product.reset(scenario as ScenarioId);
  }
  return product.server.dispatch('inspection.list', {}, actor).then((result) => ({
    rows: result.ok ? ((result.value as { rows: Record<string, unknown>[] }).rows ?? []) : [],
    scenario: product.scenario,
    actorRole: actor.role,
  }));
};
