<script lang="ts">
  import { tick, type Snippet } from 'svelte';
  import type { UiOverlayIntent } from '@victframework/ui';
  import Button from './Button.svelte';

  interface Props { surfaceId: string; intent: UiOverlayIntent; content: Snippet }
  let { surfaceId, intent, content }: Props = $props();
  let open = $state(false);
  let dialog = $state<HTMLDialogElement | null>(null);
  let panel = $state<HTMLElement | null>(null);
  let trigger: HTMLButtonElement | null = null;

  async function openOverlay(event: MouseEvent): Promise<void> {
    if (open) return;
    trigger = event.currentTarget as HTMLButtonElement;
    open = true;
    await tick();
    // Native modal dialogs supply focus containment, inert background,
    // Escape/cancel behavior, and the top layer for nested overlays.
    if (typeof dialog?.showModal === 'function') dialog.showModal();
    else dialog?.setAttribute('open', ''); // DOM test environment fallback.
    panel?.focus();
  }

  function closeOverlay(): void {
    if (typeof dialog?.close === 'function' && dialog.open) dialog.close();
    finishClose();
  }

  function finishClose(): void {
    if (!open) return;
    open = false;
    void tick().then(() => trigger?.focus());
  }

  function fallbackEscape(event: KeyboardEvent): void {
    // happy-dom does not implement the native dialog cancel event.
    if (open && typeof dialog?.showModal !== 'function' && event.key === 'Escape' &&
      (document.activeElement as Element | null)?.closest('dialog') === dialog) {
      event.preventDefault();
      closeOverlay();
    }
  }
</script>

<svelte:window onkeydown={fallbackEscape} />
<Button label={intent.triggerLabel} variant="secondary" surfaceId={surfaceId}
  testId="overlay-trigger" haspopup="dialog" expanded={open}
  onclick={(event) => { void openOverlay(event); }} />

{#if open}
  <dialog
    class="vict-overlay"
    class:vict-overlay--drawer={intent.kind === 'drawer'}
    data-testid="overlay"
    aria-modal="true"
    aria-label={intent.title || 'Dialog'}
    bind:this={dialog}
    onclose={() => { if (!dialog?.open) finishClose(); }}
    oncancel={(event) => { event.preventDefault(); closeOverlay(); }}
    onclick={(event) => { if (event.target === dialog) closeOverlay(); }}
  >
    <div class={intent.kind === 'drawer' ? 'vict-drawer' : 'vict-dialog'}
      data-testid="overlay-panel" tabindex="-1" bind:this={panel}>
      <header class="vict-overlay-header">
        <h2>{intent.title}</h2>
        <Button label="Close" variant="secondary" testId="overlay-close" onclick={closeOverlay} />
      </header>
      {@render content()}
    </div>
  </dialog>
{/if}
