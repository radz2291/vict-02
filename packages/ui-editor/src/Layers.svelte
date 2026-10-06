<script lang="ts">
  import type { UiDocument, UiRenderPlan, UiRenderInstruction } from '@victframework/ui';
  import { occurrenceKey, resolveValue, uniqueRepeatKeys, asRecord, evaluatedComponentProps, conditionsOf, evaluateCondition, type DocumentScope } from '@victframework/ui-svelte';
  import { nodeLabel, type EditorLabels } from './inspector-ux.js';
  import { tick, untrack } from 'svelte';
  let { plan, document, selectedOccurrence, onSelect, ariaLabel = 'Layers', labels = {}, scope }: {
    plan: UiRenderPlan; document?: UiDocument; selectedOccurrence?: string; onSelect?: (occurrence: string) => void;
    ariaLabel?: string; labels?: EditorLabels; scope?: DocumentScope;
  } = $props();
  interface Entry { key: string; label: string; detail: string; parent?: string; depth: number; children: boolean; component: boolean; compact: boolean; selectable: boolean; }
  let expanded = $state(new Set<string>());
  let closed = $state(new Set<string>());
  let focusKey = $state('');
  let root: HTMLElement;
  const all = $derived.by(() => {
    const out: Entry[] = [];
    function walk(i: UiRenderInstruction, depth: number, keys: readonly string[], parent?: string, values?: DocumentScope, fills: Readonly<Record<string, readonly UiRenderInstruction[]>> = {}, template = false) {
      const key = occurrenceKey(i.occurrenceKey, keys);
      const label = document ? nodeLabel(document, i.nodeId, labels) : i.kind === 'text' && i.content.type === 'literal' ? i.content.value : i.kind === 'element' ? i.tag : i.kind === 'component' ? labels.definitions?.[i.definitionId] ?? 'Component' : i.kind;
      const start = out.length;
      out.push({ key, label, depth, parent, children: false, component: i.kind === 'component', compact: i.kind === 'component' || (i.kind === 'element' && i.children.every(c => c.kind === 'text')), selectable: !template && !['component', 'repeat', 'conditional', 'slot'].includes(i.kind), detail: `${i.nodeId}${i.kind === 'component' ? ` · definition ${i.definitionId} @ ${i.definitionRevision}` : ''}${keys.length ? ` · record ${keys.join(' / ')}` : ''}${template ? ' · template (runtime scope unavailable)' : ''}` });
      const child = (instruction: UiRenderInstruction, childValues = values, childKeys = keys, childFills = fills, isTemplate = template) => walk(instruction, depth + 1, childKeys, key, childValues, childFills, isTemplate);
      if (i.kind === 'element' || i.kind === 'unsupported') i.children.forEach(c => child(c));
      if (i.kind === 'component') child(i.body, values ? { ...values, props: evaluatedComponentProps(i, values) } : undefined, keys, i.slots);
      if (i.kind === 'slot') (fills[i.name]?.length ? fills[i.name] : i.fallback).forEach(c => child(c, values, keys, {}));
      if (i.kind === 'conditional') {
        if (values) {
          const branch = i.branches.find(b => b.when === undefined || evaluateCondition(b.when, conditionsOf(plan), values));
          branch?.children.forEach(c => child(c));
        } else i.branches.forEach(b => b.children.forEach(c => child(c, values, keys, fills, true)));
      }
      if (i.kind === 'repeat') {
        const rows = values ? resolveValue({ type: 'expression', expression: i.collection }, values) : undefined;
        if (values && Array.isArray(rows)) {
          const rowScopes = rows.map(row => ({ ...values, repeatItem: { name: i.itemName, value: asRecord(row) } }));
          const rowKeys = uniqueRepeatKeys(rowScopes.map((s, index) => String(resolveValue({ type: 'expression', expression: i.key }, s) ?? index)), i.nodeId);
          rowScopes.forEach((s, index) => child(i.template, s, [...keys, rowKeys[index]], fills));
        } else child(i.template, values, keys, fills, true);
      }
      out[start] = { ...out[start], children: out.length > start + 1 };
    }
    plan.structure.forEach(i => walk(i, 0, [], undefined, scope));
    return out;
  });
  function isOpen(entry: Entry) { return !closed.has(entry.key) && (!entry.compact || expanded.has(entry.key)); }
  const entries = $derived(all.filter(entry => {
    let parent = entry.parent;
    while (parent) { const ancestor = all.find(e => e.key === parent); if (!ancestor || !isOpen(ancestor)) return false; parent = ancestor.parent; }
    return true;
  }));
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
  function select(entry: Entry) { focusKey = entry.key; if (entry.selectable) onSelect?.(entry.key); else if (entry.children) toggle(entry); }
  function keyboard(event: KeyboardEvent, entry: Entry) {
    const index = entries.findIndex(e => e.key === entry.key);
    let next: string | undefined;
    if (event.key === 'ArrowDown') next = entries[Math.min(entries.length - 1, index + 1)]?.key;
    if (event.key === 'ArrowUp') next = entries[Math.max(0, index - 1)]?.key;
    if (event.key === 'Home') next = entries[0]?.key;
    if (event.key === 'End') next = entries.at(-1)?.key;
    if (event.key === 'ArrowRight') { if (entry.children && !isOpen(entry)) toggle(entry); else next = entries[index + 1]?.parent === entry.key ? entries[index + 1]?.key : undefined; }
    if (event.key === 'ArrowLeft') { if (entry.children && isOpen(entry)) toggle(entry); else next = entry.parent; }
    if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) event.preventDefault();
    if (next) void focus(next);
  }
