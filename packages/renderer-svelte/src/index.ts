import type { ApplicationPlan, ApplicationRenderer } from '@vict/application';
import type { RenderedApplication, RendererBindings } from '@vict/application/renderer';
import VitApp from './VitApp.svelte';
import { BUILT_IN_ROLES, validatePlanForRenderer, type VictPlanView } from './logic.js';
import {
  renderVictApplication,
  type MountedVictApplication,
  type RenderVictApplicationOptions,
} from './mount.svelte.js';

export { RendererDiagnostic } from '@vict/application/renderer';
export {
  resolveRoute,
  matchPath,
  themeVariables,
  validatePlanForRenderer,
  collectSurfaces,
  BUILT_IN_ROLES,
  type VictPlanView,
  type ResolvedRoute,
  type ActionResult,
  type ViewDatum,
} from './logic.js';
export { renderVictApplication } from './mount.svelte.js';
export type { MountedVictApplication, RenderVictApplicationOptions };
export { default as VitApp } from './VitApp.svelte';
void VitApp;

/** The canonical renderer identity (participates in release identity only). */
export const RENDERER_ID = 'renderer.svelte-kit';
export const RENDERER_REVISION = '5.0.0';

/**
 * The canonical SvelteKit `ApplicationRenderer`: id + revision participate
 * in RELEASE identity (never application identity). `render` performs the
 * structural pre-validation (supported roles, exact component resolution)
 * BEFORE mounting, so malformed plans fail with structured diagnostics
 * instead of partial rendering.
 */
export function createVictRenderer(): ApplicationRenderer {
  return {
    id: RENDERER_ID,
    revision: RENDERER_REVISION,
    supportedSurfaceRoles: BUILT_IN_ROLES,
    render(plan: ApplicationPlan, bindings: RendererBindings): RenderedApplication {
      // Explicit structural validation before any unsafe rendering.
      validatePlanForRenderer(plan as unknown as VictPlanView, bindings.components, BUILT_IN_ROLES);
      const mounted: MountedVictApplication = renderVictApplication({
        plan,
        registry: bindings.components,
        dispatch: bindings.dispatch.execute,
      });
      return {
        output: mounted.output,
        unmount(): void {
          mounted.unmount();
        },
      };
    },
  };
}
