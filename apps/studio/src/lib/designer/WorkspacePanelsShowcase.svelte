<script lang="ts">
  import {untrack,tick} from 'svelte';
  import {Menubar} from '@victframework/ui-svelte/catalog/menubar';
  import WorkspaceMenu from './WorkspaceMenu.svelte';
  import {ControlScope} from '@victframework/ui-svelte';
  import {EditorCanvas,Layers,resolveOccurrence} from '@victframework/ui-editor';
  import type {UiRenderPlan} from '@victframework/ui';
  import {createShowcaseFixture} from './showcase.js';
  import {designerCatalogs,catalogDescriptors,catalogImplementations} from './application.js';
  import {studioNodeLabels} from './presentation.js';
  import {structureId,projectStructure} from './structure.js';
  import DocumentPanels from './DocumentPanels.svelte';
  import WorkspaceDetails from './WorkspaceDetails.svelte';
  import StructureView from './StructureView.svelte';
  import WorkspaceModes from './WorkspaceModes.svelte';
  import SourceDetails from './SourceDetails.svelte';
  const {document}=createShowcaseFixture('button');
  let plan=$state<UiRenderPlan>();
  let selected=$state(`${document.id}|${document.root}`);
  let selectedId=$state(structureId(document.id,'node',document.root));
  let exampleFocus=$state(structureId(document.id,'node',document.root));
  let selectedNodeId=$derived(resolveOccurrence(selected,document).sourceNodeId);
  let chatOpen=$state(false),documentOpen=$state(false);
  let context=$state<'document'|'selection'>('document');
  const inspectOpen=$derived(documentOpen && context==='selection');
  let view=$state<'design'|'interact'|'structure'>('design'),canvasMode=$state<'design'|'interact'>('design');
  const structureOpen=$derived(view==='structure');
  function changeView(next:'design'|'interact'|'structure'){view=next;if(next!=='structure')canvasMode=next;}
  let exampleWidth=$state(0),activeMenu=$state('');
  let lastPanel:'chat'|'document'='document';
  const compact=$derived(exampleWidth>0 && exampleWidth<=1000);
  function panel(name:'chat'|'document',open=true){const focused=globalThis.document.activeElement;if(open){lastPanel=name;if(compact){chatOpen=false;documentOpen=false;}}if(name==='chat')chatOpen=open;else documentOpen=open;void tick().then(()=>{if(focused instanceof HTMLElement && focused.isConnected && focused.closest('[hidden],[inert]'))globalThis.document.querySelector<HTMLElement>('.workspace-panel-showcase .studio-menus>button')?.focus({preventScroll:true});});}
  $effect(()=>{if(compact)untrack(()=>{if(chatOpen && documentOpen)panel(lastPanel);});});
  let draft=$state('');
  let notice=$state('Document shows the whole screen. Selection follows the item you choose.');
  function selectGraph(occurrence:string){selected=occurrence;selectedId=structureId(document.id,'node',resolveOccurrence(occurrence,document).sourceNodeId);}
  function select(occurrence:string){selectGraph(occurrence);exampleFocus=selectedId;}
  function selectDetail(id:string){selectedId=id;exampleFocus=id;const node=projectStructure(document).nodes.find(node=>node.id===id);if(node?.data.occurrence)selected=node.data.occurrence;}
  function inspect(id=selectedId){selectedId=id;exampleFocus=id;context='selection';panel('document');}
