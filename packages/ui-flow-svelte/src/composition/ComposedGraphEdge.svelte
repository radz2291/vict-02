<script lang="ts">
  import { BaseEdge, EdgeReconnectAnchor, getBezierPath, getStraightPath, getSmoothStepPath, type EdgeProps } from '@xyflow/svelte';
  import type {GraphEdgeAppearance} from '../editor/model-v3.js';
  let {id,sourceX,sourceY,targetX,targetY,sourcePosition,targetPosition,selected=false,data={},style,markerStart,markerEnd,interactionWidth,label,labelStyle}:EdgeProps=$props();
  const occurrence=$props.id();
  const markerId=`vict-edge-${Array.from(occurrence,char=>char.codePointAt(0)!.toString(16)).join('-')}`;
  const appearance=$derived(data.appearance as Required<GraphEdgeAppearance>|undefined);
  const geometry=$derived({sourceX,sourceY,targetX,targetY,sourcePosition,targetPosition});
  const path=$derived(appearance?.route==='straight'?getStraightPath(geometry):appearance?.route==='orthogonal'?getSmoothStepPath(geometry):getBezierPath(geometry));
  const writable=$derived(data.readOnly!==true);
  const color=$derived(appearance?.color.startsWith('token:')?`var(--vict-color-${appearance.color.slice(6)},var(--vict-color-border))`:appearance?.color);
  const dash=$derived(appearance?.pattern==='dash'?'8 6':appearance?.pattern==='dot'?'0 5':undefined);
  const edgeStyle=$derived(appearance?`stroke:${color};stroke-width:${appearance.width};stroke-dasharray:${dash??'none'};stroke-linecap:${appearance.pattern==='dot'?'round':'butt'};`:style??`stroke:var(--vict-color-${selected?'accent':'border'});stroke-width:1.5;`);
  const start=$derived(appearance?(appearance.startArrow==='none'?undefined:`url(#${markerId}-start)`):markerStart);
  const end=$derived(appearance?(appearance.endArrow==='none'?undefined:`url(#${markerId}-end)`):markerEnd);
</script>
{#if appearance}
  <defs>
    {#each ['start','end'] as side}
      {@const arrow=side==='start'?appearance.startArrow:appearance.endArrow}
      {#if arrow!=='none'}
        <marker id={`${markerId}-${side}`} viewBox="0 -5 10 10" refX="8" refY="0" markerWidth="4" markerHeight="4" orient="auto-start-reverse" markerUnits="strokeWidth">
          <path d={arrow==='closed'?'M 0 -4 L 8 0 L 0 4 Z':'M 0 -4 L 8 0 L 0 4'} fill={arrow==='closed'?color:'none'} stroke={color} stroke-width="1.5" stroke-linejoin="round"/>
        </marker>
      {/if}
    {/each}
  </defs>
  {#if selected}<path d={path[0]} fill="none" stroke="var(--vict-color-accent)" stroke-width={appearance.width+4} opacity="0.35" pointer-events="none"/>{/if}
{/if}
<BaseEdge {id} path={path[0]} labelX={path[1]} labelY={path[2]} {label} {labelStyle} markerStart={start} markerEnd={end} {interactionWidth} style={edgeStyle}/>
{#if selected&&writable}
  <!-- Pointer geometry only. Apps may expose the same validated reconnect operation. -->
  <EdgeReconnectAnchor type="source" position={{x:sourceX,y:sourceY}} class="vict-graph-reconnect-anchor" data-graph-reconnect="source" aria-hidden="true" title="Drag source endpoint to reconnect (pointer)"><span class="reconnect-dot"></span></EdgeReconnectAnchor>
  <EdgeReconnectAnchor type="target" position={{x:targetX,y:targetY}} class="vict-graph-reconnect-anchor" data-graph-reconnect="target" aria-hidden="true" title="Drag target endpoint to reconnect (pointer)"><span class="reconnect-dot"></span></EdgeReconnectAnchor>
{/if}
<style>
  :global(.vict-graph-reconnect-anchor){display:grid;place-items:center;cursor:crosshair}
  .reconnect-dot{box-sizing:border-box;width:var(--vict-space-3,12px);height:var(--vict-space-3,12px);border:2px solid var(--vict-color-accent);border-radius:50%;background:var(--vict-color-surface);pointer-events:none}
</style>
