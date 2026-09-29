import { resolveRoute } from '@victframework/ui-svelte';
import type { ViewDatum, VictPlanView } from '@victframework/ui-svelte';
import { compileStudioPlan } from '$lib/application/index.js';

/**
 * STUDIO APP SERVER — BUILDER TRACK `studio-server` OWNS THIS FILE
 * (and all of `src/lib/server/**`).
 *
 * This scaffold stub exists only so the generic host routes can typecheck
 * before the real server lands. Replace it with the full composition:
 * the deployment-provisioned target registry, the human session boundary,
 * the HTTP-backed `ApplicationDataAdapter` over `RESOURCE_BINDINGS`
 * (never VictStores), and route loading per the `loadRoute` conventions in
 * `$lib/shared/contract.ts`. Required export (signature is the interface):
 *
 *   getStudioServer(): StudioAppServer
 */
export interface StudioAppServer {
  loadRoute(
    path: string,
    searchParams?: URLSearchParams,
  ): Promise<{
    readonly plan: VictPlanView;
    readonly viewData: Record<string, ViewDatum>;
    readonly record: Record<string, unknown> | null;
  } | null>;
}

export function getStudioServer(): StudioAppServer {
  const planView = compileStudioPlan().toJSON() as unknown as VictPlanView;
  return {
    async loadRoute(path) {
      const resolved = resolveRoute(planView, path === '' ? '/' : path);
      if (resolved === null || resolved.screen === null) {
        return null;
      }
      return { plan: planView, viewData: {}, record: null };
    },
  };
}
