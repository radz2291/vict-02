<script lang="ts">
  import { AlertDialog } from '../alert-dialog.js';
  import type { UiSvelteComponentProps } from '../../document/extensions.js';
  import ActionFeedback from '../../ActionFeedback.svelte';
  import CatalogPortal from './CatalogPortal.svelte';
  import { catalogFocusReturn } from './focus-return.js';
  let { props, io, presentation }: UiSvelteComponentProps = $props();
  let open = $derived(props.open === true);
  let triggerRef = $state<HTMLButtonElement | null>(null);
  const restoreTrigger = catalogFocusReturn(() => triggerRef);
</script>

<AlertDialog.Root bind:open onOpenChange={(next) => io?.emit('openChange', next)}>
  <AlertDialog.Trigger {...presentation?.target('trigger')} disabled={props.disabled === true} bind:ref={triggerRef}>
    {#if io?.slots?.trigger}{@render io.slots.trigger()}{:else}{typeof props.label === 'string' ? props.label : 'AlertDialog'}{/if}
  </AlertDialog.Trigger>
  <CatalogPortal {open} {presentation}>
    <AlertDialog.Overlay />
    <AlertDialog.Content {...presentation?.target('root')} onCloseAutoFocus={restoreTrigger}>
      <AlertDialog.Title>{typeof props.title === 'string' ? props.title : 'Confirm decision'}</AlertDialog.Title>
      <AlertDialog.Description>{typeof props.description === 'string' ? props.description : ''}</AlertDialog.Description>
      {@render io?.slots?.body?.()}
      <div class="vict-actions">
        <AlertDialog.Cancel {...presentation?.target('cancel')}>
          {#if io?.slots?.cancel}{@render io.slots.cancel()}{:else}{typeof props.cancelLabel === 'string' ? props.cancelLabel : 'Cancel'}{/if}
        </AlertDialog.Cancel>
        <AlertDialog.Action {...presentation?.target('action')} disabled={props.disabled === true || io?.action?.pending === true} onclick={() => io?.emit('confirm')}>
          {#if io?.slots?.action}{@render io.slots.action()}{:else}{typeof props.confirmLabel === 'string' ? props.confirmLabel : 'Confirm'}{/if}
        </AlertDialog.Action>
      </div>
    </AlertDialog.Content>
  </CatalogPortal>
</AlertDialog.Root>

<ActionFeedback feedback={io?.action?.feedback} />
