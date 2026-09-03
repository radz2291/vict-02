import { error } from '@sveltejs/kit';
import { getReferenceServer } from '$lib/server/application-server.sqlite';
import type { PageServerLoad } from './$types';

// The ONLY page server load of the application: resolves the route from the
// neutral plan (parameters and redirects included) and reads declared view
// data through the application-data port. Unknown paths produce a
// structured 404 — never a silent fallback to the first declared route.
export const load: PageServerLoad = async ({ url }) => {
  const app = getReferenceServer();
  const path = url.pathname === '' ? '/' : url.pathname;
  const route = await app.loadRoute(path, url.searchParams);
  if (route === null) {
    throw error(404, 'No application route is declared for this path.');
  }
  return {
    plan: route.plan as unknown as Record<string, unknown>,
    viewData: route.viewData as unknown as Record<string, unknown>,
    record: (route.record ?? null) as Record<string, unknown> | null,
  };
};
