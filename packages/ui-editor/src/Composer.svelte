<script lang="ts">
  import type { UiDocument, UiExtensionDescriptor } from '@victframework/ui';
  import { compositionTargets, detachedContent, detachSlotContent, compositionParent, compositionName, insertSubtree, type InsertRecipe } from './composition.js';
  import ToolPages from './ToolPages.svelte';
  import {compositionMembers,type CompositionFocus} from './composition-focus.js';
  import type { TransactionDraft } from './commands.js';
  let { document, selectedNodeId, recipes, descriptors = [], showInsert = true, showArrange = true, compact = false, onApply, onInserted, onDuplicate, onDetached, compositionFocus }: {
    document: UiDocument; selectedNodeId?: string; recipes: readonly InsertRecipe[];
    descriptors?: readonly UiExtensionDescriptor[]; showInsert?: boolean; showArrange?: boolean; onApply: (draft: TransactionDraft) => boolean;
    onInserted?: (nodeId: string) => void;
    onDetached?: (parentId: string) => void;
    compositionFocus?: CompositionFocus;
    compact?: boolean; onDuplicate?: () => void;
  } = $props();
  let reuseId = $state('');
  const reusable = $derived(detachedContent(document));
  const reuseTargets = $derived(compositionTargets(document,descriptors,reuseId));
  let search = $state('');
  let destination = $state('');
  let moveDestination = $state('');
  let placement = $state<'inside' | 'before' | 'after'>('inside');
  const members=$derived(compositionFocus?compositionMembers(document,compositionFocus):undefined);
  const targets = $derived(compositionTargets(document, descriptors).filter(target=>!compositionFocus || (target.nodeId===compositionFocus.nodeId?target.slotName===compositionFocus.slotName:members?.has(target.nodeId))));
  const moveTargets = $derived(compositionTargets(document, descriptors, selectedNodeId));
  const parent = $derived(selectedNodeId && selectedNodeId!==compositionFocus?.nodeId ? compositionParent(document, selectedNodeId) : undefined);
  const position = $derived(parent && selectedNodeId ? parent.children.indexOf(selectedNodeId) : -1);
  const key = (target: { nodeId: string; slotName?: string }) => JSON.stringify([target.nodeId, target.slotName ?? '']);
  $effect(() => {
    const selectedTargets = targets.filter(t => t.nodeId === selectedNodeId);
    const selectedTarget = selectedTargets[0];
    const parentTarget = parent && targets.find(t => key(t) === key(parent));
    const target = selectedTarget ?? parentTarget ?? targets[0];
    destination = compact && selectedTargets.length > 1 ? '' : target ? key(target) : '';
    moveDestination = '';
    placement = selectedTarget ? 'inside' : 'after';
  });
  function insert(recipe: InsertRecipe) {
    const chosen = targets.find(t => key(t) === destination);
    const target = placement !== 'inside' && parent && selectedNodeId
      ? { ...parent, index: parent.children.indexOf(selectedNodeId) + (placement === 'after' ? 1 : 0) } : chosen;
    if (!target) return;
    const id = `${recipe.id}-${globalThis.crypto.randomUUID().slice(0, 8)}`;
    if (onApply(insertSubtree(globalThis.crypto.randomUUID(), recipe.create(id), target))) onInserted?.(id);
  }
  function detachSelection() {
    if(!selectedNodeId || !parent) return;
    const parentId=parent.nodeId;
    const draft=detachSlotContent(crypto.randomUUID(),document,selectedNodeId);
    if(draft && onApply(draft)) onDetached?.(parentId);
  }
  function reuse() {
    if(!reusable.some(node=>node.id===reuseId)) return;
    const chosen=reuseTargets.find(target=>key(target)===destination);
    const into=placement!=='inside' && parent && selectedNodeId?{...parent,index:parent.children.indexOf(selectedNodeId)+(placement==='after'?1:0)}:chosen;
    if(!into) return;
    if(onApply({requestId:crypto.randomUUID(),reason:'Reuse detached source',commands:[{op:'move',nodeId:reuseId,newParentId:into.nodeId,slotName:into.slotName,index:into.index}]})) onInserted?.(reuseId);
  }
  function reorder(delta: number) {
    if (!parent || !selectedNodeId) return;
    onApply({ requestId: globalThis.crypto.randomUUID(), reason: 'Reorder element', commands: [{ op: 'move', nodeId: selectedNodeId, newParentId: parent.nodeId, slotName: parent.slotName, index: position + delta }] });
  }
  function chooseDestination(value: string) {
    if (value === 'before' || value === 'after') placement = value;
    else { placement = 'inside'; destination = value; }
  }
