<script lang="ts">
 import type {Snippet} from 'svelte';
 import SelectionSections from './SelectionSections.svelte';
 let {page=$bindable('properties'),identity,overview,relationships,technical,relationshipsCount,hasOverview=true,showIdentity=true}:{page?:'properties'|'relationships'|'technical'|'none';identity:Snippet;overview?:Snippet;relationships:Snippet;technical:Snippet;relationshipsCount?:number;hasOverview?:boolean;showIdentity?:boolean}=$props();
</script>
<div class="selection-panel">
 {#if showIdentity}{@render identity()}{/if}
 <SelectionSections bind:page overview={hasOverview?overview:undefined} {relationships} {technical} {relationshipsCount}/>
</div>
<style>
 .selection-panel{display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden}
</style>
