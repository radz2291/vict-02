<script lang="ts">
  import * as HoverCard from '../upstream/ui/hover-card/index.js';
  import { Progress } from '../upstream/ui/progress/index.js';
  import { Button } from '../upstream/ui/button/index.js';
  import { getContext } from 'svelte';
  import {cn} from '../upstream/utils.js';
  import { OwnedHoverCard, UI_PORTAL_TARGET, type UiPortalTarget, type UiComponentPresentation } from '@victframework/ui-svelte';

  let { used, limit, breakdown = [], presentation }: {
    used: number;
    limit: number;
    /** Optional actual host metadata; absent categories are never fabricated. */
    breakdown?: readonly { label: string; value: number }[];
    presentation?: UiComponentPresentation;
  } = $props();
  const hostTarget = getContext<UiPortalTarget | undefined>(UI_PORTAL_TARGET);
  const owned = $derived(!!hostTarget || !!presentation);
  const popup = $derived(presentation?.target('popup'));
  const percent = $derived(limit > 0 ? Math.min(100, Math.max(0, Math.round(used / limit * 100))) : 0);
  function formatTokens(value: number) {
    return value < 1000 ? String(value) : `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
</script>

{#snippet content()}
    <div class="flex items-center justify-between gap-3 text-sm">
      <span {...presentation?.target('title')} class={`font-medium ${presentation?.target('title').class ?? ''}`}>Context</span>
      <span {...presentation?.target('usage')} class={`text-muted-foreground ${presentation?.target('usage').class ?? ''}`}>{formatTokens(used)} / {formatTokens(limit)}</span>
    </div>
    <Progress {...presentation?.target('progress')} value={percent} aria-label="Context used" />
    {#if breakdown.length}
      <div class="flex flex-col gap-1 text-sm">
        {#each breakdown as row (row.label)}
          <div {...presentation?.target('breakdown-row')} class={`flex justify-between gap-3 ${presentation?.target('breakdown-row').class ?? ''}`}>
            <span class="text-muted-foreground">{row.label}</span>
            <span>{formatTokens(row.value)}</span>
          </div>
        {/each}
      </div>
    {/if}

{/snippet}
{#if owned}
<OwnedHoverCard {...popup} class={cn(HoverCard.hoverCardContentClass, `flex w-64 flex-col gap-3 ${popup?.class ?? ''}`)} portalTarget={hostTarget?.()} ownerId={presentation?.target('root')['data-ui-owner']} scopeClass={`vict-ai ${presentation?.scopeClass ?? ''}`}>
  {#snippet trigger(attributes)}
    <Button {...attributes} {...presentation?.target('trigger')} variant="outline" size="sm">{percent}% context</Button>
  {/snippet}
  {@render content()}
</OwnedHoverCard>
{:else}
<HoverCard.Root openDelay={10} closeDelay={100}>
  <HoverCard.Trigger>
    {#snippet child({ props })}
      <Button {...props} {...presentation?.target('trigger')} variant="outline" size="sm">{percent}% context</Button>
    {/snippet}
  </HoverCard.Trigger>
  <HoverCard.Content {...popup} class={`flex w-64 flex-col gap-3 ${popup?.class ?? ''}`} portalProps={{to: hostTarget?.() ?? presentation?.ownerDocument?.body, scopeClass: presentation?.scopeClass}}>
    {@render content()}
  </HoverCard.Content>
</HoverCard.Root>

{/if}
