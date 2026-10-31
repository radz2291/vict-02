<script lang="ts">
 import {SvelteFlow,SvelteFlowProvider,type Node,useSvelteFlow} from '@xyflow/svelte';
 import FlowCoordinateFrame from '../src/FlowCoordinateFrame.svelte';
 import FlowCoordinateSync from '../src/FlowCoordinateSync.svelte';
 import CoordinatePublicProbe from './CoordinatePublicProbe.svelte';
 import {flowGestureClasses,guardFlowGestures} from '../src/flow-gesture-boundary.js';
 let parentScale=$state(.348405),logical=$state({x:22.873,y:14,zoom:1.00317});
 let nodes=$state<Node[]>([{id:'probe',position:{x:40,y:40},data:{label:'Coordinate probe'},width:190,height:110}]);
 let api:ReturnType<typeof useSvelteFlow>|undefined;
 const id=$props.id();const classes=flowGestureClasses(id);
 export function setParentScale(value:number){parentScale=value;}
 export function logicalViewport(){return {...logical};}
 export function engineViewport(){return api?.getViewport();}
 export function nodePosition(){return {...nodes[0].position};}
</script>
<div data-coordinate-test-scale={parentScale} style:transform={`scale(${parentScale})`}>
 <div data-coordinate-test-scale="0.7" style:transform="scale(0.7)">
  <div data-coordinate-test-scale="0.6" style:transform="scale(0.6)">
   <div use:guardFlowGestures={classes} style="width:760px;height:380px">
    <FlowCoordinateFrame bind:viewport={logical} minZoom={.1} maxZoom={2}>{#snippet children(frame)}
     <SvelteFlowProvider><SvelteFlow {...classes} bind:nodes bind:viewport={frame.viewport} edges={[]} nodeDragThreshold={0} autoPanOnNodeDrag={false} fitView={false} minZoom={.1*frame.scale} maxZoom={2*frame.scale}>
      <FlowCoordinateSync {frame}/><CoordinatePublicProbe register={value=>{api=value;}}/>
      <input aria-label="Retained draft" class="nodrag nopan nowheel" value="Original draft"/>
     </SvelteFlow></SvelteFlowProvider>
    {/snippet}</FlowCoordinateFrame>
   </div>
  </div>
 </div>
</div>

