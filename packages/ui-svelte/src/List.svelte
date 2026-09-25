<script lang="ts">
  import type { UiListItem } from '@victframework/ui';
  import Feedback from './Feedback.svelte';
  interface Props {
    surfaceId?: string;
    items: readonly UiListItem[];
    emptyMessage?: string;
  }
  let { surfaceId, items, emptyMessage = 'Nothing here yet.' }: Props = $props();
</script>

{#if items.length === 0}
  <Feedback kind="empty" message={emptyMessage} {surfaceId} />
{:else}
  <ul class="vict-list" data-surface={surfaceId}>
    {#each items as item, index (index)}
      <li class="vict-list-item">
        <strong>{item.title}</strong>
        {#if item.secondary !== undefined}<span> — {item.secondary}</span>{/if}
      </li>
    {/each}
  </ul>
{/if}
