<script lang="ts">
  import {tick} from 'svelte';
  import { ControlScope } from '@victframework/ui-svelte';
  import { EditorCanvas, Layers, resolveOccurrence } from '@victframework/ui-editor';
  import type { UiRenderPlan } from '@victframework/ui';
  import { createShowcaseFixture } from './showcase.js';
  import { designerCatalogs,catalogDescriptors,catalogImplementations } from './application.js';
  import { studioNodeLabels } from './presentation.js';
  import { structureId,projectStructure } from './structure.js';
  import LayersInspectPanels from './LayersInspectPanels.svelte';
  import DocumentPanels from './DocumentPanels.svelte';
  import SourceDetails from './SourceDetails.svelte';
  const fixture=createShowcaseFixture('button');
  const document=fixture.document;
  let plan=$state<UiRenderPlan>();
  let selected=$state(`${document.id}|${document.root}`);
  let selectedId=$state(structureId(document.id,'node',document.root));
  let tab=$state<'Chat'|'Layers'>('Layers');
  let documentOpen=$state(true);
  let inspectOpen=$state(true);
  let root:HTMLElement;
  async function closeInspect(){inspectOpen=false;await tick();root.querySelector<HTMLElement>('#inspect-panel-header')?.focus();}
  let draft=$state('');
  let notice=$state('Select the rendered button or its layer to inspect the same source.');
  function select(occurrence:string){selected=occurrence;selectedId=structureId(document.id,'node',resolveOccurrence(occurrence,document).sourceNodeId);}
  function selectDetail(id:string){selectedId=id;const node=projectStructure(document).nodes.find(node=>node.id===id);if(node?.data.occurrence)selected=node.data.occurrence;}
</script>
<ControlScope class="vict-rhea">
  <section class="workspace-panel-showcase" aria-label="Docked workspace panel example" bind:this={root}>
    <h3>Docked panels and independent header collapse</h3>
    <p>These are the actual Layers / Inspect stack and Document sections. This fixture is disposable and read-only. The example Chat draft stays local; no model request is sent. Full authoring and Chat are available in <a href="/design">Studio</a>.</p>
    <button type="button" aria-expanded={documentOpen} onclick={()=>documentOpen=!documentOpen}>Example Document</button>
    <div class="panel-example" class:document-open={documentOpen}>
      <aside class="left" aria-label="Example left sidebar">
        <nav aria-label="Example sidebar tabs"><button type="button" aria-pressed={tab==='Chat'} onclick={()=>tab='Chat'}>Chat</button><button type="button" aria-pressed={tab==='Layers'} onclick={()=>tab='Layers'}>Layers</button></nav>
        <div class="tab-content" hidden={tab!=='Chat'}><label>Local example draft<textarea bind:value={draft} placeholder="Switch tabs and return to keep this draft."></textarea></label><p>No agent is connected to this layout fixture.</p></div>
        <div class="tab-content" hidden={tab!=='Layers'}><LayersInspectPanels bind:inspectOpen>
          {#snippet layers()}{#if plan}<Layers compact hideTextContent {plan} {document} labels={{nodes:studioNodeLabels(document)}} selectedOccurrence={selected} onSelect={select} componentDescriptors={catalogDescriptors} />{/if}{/snippet}
          {#snippet inspect()}<SourceDetails embedded {document} {selectedId} onClose={()=>void closeInspect()} onSelect={selectDetail} onNavigate={()=>notice='Use Studio for the existing editing tools and document edits.'} />{/snippet}
        </LayersInspectPanels></div>
      </aside>
      <div class="example-canvas"><EditorCanvas {document} catalogs={designerCatalogs} extensions={catalogDescriptors} extensionImplementations={catalogImplementations} interactionMode="design" selectedOccurrence={selected} onSelect={select} onPlan={(next:UiRenderPlan)=>plan=next} ariaLabel="Docked panel example canvas" /></div>
      <aside class="right" hidden={!documentOpen} aria-label="Example stacked Document"><header>Document</header><DocumentPanels>
        {#snippet dataContent()}<dl>{#each Object.entries(document.localState) as [key,value]}<div><dt>{key}</dt><dd>{JSON.stringify(value.initial)}</dd></div>{/each}</dl>{/snippet}
        {#snippet actionsContent()}<p>demo.submit uses the existing local simulation. This read-only fixture does not invoke it.</p>{/snippet}
        {#snippet sourceContent()}<pre>{JSON.stringify(document,null,2)}</pre>{/snippet}
      </DocumentPanels></aside>
    </div>
    <p role="status">{notice}</p>
  </section>
</ControlScope>
<style>
  .workspace-panel-showcase{margin-top:24px;border-top:1px solid var(--vict-color-border);padding-top:20px;font-size:12px}
  h3{font-size:16px}p{line-height:1.6}button{font:inherit;cursor:pointer;border:1px solid var(--vict-color-border);background:var(--vict-color-surface);color:var(--vict-color-text);padding:6px 10px;border-radius:4px}
  .panel-example{display:grid;grid-template-columns:260px minmax(0,1fr);height:520px;min-height:0;margin-top:12px;border:1px solid var(--vict-color-border);background:var(--vict-color-bg);overflow:hidden}
  .panel-example.document-open{grid-template-columns:260px minmax(0,1fr) 280px}
  aside{display:flex;flex-direction:column;min-height:0;min-width:0;background:var(--vict-color-surface);overflow:hidden}aside[hidden],.tab-content[hidden]{display:none}
  .left{border-right:1px solid var(--vict-color-border)}.right{border-left:1px solid var(--vict-color-border)}
  nav{display:flex;flex:none;height:38px;border-bottom:1px solid var(--vict-color-border)}nav button{flex:1;border:0;border-radius:0}nav button[aria-pressed=true]{border-bottom:2px solid var(--vict-color-accent);color:var(--vict-color-accent)}
  .tab-content{display:flex;flex:1;flex-direction:column;min-height:0;overflow:hidden}.tab-content>label,.tab-content>p{margin:12px}label{display:grid;gap:8px}textarea{width:100%;min-height:100px;font:inherit}
  .example-canvas{padding:16px;min-width:0;overflow:auto}.example-canvas :global(.uv-canvas){min-height:400px;background:var(--vict-color-surface)}
  header{height:38px;flex:none;padding:10px;font-weight:600;border-bottom:1px solid var(--vict-color-border)}dl{margin:0}dl>div{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:6px 0}dd{margin:0;overflow-wrap:anywhere}pre{font-size:10px;max-height:240px;overflow:auto}
  @media(max-width:1000px){.panel-example,.panel-example.document-open{grid-template-columns:minmax(0,1fr);height:auto}.left{height:460px}.example-canvas{height:240px}.right{height:400px;border-left:0;border-top:1px solid var(--vict-color-border)}}
</style>
