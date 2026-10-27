<script lang="ts">
  import {scopeVector,type VectorGraphic} from './vectors.js';
  import VectorNode from './VectorNode.svelte';
  let {graphic,label='',decorative=false,width='100%',height='auto',...rest}:{graphic:VectorGraphic;label?:string;decorative?:boolean;width?:string|number;height?:string|number;[key:string]:unknown}=$props();
  const id=$props.id();
  const scoped=$derived(scopeVector(graphic,id));
</script>
<svg {...rest} xmlns="http://www.w3.org/2000/svg" viewBox={scoped.viewBox} {width} {height} preserveAspectRatio="xMidYMid meet" role={decorative?undefined:'img'} aria-hidden={decorative?'true':undefined} aria-label={decorative?undefined:label||'Vector graphic'}>
  {#each scoped.nodes as node}<VectorNode {node}/>{/each}
</svg>
