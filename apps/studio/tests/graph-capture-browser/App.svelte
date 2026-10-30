<script lang="ts">
  import GraphSurface from '../../../../packages/ui-flow-svelte/src/editor/GraphSurface.svelte';
  import { ControlScope } from '@victframework/ui-svelte';
  import source from '../../../../docs/studio/foundation-evidence/actual-agent-graph-source.json';
  import { captureRenderedElement } from '../../../../packages/ui-ai-svelte/src/capture.js';
  import '@xyflow/svelte/dist/style.css';
  import '@victframework/ui-svelte/styles.css';
  import '@victframework/ui-svelte/catalog.css';
  import '../../../../packages/ui-ai-svelte/dist/styles.css';
  import '../../../../packages/ui-svelte/src/rhea.css';
  let graph = $state(source.localState.flowGraph.initial);
  let host: HTMLDivElement;
  let image = $state(''), report = $state('Capture the unchanged actual-agent graph.'), busy = $state(false);
  const snapshot = () => JSON.stringify([host.outerHTML, ...[host, ...host.querySelectorAll<HTMLElement>('*')].map(node => [node.scrollLeft, node.scrollTop, node.getBoundingClientRect().toJSON()])]);
  async function capture() {
    if (busy) return;
    busy = true;
    const before = snapshot();
    let changes = 0;
    const observer = new MutationObserver(records => { changes += records.length; });
    observer.observe(host, {subtree:true,attributes:true,childList:true,characterData:true});
    try {
      const result = await captureRenderedElement(host);
      changes += observer.takeRecords().length;
      if (image) URL.revokeObjectURL(image);
      image = URL.createObjectURL(result.blob);
      const {blob, ...geometry} = result;
      report = JSON.stringify({ok:true,bytes:blob.size,sourceUnchanged:before === snapshot(),mutations:changes,geometry,minimap:[...host.querySelectorAll('.svelte-flow__minimap path,.svelte-flow__minimap rect')].map(node=>({tag:node.tagName,class:node.getAttribute('class'),fill:getComputedStyle(node).fill,fillRule:getComputedStyle(node).fillRule,stroke:getComputedStyle(node).stroke}))},null,2);
    } catch(error) {
      report = JSON.stringify({ok:false,code:error instanceof Error?error.message:'capture-error',reason:(error as {captureReason?:string}).captureReason,sourceUnchanged:before===snapshot()},null,2);
    } finally {observer.disconnect();busy=false;}
  }
</script>
<h1>Actual-agent graph: native versus production capture</h1>
<p>Exact retained graph data; the right image comes from the public production capture helper. Compare MiniMap paint and other graph surfaces. No automatic visual PASS is inferred.</p>
<button onclick={capture} disabled={busy}>Capture production graph DOM</button>
<a href={image || undefined} download="actual-agent-graph-production.jpg" hidden={!image}>Download graph capture</a>
<main>
  <section><h2>Native actual graph</h2><div class="fixture" bind:this={host}><ControlScope class="vict-rhea"><GraphSurface {graph} height={480} label="Actual agent graph capture" ongraphchange={next=>{graph=next;}}/></ControlScope></div></section>
  <section><h2>Production JPEG</h2>{#if image}<img src={image} alt="Production capture of the actual agent graph" />{/if}</section>
</main>
<pre role="status">{report}</pre>
<style>:global(body){margin:16px;font:14px system-ui;background:#f8fafc;color:#172033}main{display:flex;gap:20px;align-items:flex-start}.fixture{width:848px;background:white}img{display:block;max-width:none}pre{white-space:pre-wrap;max-width:1500px}button,a{padding:8px;margin:4px}</style>