</script>
<ControlScope class="vict-rhea">
  <section class="workspace-panel-showcase" aria-label="Docked workspace panel example">
    <h3>Design, Interact and Structure workspace views</h3>
    <p>Actual workspace components in a disposable read-only fixture. This Chat draft stays local; no model request is sent. Live Chat and authoring are available in <a href="/design">Studio</a>.</p>
    <Menubar.Root class="workspace-menus studio-menus" aria-label="Example workspace menus" bind:value={activeMenu}><WorkspaceMenu label="View" value="example-view" {activeMenu}>
      <Menubar.CheckboxItem aria-label="Chat" checked={chatOpen} onSelect={()=>panel('chat',!chatOpen)}>Chat</Menubar.CheckboxItem>
      <Menubar.CheckboxItem aria-label="Document" checked={documentOpen} onSelect={()=>panel('document',!documentOpen)}>Document</Menubar.CheckboxItem>
    </WorkspaceMenu></Menubar.Root>
    <div class="panel-example" class:document-open={documentOpen} class:chat-open={chatOpen} bind:clientWidth={exampleWidth}>
      <aside class="left" hidden={!chatOpen} aria-label="Example Chat"><header>Chat<button type="button" aria-label="Close example Chat" onclick={()=>panel('chat',false)}>×</button></header><label>Local example draft<textarea bind:value={draft} placeholder="This layout example has no agent connection."></textarea></label></aside>
      <div class="example-stage">
        <div class="example-modes"><WorkspaceModes {view} onChange={changeView}/></div>
        <div class="example-canvas" hidden={structureOpen} inert={structureOpen}><EditorCanvas {document} catalogs={designerCatalogs} extensions={catalogDescriptors} extensionImplementations={catalogImplementations} interactionMode={canvasMode} selectedOccurrence={selected} onSelect={select} onPlan={(next:UiRenderPlan)=>plan=next} ariaLabel="Docked panel example canvas" /></div>
        <section class="structure-workspace" aria-label="Example Structure workspace" hidden={!structureOpen} inert={!structureOpen}>
        <StructureView focusSelection={exampleFocus} presentation="drawer" active={structureOpen} {document} revision={document.revision} {selectedNodeId} descriptors={catalogDescriptors} onSelect={selectGraph} onMove={()=>false} onNotice={(message:string)=>notice=message} onInspect={(id?:string)=>inspect(id)} onCloseInspect={()=>panel('document',false)} inspectionExpanded={inspectOpen} inspectionLabel="Selection" inspectionSelection={selectedId} onInspectSelection={(id:string)=>selectedId=id} />
        </section>
      </div>
      <aside class="right" hidden={!documentOpen} aria-label="Example stacked Document"><WorkspaceDetails bind:context onClose={()=>panel('document',false)}>{#snippet documentContent()}<DocumentPanels>
        {#snippet layersContent()}<button type="button" onclick={()=>inspect()}>Open Selection ↗</button>{#if plan}<Layers compact hideTextContent {plan} {document} labels={{nodes:studioNodeLabels(document)}} selectedOccurrence={selected} onSelect={select} componentDescriptors={catalogDescriptors} />{/if}{/snippet}
        {#snippet dataContent()}<dl>{#each Object.entries(document.localState) as [key,value]}<div><dt>{key}</dt><dd>{JSON.stringify(value.initial)}</dd></div>{/each}</dl>{/snippet}
        {#snippet actionsContent()}<p>demo.submit uses the existing local simulation. This read-only fixture does not invoke it.</p>{/snippet}
        {#snippet sourceContent()}<pre>{JSON.stringify(document,null,2)}</pre>{/snippet}
      </DocumentPanels>{/snippet}{#snippet selectionContent()}<SourceDetails embedded {document} {selectedId} onClose={()=>panel('document',false)} onSelect={selectDetail} onNavigate={()=>notice='Use Studio for document edits and floating editing tools.'} />{/snippet}</WorkspaceDetails></aside>
    </div>
    <p role="status">{notice}</p>
  </section>
</ControlScope>
<style>
  .workspace-panel-showcase{margin-top:24px;border-top:1px solid var(--vict-color-border);padding-top:20px;font-size:12px}
  h3{font-size:16px}p{line-height:1.6}button{font:inherit;cursor:pointer;border:1px solid var(--vict-color-border);background:var(--vict-color-surface);color:var(--vict-color-text);padding:6px 10px;border-radius:4px}
  .panel-example{display:grid;grid-template-columns:minmax(0,1fr);height:600px;min-height:0;margin-top:12px;border:1px solid var(--vict-color-border);background:var(--vict-color-bg);overflow:hidden}
  .panel-example.chat-open{grid-template-columns:240px minmax(0,1fr)}.panel-example.document-open{grid-template-columns:minmax(0,1fr) 280px}.panel-example.chat-open.document-open{grid-template-columns:240px minmax(0,1fr) 280px}
  aside{display:flex;flex-direction:column;min-height:0;min-width:0;background:var(--vict-color-surface);overflow:hidden}aside[hidden]{display:none}
  .left{border-right:1px solid var(--vict-color-border)}.right{border-left:1px solid var(--vict-color-border)}
  label{display:grid;gap:8px;margin:12px}textarea{width:100%;min-height:100px;font:inherit}
  .example-stage{display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden}.example-canvas{padding:16px;flex:1;min-height:0;overflow:auto}.example-canvas :global(.uv-canvas){min-height:280px;background:var(--vict-color-surface)}
  .example-canvas[hidden],.structure-workspace[hidden]{display:none}.example-modes{display:flex;padding:4px 8px;border-bottom:1px solid var(--vict-color-border)}
  .structure-workspace{display:flex;flex:1;min-width:0;min-height:0;overflow:hidden}.structure-workspace :global(.structure-inspection-layout){flex:1}
  header{display:flex;align-items:center;justify-content:space-between;height:38px;flex:none;padding:10px;font-weight:600;border-bottom:1px solid var(--vict-color-border)}dl{margin:0}dl>div{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:6px 0}dd{margin:0;overflow-wrap:anywhere}pre{font-size:10px;max-height:240px;overflow:auto}
  .right :global(.uv-layers){height:auto;flex:1;min-height:0}
  @media(max-width:1000px){.panel-example,.panel-example.document-open,.panel-example.chat-open,.panel-example.chat-open.document-open{grid-template-columns:minmax(0,1fr);height:auto}.left{height:180px}.example-stage{height:560px}.right{height:440px;border-left:0;border-top:1px solid var(--vict-color-border)}}
</style>
