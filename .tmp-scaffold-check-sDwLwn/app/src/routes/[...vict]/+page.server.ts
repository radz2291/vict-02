import { error } from '@sveltejs/kit';
import { getAppServer } from '$lib/server/application-server';
import type { PageServerLoad } from './$types';

// GENERIC HOST LOAD — scaffolder-owned, domain-free.
//
// The ONLY page server load of the application: awaits the (asynchronous)
// application factory and delegates to the plan-driven loadRoute, which
// resolves ANY declared route (including :name parameters), loads EVERY
// declared view of the resolved screen with its declared filters/sort/
// projection, and fetches declared records for parameterized routes.
// Unknown paths produce a structured 404 — never a silent fallback. This
// file contains no domain facts and never needs editing per application.
export const load: PageServerLoad = async ({ url }) => {
  const app = await getAppServer();
  const loaded = await app.loadRoute(url.pathname === '' ? '/' : url.pathname);
  if (loaded === null) {
    throw error(404, 'No application route is declared for this path.');
  }
  return loaded;
};
