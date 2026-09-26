<script lang="ts">
  import { Popover } from 'bits-ui';
  import type { Snippet } from 'svelte';
  let { label, children }: { label: string; children: Snippet } = $props();
</script>
<Popover.Root>
  <Popover.Trigger class="vict-btn vict-btn--secondary">{label}<span aria-hidden="true">⌄</span></Popover.Trigger>
  <Popover.Content class="vict-popover" sideOffset={8} align="end" aria-label={label}>
    {@render children()}
    <Popover.Close class="vict-btn vict-btn--quiet">Done</Popover.Close>
  </Popover.Content>
</Popover.Root>