</script>
<nav class="uv-layers" aria-label={ariaLabel} bind:this={root}>
  <header><h2>{ariaLabel}</h2><p>Find and select page elements</p></header>
  <ul role="tree" aria-label="Document layers">
    {#each entries as entry (entry.key)}
      <li role="none" style:padding-left={`${entry.depth * 12}px`}>
        {#if entry.children}<button class="disclosure" type="button" tabindex="-1" aria-label={`${isOpen(entry) ? 'Collapse' : 'Expand'} ${entry.label}`} onclick={() => toggle(entry)}>{isOpen(entry) ? '⌄' : '›'}</button>{:else}<span class="spacer"></span>{/if}
        <button type="button" role="treeitem" data-key={entry.key} aria-level={entry.depth + 1} aria-expanded={entry.children ? isOpen(entry) : undefined} aria-selected={entry.key === selectedOccurrence} tabindex={entry.key === tabStop ? 0 : -1} title={entry.detail} onclick={() => select(entry)} onkeydown={e => keyboard(e, entry)} onfocus={() => focusKey = entry.key}>
          <span class="icon" aria-hidden="true">{entry.component ? '◇' : entry.children ? '▤' : '·'}</span><span class="name">{entry.label}</span>{#if entry.component}<span class="badge">Component</span>{/if}
        </button>
      </li>
    {/each}
  </ul>
  <footer><p>↑ ↓ navigate · → expand · ← collapse · Enter select</p><details><summary>Selection provenance</summary><p>{all.find(e => e.key === selectedOccurrence)?.detail ?? 'No selected element'}</p><code>{selectedOccurrence ?? ''}</code></details></footer>
</nav>
<style>
  .uv-layers { font: 12px/1.5 var(--ui-editor-font, 'Segoe UI', sans-serif); color: var(--ui-editor-ink, #202938); background: var(--ui-editor-panel, #f8f9fb); min-width: 0; display: flex; flex-direction: column; height: 100%; }
  header { padding: 14px 12px; border-bottom: 1px solid var(--ui-editor-line, #d7dce5); } h2 { font-size: 13px; margin: 0; } p { font-size: 10px; color: var(--ui-editor-muted, #667085); margin: 3px 0; overflow-wrap: anywhere; }
  ul { margin: 0; padding: 8px; list-style: none; overflow: auto; flex: 1; min-height: 100px; }
  li { display: flex; align-items: stretch; min-height: 32px; }
  button { border: 0; background: transparent; color: inherit; font: inherit; cursor: pointer; border-radius: 4px; min-width: 0; }
  [role=treeitem] { display: flex; align-items: center; gap: 5px; flex: 1; padding: 5px; text-align: left; }
  [aria-selected=true] { background: var(--ui-editor-selection, #edf1ff); color: var(--ui-editor-accent, #355cc9); }
  .disclosure, .spacer { flex: 0 0 20px; width: 20px; }
  .name { overflow-wrap: anywhere; min-width: 0; flex: 1; }
  .icon { color: var(--ui-editor-muted, #667085); }
  .badge { font-size: 9px; color: var(--ui-editor-muted, #667085); }
  :focus-visible { outline: 2px solid var(--ui-editor-accent, #355cc9); outline-offset: -2px; }
  footer { padding: 10px 12px; border-top: 1px solid var(--ui-editor-line, #d7dce5); } summary { cursor: pointer; font-size: 11px; } code { font-size: 10px; overflow-wrap: anywhere; }
</style>

