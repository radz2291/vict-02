<script lang="ts">
  import * as HoverCard from '../upstream/ui/hover-card/index.js';
  import { Progress } from '../upstream/ui/progress/index.js';
  import { Button } from '../upstream/ui/button/index.js';

  let { used, limit, breakdown = [] }: {
    used: number;
    limit: number;
    /** Optional actual host metadata; absent categories are never fabricated. */
    breakdown?: readonly { label: string; value: number }[];
  } = $props();
  const percent = $derived(limit > 0 ? Math.min(100, Math.max(0, Math.round(used / limit * 100))) : 0);
  function formatTokens(value: number) {
    return value < 1000 ? String(value) : `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
</script>

<HoverCard.Root openDelay={10} closeDelay={100}>
  <HoverCard.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="outline" size="sm">{percent}% context</Button>
    {/snippet}
  </HoverCard.Trigger>
  <HoverCard.Content class="flex w-64 flex-col gap-3">
    <div class="flex items-center justify-between gap-3 text-sm">
      <span class="font-medium">Context</span>
      <span class="text-muted-foreground">{formatTokens(used)} / {formatTokens(limit)}</span>
    </div>
    <Progress value={percent} aria-label="Context used" />
    {#if breakdown.length}
      <div class="flex flex-col gap-1 text-sm">
        {#each breakdown as row (row.label)}
          <div class="flex justify-between gap-3">
            <span class="text-muted-foreground">{row.label}</span>
            <span>{formatTokens(row.value)}</span>
          </div>
        {/each}
      </div>
    {/if}
  </HoverCard.Content>
</HoverCard.Root>
