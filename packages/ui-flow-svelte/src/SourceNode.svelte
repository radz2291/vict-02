<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { Handle, Position, useUpdateNodeInternals, type NodeProps } from '@xyflow/svelte';
  let { id, data, selected }: NodeProps = $props();
  const horizontal = $derived(data.direction !== 'DOWN');
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
  <span class="vict-source-kind">{data.kindLabel ?? data.kind}</span>
  <strong>{data.label}</strong>
  <span class="vict-source-summary">{data.summary}</span>
  {#if data.collapsedCount}<span class="vict-source-summary">{data.collapsedCount} items collapsed</span>{/if}
  <Handle type="source" id="content" position={horizontal ? Position.Right : Position.Bottom} isConnectable={!!data.moveSource} class={data.moveSource ? 'edit-handle' : 'read-handle'} aria-hidden={!data.moveSource} aria-label={`Move ${data.label} to a container`} />
</div>

<style>
  .vict-source-node { box-sizing: border-box; width: 224px; min-height: 88px; padding: 11px 14px; display: flex; flex-direction: column; gap: 4px; background: var(--vict-flow-node, #fff); border: 1px solid var(--vict-flow-border, #cbd5e1); border-left: 4px solid #64748b; border-radius: 9px; color: var(--vict-flow-text, #172033); box-shadow: 0 1px 3px #0f172a12; }
  .vict-source-node.selected { outline: 2px solid #6366f1; outline-offset: 2px; }
  .vict-source-node[data-kind=state] { border-left-color: #0f766e; background: #f0fdfa; }
  .vict-source-node[data-kind=action] { border-left-color: #b45309; background: #fffbeb; }
  .vict-source-node[data-kind=catalog], .vict-source-node[data-kind=definition] { border-left-color: #7c3aed; background: #faf5ff; }
  strong { font-size: 13px; line-height: 1.35; overflow-wrap: anywhere; }
  .vict-source-kind { font-size: 10px; line-height: 1.2; color: #64748b; text-transform: uppercase; letter-spacing: .05em; }
  .vict-source-summary { font-size: 11px; line-height: 1.35; color: #64748b; overflow-wrap: anywhere; }
  :global(.read-handle) { opacity: 0; pointer-events: none; }
  :global(.edit-handle) { width: 10px; height: 10px; background: #4f46e5; }
  :global(.edit-handle.valid) { background: #15803d; outline: 3px solid #bbf7d0; }
</style>
