import { flushSync, mount, unmount } from 'svelte';
import type { ApplicationPlan, ApplicationRenderer } from '@vict/application';
import type { ComponentRegistry } from '@vict/application/renderer';
import { createComponentRegistry } from '@vict/application/renderer';
import ApplicationHost from './ApplicationHost.svelte';
import Badge from './components/Badge.svelte';

/**
 * The proof's ACTUAL renderer and component registry — shared by the
 * client page, the renderer-conformance suite, and the server-side release
 * compilation, so the release verification context is always sourced from
 * the real deployment objects (never re-declared text).
 */

export type ProofDispatch = (
  actionId: string,
  input?: unknown,
) => Promise<{ ok: boolean; value?: unknown; code?: string; message?: string }>;

/** The trusted local component registry of this deployment (outside the manifest). */
export function createProofComponentRegistry(): ComponentRegistry {
  const registry = createComponentRegistry('registry.proof', '1');
  registry.register({ componentId: 'cmp.badge', revision: '1', implementation: Badge });
  return registry;
}

/** The proof's real Svelte renderer (id + revision participate in release identity). */
export function createProofRenderer(_dispatch: ProofDispatch): ApplicationRenderer {
  return {
    id: 'renderer.svelte-proof',
    revision: '1',
    // The proof host implements these roles; standalone 'states' marker
    // surfaces are NOT supported (states render through screen.states).
    supportedSurfaceRoles: ['text', 'view', 'form', 'action', 'component'],
    render(plan: ApplicationPlan, bindings) {
      // Components come EXPLICITLY from the supplied bindings — the host
      // never consults a global or implicit registry.
      const target = document.createElement('div');
      document.body.appendChild(target);
      const instance = mount(ApplicationHost, {
        target,
        props: {
          plan,
          registry: bindings.components,
          dispatch: bindings.dispatch.execute,
          rows: [],
        },
      });
      flushSync();
      // Idempotent teardown (Svelte's unmount throws on the second call).
      let unmounted = false;
      return {
        output: target,
        unmount(): void {
          if (unmounted) {
            return;
          }
          unmounted = true;
          unmount(instance);
          target.remove();
        },
      };
    },
  };
}