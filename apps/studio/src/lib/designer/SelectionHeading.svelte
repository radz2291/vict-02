<script lang="ts">
 import type {UiDocument} from '@victframework/ui';
 import {SourceIdentity} from '@victframework/ui-editor';
 import type {StructureGraph} from './structure.js';
 import {itemKey,type WorkspaceItem} from './workspace-selection.js';
 import {selectionMember} from './selection-presentation.js';
 let {document,graph,items,blocked=false,renderedOccurrences,onInspect,onRemove}:{document:UiDocument;graph:StructureGraph;items:readonly WorkspaceItem[];blocked?:boolean;renderedOccurrences?:readonly string[];onInspect?:(item:WorkspaceItem)=>void;onRemove?:(item:WorkspaceItem)=>void}=$props();
 let expanded=$state(false);
 $effect(()=>{void items;expanded=false;});
 const shown=$derived(expanded?items:items.slice(0,3));
 const nodes=$derived(items.filter(item=>item.kind==='node').length);
 const edges=$derived(items.length-nodes);
 const title=$derived([nodes?`${nodes} ${nodes===1?'node':'nodes'}`:'',edges?`${edges} ${edges===1?'connection':'connections'}`:''].filter(Boolean).join(' · '));
</script>
{#snippet member(item:WorkspaceItem)}
 {@const identity=selectionMember(document,graph,item,renderedOccurrences)}
 {#if identity.endpoints}
  <span class="connection-identity" title={identity.name}><small>Connection</small><SourceIdentity icon={identity.endpoints.subject.iconKey} name={identity.endpoints.subject.name} context={identity.endpoints.subject.scope||undefined}/><span class="identity-phrase">{identity.endpoints.phrase}</span><SourceIdentity icon={identity.endpoints.other.iconKey} name={identity.endpoints.other.name} context={identity.endpoints.other.scope||undefined}/></span>
 {:else}
  <SourceIdentity icon={identity.iconKey} name={identity.name} kindLabel={identity.type.toLowerCase()!==identity.name.toLowerCase()?identity.type:undefined} context={identity.context||undefined} variant="card"/>
 {/if}
{/snippet}
<header class="selection-heading" aria-label="Selected items">
 {#if items.length>1}<span class="selection-count">{title}</span>{/if}
 <div class="identity-members">
 {#if items.length===1}<div class="selection-identity-card">{@render member(items[0]!)}</div>
 {:else if items.length}
  <ul class="selection-items">{#each shown as item (itemKey(item))}<li><button class="inspect-item" type="button" disabled={blocked} title={`Inspect ${selectionMember(document,graph,item,renderedOccurrences).name}`} onclick={()=>onInspect?.(item)}>{@render member(item)}</button><button class="remove-item" type="button" disabled={blocked} aria-label={`Remove ${selectionMember(document,graph,item).type} ${selectionMember(document,graph,item).name} from selection`} onclick={()=>onRemove?.(item)}>×</button></li>{/each}</ul>
 {:else}<span>No selection</span>{/if}
 </div>
 {#if items.length>3}<button class="more-members" type="button" aria-expanded={expanded} onclick={()=>expanded=!expanded}>{expanded?'Show fewer':`Show all ${items.length}`}</button>{/if}
</header>
<style>
 .selection-heading{flex:none;display:flex;flex-direction:column;gap:8px;max-height:min(240px,40%);min-height:0;padding:12px;border-bottom:1px solid var(--vict-color-border);box-sizing:border-box;font-weight:400;overflow:hidden}
 .identity-members{min-height:0;overflow:auto;overscroll-behavior:contain}.selection-count,.more-members{flex:none}.selection-items{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}.selection-items li{display:flex;border:1px solid var(--vict-color-border);border-radius:5px;min-width:0}
 .selection-identity-card{border:1px solid var(--vict-color-border);border-radius:5px;padding:8px;min-width:0}
 .inspect-item{flex:1;min-width:0;padding:8px;text-align:left}.remove-item{width:28px;flex:none;align-self:flex-start}.more-members{align-self:flex-start;color:var(--vict-color-textMuted);padding:2px 0}
 .connection-identity{display:flex;flex-direction:column;gap:2px;min-width:0}.connection-identity>small,.identity-phrase{font:var(--studio-font-meta);color:var(--vict-color-textMuted)}.identity-phrase{padding-left:20px}
 button{background:transparent;border:0;color:inherit;font:inherit;cursor:pointer}button:hover{background:var(--vict-control-selected)}button:focus-visible{outline:2px solid var(--vict-color-focusRing);outline-offset:-2px}button:disabled{opacity:.5;cursor:default}
</style>
