<script lang="ts">
  import { BaseEdge, EdgeReconnectAnchor, getBezierPath, type EdgeProps } from '@xyflow/svelte';
  let {id,sourceX,sourceY,targetX,targetY,sourcePosition,targetPosition,selected=false,data={},style,markerStart,markerEnd,interactionWidth,label,labelStyle}:EdgeProps=$props();
  const path=$derived(getBezierPath({sourceX,sourceY,targetX,targetY,sourcePosition,targetPosition}));
  const writable=$derived(data.readOnly!==true);
  const edgeStyle=$derived(style??`stroke:var(--vict-color-${selected?'accent':'border'});stroke-width:1.5;`);
</script>
<BaseEdge {id} path={path[0]} labelX={path[1]} labelY={path[2]} {label} {labelStyle} {markerStart} {markerEnd} {interactionWidth} style={edgeStyle}/>
{#if selected&&writable}
  <!-- Pointer geometry, not a keyboard button. Apps may expose the same validated
       reconnect operation through their own accessible controls. -->
  <EdgeReconnectAnchor type="source" position={{x:sourceX,y:sourceY}} class="vict-graph-reconnect-anchor" data-graph-reconnect="source" aria-hidden="true" title="Drag source endpoint to reconnect (pointer)"><span class="reconnect-dot"></span></EdgeReconnectAnchor>
  <EdgeReconnectAnchor type="target" position={{x:targetX,y:targetY}} class="vict-graph-reconnect-anchor" data-graph-reconnect="target" aria-hidden="true" title="Drag target endpoint to reconnect (pointer)"><span class="reconnect-dot"></span></EdgeReconnectAnchor>
{/if}
<style>
  :global(.vict-graph-reconnect-anchor){display:grid;place-items:center;cursor:crosshair}
  .reconnect-dot{box-sizing:border-box;width:var(--vict-space-3,12px);height:var(--vict-space-3,12px);border:2px solid var(--vict-color-accent);border-radius:50%;background:var(--vict-color-surface);pointer-events:none}
</style>
