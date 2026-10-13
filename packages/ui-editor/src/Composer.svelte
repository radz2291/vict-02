<script lang="ts">
  import type { UiDocument, UiExtensionDescriptor } from '@victframework/ui';
  import { compositionTargets, compositionParent, insertSubtree, type InsertRecipe } from './composition.js';
  import type { TransactionDraft } from './commands.js';
  let { document, selectedNodeId, recipes, descriptors = [], showInsert = true, onApply, onInserted }: {
    document: UiDocument; selectedNodeId?: string; recipes: readonly InsertRecipe[];
    descriptors?: readonly UiExtensionDescriptor[]; showInsert?: boolean; onApply: (draft: TransactionDraft) => boolean;
    onInserted?: (nodeId: string) => void;
  } = $props();
  let search = $state('');
  let destination = $state('');
  let moveDestination = $state('');
  const targets = $derived(compositionTargets(document, descriptors));
  const moveTargets = $derived(compositionTargets(document, descriptors, selectedNodeId));
  const parent = $derived(selectedNodeId ? compositionParent(document, selectedNodeId) : undefined);
  const position = $derived(parent && selectedNodeId ? parent.children.indexOf(selectedNodeId) : -1);
  const key = (target: { nodeId: string; slotName?: string }) => JSON.stringify([target.nodeId, target.slotName ?? '']);
  $effect(() => {
    const selectedTarget = targets.find(t => t.nodeId === selectedNodeId);
    const parentTarget = parent && targets.find(t => key(t) === key(parent));
    const target = selectedTarget ?? parentTarget ?? targets[0];
    destination = target ? key(target) : '';
    moveDestination = '';
  });
  function insert(recipe: InsertRecipe) {
    const target = targets.find(t => key(t) === destination);
    if (!target) return;
    const id = `${recipe.id}-${globalThis.crypto.randomUUID().slice(0, 8)}`;
    if (onApply(insertSubtree(globalThis.crypto.randomUUID(), recipe.create(id), target))) onInserted?.(id);
  }
  function reorder(delta: number) {
    if (!parent || !selectedNodeId) return;
    onApply({ requestId: globalThis.crypto.randomUUID(), reason: 'Reorder element', commands: [{ op: 'move', nodeId: selectedNodeId, newParentId: parent.nodeId, slotName: parent.slotName, index: position + delta }] });
  }
</script>

<section class="composer" aria-label="Compose screen">
  {#if showInsert}
  <label>Insert into<select aria-label="Insert into" bind:value={destination}>{#each targets as target (key(target))}<option value={key(target)}>{target.label}</option>{/each}</select></label>
  <input type="search" aria-label="Search elements" placeholder="Find an element or component…" bind:value={search} />
  <div class="recipes">{#each recipes.filter(r => `${r.label} ${r.description}`.toLowerCase().includes(search.toLowerCase())) as recipe (recipe.id)}
    <button class="recipe" type="button" disabled={!destination} onclick={() => insert(recipe)}><span class="plus">+</span><span><strong>{recipe.label}</strong><small>{recipe.description}</small></span></button>
  {/each}</div>
  {/if}
  {#if selectedNodeId && selectedNodeId !== document.root}
    <div class="arrange"><h3>Arrange selection</h3>
      <div class="order"><button type="button" disabled={!parent || position < 1} onclick={() => reorder(-1)}>Move up</button><button type="button" disabled={!parent || position >= parent.children.length - 1} onclick={() => reorder(1)}>Move down</button></div>
      <label>Move into<select aria-label="Move into" bind:value={moveDestination}><option value="">Choose a parent or slot…</option>{#each moveTargets as target (key(target))}<option value={key(target)}>{target.label}</option>{/each}</select></label>
      <button type="button" disabled={!moveDestination} onclick={() => { const target = moveTargets.find(t => key(t) === moveDestination); if (target) onApply({ requestId: globalThis.crypto.randomUUID(), reason: 'Move selection', commands: [{ op: 'move', nodeId: selectedNodeId!, newParentId: target.nodeId, slotName: target.slotName }] }); }}>Move selection</button>
      <button class="remove" type="button" onclick={() => onApply({ requestId: globalThis.crypto.randomUUID(), reason: 'Remove selection', commands: [{ op: 'remove', nodeId: selectedNodeId!, detachFromParent: true }] })}>Remove selection</button>
    </div>
  {/if}
</section>
<style>
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
  .order { display:flex; gap:6px; } .order button {flex:1;}
  .arrange button { border:1px solid #dce2ea; border-radius:5px; padding:7px; background:white; cursor:pointer; }
  .arrange .remove {color:#a13c4b;}
  button:disabled {opacity:.4;cursor:default;} :focus-visible {outline:2px solid #556ed1;outline-offset:2px;}
</style>
