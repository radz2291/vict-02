<script lang="ts">
  import GraphSurface from '../../src/editor/GraphSurface.svelte';
  import type {GraphPresentationState} from '../../src/editor/host.js';
  import source from '../../../../docs/studio/foundation-evidence/actual-agent-graph-source.json';
  import '@xyflow/svelte/dist/style.css';
  import '../../../ui-ai-svelte/dist/styles.css';
  import '../../../ui-svelte/src/rhea.css';
  let graph=$state(source.localState.flowGraph.initial),mountKey=$state(0),writes=$state(0);
  let presentation:GraphPresentationState|undefined;
  const viewState={get:()=>presentation,set:(next:GraphPresentationState)=>{presentation=next;}};
  const parsed=$derived(JSON.parse(graph));
</script>
<main>
  <h1>Graph camera and draft boundary</h1>
  <p>Exact real-agent graph. Fresh camera must fit all three nodes; edits commit on change or blur, never per keystroke.</p>
  <button onclick={()=>{mountKey++;}}>Remount preserving camera</button>
  <button onclick={()=>{presentation=undefined;mountKey++;}}>Fresh camera</button>
  <div class="fixture">{#key mountKey}<GraphSurface {graph} height={480} {viewState} label="Real agent graph" ongraphchange={next=>{graph=next;writes++;}}/>{/key}</div>
  <pre role="status">{JSON.stringify({writes,revision:parsed.revision,nodes:parsed.nodes.map((node:any)=>({id:node.id,position:node.position,values:node.values}))},null,2)}</pre>
</main>
<style>:global(body){margin:16px;font:14px system-ui;background:#f8fafc;color:#172033}.fixture{width:848px;max-width:100%;background:white}pre{white-space:pre-wrap}button{padding:8px;margin:4px}</style>
