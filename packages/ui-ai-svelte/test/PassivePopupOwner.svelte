<script lang="ts">
  import {setContext} from 'svelte';
  import {UI_PORTAL_TARGET, type UiComponentPresentation} from '@victframework/ui-svelte';
  import Context from '../src/patterns/Context.svelte';
  import InlineCitation from '../src/patterns/InlineCitation.svelte';
  let {name, citation = false, nextAction = false}: {name: string; citation?: boolean; nextAction?: boolean} = $props();
  let owner = $state<HTMLDivElement>();
  setContext(UI_PORTAL_TARGET, () => owner);
  const presentation: UiComponentPresentation = {
    get ownerDocument() {return owner?.ownerDocument;}, get scopeClass() {return `scope-${name}`;},
    target: part => ({'data-ui-owner': name, 'data-ui-occ': 'activity', 'data-ui-part': part, class: `${name}-${part}`, ...(part === 'popup' ? {style: '--public-popup: 1'} : {})}),
  };
</script>
<div bind:this={owner} data-ui-application-viewport data-owner={name}>
  {#if citation}<InlineCitation source={{id: 'citation', title: 'Supplied citation', url: 'https://example.com/'}} {presentation} />
  {:else}<Context used={3} limit={10} breakdown={[{label: 'Messages', value: 3}]} {presentation} />{/if}
  {#if nextAction}<button data-next-ordinary>Next ordinary action</button>{/if}
</div>
