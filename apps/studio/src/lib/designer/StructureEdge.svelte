<script lang="ts">
  import {BaseEdge,getSmoothStepPath,type EdgeProps} from '@victframework/ui-flow-svelte';
  let {id,sourceX,sourceY,targetX,targetY,sourcePosition,targetPosition,markerEnd,style,data,label,selected=false}:EdgeProps=$props();
  // Same routed-path validity rule as the shared renderer. Caption geometry is
  // derived from world coordinates only and never participates in node layout.
  const geometry=$derived.by(()=>{
    const route=(data as {route?:{x:number;y:number}[]} | undefined)?.route;
    if(route?.length && Math.abs(route[0]!.x-sourceX)<3 && Math.abs(route[0]!.y-sourceY)<3 && Math.abs(route.at(-1)!.x-targetX)<3 && Math.abs(route.at(-1)!.y-targetY)<3){
      const lengths=route.slice(1).map((point,index)=>Math.hypot(point.x-route[index]!.x,point.y-route[index]!.y));
      let remaining=lengths.reduce((sum,value)=>sum+value,0)/2;
      for(let index=0;index<lengths.length;index++){
        const length=lengths[index]!;
        if(remaining<=length && length>0){const a=route[index]!,b=route[index+1]!,ratio=remaining/length;return {path:route.map((point,i)=>`${i?'L':'M'} ${point.x},${point.y}`).join(' '),x:a.x+(b.x-a.x)*ratio,y:a.y+(b.y-a.y)*ratio};}
        remaining-=length;
      }
    }
    const [path,x,y]=getSmoothStepPath({sourceX,sourceY,targetX,targetY,sourcePosition,targetPosition});
    return {path,x,y};
  });
  const quiet=$derived(data?.kind==='containment' && !data?.description && label==='Contains');
  const width=$derived(Math.min(172,Math.max(52,String(label??'').length*6+16)));
</script>
<g class="studio-edge" class:quiet class:duplicate={!label}>
  <title>{label ?? 'Declared connection'} · {String(data?.path ?? '')}</title>
  <BaseEdge {id} path={geometry.path} {markerEnd} {style}/>
  {#if label}<foreignObject class="studio-edge-caption" class:revealed={selected} x={geometry.x-width/2} y={geometry.y-20} {width} height={40} pointer-events="none" data-caption={label}>
    <div class="caption"><span>{label}</span></div>
  </foreignObject>{/if}
</g>
<style>
  /* Coincident reference locations are represented by the counted caption.
     Keep their edge/path identity, but do not paint over the visible caption. */
  .duplicate{opacity:0;pointer-events:none}
  .studio-edge-caption{overflow:visible;pointer-events:none}
  .caption{height:40px;display:flex;align-items:center;justify-content:center;pointer-events:none}
  .caption span{max-width:100%;box-sizing:border-box;padding:2px 5px;border-radius:3px;background:var(--vict-color-surface,#fff);color:var(--vict-color-textMuted,#65748d);font:var(--studio-font-meta,400 11px/16px system-ui,sans-serif);text-align:center;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .quiet .studio-edge-caption{opacity:0}
  .quiet:hover .studio-edge-caption,.quiet .studio-edge-caption.revealed{opacity:1}
  :global(.svelte-flow__edge:focus) .quiet .studio-edge-caption{opacity:1}
</style>
