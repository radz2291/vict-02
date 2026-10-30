<script lang="ts">
  import * as DropdownMenu from '../upstream/ui/dropdown-menu/index.js';
  import * as InputGroup from '../upstream/ui/input-group/index.js';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import CheckIcon from '@lucide/svelte/icons/check';
  import type { ModelOption } from './types.js';
  import { getContext } from 'svelte';
  import { UI_PORTAL_TARGET,OwnedMenuContent,ownedMenuTriggerKey,resolveOwnedPopupOwner,type UiPortalTarget,type UiComponentPresentation } from '@victframework/ui-svelte';

  let { models, model, efforts = [], effort = '', onModelChange, onEffortChange, inline = false, presentation }: {
    models: readonly ModelOption[];
    model: string;
    efforts?: readonly ModelOption[];
    effort?: string;
    onModelChange?: (id: string) => void;
    onEffortChange?: (id: string) => void;
    /** Flatten layout into an InputGroup footer so individual controls can wrap. */
    inline?: boolean;
    /** Optional canonical authoring scope; does not grant provider authority. */
    presentation?: UiComponentPresentation;
  } = $props();
  const portalTarget = getContext<UiPortalTarget | undefined>(UI_PORTAL_TARGET);
  let root = $state<HTMLDivElement>();
  let modelTrigger=$state<HTMLButtonElement|null>(null),effortTrigger=$state<HTMLButtonElement|null>(null);
  let modelOpen=$state(false),effortOpen=$state(false),modelEdge=$state<'first'|'last'>('first'),effortEdge=$state<'first'|'last'>('first');
  const menuId=$props.id();
  const ownedMenuSurface='ring-foreground/5 dark:ring-foreground/10 bg-popover text-popover-foreground min-w-32 rounded-2xl p-1 shadow-lg ring-1 cn-menu-target cn-menu-translucent overflow-x-hidden overflow-y-auto';
  const ownedMode=$derived(Boolean(presentation||portalTarget||(root&&resolveOwnedPopupOwner(root))));
  function openModel(edge:'first'|'last'='first'){if(!onModelChange)return;effortOpen=false;modelEdge=edge;modelOpen=true;}
  function openEffort(edge:'first'|'last'='first'){if(!onEffortChange)return;modelOpen=false;effortEdge=edge;effortOpen=true;}
  const ownedPortal = $derived(presentation ? {to:portalTarget?.() ?? root,scopeClass:presentation.scopeClass} : undefined);
  const modelLabel = $derived(models.find(item => item.id === model)?.label ?? model);
  const effortLabel = $derived(efforts.find(item => item.id === effort)?.label ?? effort);
  const groups = $derived.by(() => {
    const result = new Map<string, ModelOption[]>();
    for (const item of models) {
      const group = item.group ?? '';
      const entries = result.get(group) ?? [];
      entries.push(item);
      result.set(group, entries);
    }
    return [...result].map(([label, items]) => ({ label, items }));
  });
</script>

