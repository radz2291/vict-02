<script lang="ts">
  import type { UiDisplayField } from '@victframework/ui';
  import Feedback from './Feedback.svelte';
  interface Props {
    surfaceId?: string;
    fields: readonly UiDisplayField[] | null;
    emptyMessage?: string;
  }
  let { surfaceId, fields, emptyMessage = 'This record does not exist.' }: Props = $props();
</script>

{#if fields === null}
  <Feedback kind="empty" message={emptyMessage} {surfaceId} />
{:else}
  <dl class="vict-detail" data-surface={surfaceId}>
    {#each fields as field (field.label)}
      <div class="vict-detail-row"><dt>{field.label}</dt><dd>{field.value}</dd></div>
    {/each}
  </dl>
{/if}
