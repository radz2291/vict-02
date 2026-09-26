<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { UiTab } from '@victframework/ui';
  interface Props { surfaceId: string; tabs: readonly UiTab[]; panel: Snippet<[number]> }
  let { surfaceId, tabs, panel }: Props = $props();
  let active = $state(0);
  let tablist = $state<HTMLElement | null>(null);
  const selected = $derived(Math.min(active, Math.max(tabs.length - 1, 0)));

  function keydown(event: KeyboardEvent): void {
    if (tabs.length === 0) return;
    let next = selected;
    if (event.key === 'ArrowRight') next = (selected + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (selected - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    active = next;
    tablist?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }
</script>

<div class="vict-tabs" data-surface={surfaceId}>
  <div class="vict-tablist" role="tablist" aria-label={surfaceId} bind:this={tablist}>
    {#each tabs as tab, index (tab.name)}
      <button
        type="button"
        role="tab"
        id="vict-tab-{surfaceId}-{tab.name}"
        aria-selected={selected === index}
        aria-controls="vict-tabpanel-{surfaceId}-{tab.name}"
        tabindex={selected === index ? 0 : -1}
        onkeydown={keydown}
        onclick={() => active = index}
      >{tab.label}</button>
    {/each}
  </div>
  {#each tabs as tab, index (tab.name)}
    <div
      class="vict-tabpanel"
      role="tabpanel"
      id="vict-tabpanel-{surfaceId}-{tab.name}"
      aria-labelledby="vict-tab-{surfaceId}-{tab.name}"
      hidden={selected !== index}
    >{@render panel(index)}</div>
  {/each}
</div>
