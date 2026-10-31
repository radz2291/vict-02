<script lang="ts">
 import GraphWorkspaceV3 from '../src/composition/GraphWorkspaceV3.svelte';
 import GraphEdgeSettings from '../src/composition/GraphEdgeSettings.svelte';
 import type {UiScopedSlotFrame} from '@victframework/ui-svelte';
 import Context from './EdgeSettingsContextProbe.svelte';
 let {initial,record,emit}:{initial:string;record:(frame:UiScopedSlotFrame)=>void;emit:(name:string,value:unknown)=>void}=$props();
 let visible=$state(true);
 export function hideSettings(){visible=false;}
</script>
{#snippet fields(frame:UiScopedSlotFrame)}{@const captured=record(frame)}<span data-frame={captured===undefined?'captured':'invalid'}></span>{/snippet}
{#snippet content(_frame:UiScopedSlotFrame)}
 <Context props={{}}/>
 {#if visible}<GraphEdgeSettings props={{target:'canvas'}} io={{emit,scopedSlots:{content:fields}}}/>{/if}
{/snippet}
<GraphWorkspaceV3 props={{graph:initial}} io={{emit,scopedSlots:{content}}} nodeId="lifetime-workspace" occurrenceKey="lifetime-occurrence"/>
