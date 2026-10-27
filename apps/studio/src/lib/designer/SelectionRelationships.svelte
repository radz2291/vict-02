<script lang="ts">
 import type {UiDocument} from '@victframework/ui';
 import {SourceIdentity,selectionOperation,type SelectionOperation} from '@victframework/ui-editor';
 import {parseStructureId,type StructureGraph} from './structure.js';
 import type {WorkspaceItem} from './workspace-selection.js';
 import {selectionIdentity} from './selection-presentation.js';
 import {relationLabel,relationMeaning,connectionKind,connectionKinds} from './structure-connections.js';
 import {relationshipGroups,relationshipPhrase,relationshipStories} from './selection-relationships.js';
 let {document,graph,items,blocked=false,onIntent}:{document:UiDocument;graph:StructureGraph;items:readonly WorkspaceItem[];blocked?:boolean;onIntent:(item:WorkspaceItem,operation:SelectionOperation)=>void}=$props();
 const groups=$derived(relationshipGroups(graph,items));
 const anchor=$derived(items.length===1&&items[0]?.kind==='node'?items[0].id:undefined);
 const identities=$derived(new Map(graph.nodes.map(node=>[node.id,selectionIdentity(document,graph,{kind:'node',id:node.id})])));
 const duplicateNames=$derived.by(()=>{const counts=new Map<string,number>();for(const identity of identities.values())counts.set(identity.name,(counts.get(identity.name)??0)+1);return counts;});
 let limit=$state(50);
 $effect(()=>{void items;limit=50;});
 const stories=$derived(anchor?relationshipStories(groups,anchor,limit):[]);
 function select(item:WorkspaceItem,event:{ctrlKey:boolean;metaKey:boolean}){onIntent(item,selectionOperation(event));}
 function keyboard(event:KeyboardEvent,item:WorkspaceItem){if(event.key==='Enter'||event.key===' '){event.preventDefault();if(!event.repeat)select(item,event);}}
 function nodeItem(id:string):WorkspaceItem{const source=graph.nodes.find(node=>node.id===id);return {kind:'node',id,...(source?.data.occurrence?{occurrence:source.data.occurrence}:{})};}
 function qualifier(id:string){
  const identity=identities.get(id);if(!identity||(duplicateNames.get(identity.name)??0)<2)return '';
  const context=identity.scope||identity.textContext||identity.type;
  const same=[...identities.values()].filter(other=>other.name===identity.name&&(other.scope||other.textContext||other.type)===context);
  return same.length>1?`${context} · ${graph.nodes.find(node=>node.id===id)?.data.sourceId||parseStructureId(id)?.[2]||id}`:context;
 }

</script>
{#snippet endpoint(id:string,prominent=false)}
 {@const item=nodeItem(id)}{@const identity=identities.get(id)}{@const scope=qualifier(id)}
 <button class="endpoint" class:story-target={prominent} type="button" disabled={blocked} title={[identity?.qualified,id].filter(Boolean).join(' · ')} aria-label={identity?.qualified??id} onclick={event=>select(item,event)} onkeydown={event=>keyboard(event,item)}>
  <SourceIdentity icon={identity?.iconKey??'container'} name={identity?.name??'Unavailable'} context={scope||undefined}/>
 </button>
{/snippet}
{#snippet roleControl(group:typeof groups[number],phrase:string)}
 {@const edge=group.edge}{@const from=identities.get(edge.source)}{@const to=identities.get(edge.target)}
 <button class="connection-role" type="button" disabled={blocked} title={[edge.data?.origin==='host'?'Host connection':'Document declaration',edge.data?.description??relationMeaning(edge),...group.paths].join('\n')} aria-label={`Inspect ${relationLabel(edge)} connection from ${from?.qualified??edge.source} to ${to?.qualified??edge.target}`} onclick={event=>select({kind:'edge',id:edge.id},event)} onkeydown={event=>keyboard(event,{kind:'edge',id:edge.id})}>
  {#if anchor}<span class="relation-dot" aria-hidden="true" style:background={connectionKinds[connectionKind(edge)].color}></span>{/if}{phrase}{#if group.paths.length>1}<small title="Declared references">({group.paths.length})</small>{/if}
 </button>
{/snippet}
<div class="details-relationships">
 {#if anchor}
  {#each stories as story (story.targetId)}
   <div class="relationship-story">
    <div class="story-phrases">{#each story.relations as group (group.edge.id)}{@render roleControl(group,relationshipPhrase(group.edge,anchor))}{/each}</div>
    {@render endpoint(story.targetId,true)}
    {#if story.count>1}<small class="story-count">{story.shown<story.count?`${story.shown} of ${story.count} references`:`${story.count} references`}</small>{/if}
   </div>
  {/each}
 {:else}
  <div class="relationship-group" role="group" aria-label="Connections">
   {#each groups.slice(0,limit) as group (group.edge.id)}
    <div class="connection-row detailed">
     {@render roleControl(group,relationLabel(group.edge))}
     {#if group.edge.data?.origin==='host'}<small class="origin" title="Declared host connection">Host</small>{/if}
     <div class="endpoints">{@render endpoint(group.edge.source)}<span class="direction" aria-hidden="true">→</span>{@render endpoint(group.edge.target)}</div>
    </div>
   {/each}
  </div>
 {/if}
 {#if groups.length>limit}<button type="button" class="more" onclick={()=>limit+=50}>Show 50 more</button>{/if}
 {#if !groups.length}<p>No declared relationships.</p>{/if}
</div>
<style>
 .details-relationships{display:flex;flex-direction:column;gap:8px;min-width:0}.relationship-group{min-width:0}
 .relationship-story{min-width:0;border:1px solid var(--vict-color-border);border-radius:5px;padding:6px 8px}.story-phrases{display:flex;flex-wrap:wrap;align-items:center;gap:0 6px}.story-phrases .connection-role{min-height:24px;padding:2px 3px;font:var(--studio-font-meta);font-weight:400;color:var(--vict-color-textMuted)}.relation-dot{width:5px;height:5px;border-radius:50%;flex:none;align-self:center}.story-target{width:100%;min-height:28px;padding:2px 3px}.story-target{--source-identity-weight:500}.story-count{display:block;padding:0 3px 2px}
 .connection-row{display:grid;grid-template-columns:minmax(58px,.45fr) 12px minmax(0,1fr) auto;align-items:center;gap:4px;padding:3px 0;border-bottom:1px solid var(--vict-color-border);min-width:0}.connection-row:last-child{border-bottom:0}.connection-row.detailed{grid-template-columns:minmax(0,1fr) auto}
 button{font:inherit;font-weight:400;color:inherit;background:transparent;border:0;text-align:left;cursor:pointer;min-width:0;min-height:28px;padding:4px;border-radius:3px}button:hover{background:var(--vict-control-selected)}button:focus-visible{outline:2px solid var(--vict-color-focusRing);outline-offset:-2px}button:disabled{opacity:.5;cursor:default}
 .connection-role{display:flex;align-items:baseline;gap:6px;overflow-wrap:anywhere}.endpoint{display:flex;min-width:0}.endpoints{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1fr) 12px minmax(0,1fr);align-items:center;gap:4px}
 small,p,.direction{font:var(--studio-font-meta);color:var(--vict-color-textMuted)}.origin{padding-right:4px}.more{align-self:flex-start}p{margin:0}
</style>
