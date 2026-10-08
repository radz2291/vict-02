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
  import CatalogPart from './CatalogPart.svelte';
  import type { UiSvelteComponentIO, UiComponentPresentation } from '../../document/extensions.js';

  interface Props {
    readonly props: Readonly<Record<string, unknown>>;
    readonly io?: UiSvelteComponentIO;
    readonly presentation?: UiComponentPresentation;
  }
  let { props, io, presentation }: Props = $props();
  const title = $derived(typeof props.title === 'string' ? props.title : '');
  let open = $derived(props.open === true);
  let triggerRef = $state<HTMLButtonElement | null>(null);
  let contentRef = $state<HTMLDivElement | null>(null);
  let overlayRef = $state<HTMLDivElement | null>(null);
</script>

<span data-testid="catalog-dialog" style="display: contents">
  <Dialog.Root
    bind:open
    onOpenChange={(next) => io?.emit('openChange', next === true)}
  >
    <Dialog.Trigger {...presentation?.target('trigger')} bind:ref={triggerRef} data-testid="dialog-trigger">
      {#snippet child({ props: attributes })}
        <CatalogPart as="button" {attributes} bind:ref={triggerRef}>Open {title}</CatalogPart>
      {/snippet}
    </Dialog.Trigger>
    <CatalogPortal {open} {presentation}>
      <Dialog.Overlay bind:ref={overlayRef} data-testid="dialog-overlay">
        {#snippet child({ props: attributes })}
          <CatalogPart as="div" {attributes} bind:ref={overlayRef} />
        {/snippet}
      </Dialog.Overlay>
      <Dialog.Content {...presentation?.target('root')} bind:ref={contentRef} data-testid="dialog-panel">
        {#snippet child({ props: attributes })}
          <CatalogPart as="div" {attributes} bind:ref={contentRef}>
            <Dialog.Title>{title || 'Dialog'}</Dialog.Title>
            <Dialog.Close aria-label="Close" data-testid="dialog-close">✕</Dialog.Close>
            <div class="vict-overlay-body">
              {@render io?.slots?.body?.()}
            </div>
          </CatalogPart>
        {/snippet}
      </Dialog.Content>
    </CatalogPortal>
  </Dialog.Root>
</span>
