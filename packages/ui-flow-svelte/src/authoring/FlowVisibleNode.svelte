<script lang="ts">
  import { Handle, Position, type NodeProps } from '@xyflow/svelte';
  import type { FlowDeclaration } from './context.js';
  let { data, selected }: NodeProps = $props();
  const entry = $derived(data.declaration as FlowDeclaration);
</script>
<div {...entry.target} class={`${entry.target.class} vict-authored-flow-node`} class:selected aria-label={entry.label}>
  <Handle type="target" position={Position.Left} isConnectable={false} />
  <strong>{entry.label}</strong>
  <Handle type="source" position={Position.Right} isConnectable={false} />
</div>
<style>
  .vict-authored-flow-node { box-sizing: border-box; width: 180px; min-height: 54px; padding: 14px; border: 1px solid #94a3b8; border-radius: 8px; background: #fff; color: #172033; font: 13px/1.4 system-ui; overflow-wrap: anywhere; }
  .selected { outline: 2px solid #6366f1; outline-offset: 2px; }
  :global(.vict-authored-flow-node .svelte-flow__handle) { opacity: 0; pointer-events: none; }
</style>
