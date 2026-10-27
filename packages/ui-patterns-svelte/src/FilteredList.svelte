<script lang="ts">
  import {patternTarget} from './target.js';
  import type { UiSvelteComponentProps } from '@victframework/ui-svelte';
  import { MediaIcon } from '@victframework/ui-media-svelte';
  import { filterItems,stringItems } from './state.js';
  let {props,io,presentation,occurrenceKey,nodeId}:UiSvelteComponentProps=$props();
  const items=$derived(stringItems(props.items));
  const query=$derived(String(props.query??''));
  const filtered=$derived(filterItems(items,query));
  const searchLabel=$derived(String(props.searchLabel??'Search').trim()||'Search');
  const id=$props.id();
</script>
<section {...patternTarget(presentation,'root','vict-filtered-list')} aria-label={String(props.label??'Searchable list')}>
  <label for={id}>{searchLabel}</label>
  <div class="vict-filtered-search">
    {#if io?.slots?.searchIcon}<span {...presentation?.target('searchIcon')} aria-hidden="true">{@render io.slots.searchIcon()}</span>{:else if props.searchIcon}<span {...presentation?.target('searchIcon')} aria-hidden="true"><MediaIcon {nodeId} occurrenceKey={`${occurrenceKey}:search-icon`} props={{pack:String(props.iconPack??'lucide'),revision:String(props.iconRevision??'1.27.0'),name:String(props.searchIcon),decorative:true,size:20}} /></span>{/if}
    <input {...presentation?.target('search')} id={id} type="search" value={query} oninput={event=>io?.emit('queryChange',event.currentTarget.value)} />
  </div>
  <p role="status">{filtered.length} {filtered.length===1?'result':'results'}</p>
  <ul {...presentation?.target('items')}>{#each filtered as item}<li><button {...presentation?.target('item')} type="button" onclick={()=>io?.emit('itemActivate',item)}>{item}</button></li>{/each}</ul>
  {#if !filtered.length}<p>{String(props.emptyLabel??'No matching items')}</p>{/if}
</section>
<style>.vict-filtered-list{min-width:0}label{display:block}.vict-filtered-search{display:flex;align-items:center;gap:.5rem}input{background:var(--vict-surface,var(--vict-color-surface,#fff));color:var(--vict-text,var(--vict-color-text,#172033));border:1px solid var(--vict-border,var(--vict-color-border,#d8dce5));font:inherit;box-sizing:border-box;width:100%;min-height:44px;min-width:0}ul{list-style:none;padding:0;margin:0}button{background:var(--vict-surface,var(--vict-color-surface,#fff));color:var(--vict-text,var(--vict-color-text,#172033));border:1px solid var(--vict-border,var(--vict-color-border,#d8dce5));font:inherit;min-height:44px;width:100%;text-align:start;padding:.5rem .75rem}li+li{margin-top:.25rem}</style>
