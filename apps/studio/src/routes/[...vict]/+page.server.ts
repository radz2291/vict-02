import { error } from '@sveltejs/kit';
import { getStudioServer } from '$lib/server/app-server.js';
import type { PageServerLoad } from './$types';

// The GENERIC application host page server load — the only page server
// load of the application shell. It resolves the route from the compiled
// plan and loads declared view data through the HTTP-backed adapter on the
// server. Unknown paths produce a structured 404 — never a silent fallback
// to the first declared route.
export const load: PageServerLoad = async ({ url }) => {
  const app = getStudioServer();
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
