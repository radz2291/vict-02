<script lang="ts">
  import type {UiDocument,UiExtensionDescriptor} from '@victframework/ui';
  import {compositionName} from './composition.js';
  import {compositionSlots,compositionTrail,type CompositionFocus} from './composition-focus.js';
  let {document,focus,descriptors,disabled=false,onNavigate}: {document:UiDocument;focus:CompositionFocus;descriptors:readonly UiExtensionDescriptor[];disabled?:boolean;onNavigate:(focus:CompositionFocus|undefined)=>void}=$props();
  const trail=$derived(compositionTrail(document,focus));
  const slots=$derived(compositionSlots(document,focus.nodeId,descriptors));
  const name=(slot:string)=>slot.replace(/[-_]/g,' ').replace(/^./,c=>c.toUpperCase());
</script>
<nav aria-label="Composition navigation">
 <div class="trail"><button type="button" {disabled} onclick={()=>onNavigate(undefined)}>← Screen</button>{#each trail as item,index}<span aria-hidden="true">/</span><button type="button" {disabled} aria-current={index===trail.length-1?'location':undefined} onclick={()=>onNavigate(item)}>{compositionName(document,item.nodeId)}{#if compositionSlots(document,item.nodeId,descriptors).length>1}<small>{name(item.slotName)}</small>{/if}</button>{/each}</div>
 {#if slots.length>1}<label>Content area<select aria-label="Composition slot" value={focus.slotName} {disabled} onchange={event=>onNavigate({...focus,slotName:event.currentTarget.value})}>{#each slots as slot}<option value={slot}>{name(slot)}</option>{/each}</select></label>{/if}
 <span class="hint">Content composition · app visibility unchanged</span>
</nav>
<style>
 nav{display:flex;align-items:center;flex-wrap:wrap;gap:6px 12px;padding:7px 12px;border-bottom:1px solid #dce2eb;background:#f5f7fc;color:#506078;font:11px/1.4 'Segoe UI',system-ui,sans-serif;min-width:0;}
 .trail{display:flex;align-items:center;gap:5px;flex:1;overflow:auto;min-width:140px;}button{display:flex;align-items:center;gap:5px;white-space:nowrap;border:0;background:transparent;color:#5266a8;cursor:pointer;padding:4px;border-radius:3px;font:inherit;}button[aria-current]{color:#25334f;font-weight:600;}small{font-size:10px;color:#7b879c;font-weight:400;}label{display:flex;align-items:center;gap:5px;}select{font:inherit;border:1px solid #dce2eb;border-radius:4px;background:white;color:#34425a;padding:4px;max-width:150px;}.hint{font-size:10px;color:#78869c;} :disabled{opacity:.5;cursor:default;}:focus-visible{outline:2px solid #5269bd;outline-offset:-1px;}
 @media(max-width:600px){.hint{width:100%;}.trail{flex-basis:100%;}}
</style>
