<script lang="ts">
  import type { UiDocument, UiRenderPlan, UiRenderInstruction } from '@victframework/ui';
  import { occurrenceKey, resolveValue, uniqueRepeatKeys, asRecord, evaluatedComponentProps, conditionsOf, evaluateCondition, type DocumentScope } from '@victframework/ui-svelte';
  import { type EditorLabels } from './inspector-ux.js';
  import { resolveOccurrence } from './occurrence.js';
  import { tick, untrack } from 'svelte';
  import { previewValues } from './preview-values.js';
  import { compositionName, moveRelative, type CompositionPlacement } from './composition.js';
  import type { TransactionDraft } from './commands.js';
  import {compositionSlots,type CompositionFocus} from './composition-focus.js';
  let { plan, document, selectedOccurrence, onSelect, ariaLabel = 'Layers', labels = {}, scope, onApply, componentDescriptors = [], onOpenComposition, compact = false, hideTextContent = false }: {
    plan: UiRenderPlan; document?: UiDocument; selectedOccurrence?: string; onSelect?: (occurrence: string) => void;
    ariaLabel?: string; labels?: EditorLabels; scope?: DocumentScope;
    onApply?: (draft: TransactionDraft) => boolean; componentDescriptors?: readonly import('@victframework/ui').UiExtensionDescriptor[];
    onOpenComposition?:(focus:CompositionFocus)=>void;
    /** Dense single-line rows for a document browser. Full labels remain accessible. */
    compact?: boolean;
    /** Hide sole source-owned text children when the host selects their parent. */
    hideTextContent?: boolean;
  } = $props();
  interface Entry { hiddenText?: boolean; key: string; nodeId: string; label: string; detail: string; parent?: string; depth: number; children: boolean; component: boolean; compact: boolean; selectable: boolean; composition?:CompositionFocus; }
  let expanded = $state(new Set<string>());
  let closed = $state(new Set<string>());
  let focusKey = $state('');
  let search = $state('');
  let draggedId = $state('');
  let dropKey = $state('');
  let dropPosition = $state<CompositionPlacement>('before');
  let moveMessage = $state('');
  function direct(entry: Entry) { return !!document && entry.selectable && entry.nodeId !== document.root && entry.key === `${document.id}|${entry.nodeId}`; }
  function dragOver(event: DragEvent, entry: Entry) {
    if (!document || !draggedId || (!direct(entry) && entry.nodeId !== document.root)) return;
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const ratio = (event.clientY - box.top) / box.height;
    const inside = moveRelative(document, draggedId, entry.nodeId, 'inside', componentDescriptors);
    const position: CompositionPlacement = ratio > .25 && ratio < .75 && inside ? 'inside' : ratio < .5 ? 'before' : 'after';
    if (!moveRelative(document, draggedId, entry.nodeId, position, componentDescriptors)) return;
    event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    dropKey = entry.key; dropPosition = position;
    moveMessage = `Move ${compositionName(document, draggedId)} ${position} ${entry.label}`;
  }
  function drop(event: DragEvent, entry: Entry) {
    event.preventDefault();
    if (document && dropKey === entry.key) {
      const command = moveRelative(document, draggedId, entry.nodeId, dropPosition, componentDescriptors);
      if (command && onApply?.({ requestId: crypto.randomUUID(), reason: moveMessage, commands: [command] })) {
        const key = `${document.id}|${draggedId}`; onSelect?.(key); void focus(key);
      }
    }
    draggedId = ''; dropKey = ''; moveMessage = '';
  }
  const query = $derived(search.trim().toLocaleLowerCase());
  let root: HTMLElement;
  const effectiveScope = $derived(scope ? { ...scope, state: { ...scope.state, ...previewValues(document?.localState ?? {}, scope.state ?? {}) } } : undefined);
  const all = $derived.by(() => {
    const out: Entry[] = [];
    function walk(i: UiRenderInstruction, depth: number, keys: readonly string[], parent?: string, values?: DocumentScope, fills: Readonly<Record<string, readonly UiRenderInstruction[]>> = {}, template = false, fillScope?: DocumentScope) {
      const key = occurrenceKey(i.occurrenceKey, keys);
      const label = document ? compositionName(document, i.nodeId, labels) : i.kind === 'text' && i.content.type === 'literal' ? i.content.value : i.kind === 'element' ? i.tag : i.kind === 'component' ? labels.definitions?.[i.definitionId] ?? 'Component' : i.kind;
      const sourceNode = document?.nodes[i.nodeId];
      const hiddenText = !!(hideTextContent && document && !template && !keys.length &&
        i.kind==='element' && i.children.length===1 && i.children[0]?.kind==='text' &&
        sourceNode?.kind==='element' && sourceNode.children.length===1 &&
        !resolveOccurrence(key,document).instancePath.some(step=>document.componentDefinitions[step.definitionId]));
      const start = out.length;
      out.push({ hiddenText, key, nodeId: i.nodeId, label, depth, parent, children: false, component: i.kind === 'component' || i.kind === 'extension', compact: i.kind === 'component' || i.kind === 'extension' || (i.kind === 'element' && i.children.every(c => c.kind === 'text')), selectable: !template && !['component', 'repeat', 'conditional', 'slot'].includes(i.kind), detail: `${i.nodeId}${i.kind === 'component' ? ` · definition ${i.definitionId} @ ${i.definitionRevision}` : ''}${keys.length ? ` · record ${keys.join(' / ')}` : ''}${template ? ' · template (runtime scope unavailable)' : ''}` });
      const child = (instruction: UiRenderInstruction, childValues = values, childKeys = keys, childFills = fills, isTemplate = template, childFillScope = fillScope) => walk(instruction, depth + 1, childKeys, key, childValues, childFills, isTemplate, childFillScope);
      if (i.kind === 'element' || i.kind === 'unsupported') i.children.filter(c=>!hiddenText || c.kind!=='text').forEach(c => child(c));
      if (i.kind === 'extension') {
        const slots=document && onOpenComposition?compositionSlots(document,i.nodeId,componentDescriptors):[];
        if(slots.length) for(const name of slots){
          const children=i.slots?.[name] ?? [];
          const slotKey=`${key}|slot:${name}`;
          out.push({key:slotKey,nodeId:i.nodeId,label:`${name.replace(/^./,c=>c.toUpperCase())} · composition`,detail:`${children.length} ${children.length===1?'item':'items'} · open to edit`,parent:key,depth:depth+1,children:!!children.length,component:false,compact:false,selectable:false,composition:{nodeId:i.nodeId,slotName:name}});
          children.forEach(c=>walk(c,depth+2,keys,slotKey,values,{},template));
        }
        else Object.values(i.slots ?? {}).forEach(children => children.forEach(c => child(c, values, keys, {})));
      }
      if (i.kind === 'component') child(i.body, values ? { ...values, props: evaluatedComponentProps(i, values) } : undefined, keys, i.slots, template, values);
      if (i.kind === 'slot') {
        const filled = (fills[i.name]?.length ?? 0) > 0;
        (filled ? fills[i.name]! : i.fallback).forEach(c => child(c, filled ? fillScope ?? values : values, keys, filled ? {} : fills, template, filled ? undefined : fillScope));
      }
      if (i.kind === 'conditional') {
        if (values) {
          const branch = i.branches.find(b => b.when === undefined || evaluateCondition(b.when, conditionsOf(plan), values));
          branch?.children.forEach(c => child(c));
        } else i.branches.forEach(b => b.children.forEach(c => child(c, values, keys, fills, true)));
      }
      if (i.kind === 'repeat') {
        const rows = values ? resolveValue({ type: 'expression', expression: i.collection }, values) : undefined;
        if (values && Array.isArray(rows)) {
          const rowScopes = rows.map(row => { const record = asRecord(row); return { ...values, repeatItem: { name: i.itemName, value: record }, repeatItems: { ...values.repeatItems, [i.itemName]: record } }; });
          const rowKeys = uniqueRepeatKeys(rowScopes.map((s, index) => String(resolveValue({ type: 'expression', expression: i.key }, s) ?? index)), i.nodeId);
          rowScopes.forEach((s, index) => child(i.template, s, [...keys, rowKeys[index] ?? `${index}`], fills));
        } else child(i.template, values, keys, fills, true);
      }
      if (out[start]) out[start] = { ...out[start]!, children: out.length > start + 1 };
    }
    plan.structure.forEach(i => walk(i, 0, [], undefined, effectiveScope));
    return out;
  });
  // Count immediate children in the complete outline, independent of search/collapse.
  const childCounts = $derived.by(() => {
    const counts = new Map<string,number>();
    for(const entry of all) if(entry.parent) counts.set(entry.parent,(counts.get(entry.parent) ?? 0)+1);
    return counts;
  });
  function isOpen(entry: Entry) { return !closed.has(entry.key) && (!entry.compact || expanded.has(entry.key)); }
  const matches = $derived(all.filter(entry => `${entry.label} ${entry.detail}`.toLocaleLowerCase().includes(query)));
  const searchKeys = $derived.by(() => {
    const keys = new Set<string>();
    if (!query) return keys;
    for (const entry of matches) {
      keys.add(entry.key);
      let parent = entry.parent;
      while (parent) { keys.add(parent); parent = all.find(e => e.key === parent)?.parent; }
    }
    return keys;
  });
  const entries = $derived(all.filter(entry => {
    if (query) return searchKeys.has(entry.key);
    let parent = entry.parent;
    while (parent) { const ancestor = all.find(e => e.key === parent); if (!ancestor || !isOpen(ancestor)) return false; parent = ancestor.parent; }
    return true;
  }));
  const selectedAncestors = $derived.by(() => {
    const keys = new Set<string>();
    let parent = all.find(entry => entry.key === selectedOccurrence)?.parent;
    while(parent) {keys.add(parent);parent=all.find(entry=>entry.key===parent)?.parent;}
    return keys;
  });
  const treeGuides = $derived.by(() => {
    const guides = new Map<string, {level:number;end:boolean;continues:boolean}[]>();
    const siblings = new Map<string|undefined, string>();
    for(const entry of entries) siblings.set(entry.parent,entry.key);
    for(const entry of entries) {
      const path:Entry[]=[entry];
      let parent=all.find(item=>item.key===entry.parent);
      while(parent) {path.unshift(parent);parent=all.find(item=>item.key===parent?.parent);}
      guides.set(entry.key,path.slice(1).map((branch,level)=>({level,end:level===path.length-2,continues:siblings.get(branch.parent)!==branch.key})));
    }
    return guides;
  });
  function iconPath(entry:Entry):string {
    if(entry.composition) return 'M2 4h5l2 2h5v7H2z';
    const node=document?.nodes[entry.nodeId];
    const tag=node?.kind==='element'?node.tag:'';
    const definition=node?.kind==='component'?node.definitionId:'';
    if(tag==='input' || tag==='textarea') return 'M2 4h12v8H2z M5 6v4';
    if(definition.endsWith('.checkbox')) return 'M3 3h10v10H3z M5 8l2 2 4-4';
    if(tag==='button' || definition.endsWith('.button')) return 'M3 4h10l1 1v6l-1 1H3l-1-1V5z M5 8h6';
    if(definition.endsWith('.dialog') || definition.endsWith('.popover')) return 'M2 3h12v10H2z M2 6h12 M11 4.5h1';
    if(/^h[1-6]$/.test(tag)) return 'M4 3v10 M12 3v10 M4 8h8';
    if(node?.kind==='text' || ['p','span','label','a'].includes(tag)) return 'M3 4h10 M8 4v9 M5 13h6';
    if(entry.component) return 'M8 2l6 6-6 6-6-6z';
    return 'M2 3h12v10H2z M2 6h12';
  }
  function visibleLabel(entry: Entry) {
    if(entry.hiddenText && !labels.nodes?.[entry.nodeId]) return entry.label.split(' · ')[0];
    // Expanded text-only elements use their role; the child carries the content.
    if (entry.compact && !entry.component && (query || isOpen(entry)) && !labels.nodes?.[entry.nodeId]) return entry.label.split(' · ')[0];
    return entry.label;
  }
  const tabStop = $derived(entries.some(entry => entry.key === focusKey) ? focusKey : entries[0]?.key);
  $effect(() => {
    if (!selectedOccurrence) return;
    const entry = all.find(e => e.key === selectedOccurrence);
    if (!entry) return;
    untrack(() => {
      let parent = entry.parent;
      const nextExpanded = new Set(expanded), nextClosed = new Set(closed);
      while (parent) { nextExpanded.add(parent); nextClosed.delete(parent); parent = all.find(e => e.key === parent)?.parent; }
      expanded = nextExpanded; closed = nextClosed;
    });
    focusKey = selectedOccurrence;
  });
  function toggle(entry: Entry) {
    if (isOpen(entry)) {
      let focused = all.find(item => item.key === focusKey);
      while (focused?.parent) {
        if (focused.parent === entry.key) { focusKey = entry.key; break; }
        focused = all.find(item => item.key === focused?.parent);
      }
      closed = new Set([...closed, entry.key]);
    }
    else { closed = new Set([...closed].filter(k => k !== entry.key)); expanded = new Set([...expanded, entry.key]); }
  }
  async function focus(key: string) { focusKey = key; await tick(); Array.from(root.querySelectorAll<HTMLElement>('[role=treeitem]')).find(e => e.dataset.key === key)?.focus(); }
  function select(entry: Entry) { focusKey = entry.key; if(entry.composition)onOpenComposition?.(entry.composition); else if (entry.selectable) onSelect?.(entry.key); else if (entry.children && !query) toggle(entry); }
  function keyboard(event: KeyboardEvent, entry: Entry) {
    const index = entries.findIndex(e => e.key === entry.key);
    let next: string | undefined;
    if (event.key === 'ArrowDown') next = entries[Math.min(entries.length - 1, index + 1)]?.key;
    if (event.key === 'ArrowUp') next = entries[Math.max(0, index - 1)]?.key;
    if (event.key === 'Home') next = entries[0]?.key;
    if (event.key === 'End') next = entries.at(-1)?.key;
    if (event.key === 'ArrowRight') { if (!query && entry.children && !isOpen(entry)) toggle(entry); else next = entries[index + 1]?.parent === entry.key ? entries[index + 1]?.key : undefined; }
    if (event.key === 'ArrowLeft') { if (!query && entry.children && isOpen(entry)) toggle(entry); else next = entry.parent; }
    if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) event.preventDefault();
    if (next) void focus(next);
  }
