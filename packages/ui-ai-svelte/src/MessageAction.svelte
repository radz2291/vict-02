<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Button } from './upstream/ui/button/index.js';
  import * as Tooltip from './upstream/ui/tooltip/index.js';
  let { label, hint = label, onclick, pressed, copied, action, children }: {
    label: string; hint?: string; onclick: () => void; pressed?: boolean;
    copied?: boolean; action?: string; children: Snippet;
  } = $props();
</script>

<!-- Official Message ghost icon action and tooltip composition. -->
<Tooltip.Provider>
  <Tooltip.Root>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        <Button {...props} variant="ghost" size="icon-sm" aria-label={label}
          aria-pressed={pressed} data-message-action={action} data-copied={copied || undefined} {onclick}>
          {@render children()}
        </Button>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content><p>{hint}</p></Tooltip.Content>
  </Tooltip.Root>
</Tooltip.Provider>
