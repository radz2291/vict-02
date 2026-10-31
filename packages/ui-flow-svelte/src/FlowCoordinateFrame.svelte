<script lang="ts">
 import {setContext,type Snippet} from 'svelte';
 import {FLOW_COORDINATE_UNITS,engineViewport,logicalViewport,observeFlowCoordinateFrame,type FlowViewportUnits,type FlowCoordinateState} from './flow-coordinate-frame.js';
 // For ancestor scale s, the engine root is s times larger and counter-scaled
 // by 1/s. Its native pointer frame therefore uses screen CSS pixels. Giving
 // it viewport (s*x,s*y,s*z) retains the original rendered/source coordinates:
 // screen = origin + s*(logicalPan + logicalZoom*world). No event is rewritten.
 let {viewport=$bindable<FlowViewportUnits>({x:0,y:0,zoom:1}),minZoom=.5,maxZoom=2,onUnitChange,children}:{viewport?:FlowViewportUnits;minZoom?:number;maxZoom?:number;onUnitChange?:()=>void;children:Snippet<[FlowCoordinateState]>}=$props();
 let scale=$state(1),supported=$state(true),width=$state(0),height=$state(0);
 const frame:FlowCoordinateState={get scale(){return scale;},get expectedWidth(){return supported?width*scale:0;},get expectedHeight(){return supported?height*scale:0;},get minZoom(){return minZoom;},get maxZoom(){return maxZoom;},get viewport(){return engineViewport(viewport,scale);},set viewport(value:FlowViewportUnits){
  if(!supported)return;
  const next=logicalViewport(value,scale);
  if(!Number.isFinite(next.x)||!Number.isFinite(next.y)||!Number.isFinite(next.zoom)||next.zoom<=0)return;
  if(['x','y','zoom'].every(key=>Math.abs(next[key as keyof FlowViewportUnits]-viewport[key as keyof FlowViewportUnits])<=Number.EPSILON*8*Math.max(1,Math.abs(viewport[key as keyof FlowViewportUnits]))))return;
  viewport=next;
 }};
 setContext(FLOW_COORDINATE_UNITS,frame);
 function measure(root:HTMLElement){return observeFlowCoordinateFrame(root,(next,valid,size)=>{
  width=size.width;height=size.height;
  if(Math.abs(next-scale)>Number.EPSILON*8*Math.max(next,scale)){onUnitChange?.();scale=next;}
  supported=valid;
 });}
</script>
<div class="flow-coordinate-frame" use:measure data-vict-flow-coordinate-scale={scale}>
 <div class="flow-coordinate-engine" inert={!supported} style:width={`${scale*100}%`} style:height={`${scale*100}%`} style:transform={`scale(${1/scale})`}>
  {@render children(frame)}
 </div>
 {#if !supported}<p role="alert">Graph interaction requires an unrotated, uniformly scaled frame.</p>{/if}
</div>
<style>
 .flow-coordinate-frame{position:relative;width:100%;height:100%;min-width:0;min-height:0}
 .flow-coordinate-engine{position:absolute;left:0;top:0;transform-origin:0 0}
</style>
