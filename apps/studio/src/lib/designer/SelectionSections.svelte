<script lang="ts">
 import type {Snippet} from 'svelte';
 import './disclosures.css';
 let {page=$bindable('properties'),overview,relationships,technical,relationshipsCount}:{page?:'properties'|'relationships'|'technical'|'none';overview:Snippet;relationships:Snippet;technical:Snippet;relationshipsCount?:number}=$props();
 const id=$props.id();
 const sections=[{key:'properties',label:'Overview'},{key:'relationships',label:'Relationships'},{key:'technical',label:'Technical information'}] as const;
</script>
<div class="selection-sections">
 {#each sections as section}<section class:expanded={page===section.key} aria-label={`Selection ${section.label.toLowerCase()}`}><button type="button" class="studio-section-header" aria-label={section.label} title={section.key==='relationships'&&relationshipsCount!==undefined?`${relationshipsCount} declared relationships`:undefined} aria-expanded={page===section.key} aria-controls={id+'-'+section.key} onclick={()=>page=page===section.key?'none':section.key}><span class="section-heading">{section.label}{#if section.key==='relationships'&&relationshipsCount!==undefined}<small>{relationshipsCount}</small>{/if}</span></button><div class="details-body" id={id+'-'+section.key} hidden={page!==section.key}>{#if section.key==='properties'}{@render overview()}{:else if section.key==='relationships'}{@render relationships()}{:else}{@render technical()}{/if}</div></section>{/each}
</div>
<style>
 .section-heading{display:flex;align-items:baseline;gap:8px}.section-heading small{font:var(--studio-font-meta);color:var(--vict-color-textMuted);font-weight:400}
 .selection-sections{display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden}.selection-sections>section{display:flex;flex-direction:column;flex:none;min-height:0;overflow:hidden}.selection-sections>section.expanded{flex:1}.studio-section-header{flex:none}.details-body{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:10px}.details-body[hidden]{display:none}
</style>