</script>
<nav class="uv-layers" class:compact aria-label={ariaLabel} bind:this={root}>
  <header><h2>{ariaLabel}</h2><div class="search"><input type="search" aria-label="Search layers" placeholder="Find an element…" bind:value={search} onkeydown={e => { if (e.key === 'Escape') search = ''; if (e.key === 'ArrowDown' && entries[0]) { e.preventDefault(); void focus(entries[0].key); } }} />{#if query}<button type="button" aria-label="Clear layers search" onclick={() => search = ''}>×</button>{/if}</div>{#if query}<p role="status">{matches.length} matches · ancestors shown</p>{/if}</header>
  <ul role="tree" aria-label="Document layers">
    {#each entries as entry (entry.key)}
      <li role="none" class:is-parent={entry.children && (!entry.compact || entry.component)} class:is-ancestor={selectedAncestors.has(entry.key)} class:is-selected={entry.key===selectedOccurrence} style:padding-left={`${entry.depth * 16}px`}>
        <span class="tree-guides" aria-hidden="true">{#each treeGuides.get(entry.key) ?? [] as guide}{#if guide.continues || guide.end}<span class="tree-guide" class:branch={guide.end} class:last={!guide.continues} style:left={`${guide.level*16+10}px`}></span>{/if}{/each}</span>
        {#if entry.children}<button class="disclosure" type="button" tabindex="-1" disabled={!!query} aria-label={`${query || isOpen(entry) ? 'Collapse' : 'Expand'} ${entry.label}`} onclick={() => toggle(entry)}><svg viewBox="0 0 16 16" aria-hidden="true" class:expanded={!!query || isOpen(entry)}><path d="m6 4 4 4-4 4" /></svg></button>{:else}<span class="spacer"></span>{/if}
        <button type="button" role="treeitem" data-key={entry.key} data-drop={dropKey === entry.key ? dropPosition : undefined} aria-level={entry.depth + 1} aria-expanded={entry.children ? !!query || isOpen(entry) : undefined} aria-selected={entry.key === selectedOccurrence} tabindex={entry.key === tabStop ? 0 : -1} title={`${entry.label} · ${entry.detail}`} onclick={() => select(entry)} onkeydown={e => keyboard(e, entry)} onfocus={() => focusKey = entry.key}
          draggable={!!onApply && direct(entry) && !query} ondragstart={event => { if (!direct(entry)) { event.preventDefault(); return; } draggedId = entry.nodeId; if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', entry.nodeId); } }}
          ondragover={event => dragOver(event, entry)} ondrop={event => drop(event, entry)} ondragleave={() => { dropKey = ''; }} ondragend={() => { draggedId = ''; dropKey = ''; moveMessage = ''; }}>
          <span class="icon" aria-hidden="true"><svg viewBox="0 0 16 16"><path d={iconPath(entry)} /></svg></span><span class="name" title={visibleLabel(entry)}>{visibleLabel(entry)}</span>{#if entry.children && !query && !isOpen(entry)}<span class="child-count" title="Direct children" aria-label={`${childCounts.get(entry.key) ?? 0} direct ${childCounts.get(entry.key) === 1 ? 'child' : 'children'}`}>{childCounts.get(entry.key)}</span>{/if}{#if entry.component}<span class="badge" title="Component" aria-label="Component">◇</span>{/if}
        </button>
      </li>
    {/each}
  </ul>
  {#if query && !matches.length}<p class="empty" role="status">No matching elements. Clear search to return to the page.</p>{/if}
  <footer><p>↑ ↓ navigate · → expand · ← collapse · Enter select</p>{#if onApply}<p>Drag to move, or use Arrange tools.</p><p role="status">{moveMessage}</p>{/if}<details><summary>Selection details & provenance</summary><p><strong>{all.find(e => e.key === selectedOccurrence)?.label ?? 'No selected element'}</strong></p><p>{all.find(e => e.key === selectedOccurrence)?.detail}</p><code>{selectedOccurrence ?? ''}</code></details></footer>
</nav>
<style>
  .uv-layers { font: 12px/1.5 var(--ui-editor-font, 'Segoe UI', sans-serif); color: var(--ui-editor-ink, #202938); background: var(--ui-editor-panel, #f8f9fb); min-width: 0; display: flex; flex-direction: column; height: 100%; }
  header { padding: 14px 12px; border-bottom: 1px solid var(--ui-editor-line, #d7dce5); } h2 { font-size: 13px; margin: 0; } p { font-size: 10px; color: var(--ui-editor-muted, #667085); margin: 3px 0; overflow-wrap: anywhere; }
  .search { display: flex; gap: 3px; margin-top: 6px; } .search input { width: 100%; min-width: 0; font: inherit; border: 1px solid var(--ui-editor-line, #d7dce5); border-radius: 4px; background: var(--ui-editor-input, #fff); color: inherit; padding: 5px; } .search button { padding: 0 4px; } .empty { padding: 8px 12px; }
  ul { margin: 0; padding: 8px; list-style: none; overflow: auto; flex: 1; min-height: 100px; }
  li { position:relative;display: flex; align-items: stretch; min-height: 32px; }
  button { border: 0; background: transparent; color: inherit; font: inherit; cursor: pointer; border-radius: 4px; min-width: 0; }
  [role=treeitem] { display: flex; align-items: center; gap: 5px; flex: 1; padding: 5px; text-align: left; }
  [aria-selected=true] { background: var(--ui-editor-selection, #edf1ff); color: var(--ui-editor-accent, #355cc9); }
  .disclosure, .spacer { flex: 0 0 20px; width: 20px; }
  [data-drop=before] {box-shadow:inset 0 2px #5269bd;} [data-drop=after] {box-shadow:inset 0 -2px #5269bd;} [data-drop=inside] {outline:2px solid #5269bd;outline-offset:-2px;} [draggable=true] {cursor:grab;}
  .name { overflow-wrap: anywhere; min-width: 0; flex: 1; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .icon {display:flex;align-items:center;flex:none;width:16px; color: var(--ui-editor-muted, #667085); }
  .icon svg,.disclosure svg {width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.35;stroke-linecap:round;stroke-linejoin:round;}
  .disclosure {display:grid;place-items:center;position:relative;z-index:1;}
  .disclosure svg {width:12px;height:12px;transition:transform .1s;} .disclosure svg.expanded {transform:rotate(90deg);}
  .tree-guides {position:absolute;inset:0;pointer-events:none;}
  .tree-guide {position:absolute;top:0;bottom:0;width:12px;}
  .tree-guide::before {content:'';position:absolute;left:0;top:0;bottom:0;border-left:1px solid #d7deea;}
  .tree-guide.branch::after {content:'';position:absolute;left:0;right:0;top:50%;border-top:1px solid #d7deea;}
  .tree-guide.branch.last::before {bottom:50%;}
  .is-parent .name {font-weight:600;color:#46556e;}
  .is-ancestor > [role=treeitem] {background:#f3f5fb;}
  .is-ancestor > [role=treeitem] .name,.is-ancestor > .disclosure {color:#5269a5;}
  .is-selected .tree-guide::before,.is-selected .tree-guide::after,.is-ancestor .tree-guide::before,.is-ancestor .tree-guide::after {border-color:#9aabd3;}
  .is-selected .name,.is-selected .icon {color:var(--ui-editor-accent,#355cc9);}
  [role=treeitem]:hover {background:#f0f3f9;}
  [role=treeitem][aria-selected=true] {background:var(--ui-editor-selection,#edf1ff);}
  .child-count {flex:none;font-size:10px;font-variant-numeric:tabular-nums;color:var(--ui-editor-muted,#667085);padding-inline:4px;}
  .badge { font-size: 9px; color: var(--ui-editor-muted, #667085); }
  :focus-visible { outline: 2px solid var(--ui-editor-accent, #355cc9); outline-offset: -2px; }
  .compact {background:var(--ui-editor-input,#fff);}
  .compact header {padding:0 0 8px;border:0;} .compact h2 {display:none;}
  .compact .search {margin:0;} .compact ul {padding:0;}
  .compact li {min-height:28px;} .compact [role=treeitem] {padding:4px;}
  .compact .name {display:block;white-space:nowrap;text-overflow:ellipsis;overflow-wrap:normal;}
  .compact footer {padding:6px 0;border:0;} .compact footer > p {display:none;}
  footer { padding: 10px 12px; border-top: 1px solid var(--ui-editor-line, #d7dce5); } summary { cursor: pointer; font-size: 11px; } code { font-size: 10px; overflow-wrap: anywhere; }
</style>

