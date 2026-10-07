import type { PageServerLoad } from './$types.js';
import {
  getProductServer,
  actorFrom,
  SCENARIO_IDS,
  type ImplementationMode,
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
  const mode = url.searchParams.get('mode');
  if (
    (mode === 'simulated' || mode === 'durable-local') &&
    mode !== product.mode
  ) {
    product.reset(product.scenario, mode as ImplementationMode);
  }
  return product.server.dispatch('inspection.list', {}, actor).then((result) => ({
    rows: result.ok ? ((result.value as { rows: Record<string, unknown>[] }).rows ?? []) : [],
    scenario: product.scenario,
    mode: product.mode,
    actorRole: actor.role,
  }));
};
