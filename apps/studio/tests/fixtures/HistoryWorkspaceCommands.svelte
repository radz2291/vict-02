<script lang="ts">
  import {getContext} from 'svelte';
  import {GRAPH_WORKSPACE,type GraphWorkspaceContext} from '@victframework/ui-flow-svelte';
  const workspace=getContext<GraphWorkspaceContext>(GRAPH_WORKSPACE);
</script>
<button onclick={()=>workspace.apply([{type:'moveNodes',positions:{'source-note-2':{x:527.8139007098847,y:-42.927209726856944}}}])}>Probe moveNodes</button>
<button onclick={()=>workspace.select({nodes:[],edges:['edge-source-review-2']})}>Probe select edge</button>
<button onclick={()=>workspace.apply([{type:'remove',selection:{nodes:[],edges:['edge-source-review-2']}}])}>Probe remove edge</button>
<button onclick={()=>workspace.apply([{type:'connect',edge:{id:'probe-reconnected',source:'source-note-2',sourcePort:'evidence',target:'review-1',targetPort:'intake'}}])}>Probe connect</button>
