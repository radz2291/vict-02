<script lang="ts">
  import { Tabs } from 'bits-ui';
  import type { Snippet } from 'svelte';
  import type { UiTab } from '@victframework/ui';
  let { surfaceId, tabs, panel }: { surfaceId: string; tabs: readonly UiTab[]; panel: Snippet<[number]> } = $props();
  let value = $state('');
  $effect(() => {
    if (!tabs.some((tab) => tab.name === value)) value = tabs[0]?.name ?? '';
  });
</script>
<Tabs.Root class="vict-tabs" data-surface={surfaceId} bind:value>
  <Tabs.List class="vict-tablist" aria-label={surfaceId}>
    {#each tabs as tab (tab.name)}<Tabs.Trigger value={tab.name}>{tab.label}</Tabs.Trigger>{/each}
  </Tabs.List>
  {#each tabs as tab, index (tab.name)}
    <Tabs.Content value={tab.name} class="vict-tabpanel">
      {@render panel(index)}
    </Tabs.Content>
  {/each}
</Tabs.Root>
