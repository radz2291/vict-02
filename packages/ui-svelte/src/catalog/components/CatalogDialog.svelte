<script lang="ts">
  /**
   * B1 catalog wrapper: the catalog Dialog (bits-ui Dialog parts styled by
   * catalog.css — the showcase reference surface, frozen fixture
   * dialog-slot.json). CONTROLLED open loop: `open` prop in; `openChange`
   * emits for trigger/Escape/overlay closes; the `body` slot carries
   * authored content (instance scope) with its own declared actions.
   * Portals render through bits-ui's configured portal target (the
   * ControlScope root).
   */
  import { Dialog } from 'bits-ui';
  import CatalogPortal from './CatalogPortal.svelte';
  import { catalogFocusReturn } from './focus-return.js';
  import type { UiSvelteComponentIO, UiComponentPresentation } from '../../document/extensions.js';

  interface Props {
    readonly props: Readonly<Record<string, unknown>>;
    readonly io?: UiSvelteComponentIO;
    readonly presentation?: UiComponentPresentation;
  }
  let { props, io, presentation }: Props = $props();
  const title = $derived(typeof props.title === 'string' ? props.title : '');
  const composition = $derived(presentation?.compositionSlot === 'body');
  let open = $derived(props.open === true);
  let triggerRef = $state<HTMLButtonElement | null>(null);
  const restoreTrigger = catalogFocusReturn(() => triggerRef);
</script>

{#snippet frame()}
  <header class="vict-catalog-overlay-header">
    {#if composition}
      <h2 data-dialog-title>{title || 'Dialog'}</h2>
      <button type="button" data-dialog-close aria-label="Close" data-testid="dialog-close">&#x2715;</button>
    {:else}
      <Dialog.Title>{title || 'Dialog'}</Dialog.Title>
      <Dialog.Close aria-label="Close" data-testid="dialog-close">&#x2715;</Dialog.Close>
    {/if}
  </header>
  <div class="vict-overlay-body">
    {@render io?.slots?.body?.()}
  </div>
{/snippet}

<span data-testid="catalog-dialog" style="display: contents">
  {#if composition}
    <section
      {...presentation?.target('root')}
      data-dialog-content
      data-ui-composition-surface="body"
      data-testid="dialog-panel"
    >
      {@render frame()}
    </section>
  {:else}
    <Dialog.Root bind:open onOpenChange={(next) => io?.emit('openChange', next === true)}>
      <!-- The library's native attachment owns the trigger ref used by FocusScope. -->
      <Dialog.Trigger {...presentation?.target('trigger')} bind:ref={triggerRef} data-testid="dialog-trigger">
        Open {title}
      </Dialog.Trigger>
      <CatalogPortal {open} {presentation}>
        <Dialog.Overlay data-testid="dialog-overlay" />
        <Dialog.Content
          {...presentation?.target('root')}
          data-testid="dialog-panel"
          onCloseAutoFocus={restoreTrigger}
        >
          {@render frame()}
        </Dialog.Content>
      </CatalogPortal>
    </Dialog.Root>
  {/if}
</span>
