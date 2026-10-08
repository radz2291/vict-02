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
  import type { Snippet } from 'svelte';
  import type { UiSvelteComponentIO } from '../../document/extensions.js';

  interface Props {
    readonly props: Readonly<Record<string, unknown>>;
    readonly io?: UiSvelteComponentIO;
    readonly children?: Snippet;
  }
  let { props, io, children }: Props = $props();
  const title = $derived(typeof props.title === 'string' ? props.title : '');
  const open = $derived(props.open === true);
</script>

<span data-testid="catalog-dialog" style="display: contents">
  <Dialog.Root
    {open}
    onOpenChange={(next) => io?.emit('openChange', next === true)}
  >
    <Dialog.Trigger data-testid="dialog-trigger">Open {title}</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay data-testid="dialog-overlay" />
      <Dialog.Content data-testid="dialog-panel">
        <Dialog.Title>{title || 'Dialog'}</Dialog.Title>
        <Dialog.Close aria-label="Close" data-testid="dialog-close">✕</Dialog.Close>
        <div class="vict-overlay-body">
          {@render children?.()}
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
</span>
