<script lang="ts">
  import {ControlScope} from '@victframework/ui-svelte';
  import {EditorCanvas,Layers,resolveOccurrence} from '@victframework/ui-editor';
  import type {UiRenderPlan} from '@victframework/ui';
  import {createShowcaseFixture} from './showcase.js';
  import {designerCatalogs,catalogDescriptors,catalogImplementations} from './application.js';
  import {studioNodeLabels} from './presentation.js';
  import {structureId,projectStructure} from './structure.js';
  import DocumentPanels from './DocumentPanels.svelte';
  import StructureInspection from './StructureInspection.svelte';
  import StructureView from './StructureView.svelte';
  import StructureDock from './StructureDock.svelte';
  import SourceDetails from './SourceDetails.svelte';
  const {document}=createShowcaseFixture('button');
  let plan=$state<UiRenderPlan>();
  let selected=$state(`${document.id}|${document.root}`);
  let selectedId=$state(structureId(document.id,'node',document.root));
  let selectedNodeId=$derived(resolveOccurrence(selected,document).sourceNodeId);
  let documentOpen=$state(true),structureOpen=$state(true),inspectOpen=$state(false);
  let draft=$state('');
  let notice=$state('Select a layer or graph item, then Inspect inside Structure.');
  function select(occurrence:string){selected=occurrence;selectedId=structureId(document.id,'node',resolveOccurrence(occurrence,document).sourceNodeId);}
  function selectDetail(id:string){selectedId=id;const node=projectStructure(document).nodes.find(node=>node.id===id);if(node?.data.occurrence)selected=node.data.occurrence;}
  function inspect(id=selectedId){selectedId=id;structureOpen=true;inspectOpen=true;}
</script>
<ControlScope class="vict-rhea">
  <section class="workspace-panel-showcase" aria-label="Docked workspace panel example">
    <h3>Chat, Document accordion and Structure inspection</h3>
    <p>Actual workspace components in a disposable read-only fixture. This Chat draft stays local; no model request is sent. Live Chat and authoring are available in <a href="/design">Studio</a>.</p>
    <button type="button" aria-expanded={documentOpen} onclick={()=>documentOpen=!documentOpen}>Example Document</button>
    <div class="panel-example" class:document-open={documentOpen}>
      <aside class="left" aria-label="Example Chat"><header>Chat</header><label>Local example draft<textarea bind:value={draft} placeholder="This layout example has no agent connection."></textarea></label></aside>
      <div class="example-stage">
        <div class="example-canvas"><EditorCanvas {document} catalogs={designerCatalogs} extensions={catalogDescriptors} extensionImplementations={catalogImplementations} interactionMode="design" selectedOccurrence={selected} onSelect={select} onPlan={(next:UiRenderPlan)=>plan=next} ariaLabel="Docked panel example canvas" /></div>
        <StructureDock bind:open={structureOpen} availableHeight={600} height={240}>
          <StructureInspection open={inspectOpen}>
            {#snippet graphContent(visible:boolean)}<StructureView presentation="drawer" active={structureOpen && visible} {document} revision={document.revision} {selectedNodeId} descriptors={catalogDescriptors} onSelect={select} onMove={()=>false} onNotice={(message:string)=>notice=message} onInspect={(id?:string)=>inspect(id)} onCloseInspect={()=>inspectOpen=false} inspectionExpanded={inspectOpen} inspectionSelection={selectedId} onInspectSelection={(id:string)=>selectedId=id} />{/snippet}
            {#snippet inspectionContent()}<SourceDetails {document} {selectedId} onClose={()=>inspectOpen=false} onSelect={selectDetail} onNavigate={()=>notice='Use Studio for document edits and floating editing tools.'} />{/snippet}
          </StructureInspection>
        </StructureDock>
      </div>
      <aside class="right" hidden={!documentOpen} aria-label="Example stacked Document"><header>Document</header><DocumentPanels>
        {#snippet layersContent()}<button type="button" onclick={()=>inspect()}>Inspect in Structure ↗</button>{#if plan}<Layers compact hideTextContent {plan} {document} labels={{nodes:studioNodeLabels(document)}} selectedOccurrence={selected} onSelect={select} componentDescriptors={catalogDescriptors} />{/if}{/snippet}
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
  .panel-example{display:grid;grid-template-columns:240px minmax(0,1fr);height:600px;min-height:0;margin-top:12px;border:1px solid var(--vict-color-border);background:var(--vict-color-bg);overflow:hidden}
  .panel-example.document-open{grid-template-columns:240px minmax(0,1fr) 280px}
  aside{display:flex;flex-direction:column;min-height:0;min-width:0;background:var(--vict-color-surface);overflow:hidden}aside[hidden]{display:none}
  .left{border-right:1px solid var(--vict-color-border)}.right{border-left:1px solid var(--vict-color-border)}
  label{display:grid;gap:8px;margin:12px}textarea{width:100%;min-height:100px;font:inherit}
  .example-stage{display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden}.example-canvas{padding:16px;flex:1;min-height:0;overflow:auto}.example-canvas :global(.uv-canvas){min-height:280px;background:var(--vict-color-surface)}
  header{height:38px;flex:none;padding:10px;font-weight:600;border-bottom:1px solid var(--vict-color-border)}dl{margin:0}dl>div{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:6px 0}dd{margin:0;overflow-wrap:anywhere}pre{font-size:10px;max-height:240px;overflow:auto}
  .right :global(.uv-layers){height:auto;flex:1;min-height:0}
  @media(max-width:1000px){.panel-example,.panel-example.document-open{grid-template-columns:minmax(0,1fr);height:auto}.left{height:180px}.example-stage{height:560px}.right{height:440px;border-left:0;border-top:1px solid var(--vict-color-border)}}
</style>
