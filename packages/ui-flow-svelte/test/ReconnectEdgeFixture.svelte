<script lang="ts">
  import {SvelteFlow,SvelteFlowProvider,Position,type Node,type Edge} from '@xyflow/svelte';
  import ComposedGraphEdge from '../src/composition/ComposedGraphEdge.svelte';
  let selected=$state(true),readOnly=$state(false);
  const nodes:Node[]=[
    {id:'a',position:{x:0,y:0},width:120,height:80,data:{label:'A'},handles:[{id:'out',type:'source',position:Position.Right,x:120,y:40,width:10,height:10}]},
    {id:'b',position:{x:260,y:0},width:120,height:80,data:{label:'B'},handles:[{id:'in',type:'target',position:Position.Left,x:0,y:40,width:10,height:10}]},
  ];
  const edges=$derived<Edge[]>([{id:'ab',type:'composed',source:'a',sourceHandle:'out',target:'b',targetHandle:'in',selected,data:{readOnly}}]);
  export function configure(nextSelected:boolean,nextReadOnly:boolean){selected=nextSelected;readOnly=nextReadOnly;}
</script>
<div style="width:640px;height:360px"><SvelteFlowProvider><SvelteFlow {nodes} {edges} edgeTypes={{composed:ComposedGraphEdge}} width={640} height={360}/></SvelteFlowProvider></div>
