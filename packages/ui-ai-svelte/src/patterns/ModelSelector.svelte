<script lang="ts">
  import * as DropdownMenu from '../upstream/ui/dropdown-menu/index.js';
  import * as InputGroup from '../upstream/ui/input-group/index.js';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import type { ModelOption } from './types.js';

  let { models, model, efforts = [], effort = '', onModelChange, onEffortChange, inline = false }: {
    models: readonly ModelOption[];
    model: string;
    efforts?: readonly ModelOption[];
    effort?: string;
    onModelChange?: (id: string) => void;
    onEffortChange?: (id: string) => void;
    /** Flatten layout into an InputGroup footer so individual controls can wrap. */
    inline?: boolean;
  } = $props();
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

<div class={inline ? 'contents' : 'flex flex-wrap items-center gap-2'}>
  <DropdownMenu.Root>
    <DropdownMenu.Trigger disabled={!onModelChange}>
      {#snippet child({ props })}
        <InputGroup.Button {...props} size="sm" variant="outline" aria-label={`Model: ${modelLabel}`}>
          {modelLabel}
          <ChevronDown />
        </InputGroup.Button>
      {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content align="start" class="w-48">
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
          <InputGroup.Button {...props} size="sm" variant="outline" aria-label={`Effort: ${effortLabel}`}>
            <span class="text-muted-foreground">Effort</span>
            {effortLabel}
            <ChevronDown />
          </InputGroup.Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" class="w-36">
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
