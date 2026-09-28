import type { ApplicationPlan, ApplicationRenderer } from '@victframework/application';
import type { RenderedApplication, RendererBindings } from '@victframework/application/renderer';
import { BUILT_IN_ROLES, validatePlanForRenderer, type VictPlanView } from './logic.js';
import { renderVictApplication, type MountedVictApplication } from './mount.svelte.js';

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
