import { error } from '@sveltejs/kit';
import { compileProofPlan } from '$lib/application/definition';
import { getProofServer } from '$lib/application/server';
import type { PageServerLoad } from './$types';

// Server-side load: compiles the neutral definition into the immutable plan
// (declarations + stable references only — no handlers, no secrets) and
// reads declared-view rows through the application-data port.
//
// Unknown application routes NEVER silently render the first declared
// route (LOW-04-J remediation): a path that does not match a declared
// route exactly produces a proper structured not-found outcome (HTTP 404).
export const load: PageServerLoad = async ({ url }) => {
  const plan = compileProofPlan();
  const path = url.pathname === '' ? '/' : url.pathname;
  const matches = plan.routes.some((route) => route.route.path === path);
  if (!matches) {
    throw error(
      404,
      `No application route is declared for this path (path length: ${path.length}). HTTP 404 not-found.`,
    );
  }
  const server = getProofServer();
  return {
    plan: plan.toJSON(),
    rows: (await server.listNotes()) as Record<string, unknown>[],
  };
};