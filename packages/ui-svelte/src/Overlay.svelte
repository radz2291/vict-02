<script lang="ts">
  import { Dialog } from 'bits-ui';
  import type { Snippet } from 'svelte';
  import type { UiOverlayIntent } from '@victframework/ui';
  let { surfaceId, intent, content, onOpenChange }: { surfaceId: string; intent: UiOverlayIntent; content: Snippet; onOpenChange?: (open: boolean) => void } = $props();
  let trigger = $state<HTMLButtonElement | null>(null);
</script>
<Dialog.Root {onOpenChange}>
  <Dialog.Trigger bind:ref={trigger} class="vict-btn vict-btn--secondary" data-surface={surfaceId} data-testid="overlay-trigger">
    {intent.triggerLabel}
  </Dialog.Trigger>
  <!-- A portal inside the app preserves tokens and avoids transformed ancestors. -->
  <Dialog.Portal to={trigger?.closest('.vict-app') ?? 'body'}>
  <Dialog.Overlay class="vict-overlay-backdrop" data-testid="overlay" />
  <Dialog.Content class={intent.kind === 'drawer' ? 'vict-drawer' : 'vict-dialog'} data-testid="overlay-panel">
    <header class="vict-overlay-header">
      <Dialog.Title>
        {#snippet child({ props })}<h2 {...props}>{intent.title || 'Dialog'}</h2>{/snippet}
      </Dialog.Title>
      <Dialog.Close class="vict-btn vict-btn--quiet" data-testid="overlay-close" aria-label="Close">✕</Dialog.Close>
    </header>
    <div class="vict-overlay-body">{@render content()}</div>
  </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
