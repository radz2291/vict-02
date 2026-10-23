<script lang="ts">
  import * as HoverCard from '../upstream/ui/hover-card/index.js';
  import { Button } from '../upstream/ui/button/index.js';
  import { safeExternalUrl } from '../upstream/markdown/safe-url.js';
  import type { Citation } from './types.js';

  let { source }: { source: Citation } = $props();
  const href = $derived(safeExternalUrl(source.url));
  const hostname = $derived.by(() => {
    if (!href) return undefined;
    try { return new URL(href).hostname.replace(/^www\./, ''); }
    catch { return undefined; }
  });
</script>

<HoverCard.Root openDelay={10} closeDelay={100}>
  <HoverCard.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="secondary" size="xs">{hostname || source.title}</Button>
    {/snippet}
  </HoverCard.Trigger>
  <HoverCard.Content class="flex w-64 flex-col gap-1">
    <div class="font-medium">{source.title || hostname}</div>
    {#if source.excerpt}<p class="text-muted-foreground">{source.excerpt}</p>{/if}
    {#if href}
      <a {href} target="_blank" rel="noopener noreferrer"
        class="text-xs text-muted-foreground underline-offset-4 hover:underline">
        {hostname || source.title}
        <span class="sr-only"> (opens in a new tab)</span>
      </a>
    {/if}
  </HoverCard.Content>
</HoverCard.Root>
