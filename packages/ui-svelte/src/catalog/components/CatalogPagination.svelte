<script lang="ts">
  import { Pagination } from '../pagination.js';
  import { numeric } from './b3-values.js';
  import type { UiSvelteComponentProps } from '../../document/extensions.js';
  let { props, io, presentation }: UiSvelteComponentProps = $props();
  let page = $derived(numeric(props.page, 1));
</script>
<Pagination.Root {...presentation?.target('root')} bind:page
  count={Math.max(0, Math.floor(numeric(props.count, 0)))}
  perPage={Math.max(1, Math.floor(numeric(props.perPage, 10)))}
  siblingCount={Math.max(0, Math.floor(numeric(props.siblingCount, 1)))}
  aria-label={String(props.label ?? 'Pages')} onPageChange={(next) => io?.emit('pageChange', next)}>
  {#snippet children({ pages, currentPage })}
    <Pagination.PrevButton aria-label="Previous page">‹</Pagination.PrevButton>
    {#each pages as item (item.key)}
      {#if item.type === 'ellipsis'}<span aria-hidden="true">…</span>
      {:else}<Pagination.Page page={item} aria-current={currentPage === item.value ? 'page' : undefined}>{item.value}</Pagination.Page>{/if}
    {/each}
    <Pagination.NextButton aria-label="Next page">›</Pagination.NextButton>
    {@render io?.slots?.help?.()}
  {/snippet}
</Pagination.Root>
