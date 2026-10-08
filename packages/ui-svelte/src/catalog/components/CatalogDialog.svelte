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
  function restoreTrigger(event: Event): void {
    // Bits invokes this at focus-scope teardown. State-driven opens may not
    // have a pre-focused trigger for the library to remember. Use only this
    // occurrence's live public ref, never a document-wide selector.
    event.preventDefault();
    if (triggerRef?.isConnected && !triggerRef.disabled && !triggerRef.closest('[inert]')) {
      triggerRef.focus({ preventScroll: true });
    }
  }
</script>

<span data-testid="catalog-dialog" style="display: contents">
  <Dialog.Root
    bind:open
    onOpenChange={(next) => io?.emit('openChange', next === true)}
  >
    <!-- Use the library's native DOM path: its attachment alone owns the
         ref consumed by PresenceManager and FocusScope. No second bind:this
         writer in a delegated child can clear or pre-empt that ref. -->
    <Dialog.Trigger {...presentation?.target('trigger')} bind:ref={triggerRef} data-testid="dialog-trigger">
      Open {title}
    </Dialog.Trigger>
    <CatalogPortal {open} {presentation}>
      <Dialog.Overlay data-testid="dialog-overlay" />
      <Dialog.Content {...presentation?.target('root')} data-testid="dialog-panel"
        onCloseAutoFocus={restoreTrigger}>
        <Dialog.Title>{title || 'Dialog'}</Dialog.Title>
        <Dialog.Close aria-label="Close" data-testid="dialog-close">✕</Dialog.Close>
        <div class="vict-overlay-body">
          {@render io?.slots?.body?.()}
        </div>
      </Dialog.Content>
    </CatalogPortal>
  </Dialog.Root>
</span>
