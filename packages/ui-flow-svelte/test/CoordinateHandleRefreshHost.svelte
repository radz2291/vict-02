<script lang="ts">
  import {setContext,untrack} from 'svelte';
  import type {NodeProps} from '@xyflow/svelte';
  import ComposedGraphNode from '../src/composition/ComposedGraphNode.svelte';
  import {FLOW_COORDINATE_UNITS} from '../src/flow-coordinate-frame.js';
  import type {GraphWorkspaceContext} from '../src/composition/context.js';
  let {id}:{id:string}=$props();
  let scale=$state(1);
  setContext(FLOW_COORDINATE_UNITS,{get scale(){return scale;}});
  const node=untrack(()=>({id,type:'test',label:'Stable card',position:{x:0,y:0}}));
  const workspace={graph:{revision:0,nodes:[node],edges:[]},readOnly:false,ports:()=>[],body:undefined} as unknown as GraphWorkspaceContext;
  const nodeProps=untrack(()=>({id,data:{node,workspace},selected:false} as NodeProps));
  export function setScale(value:number){scale=value;}
</script>
<ComposedGraphNode {...nodeProps}/>
