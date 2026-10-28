<script lang="ts">
  import { getContext, type Snippet } from 'svelte';
  import { UI_PORTAL_TARGET, type UiPortalTarget, type UiComponentPresentation } from '@victframework/ui-svelte';
  import { Button } from './upstream/ui/button/index.js';
  import * as Tooltip from './upstream/ui/tooltip/index.js';
  let { label, hint = label, onclick, pressed, copied, action, children, presentation, part }: {
    label: string; hint?: string; onclick: () => void; pressed?: boolean;
    copied?: boolean; action?: string; children: Snippet;
    presentation?: UiComponentPresentation; part?: string;
  } = $props();
  const portalTarget = getContext<UiPortalTarget | undefined>(UI_PORTAL_TARGET);
  let owner = $state<HTMLSpanElement>();
  const target = $derived(part ? presentation?.target(part) : undefined);
  const tip = $derived(part ? presentation?.target(`${part}-tooltip`) : undefined);
  const ownedPortal = $derived(presentation || portalTarget ? {to:portalTarget?.() ?? owner,scopeClass:presentation?.scopeClass} : undefined);
</script>

<!-- Official Message ghost icon action and tooltip composition. -->
{#snippet actionContent()}
<Tooltip.Provider>
  <Tooltip.Root>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        <Button {...props} {...target} variant="ghost" size="icon-sm" aria-label={label}
          aria-pressed={pressed} data-message-action={action} data-copied={copied || undefined} {onclick}>
          {@render children()}
        </Button>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content {...tip} role="tooltip" portalProps={ownedPortal}><p>{hint}</p></Tooltip.Content>
  </Tooltip.Root>
</Tooltip.Provider>
{/snippet}
{#if presentation || portalTarget}<span bind:this={owner} style="display: contents">{@render actionContent()}</span>{:else}{@render actionContent()}{/if}
