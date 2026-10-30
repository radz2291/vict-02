<script lang="ts">
  import * as HoverCard from '../upstream/ui/hover-card/index.js';
  import { Button } from '../upstream/ui/button/index.js';
  import { safeExternalUrl } from '../upstream/markdown/safe-url.js';
  import type { Citation } from './types.js';
  import { getContext } from 'svelte';
  import {cn} from '../upstream/utils.js';
  import { OwnedHoverCard, UI_PORTAL_TARGET, type UiPortalTarget, type UiComponentPresentation } from '@victframework/ui-svelte';

  let { source, presentation }: { source: Citation; presentation?: UiComponentPresentation } = $props();
  const hostTarget = getContext<UiPortalTarget | undefined>(UI_PORTAL_TARGET);
  const owned = $derived(!!hostTarget || !!presentation);
  const popup = $derived(presentation?.target('popup'));
  const href = $derived(safeExternalUrl(source.url));
  const hostname = $derived.by(() => {
    if (!href) return undefined;
    try { return new URL(href).hostname.replace(/^www\./, ''); }
    catch { return undefined; }
  });
</script>

{#snippet content()}
    <div {...presentation?.target('title')} class={`font-medium ${presentation?.target('title').class ?? ''}`}>{source.title || hostname}</div>
    {#if source.excerpt}<p {...presentation?.target('excerpt')} class={`text-muted-foreground ${presentation?.target('excerpt').class ?? ''}`}>{source.excerpt}</p>{/if}
    {#if href}
      <a {...presentation?.target('source')} {href} target="_blank" rel="noopener noreferrer"
        class={`text-xs text-muted-foreground underline-offset-4 hover:underline ${presentation?.target('source').class ?? ''}`}>
        {hostname || source.title}
        <span class="sr-only"> (opens in a new tab)</span>
      </a>
    {/if}

{/snippet}
{#if owned}
<OwnedHoverCard {...popup} class={cn(HoverCard.hoverCardContentClass, `flex w-64 flex-col gap-1 ${popup?.class ?? ''}`)} portalTarget={hostTarget?.()} ownerId={presentation?.target('root')['data-ui-owner']} scopeClass={`vict-ai ${presentation?.scopeClass ?? ''}`}>
  {#snippet trigger(attributes)}
    <Button {...attributes} {...presentation?.target('trigger')} variant="secondary" size="xs">{hostname || source.title}</Button>
  {/snippet}
  {@render content()}
</OwnedHoverCard>
{:else}
<HoverCard.Root openDelay={10} closeDelay={100}>
  <HoverCard.Trigger>
    {#snippet child({ props })}
      <Button {...props} {...presentation?.target('trigger')} variant="secondary" size="xs">{hostname || source.title}</Button>
    {/snippet}
  </HoverCard.Trigger>
  <HoverCard.Content {...popup} class={`flex w-64 flex-col gap-1 ${popup?.class ?? ''}`} portalProps={{to: hostTarget?.() ?? presentation?.ownerDocument?.body, scopeClass: presentation?.scopeClass}}>
    {@render content()}
  </HoverCard.Content>
</HoverCard.Root>

{/if}
