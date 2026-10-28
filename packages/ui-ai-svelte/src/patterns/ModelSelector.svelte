<script lang="ts">
  import * as DropdownMenu from '../upstream/ui/dropdown-menu/index.js';
  import * as InputGroup from '../upstream/ui/input-group/index.js';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import type { ModelOption } from './types.js';
  import { getContext } from 'svelte';
  import { UI_PORTAL_TARGET, type UiPortalTarget, type UiComponentPresentation } from '@victframework/ui-svelte';

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
</div>