<div bind:this={root} class={`${inline ? 'contents' : 'flex flex-wrap items-center gap-2'} ${presentation?.scopeClass??''}`}>
  {#if ownedMode}
    <InputGroup.Button {...presentation?.target('model-trigger')} bind:ref={modelTrigger} id={`${menuId}-model-trigger`} size="sm" variant="outline" disabled={!onModelChange}
      aria-label={`Model: ${modelLabel}`} aria-haspopup="menu" aria-expanded={modelOpen} aria-controls={modelOpen?`${menuId}-model-menu`:undefined}
      onclick={()=>modelOpen?modelOpen=false:openModel()} onkeydown={event=>ownedMenuTriggerKey(event,openModel)}>
      {modelLabel}<ChevronDown/>
    </InputGroup.Button>
    <OwnedMenuContent {...presentation?.target('model-menu')} id={`${menuId}-model-menu`} open={modelOpen} trigger={modelTrigger}
      portalTarget={portalTarget?.()??root} scopeClass={`vict-ai ${presentation?.scopeClass??''}`} surface="custom" initialFocus={modelEdge} aria-labelledby={`${menuId}-model-trigger`}
      class={`${ownedMenuSurface} w-48 ${presentation?.target('model-menu').class??''}`} onRequestClose={()=>modelOpen=false}>
      {#each groups as group,index (group.label)}
        {#if index>0}<div role="separator" data-dropdown-menu-separator class="my-1 border-t border-border"></div>{/if}
        <div role="group" aria-labelledby={group.label?`${menuId}-group-${index}`:undefined}>
          {#if group.label}<div id={`${menuId}-group-${index}`} data-dropdown-menu-group-label class="px-2 py-1.5 text-sm text-muted-foreground">{group.label}</div>{/if}
          {#each group.items as item (item.id)}
            <button type="button" role="menuitemradio" tabindex="-1" aria-checked={model===item.id} data-state={model===item.id?'checked':'unchecked'} data-slot="dropdown-menu-radio-item" data-dropdown-menu-radio-item data-text-value={item.label}
              class="relative flex min-h-7 w-full cursor-default items-center gap-2 rounded-xl py-1.5 pr-8 pl-2 text-left text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground"
              onclick={()=>{onModelChange?.(item.id);modelOpen=false;}}>
              <span class="pointer-events-none absolute right-2 flex items-center justify-center" data-slot="dropdown-menu-radio-item-indicator">{#if model===item.id}<CheckIcon class="size-4" aria-hidden="true"/>{/if}</span>
              {item.label}
            </button>
          {/each}
        </div>
      {/each}
    </OwnedMenuContent>
    {#if efforts.length}
      <InputGroup.Button {...presentation?.target('effort-trigger')} bind:ref={effortTrigger} id={`${menuId}-effort-trigger`} size="sm" variant="outline" disabled={!onEffortChange}
        aria-label={`Effort: ${effortLabel}`} aria-haspopup="menu" aria-expanded={effortOpen} aria-controls={effortOpen?`${menuId}-effort-menu`:undefined}
        onclick={()=>effortOpen?effortOpen=false:openEffort()} onkeydown={event=>ownedMenuTriggerKey(event,openEffort)}>
        <span class="text-muted-foreground">Effort</span>{effortLabel}<ChevronDown/>
      </InputGroup.Button>
      <OwnedMenuContent {...presentation?.target('effort-menu')} id={`${menuId}-effort-menu`} open={effortOpen} trigger={effortTrigger}
        portalTarget={portalTarget?.()??root} scopeClass={`vict-ai ${presentation?.scopeClass??''}`} surface="custom" initialFocus={effortEdge} aria-labelledby={`${menuId}-effort-trigger`}
        class={`${ownedMenuSurface} w-36 ${presentation?.target('effort-menu').class??''}`} onRequestClose={()=>effortOpen=false}>
        {#each efforts as item (item.id)}
          <button type="button" role="menuitemradio" tabindex="-1" aria-checked={effort===item.id} data-state={effort===item.id?'checked':'unchecked'} data-slot="dropdown-menu-radio-item" data-dropdown-menu-radio-item data-text-value={item.label}
            class="relative flex min-h-7 w-full cursor-default items-center gap-2 rounded-xl py-1.5 pr-8 pl-2 text-left text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground"
            onclick={()=>{onEffortChange?.(item.id);effortOpen=false;}}>
            <span class="pointer-events-none absolute right-2 flex items-center justify-center" data-slot="dropdown-menu-radio-item-indicator">{#if effort===item.id}<CheckIcon class="size-4" aria-hidden="true"/>{/if}</span>
            {item.label}
          </button>
        {/each}
      </OwnedMenuContent>
    {/if}
  {:else}
  <DropdownMenu.Root>
    <DropdownMenu.Trigger disabled={!onModelChange}>
      {#snippet child({ props })}
        <InputGroup.Button {...props} {...presentation?.target('model-trigger')} size="sm" variant="outline" aria-label={`Model: ${modelLabel}`}>
          {modelLabel}
          <ChevronDown />
        </InputGroup.Button>
      {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content {...presentation?.target('model-menu')} portalProps={ownedPortal} align="start" class={`w-48 ${presentation?.target('model-menu').class??''}`}>
      <DropdownMenu.RadioGroup value={model} onValueChange={onModelChange}>
        {#each groups as group, index (group.label)}
          {#if index > 0}<DropdownMenu.Separator />{/if}
          <DropdownMenu.Group>
            {#if group.label}<DropdownMenu.Label>{group.label}</DropdownMenu.Label>{/if}
            {#each group.items as item (item.id)}
              <DropdownMenu.RadioItem value={item.id} closeOnSelect>{item.label}</DropdownMenu.RadioItem>
            {/each}
          </DropdownMenu.Group>
        {/each}
      </DropdownMenu.RadioGroup>
    </DropdownMenu.Content>
  </DropdownMenu.Root>
  {#if efforts.length}
    <DropdownMenu.Root>
      <DropdownMenu.Trigger disabled={!onEffortChange}>
        {#snippet child({ props })}
          <InputGroup.Button {...props} {...presentation?.target('effort-trigger')} size="sm" variant="outline" aria-label={`Effort: ${effortLabel}`}>
            <span class="text-muted-foreground">Effort</span>
            {effortLabel}
            <ChevronDown />
          </InputGroup.Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content {...presentation?.target('effort-menu')} portalProps={ownedPortal} align="start" class={`w-36 ${presentation?.target('effort-menu').class??''}`}>
        <DropdownMenu.Group>
          <DropdownMenu.Label>Effort</DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={effort} onValueChange={onEffortChange}>
            {#each efforts as item (item.id)}
              <DropdownMenu.RadioItem value={item.id} closeOnSelect>{item.label}</DropdownMenu.RadioItem>
            {/each}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Group>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  {/if}
  {/if}
</div>
