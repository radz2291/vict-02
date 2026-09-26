import { error } from '@sveltejs/kit';
import { serverForPath } from '$lib/server/preview-server';
import type { PageServerLoad } from './$types';

// The ONLY page server load of the showcase: resolves the route from the
// neutral plan (parameters and redirects included) and reads declared view
// data through the application-data port. Unknown paths produce a
// structured 404 — never a silent fallback.
export const load: PageServerLoad = async ({ url }) => {
  const path = url.pathname === '' ? '/' : url.pathname;
  const app = serverForPath(path);
  if (!app) throw error(404, 'No application route is declared for this path.');
  const route = await app.loadRoute(path, url.searchParams);
  if (route === null) {
    throw error(404, 'No application route is declared for this path.');
  }
  return {
    ...(process.env.VICT_COMPOSITION === '1'
      ? { actionEndpoint: '/api/act?application=' + encodeURIComponent(app.plan.applicationId) }
      : {}),
    plan: route.plan as unknown as Record<string, unknown>,
    viewData: route.viewData as unknown as Record<string, unknown>,
    record: (route.record ?? null) as Record<string, unknown> | null,
  };
};
