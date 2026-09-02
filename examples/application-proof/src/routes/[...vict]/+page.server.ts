import { compileProofPlan } from '$lib/application/definition';
import { getProofServer } from '$lib/application/server';
import type { PageServerLoad } from './$types';

// Server-side load: compiles the neutral definition into the immutable plan
// (declarations + stable references only — no handlers, no secrets) and
// reads declared-view rows through the application-data port.
export const load: PageServerLoad = async () => {
  const server = getProofServer();
  const plan = compileProofPlan();
  return {
    plan: plan.toJSON(),
    rows: (await server.listNotes()) as Record<string, unknown>[],
  };
};
