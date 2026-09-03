/// <reference lib="dom" />
import { flushSync, mount, unmount } from 'svelte';
import VitApp from './VitApp.svelte';

/**
 * Mount the generic application host with REACTIVE props ($state): updates
 * through `update()` propagate into the mounted component without
 * remounting, which is exactly the permanent reactivity guarantee the
 * Stage 05 tests exercise (path / plan / rows / registry changes must never
 * leave stale resolution).
 */
export interface RenderVictApplicationOptions {
  readonly plan: unknown;
  readonly registry: unknown;
  readonly dispatch: (actionId: string, input?: unknown) => Promise<unknown>;
  readonly path?: string;
  readonly viewData?: Record<string, unknown>;
  readonly record?: Record<string, unknown> | null;
  readonly target?: HTMLElement;
  readonly navigate?: (path: string) => void;
}

export interface MountedVictApplication {
  readonly output: HTMLElement;
  update(props: Record<string, unknown>): void;
  unmount(): void;
}

export function renderVictApplication(
  options: RenderVictApplicationOptions,
): MountedVictApplication {
  let target = options.target;
  if (target === undefined) {
    target = document.createElement('div');
    document.body.appendChild(target);
  }
  const props = $state({
    plan: options.plan,
    registry: options.registry,
    dispatch: options.dispatch,
    path: options.path ?? '/',
    viewData: options.viewData ?? {},
    record: options.record ?? null,
    navigate: options.navigate,
  });
  const instance = mount(VitApp, { target, props });
  flushSync();
  let unmounted = false;
  const mountTarget = target;
  return {
    output: mountTarget,
    update(next: Record<string, unknown>): void {
      Object.assign(props, next);
      flushSync();
    },
    unmount(): void {
      if (unmounted) {
        return; // idempotent teardown
      }
      unmounted = true;
      // Idempotent teardown: the component instance is destroyed. The
      // rendered DOM is intentionally left in place as a static snapshot so
      // post-unmount inspection (e.g. conformance canary scans of the last
      // output) still works; the host page owns node removal.
      unmount(instance);
    },
  };
}
