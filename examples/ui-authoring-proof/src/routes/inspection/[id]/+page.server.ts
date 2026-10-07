import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';
import { getProductServer, actorFrom } from '$lib/server/inspection.js';

export const load: PageServerLoad = ({ params, url }) => {
  const product = getProductServer();
  const actor = actorFrom(url);
  return product.server
    .dispatch('inspection.get', { id: params.id }, actor)
    .then((result) => {
      if (!result.ok) throw error(404, 'Inspection not found.');
      const record = result.value as Record<string, unknown>;
      return {
        id: params.id,
        record,
        activity: product.server.adapter.activityFor(String(record['id'])),
        actorRole: actor.role,
        scenario: product.scenario,
      };
    });
};
