<script lang="ts">
  /**
   * The `dialog` and `drawer` roles: an accessible overlay with a trigger
   * button, focus management (initial focus, Escape, focus trap, focus
   * restore), and nested content surfaces.
   */
  import type { ComponentRegistry } from '@vict/application/renderer';
  import type { VictPlanView, PlanSurface, ViewDatum, ActionResult } from './logic.js';
    import Surface from './Surface.svelte';

  interface Props {
    surface: PlanSurface;
    plan: VictPlanView;
    registry: ComponentRegistry;
    context: {
      readonly params: Readonly<Record<string, string>>;
      readonly viewRowCount: (viewId: string) => number;
    };
    params: Readonly<Record<string, string>>;
    viewData: Readonly<Record<string, ViewDatum>>;
    record: Record<string, unknown> | null;
    run: (actionId: string, input?: unknown) => Promise<void>;
    dispatch: (actionId: string, input?: unknown) => Promise<ActionResult>;
    onInvalidate?: () => void;
    navigate?: (path: string) => void;
  }

  let {
    surface,
    plan,
    registry,
    context,
    params,
    viewData,
    record,
    run,
    dispatch,
    onInvalidate,
    navigate,
  }: Props = $props();

  const isDrawer = $derived(surface.role === 'drawer');
  let open = $state(false);
  let panel = $state<HTMLElement | null>(null);
  let trigger = $state<HTMLButtonElement | null>(null);

  function openOverlay(): void {
    open = true;
    queueMicrotask(() => {
      panel?.focus();
    });
  }

  function closeOverlay(): void {
    open = false;
    queueMicrotask(() => {
      trigger?.focus();
    });
  }

  function onKeydown(event: KeyboardEvent): void {
    if (!open) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeOverlay();
      return;
    }
    if (event.key === 'Tab' && panel !== null) {
      // Simple focus trap across the panel's focusable descendants.
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<button
  type="button"
  class="vict-btn vict-btn--secondary"
  bind:this={trigger}
  data-surface={surface.id}
  data-testid="overlay-trigger"
  aria-haspopup="dialog"
  aria-expanded={open}
  onclick={openOverlay}
>
  {typeof surface.triggerLabel === 'string' ? surface.triggerLabel : 'Open'}
</button>

{#if open}
  <div class="vict-overlay" class:vict-overlay--drawer={isDrawer} data-testid="overlay">
    <button
      type="button"
      class="vict-overlay-backdrop"
      aria-label="Close overlay"
      data-testid="overlay-backdrop"
      onclick={closeOverlay}
    ></button>
    <div
      class={isDrawer ? 'vict-drawer' : 'vict-dialog'}
      role="dialog"
      aria-modal="true"
      aria-label={typeof surface.title === 'string' ? surface.title : 'Dialog'}
      data-testid="overlay-panel"
      tabindex="-1"
      bind:this={panel}
    >
      <header class="vict-overlay-header">
        <h2>{typeof surface.title === 'string' ? surface.title : ''}</h2>
        <button
          type="button"
          class="vict-btn vict-btn--secondary"
          data-testid="overlay-close"
          onclick={closeOverlay}
        >
          Close
        </button>
      </header>
      {#each ((surface.content ?? []) as readonly PlanSurface[]) as nested (nested.id)}
        <Surface
          surface={nested}
          {plan}
          {registry}
          {context}
          {params}
          {viewData}
          {record}
          {run}
          {dispatch}
          {onInvalidate}
          {navigate}
        />
      {/each}
    </div>
  </div>
{/if}

<style>
  .vict-overlay-backdrop {
    position: absolute;
    inset: 0;
    background: none;
    border: none;
    cursor: default;
  }

  .vict-dialog,
  .vict-drawer {
    position: relative;
    z-index: 1;
  }

  .vict-overlay-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(var(--vict-spacing-unit) * 2);
    margin-bottom: calc(var(--vict-spacing-unit) * 3);
  }

  .vict-overlay-header h2 {
    margin: 0;
    font-size: 1.1rem;
  }
</style>
