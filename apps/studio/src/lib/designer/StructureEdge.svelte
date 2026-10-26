<script lang="ts">
  import {BaseEdge,getSmoothStepPath,Position,type EdgeProps} from '@victframework/ui-flow-svelte';
  import {getContext} from 'svelte';
  import {feedbackPath,structureGeometryContext,type StructureGeometryContext} from './structure-edge-geometry.js';
  import {structureTraceContext,type StructureTraceContext} from './structure-trace.js';
  const traceContext=getContext<StructureTraceContext|undefined>(structureTraceContext);
  const trace=$derived(traceContext?.current());
  let {id,source,target,sourceX,sourceY,targetX,targetY,sourcePosition,targetPosition,markerEnd,style,data,label}:EdgeProps=$props();
  const traced=$derived(!!trace?.edges.has(id));
  const surrounding=getContext<StructureGeometryContext|undefined>(structureGeometryContext);
  // Keep routing in world coordinates. Selection never participates in layout.
  const geometry=$derived.by(()=>{
    const cards=surrounding?.nodes(),sourceCard=cards?.get(source),targetCard=cards?.get(target);
    if(sourcePosition===Position.Right && targetPosition===Position.Left && sourceX>targetX && sourceCard && targetCard){
      return {path:feedbackPath({x:sourceX,y:sourceY},{x:targetX,y:targetY},sourceCard,targetCard,[...cards!.values()])};
    }
    const route=(data as {route?:{x:number;y:number}[]} | undefined)?.route;
    if(route?.length && Math.abs(route[0]!.x-sourceX)<3 && Math.abs(route[0]!.y-sourceY)<3 && Math.abs(route.at(-1)!.x-targetX)<3 && Math.abs(route.at(-1)!.y-targetY)<3){
      return {path:route.map((point,index)=>`${index?'L':'M'} ${point.x},${point.y}`).join(' ')};
    }
    const [path]=getSmoothStepPath({sourceX,sourceY,targetX,targetY,sourcePosition,targetPosition});
    return {path};
  });

</script>
<g class="studio-edge" class:traced class:trace-dim={!!trace && !traced} class:duplicate={!label}>
  <BaseEdge {id} path={geometry.path} {markerEnd} {style}/>

</g>
<style>
  /* Coincident records share a painted line. Socket counts and Selection
     retain all declaration locations without painting duplicate strokes. */
  .duplicate{opacity:0;pointer-events:none}
  .trace-dim{opacity:.2}
  .traced :global(.svelte-flow__edge-path){stroke-width:2.5px}
</style>
