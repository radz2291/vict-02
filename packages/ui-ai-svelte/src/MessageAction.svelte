<script lang="ts">
  import { getContext, type Snippet } from 'svelte';
  import { UI_PORTAL_TARGET, OwnedTooltip, type UiPortalTarget, type UiComponentPresentation } from '@victframework/ui-svelte';
  import { Button } from './upstream/ui/button/index.js';
  import * as Tooltip from './upstream/ui/tooltip/index.js';
  let { label, hint = label, onclick, pressed, copied, action, children, presentation, part }: {
    label: string; hint?: string; onclick: () => void; pressed?: boolean;
    copied?: boolean; action?: string; children: Snippet;
    presentation?: UiComponentPresentation; part?: string;
  } = $props();
  const portalTarget = getContext<UiPortalTarget | undefined>(UI_PORTAL_TARGET);
  const target = $derived(part ? presentation?.target(part) : undefined);
  const tip = $derived(part ? presentation?.target(`${part}-tooltip`) : undefined);
  const owned = $derived(!!presentation || !!portalTarget);
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
    <Tooltip.Content {...tip} role="tooltip"><p>{hint}</p></Tooltip.Content>
  </Tooltip.Root>
</Tooltip.Provider>
{/snippet}
{#if owned}
  <OwnedTooltip {...tip} ownerId={target?.['data-ui-owner']} portalTarget={portalTarget?.()} scopeClass={`vict-ai ${presentation?.scopeClass??''}`}
    class={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs z-50 w-fit max-w-xs bg-foreground text-background ${tip?.class??''}`} arrow>
    {#snippet trigger(attributes)}
      <Button {...attributes} {...target} variant="ghost" size="icon-sm" aria-label={label}
        aria-pressed={pressed} data-message-action={action} data-copied={copied || undefined} {onclick}>
        {@render children()}
      </Button>
    {/snippet}
    <p>{hint}</p>
  </OwnedTooltip>
{:else}{@render actionContent()}{/if}
