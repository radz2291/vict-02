<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { Handle, Position, useUpdateNodeInternals, type NodeProps } from '@xyflow/svelte';
  let { id, data, selected }: NodeProps = $props();
  const horizontal = $derived(data.direction !== 'DOWN');
  const toggleGroup = $derived(typeof data.onToggleGroup === 'function' ? data.onToggleGroup as () => void : undefined);
  const updateNodeInternals = useUpdateNodeInternals();
  $effect(() => {
    const nodeId = id;
    void horizontal;
    let cancelled = false;
    // Moving a custom Handle does not resize the card. ResizeObserver therefore
    // cannot invalidate Flow's cached handle bounds. Refresh after Svelte has
    // committed the new side so edges use the actual, current handle geometry.
    void tick().then(() => { if (!cancelled) untrack(() => updateNodeInternals(nodeId)); });
    return () => { cancelled = true; };
  });
</script>

<div class="vict-source-node" class:selected data-kind={data.kind}>
  <Handle type="target" id="container" position={horizontal ? Position.Left : Position.Top} isConnectable={!!data.moveTarget} class={data.moveTarget ? 'edit-handle' : 'read-handle'} aria-hidden={!data.moveTarget} aria-label={`Move content inside ${data.label}`} />
  <div class="vict-source-heading"><span class="vict-source-kind">{data.kindLabel ?? data.kind}</span>
    {#if toggleGroup}<button type="button" class="nodrag nopan" aria-label={`${data.collapsed ? 'Expand' : 'Collapse'} ${data.label}`} aria-expanded={!data.collapsed} onkeydown={event => { if (event.key === 'Enter' || event.key === ' ') event.stopPropagation(); }} onclick={event => { event.stopPropagation(); toggleGroup(); }}>{data.collapsed ? '›' : '⌄'}</button>{/if}
  </div>
  <strong>{data.label}</strong>
  {#if data.summary}<span class="vict-source-summary">{data.summary}</span>{/if}
  {#if data.collapsedCount}<span class="vict-source-summary">{data.collapsedCount} items inside</span>{/if}
  <Handle type="source" id="content" position={horizontal ? Position.Right : Position.Bottom} isConnectable={!!data.moveSource} class={data.moveSource ? 'edit-handle' : 'read-handle'} aria-hidden={!data.moveSource} aria-label={`Move ${data.label} to a container`} />
</div>

<style>
  .vict-source-node { box-sizing: border-box; width: 224px; min-height: 76px; padding: 9px 12px; display: flex; flex-direction: column; gap: 4px; background: var(--vict-flow-node, #fff); border: 1px solid var(--vict-flow-border, #cbd5e1); border-left: 3px solid #64748b; border-radius: 7px; color: var(--vict-flow-text, #172033); box-shadow: 0 1px 3px #0f172a0a; }
  .vict-source-node.selected { outline: 2px solid #6366f1; outline-offset: 2px; }
  .vict-source-node[data-kind=state] { border-left-color: #0f766e; background: #f0fdfa; }
  .vict-source-node[data-kind=action] { border-left-color: #b45309; background: #fffbeb; }
  .vict-source-node[data-kind=catalog], .vict-source-node[data-kind=definition] { border-left-color: #7c3aed; background: #faf5ff; }
  strong { font-size: 13px; line-height: 1.4; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .vict-source-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 20px; }
  button { width: 24px; height: 24px; margin: -3px -4px -3px 0; padding: 0; border: 0; border-radius: 4px; background: transparent; color: #475569; font: 18px/1 system-ui; cursor: pointer; }
  button:hover { background: #edf1ff; } button:focus-visible { outline: 2px solid #6366f1; outline-offset: 2px; }
  .vict-source-kind { font-size: 10px; line-height: 1.2; color: #64748b; text-transform: uppercase; letter-spacing: .05em; }
  .vict-source-summary { font-size: 11px; line-height: 1.35; color: #64748b; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  :global(.read-handle) { opacity: 0; pointer-events: none; }
  :global(.edit-handle) { width: 10px; height: 10px; background: #4f46e5; }
  :global(.edit-handle.valid) { background: #15803d; outline: 3px solid #bbf7d0; }
</style>
