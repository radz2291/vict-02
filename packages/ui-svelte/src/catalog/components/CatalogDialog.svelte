<script lang="ts">
  /**
   * B1 catalog wrapper: bits-ui Dialog adapted to the IO contract (frozen
   * fixture dialog-slot.json). Controlled open loop: `open` prop in;
   * `openChange` out (trigger, Escape, overlay close); the `body` slot
   * carries authored content (instance scope) with its own declared
   * actions; portals to the nearest app/controls root.
   */
  import { Dialog } from 'bits-ui';
  import type { Snippet } from 'svelte';
  import type { UiSvelteComponentIO } from '../../document/extensions.js';

  interface Props {
    readonly props: Readonly<Record<string, unknown>>;
    readonly io?: UiSvelteComponentIO;
  }
  let { props, io }: Props = $props();
  const title = $derived(typeof props.title === 'string' ? props.title : '');
  const open = $derived(props.open === true);
  let portalTarget = $state<HTMLElement | null>(null);
</script>

<span bind:this={portalTarget} hidden data-testid="catalog-dialog-anchor"></span>
<Dialog.Root
  {open}
  onOpenChange={(next) => io?.emit('openChange', next === true)}
>
  <Dialog.Trigger
    class="vict-btn vict-btn--secondary"
    data-testid="dialog-trigger"
  >Open {title}</Dialog.Trigger>
  <Dialog.Portal to={portalTarget?.closest('.vict-app, .vict-controls') ?? 'body'}>
    <Dialog.Overlay class="vict-overlay-backdrop" data-testid="dialog-overlay" />
    <Dialog.Content class="vict-dialog" data-testid="dialog-panel">
      <header class="vict-overlay-header">
        <Dialog.Title>
          {#snippet child({ props: titleProps })}<h2 {...titleProps}>{title || 'Dialog'}</h2>{/snippet}
        </Dialog.Title>
        <Dialog.Close class="vict-btn vict-btn--quiet" aria-label="Close" data-testid="dialog-close">✕</Dialog.Close>
      </header>
      <div class="vict-overlay-body">
        {@render io?.slots?.body?.()}
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