</script>

<section class="composer" class:compact aria-label="Compose screen">
  {#if showArrange && selectedNodeId && selectedNodeId !== document.root}
    <div class="arrange">{#if !compact}<h3>Arrange selection</h3>{/if}
      <div class="arrange-actions">
        <div class="order"><button type="button" aria-label="Move up" title="Move up" disabled={!parent || position < 1} onclick={() => reorder(-1)}>{compact ? '↑ Up' : 'Move up'}</button><button type="button" aria-label="Move down" title="Move down" disabled={!parent || position >= parent.children.length - 1} onclick={() => reorder(1)}>{compact ? '↓ Down' : 'Move down'}</button></div>
        {#if onDuplicate}<button class="duplicate" type="button" onclick={onDuplicate}>Duplicate</button>{/if}
        <button class="remove" type="button" aria-label="Remove selection" onclick={() => onApply({ requestId: globalThis.crypto.randomUUID(), reason: 'Remove selection', commands: [{ op: 'remove', nodeId: selectedNodeId!, detachFromParent: true }] })}>{compact ? 'Remove' : 'Remove selection'}</button>
      </div>
      <div class="move-target">
        <label><span>Move into</span><select aria-label="Move into" bind:value={moveDestination}><option value="">Choose a parent or slot…</option>{#each moveTargets as target (key(target))}<option value={key(target)}>{target.label}</option>{/each}</select></label>
        <button type="button" class="move" aria-label="Move selection" disabled={!moveDestination} onclick={() => { const target = moveTargets.find(t => key(t) === moveDestination); if (target) onApply({ requestId: globalThis.crypto.randomUUID(), reason: 'Move selection', commands: [{ op: 'move', nodeId: selectedNodeId!, newParentId: target.nodeId, slotName: target.slotName }] }); }}>{compact ? 'Move' : 'Move selection'}</button>
      </div>
      {#if parent?.slotName}<div class="keep-aside"><button type="button" onclick={detachSelection}>Keep aside</button><span>Detach from this slot and keep the content for reuse.</span></div>{/if}
    </div>
  {/if}
  {#if showInsert}
  {#if compact}
    <select aria-label="Insertion destination" value={placement === 'inside' ? destination : placement} onchange={event => chooseDestination(event.currentTarget.value)}>
      <option value="">Choose where to add…</option>
      {#if parent && selectedNodeId}<option value="before">Before {compositionName(document, selectedNodeId)}</option><option value="after">After {compositionName(document, selectedNodeId)}</option>{/if}
      {#each targets as target (key(target))}<option value={key(target)}>Inside {target.label}</option>{/each}
    </select>
  {:else}
  <label>Insert position<select aria-label="Insert position" bind:value={placement}><option value="inside">Inside a container or slot</option>{#if parent}<option value="before">Before selection</option><option value="after">After selection</option>{/if}</select></label>
  <label>Insert into<select aria-label="Insert into" bind:value={destination} disabled={placement !== 'inside'}>{#each targets as target (key(target))}<option value={key(target)}>{target.label}</option>{/each}</select></label>
  <input type="search" aria-label="Search elements" placeholder="Find an element or component…" bind:value={search} />
  {/if}
  <ToolPages pages={[{id:'new',label:'New element'},{id:'reuse',label:`Reuse (${reusable.length})`}]} label="Insert content pages">{#snippet children(page)}
  {#if page==='new'}<div class="recipes">{#each recipes.filter(r => `${r.label} ${r.description}`.toLowerCase().includes(search.toLowerCase())) as recipe (recipe.id)}
    <button class="recipe" type="button" disabled={placement === 'inside' ? !destination : !parent} onclick={() => insert(recipe)} title={recipe.description}><span class="plus">+</span><span><strong>{recipe.label}</strong>{#if !compact}<small>{recipe.description}</small>{/if}</span></button>
  {/each}</div>
  {:else}<div class="reuse"><label>Kept content<select aria-label="Kept content" value={reuseId} onchange={event=>reuseId=event.currentTarget.value}><option value="">Choose content…</option>{#each reusable as node}<option value={node.id}>{compositionName(document,node.id)}</option>{/each}</select></label><button type="button" disabled={!reuseId || (placement==='inside'?!reuseTargets.some(target=>key(target)===destination):!parent)} onclick={reuse}>Place content</button><p>Moves the same saved source, including its styles and connections. Undo returns it here.</p>{#if !reusable.length}<p>No detached content. Select a slot child and use Arrange → Keep aside.</p>{/if}</div>{/if}
  {/snippet}</ToolPages>
  {/if}
</section>
<style>
  .keep-aside {display:flex;align-items:center;gap:7px;}.keep-aside span,.reuse p {font-size:11px;color:#758195;}.reuse button {border:1px solid #dce2ea;background:white;border-radius:4px;padding:5px 7px;margin-top:5px;}
  .composer { display:grid; gap:12px; font:13px/1.45 system-ui,sans-serif; }
  label { display:grid; gap:5px; color:#536176; font-size:11px; font-weight:600; }
  input,select,button { font:inherit; min-width:0; }
  input,select { width:100%; box-sizing:border-box; padding:8px; border:1px solid #dce2ea; border-radius:6px; background:white; color:#253044; }
  .recipes { display:grid; gap:5px; }
  .recipe { display:flex; text-align:left; gap:12px; padding:10px; background:white; border:1px solid #e5e9ef; border-radius:7px; cursor:pointer; color:#253044; }
  .recipe:hover { border-color:#8298d4; background:#f5f7ff; }
  .plus { color:#586fc0; font-size:21px; line-height:1.2; }
  strong,small { display:block; } strong {font-weight:550;} small { color:#758195; font-size:11px; margin-top:2px; }
  .arrange { display:grid; gap:8px; border-top:1px solid #e3e7ed; padding-top:14px; }
  h3 { font-size:11px; text-transform:uppercase; letter-spacing:.07em; margin:0; color:#617086; }
  .arrange-actions, .move-target {display:contents;}
  .order { display:flex; gap:6px; } .order button {flex:1;}
  .arrange button { border:1px solid #dce2ea; border-radius:5px; padding:7px; background:white; cursor:pointer; }
  .arrange .remove {color:#a13c4b;}
  button:disabled {opacity:.4;cursor:default;} :focus-visible {outline:2px solid #556ed1;outline-offset:2px;}
  .compact { gap:6px; font-size:11px; } .compact select { padding:4px 6px; height:27px; border-radius:4px; font-size:11px; }
  .compact .recipes { grid-template-columns:repeat(3,minmax(0,1fr)); gap:4px; }
  .compact .recipe { align-items:center; gap:5px; padding:4px 6px; min-height:25px; border-radius:4px; }
  .compact .plus { font-size:14px; } .compact strong {font-size:11px;}
  .compact .arrange { padding:0; border:0; gap:6px; }
  .compact .arrange-actions {display:flex;align-items:center;gap:4px;}
  .compact .order {display:contents;}
  .compact .order button {flex:initial;}
  .compact .duplicate {margin-left:4px;}
  .compact .move-target {display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:6px;}
  .compact .move-target label {display:contents;font-weight:400;}
  .compact .move-target span {white-space:nowrap;}
  .compact .arrange button {padding:4px 7px;min-height:27px;font-size:11px;white-space:nowrap;color:#34425a;}
  .compact .arrange .remove {color:#a13c4b;}
  .compact .arrange button:not(:disabled):hover {background:#f5f7ff;border-color:#8298d4;}
  .compact .move-target .move {color:#405abd;background:#f5f7ff;}
</style>
