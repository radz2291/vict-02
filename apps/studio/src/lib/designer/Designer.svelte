<script lang="ts">
  import './disclosures.css';
  import {exclusiveWorkspacePanels} from './workspace-panels.js';
  import {compatiblePreviewValues} from './preview-state.js';
  import { onMount, tick, untrack } from 'svelte';
  import { beforeNavigate } from '$app/navigation';
  import { ControlScope } from '@victframework/ui-svelte';
  import { Composer, EditorBridge, EditorCanvas, Inspector, Layers, PanelResizer, StateInitialEditor, SelectionPalette, setAttribute, canvasSelectionTarget, resolveOccurrence, compositionParent, compositionName, literalTextTarget, duplicateSubtree, type TransactionDraft } from '@victframework/ui-editor';
  import { createPreviewSession } from '@victframework/ui-preview';
  import { CompositionNavigator, authoredOccurrence, compositionSlots, compositionMembers, compositionTrail, firstCompositionSlot, type CompositionFocus } from '@victframework/ui-editor';
  import type { UiDocument, UiRenderPlan, UiValue } from '@victframework/ui';
  import { newScreen, compileScreen, screenIssues, screenApplication, screenName, screenActionState, designerCatalogs, actionInputs, catalogDescriptors, catalogImplementations } from './application.js';
  import { screenPlacementIssues, screenAuthoringGuidance } from './placement.js';
  import AuthoringGuidance from './AuthoringGuidance.svelte';
  import { screenStore, savedScreens } from './storage.js';
  import { screenRecipes } from './recipes.js';
  import { createScreenSimulation, screenDispatcher } from './execution.js';
  import { Menubar } from '@victframework/ui-svelte/catalog/menubar';
  import WorkspaceMenu from './WorkspaceMenu.svelte';
  import WorkspaceBrand from './WorkspaceBrand.svelte';
  import AgentChat from './AgentChat.svelte';
  import { captureDesignerPreview } from './visual-observation.js';
  import StructureView from './StructureView.svelte';
  import WorkspaceSelectionDetails from './WorkspaceSelectionDetails.svelte';
  import {changeSelection,pruneSelection,nodeItem,itemKey,primaryItem,singleOccurrence,type WorkspaceSelection,type WorkspaceItem} from './workspace-selection.js';
  import {selectionSet} from './selection-context.js';
  import {selectionIdentity} from './selection-presentation.js';
  import type {OccurrenceSelectionIntent,SelectionOperation} from '@victframework/ui-editor';
  import DataEditorHeader from './DataEditorHeader.svelte';
  import WorkspaceDetails from './WorkspaceDetails.svelte';
  import DocumentPanels from './DocumentPanels.svelte';
  import WorkspaceModes from './WorkspaceModes.svelte';
  import TryScenarios from './TryScenarios.svelte';
  import type { TestScenario } from './test-scenarios.js';
  import { readableName, studioNodeLabels,studioStateLabels,studioActionLabels,studioDisplayName } from './presentation.js';
  import WorkspaceContextMenu from './WorkspaceContextMenu.svelte';
  import { sourceCapabilities, type WorkspaceContext } from './workspace-context.js';
  import { projectStructure, structureId, structureMove, type StructureEditRequest, type StructureHandoff } from './structure.js';
  function moveFromStructure(request: StructureEditRequest): boolean {
    if (!bridge) return false;
    const prepared = structureMove(bridge.document, bridge.getSnapshot().revision, request, textDraftDirty || sourceDraftDirty || renamingScreen, catalogDescriptors, screenRecipes);
    if (!prepared.ok) { notice = prepared.message; return false; }
    return apply(prepared.draft);
  }
  function selectStructureNode(occurrence: string,fromGraph=false) {
    if (textDraftDirty || sourceDraftDirty || renamingScreen) { notice = 'Apply or cancel your draft first.'; return; }
    if(source){const item=nodeItem(source,occurrence);if(item)updateSelection([item]);}paletteRequested=false;
    if (source) {detailId = structureId(source.id, 'node', resolveOccurrence(occurrence, source).sourceNodeId);if(!fromGraph)structureFocusId=detailId;}
  }
  async function locateOnCanvas(occurrence: string) {
    if (!source || textDraftDirty || sourceDraftDirty || renamingScreen) return;
    workspaceView=mode; await tick();
    const find = () => {
      const owner=canvasScroll?.querySelector<HTMLElement>('[data-ui-owner-root]')?.dataset.uiOwnerRoot;if(!owner)return undefined;
      const elements=[...globalThis.document.querySelectorAll<HTMLElement>('[data-ui-occ]')].filter(element=>element.dataset.uiOwner===owner);
      const target=canvasSelectionTarget(source!,occurrence,elements,true);return target&&[...target.getClientRects()].some(rect=>rect.width>0&&rect.height>0)?target:undefined;
    };
    if (!find()) {
      if (mode === 'interact') { notice = 'This source is hidden in Interact. Switch to Design, then Locate on canvas to inspect its composition.'; return; }
      const report = resolveOccurrence(occurrence, source);
      const nearest = compositionTrail(source, { nodeId: report.sourceNodeId, slotName: '' }).at(-2);
      compositionFocus = nearest && compositionSlots(source, nearest.nodeId, catalogDescriptors).includes(nearest.slotName) ? nearest : undefined;
      await tick();
    }
    const target = find();
    if (target) { target.scrollIntoView({ block: 'nearest', inline: 'nearest' }); target.focus({ preventScroll: true }); }
    const text=resolveOccurrence(occurrence,source).node?.kind==='text';
    const location=selectionIdentity(source,workspaceGraph,nodeItem(source,occurrence)??{kind:'node',id:''}).textLocation;
    notice=target?(text&&target.dataset.uiOcc!==occurrence?`${location??'Text inside its containing element'}. The text remains selected; the containing element is highlighted.`:'Located on canvas.'):(text?'This text is not currently visible on the canvas.':'This source has no visible canvas element. Open its composition to inspect it.');
  }
  async function structureNavigate(request: StructureHandoff) {
    if (textDraftDirty || sourceDraftDirty || renamingScreen) { notice = 'Apply or cancel your draft first.'; return; }
    if (request.occurrence) selectStructureNode(request.occurrence);
    if (request.destination === 'data' || request.destination === 'actions') {
      drawerContext='document';showPanel('document'); testingOpen=false;
      documentPanel=request.destination;
      selectedData = request.destination === 'data' ? request.key : undefined;
    } else if (request.destination === 'layers') {
      documentPanel='layers';drawerContext='document';showPanel('document');testingOpen=false;
    } else {
      if (request.destination === 'design' && request.occurrence) { await locateOnCanvas(request.occurrence); return; }
      if (request.destination === 'inspector' && request.occurrence) { changeMode('design'); if(source&&resolveOccurrence(request.occurrence,source).node?.kind==='text'){await locateOnCanvas(request.occurrence);return;} selectOccurrence(request.occurrence, true); paletteFocus=Symbol('edit-handoff'); }
    }
    notice = request.destination === 'actions' ? `${studioDisplayName('action',request.key??'')} · simulated execution is available in Interact.` : `Opened ${request.destination} for the selected source.`;
    await tick();
    const target = request.destination === 'layers' ? '[data-document-section=layers]' : request.destination === 'data' || request.destination === 'actions' ? `[data-document-section=${request.destination}]` : request.destination === 'inspector' ? '.selection-palette' : '.design-frame .uv-canvas';
    globalThis.document.querySelector<HTMLElement>(target)?.focus({ preventScroll: true });
  }
  import { documentCursor, applyAgentProposal, type AgentProposal } from './agent-edits.js';
  let agentEpoch = $state(crypto.randomUUID());
  let chatOpen = $state(false);
  let chatWidth = $state(280);
  let drawerWidth = $state(320);
  async function toggleChat(){showPanel('chat',!chatOpen);await tick();(chatOpen?globalThis.document.querySelector<HTMLElement>('.agent-panel textarea'):workspaceElement?.querySelector<HTMLElement>('.left-drawer-toggle')??viewButton)?.focus({preventScroll:true});}
  type AuxiliaryPanel='chat'|'document'|'testing';
  let availableWidth=$state(0);
  const compactWorkspace=$derived(exclusiveWorkspacePanels(availableWidth,chatWidth,drawerWidth));
  let lastPanel:AuxiliaryPanel='document';
  let viewButton=$state<HTMLButtonElement|null>(null);
  let structureFocusId=$state<string>();
  function showPanel(panel:AuxiliaryPanel,open=true){
    const focused=globalThis.document.activeElement;
    if(open){
      lastPanel=panel;
      if(compactWorkspace){chatOpen=false;drawerOpen=false;testingOpen=false;}
    }
    if(panel==='chat')chatOpen=open;
    else if(panel==='document'){drawerOpen=open;if(open)testingOpen=false;}
    else testingOpen=open;
    void tick().then(()=>{if(focused instanceof HTMLElement && focused.isConnected && focused.closest('[hidden],[inert]')){
      const selector=panel==='chat'?'.agent-panel:not([hidden]) textarea':panel==='document'?'#document-drawer:not([hidden]) .close-document':'.testing-drawer [aria-label="Close testing"]';
      (open?globalThis.document.querySelector<HTMLElement>(selector) ?? viewButton:viewButton)?.focus({preventScroll:true});
    }});
  }
  $effect(()=>{if(compactWorkspace)untrack(()=>{
    const visible:AuxiliaryPanel[]=([...(['chat','document','testing'] as const)]).filter(panel=>panel==='chat'?chatOpen:panel==='document'?drawerOpen:testingOpen);
    if(visible.length>1)showPanel(visible.includes(lastPanel)?lastPanel:visible.at(-1)!);
  });});
  function showStructure(){
    if(source && !structureFocusId)structureFocusId=detailId ?? structureId(source.id,'node',selectedNode?.id ?? source.root);
    workspaceView='structure';
    void tick().then(()=>workspaceElement?.querySelector<HTMLElement>('[aria-label="Search structure"]')?.focus({preventScroll:true}));
  }
  function changeView(next:'design'|'interact'|'structure'){if(next==='structure')showStructure();else changeMode(next);}
  let testingOpen = $state(false);
  let activeTest = $state<TestScenario>();
  let testChoice = 0;
  let testingReturn: HTMLElement | undefined;
  async function openTesting() {
    if(textDraftDirty || sourceDraftDirty || renamingScreen){notice='Apply or cancel your draft first.';return;}
    const active=globalThis.document.activeElement;
    testingReturn=active instanceof HTMLElement && !active.closest('[role="menu"]')?active:undefined;
    showPanel('testing');
  }
  function closeTesting() {
    testingOpen=false;void tick().then(()=>{
      const target=testingReturn?.isConnected && !testingReturn.closest('[hidden],[inert]') && testingReturn.getClientRects().length ? testingReturn : viewButton;
      target?.focus({preventScroll:true});
    });
  }
  async function chooseTest(test:TestScenario) {
    if(textDraftDirty || sourceDraftDirty || renamingScreen)return;
    changeMode('interact');
    resetRuntime();const choice=testChoice;await tick();if(choice!==testChoice)return;
    simulation.denied=test.simulation==='denied';simulation.failNext=test.simulation==='failNext';
    runtimeValues={...test.values};activeTest=test;
    notice=test.description;
  }
  async function changeTestValue(key:string,value:UiValue|undefined) {
    if(textDraftDirty || sourceDraftDirty || renamingScreen)return;
    const retained={...runtimeValues};if(value===undefined)delete retained[key];else retained[key]=value;
    resetRuntime();const choice=testChoice;await tick();if(choice!==testChoice)return;
    runtimeValues=retained;activeTest={id:'custom',label:'Custom values',description:'Temporary state values.'};
  }
  async function tryCanvas() {
    if(textDraftDirty || sourceDraftDirty || renamingScreen)return;
    // Keep deliberately prepared temporary values while opening the interactive canvas.
    const retained={...runtimeValues},test=activeTest,denied=simulation.denied,failNext=simulation.failNext;
    changeMode('interact');runtimeValues=retained;activeTest=test;simulation.denied=denied;simulation.failNext=failNext;
    testingOpen=false;drawerOpen=false;
    await tick();canvasScroll?.querySelector<HTMLElement>('input,button,select,textarea,[tabindex="0"]')?.focus({preventScroll:true});
  }
  import '@victframework/ui-svelte/styles.css';
  import '@victframework/ui-svelte/catalog.css';
  import './workspace.css';
  import './designer.css';
  import '@victframework/ui-svelte/rhea.css';
  import './studio-theme.css';
  import './studio-typography.css';

  let bridge = $state<EditorBridge>();
  let version = $state(0);
  let library = $state<{ id: string; name: string }[]>([]);
  const sessions = new Map<string, EditorBridge>();
  let unsubscribe: (() => void) | undefined;
  const snapshot = $derived.by(() => { void version; return bridge?.getSnapshot(); });
  const authoredRevision = $derived(snapshot?.revision);
  const source = $derived.by(() => { void version; return bridge?.document; });
  const compilation = $derived(source ? compileScreen(source) : undefined);
  const structureContext=$derived({descriptors:catalogDescriptors,actionState:screenActionState,actionIds:designerCatalogs.actionIds,routeIds:designerCatalogs.routeIds,plan:compilation?.ok?Object.values(compilation.plan.documentPlans??{}).find(item=>item.documentId===source?.id):undefined});
  let workspaceSelection=$state<WorkspaceSelection>({documentId:'',items:[]});
  const savedSelections=new Map<string,WorkspaceSelection>();
  const workspaceGraph=$derived(source?projectStructure(source,structureContext):{nodes:[],edges:[]});
  let renderedDocument=$state('');
  let renderedOccurrences=$state<readonly string[]>([]);
  const currentOccurrences=$derived(renderedDocument===source?.id?renderedOccurrences:undefined);
  const selectedSourceIds=$derived(workspaceSelection.items.flatMap(item=>item.kind==='node'&&!item.occurrence?workspaceGraph.nodes.find(node=>node.id===item.id)?.data.sourceId??[]:[]));
  const selectionLabel=$derived(source&&workspaceSelection.items.length===1?selectionIdentity(source!,workspaceGraph,workspaceSelection.items[0]!).qualified:workspaceSelection.items.length?`${workspaceSelection.items.length} selected items`:'None');
  const selectedOccurrences=$derived(workspaceSelection.items.flatMap(item=>item.kind==='node'&&item.occurrence?[item.occurrence]:[]));
  const selected = $derived(singleOccurrence(workspaceSelection));
  $effect(()=>{
    if(!source)return;const document=source,graph=workspaceGraph,state=workspaceSelection;
    untrack(()=>{
      const next=pruneSelection(state,document,graph);
      if(JSON.stringify(next)!==JSON.stringify(state))workspaceSelection=next;
      const occurrence=singleOccurrence(next);if(bridge?.getSnapshot().selectedOccurrence!==occurrence)bridge?.select(occurrence);
      const primary=primaryItem(next);detailId=primary?.kind==='node'?primary.id:undefined;
      if(next.items.length!==1||!occurrence)paletteRequested=false;
    });
  });
  function updateSelection(items:readonly WorkspaceItem[],operation:SelectionOperation='replace',primary?:WorkspaceItem){
    if(!source||textDraftDirty||sourceDraftDirty||renamingScreen){notice='Apply or cancel your draft before changing selection.';return;}
    workspaceSelection=changeSelection({...workspaceSelection,documentId:source.id},items,operation,primary);
    paletteRequested=false;layerProvenance=undefined;
  }
  function clearWorkspaceSelection(){updateSelection([]);}
  function selectRelated(items:readonly WorkspaceItem[],operation:SelectionOperation){if(!source||textDraftDirty||sourceDraftDirty||renamingScreen){notice='Apply or cancel your draft before changing selection.';return;}updateSelection(items,operation);if(operation==='replace'&&items.length===1&&items[0]?.kind==='node')structureFocusId=items[0].id;}
  function layerSelection(intent:OccurrenceSelectionIntent){
    if(!source)return;if(textDraftDirty||sourceDraftDirty||renamingScreen){notice='Apply or cancel your draft before changing selection.';return;}
    const items=intent.occurrences.flatMap(occurrence=>{const item=nodeItem(source,occurrence);return item?[item]:[];});
    items.push(...(intent.sourceNodeIds??[]).filter(id=>!!source.nodes[id]).map(id=>({kind:'node' as const,id:structureId(source.id,'node',id)})));
    updateSelection(items,intent.operation,intent.primarySourceId?{kind:'node',id:structureId(source.id,'node',intent.primarySourceId)}:nodeItem(source,intent.primary));
  }
  function normalizedOccurrence(occurrence:string){
    if(!source)return occurrence;const report=resolveOccurrence(occurrence,source);
    const direct=!report.instancePath.some(step=>source.componentDefinitions[step.definitionId])&&!report.repeatKeys.length;
    const parent=report.node?.kind==='text'&&direct?compositionParent(source,report.node.id):undefined;
    const owner=parent?source.nodes[parent.nodeId]:undefined;
    return owner?.kind==='element'&&owner.children.length===1?authoredOccurrence(source,owner.id)??occurrence:direct&&occurrence.split('|').length===2?authoredOccurrence(source,report.sourceNodeId)??occurrence:occurrence;
  }
  function canvasSelection(intent:OccurrenceSelectionIntent){
    if(!source)return;if(textDraftDirty||sourceDraftDirty||renamingScreen){notice='Apply or cancel your draft before changing selection.';return;}
    if(intent.operation==='replace'&&intent.occurrences.length===1){selectOccurrence(intent.primary);return;}
    const items=intent.occurrences.flatMap(occurrence=>{const item=nodeItem(source,normalizedOccurrence(occurrence));return item?[item]:[];});updateSelection(items,intent.operation);
  }

  const selectedNode = $derived(source && selected ? resolveOccurrence(selected, source).node : undefined);
  let compositionFocus=$state<CompositionFocus>();
  let canvasScroll=$state<HTMLDivElement>();
  $effect(()=>{const element=canvasScroll;if(!element)return;const clear=(event:MouseEvent)=>{if(mode==='design'&&!event.ctrlKey&&!event.metaKey&&(event.target===element||event.target instanceof Element&&event.target.matches('.design-frame')))clearWorkspaceSelection();};element.addEventListener('click',clear);return()=>element.removeEventListener('click',clear);});
  const selectedSlots=$derived(source && selectedNode?compositionSlots(source,selectedNode.id,catalogDescriptors):[]);
  const focusedMembers=$derived(source && compositionFocus?compositionMembers(source,compositionFocus):undefined);
  $effect(()=>{if(source && compositionFocus && !compositionSlots(source,compositionFocus.nodeId,catalogDescriptors).includes(compositionFocus.slotName)) {compositionFocus=undefined;notice='Composition is no longer available. Returned to the screen.';}});
  async function navigateComposition(next:CompositionFocus|undefined) {
    if(!source || textDraftDirty || sourceDraftDirty){notice='Apply or cancel your property or source edit before changing composition.';return;}
    if(next && !compositionSlots(source,next.nodeId,catalogDescriptors).includes(next.slotName))return;
    const previous=compositionFocus;
    compositionFocus=next;
    const nodeId=next?.nodeId ?? (previous?compositionTrail(source,previous)[0]?.nodeId:undefined) ?? source.root;
    const target=nodeItem(source,authoredOccurrence(source,nodeId)??`${source.id}|${source.root}`);if(target)updateSelection([target]);
    editTextSignal=undefined;paletteRequested=false;
    notice=next?`Editing ${compositionName(source,next.nodeId)} / ${next.slotName}. App visibility is unchanged.`:'Returned to the screen.';
    await tick(); globalThis.document.querySelector<HTMLElement>('.design-frame .uv-canvas')?.focus({preventScroll:true});
    if(canvasScroll) {canvasScroll.scrollTop=0;canvasScroll.scrollLeft=0;}
  }
  function openComposition(occurrence=selected) {
    if(!source || !occurrence)return;
    const report=resolveOccurrence(occurrence,source);
    if(report.repeatKeys.length || report.instancePath.some(step=>source.componentDefinitions[step.definitionId]))return;
    const slotName=firstCompositionSlot(compositionSlots(source,report.sourceNodeId,catalogDescriptors));
    if(slotName)void navigateComposition({nodeId:report.sourceNodeId,slotName});
  }
  function selectFromStructure(occurrence:string) {
    // Navigation selection does not switch composition or reveal editing tools.
    selectStructureNode(occurrence);
  }
  let plan = $state<UiRenderPlan>();
  let issues = $state<readonly { code: string; message: string }[]>([]);
  let notice = $state('Start with an empty screen. Add a heading or section to begin.');
  let documentPanel=$state<'layers'|'data'|'actions'|'source'|'none'>('layers');
  let formatSection = $state<'Content' | 'Style' | 'Behavior'>('Style');
  let editTextSignal = $state<symbol>();
  let selectionToolsReveal = $state<symbol>();
  let propertyDraftDirty = $state(false);
  let dataDraftDirty = $state(false);
  const textDraftDirty = $derived(propertyDraftDirty || dataDraftDirty);
  let selectedData = $state<string>();
  const dataName = (key:string) => editorLabels.state[key as keyof typeof editorLabels.state] ?? readableName(key);
  const dataType = (type:string) => ({string:'Text',boolean:'Yes / No',number:'Number',stringList:'Text list',numberList:'Number list'}[type] ?? type);
  function dataPreview(value:unknown) {return Array.isArray(value) ? `${value.length} items` : typeof value==='boolean' ? value?'Yes':'No' : value === '' ? 'Empty' : String(value);}
  function openData(key?:string) {if(textDraftDirty || sourceDraftDirty) {notice='Apply or cancel your draft first.';return;} selectedData=key;}
  async function toggleDocument() {if(drawerOpen && !testingOpen)closeDrawer();else {showPanel('document');await tick();globalThis.document.querySelector<HTMLElement>('.close-document')?.focus({preventScroll:true});}}

  let palettePage = $state<'format' | 'insert' | 'arrange' | 'connect'>('format');
  let paletteRequested = $state(false);
  let paletteFocus = $state<symbol>();
  let width = $state('fluid');
  let canvasWidth=$state(0);
  let mode = $state<'design' | 'interact'>('design');
  let workspaceView=$state<'design'|'interact'|'structure'>('design');
  let drawerOpen = $state(false);
  let workspaceElement = $state<HTMLDivElement>();
  let detailId = $state<string>();
  let layerProvenance=$state<{occurrence:string;detail:string}>();
  let drawerContext=$state<'document'|'selection'>('document');
  const detailsOpen=$derived(drawerOpen && !testingOpen && drawerContext==='selection');
  const effectiveDrawerWidth = $derived(drawerWidth);
  const structureOpen=$derived(workspaceView==='structure');
  let detailsPage = $state<'properties'|'relationships'|'technical'|'none'>('properties');
  let workspaceWidth = $state(0);
  const rightOpen = $derived(drawerOpen || testingOpen);
  let inspectionReturn: HTMLElement | undefined;
  function inspectSource(id = source && selected ? structureId(source.id,'node',resolveOccurrence(selected,source).sourceNodeId) : undefined, page:'properties'|'relationships'='properties') {
    const active = globalThis.document.activeElement;
    inspectionReturn = active instanceof HTMLElement && !active.closest('[role="menu"]') ? active : undefined;
    detailId=id;detailsPage=page;drawerContext='selection';showPanel('document');
    void tick().then(()=>{const target=workspaceElement?.querySelector<HTMLElement>('#document-drawer [role=tab][data-context=selection]');target?.scrollIntoView({block:'nearest'});target?.focus({preventScroll:true});});
  }
  function closeDetails() { showPanel('document',false); void tick().then(()=>{
    const target = inspectionReturn?.isConnected && !inspectionReturn.closest('[hidden],[inert]') ? inspectionReturn : workspaceElement?.querySelector<HTMLElement>('.right-drawer-toggle');
    target?.scrollIntoView({block:'nearest'});target?.focus({ preventScroll:true });
  }); }
  function selectDetail(id:string) {
    if (!source || textDraftDirty || sourceDraftDirty || renamingScreen) return;
    const item = workspaceGraph.nodes.find(node=>node.id===id);
    updateSelection([{kind:'node',id,...(item?.data.occurrence?{occurrence:item.data.occurrence}:{})}]);
    detailId = id;
    structureFocusId=id;
    if (item?.data.occurrence) selectStructureNode(item.data.occurrence);
  }
  function objectContext(occurrence: string, normalizeText=true): WorkspaceContext | undefined {
    if (!source) return;
    const initial = sourceCapabilities(source, occurrence);
    const ownerId = initial.direct && initial.report?.node?.kind === 'text' ? compositionParent(source, initial.report.sourceNodeId)?.nodeId : undefined;
    const owner = ownerId ? source.nodes[ownerId] : undefined;
    if (normalizeText && owner?.kind === 'element' && owner.children.length === 1) occurrence = authoredOccurrence(source,owner.id) ?? occurrence;
    const capability = sourceCapabilities(source, occurrence);
    if (!capability.report?.node) return;
    const blocked = textDraftDirty || sourceDraftDirty || renamingScreen;
    const target = () => { if (!blocked) selectStructureNode(occurrence); };
    const act = (action:()=>void) => { target(); if (!blocked && capability.direct) action(); };
    return { label:'Object commands', prepare:target, commands:[
      {id:'inspect',label:'Inspect', disabled:blocked, run:()=>inspectSource(structureId(source!.id,'node',capability.report!.sourceNodeId))},
      {id:'locate',label:'Locate on canvas', disabled:blocked, run:()=>void locateOnCanvas(occurrence)},
      {id:'edit',label:'Edit on canvas', disabled:blocked || !capability.direct, run:()=>act(()=>{changeMode('design');selectOccurrence(occurrence,true);paletteFocus=Symbol('edit-handoff');})},
      {id:'duplicate',label:'Duplicate', separator:true, disabled:blocked || !capability.removable, run:()=>act(duplicateSelection)},
      {id:'delete',label:'Delete', disabled:blocked || !capability.removable, run:()=>act(removeSelection)},
      {id:'earlier',label:'Move earlier', separator:true, disabled:blocked || !capability.earlier, run:()=>act(()=>reorderSelection(-1))},
      {id:'later',label:'Move later', disabled:blocked || !capability.later, run:()=>act(()=>reorderSelection(1))},
      {id:'arrange-canvas',label:'Arrange on canvas…', disabled:blocked || !capability.direct, run:()=>act(()=>{ changeMode('design'); selectOccurrence(occurrence,true); palettePage='arrange'; })},
    ] };
  }
  function canvasContext(target:Element):WorkspaceContext|undefined {
    if (!source || workspaceView !== 'design' || (!canvasScroll?.contains(target) && !ownsCanvasTarget(target))) return;
    if (target.closest('.selection-palette,[data-ui-selection-tools]')) return;
    const occurrence = target.closest<HTMLElement>('[data-ui-occ]')?.dataset.uiOcc;
    if (occurrence && resolveOccurrence(occurrence,source).sourceNodeId !== source.root) return objectContext(occurrence);
    const blocked=textDraftDirty || sourceDraftDirty || renamingScreen;
    return { label:'Canvas commands', prepare:()=>{if(!blocked){clearWorkspaceSelection();paletteRequested=false;}}, commands:[
      {label:'Fit canvas', run:()=>width='fluid'}, {label:'Tablet · 768',run:()=>width='768'}, {label:'Phone · 390',run:()=>width='390'},
      {label:'Insert…', separator:true, disabled:blocked, run:()=>{selectOccurrence(`${source!.id}|${source!.root}`,true);palettePage='insert';}},
    ]};
  }
  function ownsCanvasTarget(target:Element):boolean {
    const owner=canvasScroll?.querySelector<HTMLElement>('[data-ui-owner-root]')?.dataset.uiOwnerRoot;
    return !!owner && target.closest<HTMLElement>('[data-ui-owner]')?.dataset.uiOwner===owner;
  }

  function dismissStructure() {workspaceView=mode;void tick().then(()=>workspaceElement?.querySelector<HTMLElement>('.canvas-modes button[aria-pressed=true]')?.focus({preventScroll:true}));}
  let renamingScreen=$state(false);
  let screenNameDraft=$state('');
  let screenNameInput=$state<HTMLInputElement>();
  let renameButton=$state<HTMLButtonElement|null>(null);
  let activeMenu=$state('');
  async function beginRename() {
    if(!source || textDraftDirty || sourceDraftDirty)return;
    screenNameDraft=screenName(source);renamingScreen=true;
    await tick();screenNameInput?.focus();screenNameInput?.select();
  }
  function finishRename() {
    if(!renamingScreen)return;
    renamingScreen=false;
    const name=screenNameDraft.trim();
    if(source && name && name!==screenName(source)) apply(setAttribute({requestId:crypto.randomUUID(),nodeId:source.root,name:'aria-label',value:name}));
  }
  function renameKey(event:KeyboardEvent) {
    if(event.key==='Escape') {event.preventDefault();event.stopPropagation();renamingScreen=false;void tick().then(()=>renameButton?.focus());}
    if(event.key==='Enter') {event.preventDefault();finishRename();void tick().then(()=>renameButton?.focus());}
  }
  function closeDrawer() {showPanel('document',false);void tick().then(()=>(workspaceElement?.querySelector<HTMLElement>('.right-drawer-toggle')??viewButton)?.focus({preventScroll:true}));}
  function documentKeys(event: KeyboardEvent) {
    if(event.key==='Escape' && !event.defaultPrevented){event.preventDefault();event.stopPropagation();closeDrawer();return;}

  }
  const editorLabels=$derived({actions:studioActionLabels,nodes:source?studioNodeLabels(source):{screen:'Screen'},state:studioStateLabels,actionInputs:{message:'Message',accepted:'Agreement'}});
  function selectOccurrence(occurrence: string, revealTools = true) {
    if (textDraftDirty || sourceDraftDirty) { notice = 'Apply or cancel your edit first.'; return; }
    if(revealTools) workspaceView='design';
    editTextSignal = undefined;
    if (source) {
      const report = resolveOccurrence(occurrence, source);
      const direct=!report.instancePath.some(step=>source.componentDefinitions[step.definitionId]) && !report.repeatKeys.length;
      const parent = report.node?.kind === 'text' && direct ? compositionParent(source, report.node.id) : undefined;
      const owner = parent ? source.nodes[parent.nodeId] : undefined;
      if (owner?.kind === 'element' && owner.children.length === 1) occurrence = authoredOccurrence(source,owner.id) ?? occurrence;
      else if(direct && occurrence.split('|').length===2) occurrence=authoredOccurrence(source,report.sourceNodeId) ?? occurrence;
      const id=resolveOccurrence(occurrence,source).sourceNodeId;
      if(compositionFocus && id!==compositionFocus.nodeId && !focusedMembers?.has(id))compositionFocus=undefined;
    }
    if(source){const item=nodeItem(source,occurrence);if(item)updateSelection([item]);}
    if (source) {detailId=structureId(source.id,'node',resolveOccurrence(occurrence,source).sourceNodeId);structureFocusId=detailId;}
    palettePage = 'format'; paletteRequested = revealTools;
    formatSection = reportSection(occurrence);
    if(revealTools) selectionToolsReveal = Symbol('selection-tools');
  }
  function editSelectedText(occurrence = selected) {
    if (!occurrence || !source || textDraftDirty || sourceDraftDirty) return;
    const report = resolveOccurrence(occurrence, source);
    if (report.instancePath.some(step=>source.componentDefinitions[step.definitionId]) || report.repeatKeys.length || !literalTextTarget(source, report.sourceNodeId)) return;
    selectOccurrence(occurrence);
    editTextSignal = Symbol('edit');
  }
  function reportSection(occurrence: string): 'Content' | 'Style' {
    const node = source && resolveOccurrence(occurrence, source).node;
    return node?.kind === 'component' || (node?.kind === 'element' && ['input', 'textarea'].includes(node.tag)) ? 'Content' : 'Style';
  }
  function changeMode(next: 'design' | 'interact') { if (mode!==next && (textDraftDirty || sourceDraftDirty || renamingScreen)) { notice = 'Apply or cancel your draft first.'; return; } if (mode !== next) { mode = next; } workspaceView=next; notice = next === 'design' ? 'Design mode · select and edit without running behavior.' : 'Interact mode · simulated behavior, no live effects.'; }
  let createDialog: HTMLDialogElement;
  let nameInput: HTMLInputElement;
  let screenTitle = $state('My first screen');
  let sourceDraft = $state('');
  let sourceDraftRevision = '';
  let sourceDraftDirty = $state(false);
  $effect(() => { if (source && !untrack(() => sourceDraftDirty)) { sourceDraft = JSON.stringify(source, null, 2); sourceDraftRevision = snapshot?.revision ?? ''; } });
  beforeNavigate(navigation => {
    if (!navigation.willUnload && (textDraftDirty || sourceDraftDirty || [...sessions.values()].some(session => session.getSnapshot().dirty))) {
      navigation.cancel(); notice = 'Save or undo your authored changes before leaving the designer.';
    }
  });
  let runtimeValues = $state<Record<string, UiValue>>({});
  let resetSignal = $state(Symbol('designer-preview'));
  let activity = $state<string[]>([]);
  let simulation = $state({ denied: false, failNext: false });
  const adapter = createScreenSimulation(simulation);
  const scenario = { schema: 'vict.ui-scenario@1', scenarioId: 'studio.screen-preview',
    references: { application: { id: 'studio.screen', revision: '1' }, documents: {} }, seeds: { domain: { rows: {} } },
    actors: [{ actorId: 'screen-demo', role: 'designer', permissions: ['studio.demo.write'] }],
    operations: [{ op: 'studio.demo:submit', implementation: 'simulated' }], resetBoundary: 'session' } as const;
  let preview = createPreviewSession({ scenario, dataAdapter: { adapter, context: actor => ({ permissions: actor.permissions, effect: 'write', actor: actor.actorId }) } });
  function resetRuntime() {
    testChoice++;
    adapter.reset(); preview.reset();
    simulation.denied=false;simulation.failNext=false;activeTest=undefined;
    const document = bridge?.document;
    preview = createPreviewSession({ scenario: { ...scenario, references: {
      application: { id: document ? `studio.${document.id}` : 'studio.screen', revision: '1' },
      documents: document ? { [document.id]: document.revision } : {},
    } }, dataAdapter: { adapter, context: actor => ({ permissions: actor.permissions, effect: 'write', actor: actor.actorId }) } });
    runtimeValues = {}; resetSignal = Symbol('reset'); activity = [];
  }
  let runtimeRevision='';
  // Fence in-flight simulation before render, retaining only values valid for the new source.
  $effect.pre(()=>{const revision=authoredRevision;if(!revision)return;untrack(()=>{
    if(runtimeRevision&&runtimeRevision!==revision&&source){
      const compatible=compatiblePreviewValues(source,runtimeValues),retained=compatible.values;
      const removed=compatible.removed.length,test=activeTest,denied=simulation.denied,failNext=simulation.failNext;
      resetRuntime();runtimeValues=retained;
      if(!removed){activeTest=test;simulation.denied=denied;simulation.failNext=failNext;}else notice=`${removed} temporary ${removed===1?'value was':'values were'} reset because the document changed. Your saved starting values are unchanged.`;
    }
    runtimeRevision=revision;
  });});
  function openSession(next: EditorBridge) {
    agentEpoch = crypto.randomUUID();
    compositionFocus=undefined;detailId=undefined;structureFocusId=structureId(next.document.id,'node',next.document.root);
    palettePage = 'format'; paletteRequested = false;
    if(bridge)savedSelections.set(bridge.document.id,workspaceSelection);
    unsubscribe?.(); bridge = next; version++;
    const root=nodeItem(next.document,`${next.document.id}|${next.document.root}`)!;
    workspaceSelection=savedSelections.get(next.document.id)??{documentId:next.document.id,items:[root],primary:itemKey(root)};
    unsubscribe = next.subscribe(() => version++);
    plan = undefined; issues = []; resetRuntime();
    next.select(singleOccurrence(workspaceSelection));
    try { localStorage.setItem('vict.studio.active-screen', next.document.id); } catch { /* document save reports storage failures */ }
  }
  function createScreen(title: string) {
    const document = newScreen(title);
    const next = new EditorBridge({ catalogs: designerCatalogs, validateDocument: screenPlacementIssues, store: screenStore(localStorage, document.id), initial: { document, storedRevision: 'r1' } });
    sessions.set(document.id, next);
    library = [...library, { id: document.id, name: title }];
    openSession(next); drawerOpen = false;
    notice = 'New screen · not saved yet.';
  }
  function openScreen(id: string) {
    if (textDraftDirty) { notice = 'Apply or cancel your property edit before switching screens.'; return; }
    if (sourceDraftDirty) { notice = 'Apply or discard your JSON draft before switching screens.'; return; }
    const existing = sessions.get(id);
    if (existing) { openSession(existing); notice = 'Screen opened. In-session edits are retained.'; return; }
    const store = screenStore(localStorage, id);
    const loaded = store.rawLoad();
    if (loaded.status !== 'loaded') { notice = loaded.status === 'invalid' ? loaded.message : 'This screen has not been saved.'; issues = [{ code: 'STUDIO_OPEN_REFUSED', message: notice }]; return; }
    const next = new EditorBridge({ catalogs: designerCatalogs, validateDocument: screenPlacementIssues, store, initial: loaded });
    sessions.set(id, next); openSession(next); notice = 'Loaded the saved screen.';
  }
  onMount(() => {
    try {const sizes=JSON.parse(localStorage.getItem('vict.studio.workspace-sizes') ?? '{}');chatWidth=Math.max(240,Math.min(400,Number(sizes.chat)||280));drawerWidth=Math.max(280,Math.min(460,Number(sizes.document)||320));}catch{/* Optional layout preferences never block document loading. */}
    try {
      library = savedScreens(localStorage);
      const active = localStorage.getItem('vict.studio.active-screen');
      if (active && library.some(item => item.id === active)) openScreen(active);
      else if (library[0]) openScreen(library[0].id);
      else createScreen('Untitled screen');
    } catch { issues = [{ code: 'STUDIO_STORAGE_UNAVAILABLE', message: 'Browser storage is unavailable. Enable storage to author and save screens.' }]; }
    return () => { unsubscribe?.(); };
  });
  function rememberSizes() {try{localStorage.setItem('vict.studio.workspace-sizes',JSON.stringify({chat:chatWidth,document:drawerWidth}));}catch{/* Session dimensions remain usable without storage. */}}
  $effect(()=>{void chatWidth;void drawerWidth;if(bridge)rememberSizes();});
  function receiveAgentProposal(proposal: AgentProposal) {
    if (!bridge) return {ok:false as const,code:"UI_DOC_STALE_REVISION",message:"The screen is no longer open."};
    const result = applyAgentProposal(bridge, proposal, agentEpoch, textDraftDirty || sourceDraftDirty || renamingScreen || !!createDialog?.open);
    if (result.ok) {
      notice = `${proposal.edit.reason} · agent edit · unsaved`; issues = [];
    } else notice = result.message;
    return result;
  }
  function apply(draft: TransactionDraft, fromSource=false): boolean {
    if(sourceDraftDirty && !fromSource){notice="Apply or discard your JSON draft first.";return false;}
    if (textDraftDirty) { notice = 'Apply or cancel your property edit first.'; return false; }
    if (!bridge) return false;
    const result = bridge.apply(draft);
    issues = result.ok ? [] : result.issues;
    if (result.ok) {
      notice = `${draft.reason ?? 'Change applied'} · unsaved`;
    }
    return result.ok;
  }
  function undo() { if (!bridge) return; if (textDraftDirty || sourceDraftDirty) { notice = 'Apply or cancel your draft first.'; return; } const result = bridge.undo(); issues = result.ok ? [] : result.issues; notice = result.ok ? 'Undid the last authored change.' : 'Nothing to undo.'; }
  function redo() { if (!bridge) return; if (textDraftDirty || sourceDraftDirty) { notice = 'Apply or cancel your draft first.'; return; } const result = bridge.redo(); issues = result.ok ? [] : result.issues; notice = result.ok ? 'Redid the authored change.' : 'Nothing to redo.'; }
  function save(): boolean {
    if (textDraftDirty) { notice = 'Apply or cancel your property edit before saving.'; return false; }
    if (sourceDraftDirty) { notice = 'Apply or discard your JSON draft before saving.'; return false; }
    if (!bridge || !compilation?.ok) { notice = 'Resolve source diagnostics before saving.'; return false; }
    const result = bridge.save(); issues = result.ok ? [] : result.issues;
    if (!result.ok) { notice = 'Save refused. Your edits are still in this session.'; return false; }
    const guidance=screenAuthoringGuidance(result.document);
    notice = `Saved ${screenName(result.document)} · revision ${result.storedRevision}${guidance.count?` · ${guidance.count} source guidance notes in Document → Source`:''}`;
    library = library.map(item => item.id === result.document.id ? { id: item.id, name: screenName(result.document) } : item);
    return true;
  }
  function reopen() {
    if (textDraftDirty) { notice = 'Apply or cancel your property edit before reloading.'; return; }
    if (!bridge) return;
    if (sourceDraftDirty) { notice = 'Apply or discard your JSON draft before reloading.'; return; }
    if (snapshot?.dirty) { notice = 'Save or undo your changes before reloading the saved screen.'; return; }
    const result = bridge.reopen();
    if (result.ok) agentEpoch = crypto.randomUUID();
    if (!result.ok) { issues = [{ code: result.code, message: result.message ?? 'Reload failed.' }]; return; }
    compositionFocus=undefined;paletteRequested = false; palettePage = 'format';
    resetRuntime(); const root=nodeItem(bridge.document,`${bridge.document.id}|${bridge.document.root}`);if(root)updateSelection([root]); issues = []; notice = `Reloaded revision ${result.storedRevision}; runtime state reset.`;
  }
  async function dispatch(actionId: string, input?: unknown) {
    if (mode === 'design') return { ok: false, code: 'UI_EDITOR_DESIGN_MODE', message: 'Switch to Interact to run behavior.' };
    if (!compilation?.ok) return { ok: false, code: 'APPLICATION_INVALID', message: 'The application does not compile.' };
    const active = preview;
    const result = await screenDispatcher(compilation.plan, adapter, async (op, value) => {
      const executed = await active.run(op, value);
      return executed.ok ? { ok: true, value: executed.value } : { ok: false, code: executed.code, message: executed.message };
    }).execute(actionId, input);
    if (active === preview) activity = [...activity.slice(-4), `${actionId}: ${result.message ?? (result.ok ? 'Succeeded' : result.code)}`];
    return result;
  }
  function effective(occurrence: string, property: string) {
    const elements = [...globalThis.document.querySelectorAll<HTMLElement>('.design-frame [data-ui-occ]')].filter(element => element.dataset.uiOcc === occurrence);
    const element = elements.find(element => element.hasAttribute('data-ui-primary')) ?? elements.find(element => element.getBoundingClientRect().width > 0);
    return element ? getComputedStyle(element).getPropertyValue(property) : undefined;
  }
  function shortcuts(event: KeyboardEvent) {
    if(event.defaultPrevented)return;
    if(event.key==='Escape' && event.target instanceof Element && event.target.closest('#document-drawer')){event.preventDefault();closeDrawer();return;}
    if (event.key === 'Escape' && detailsOpen && event.target instanceof Element && event.target.closest('.source-details')) {event.preventDefault();closeDetails();return;}
    if(activeMenu) {
      if((event.ctrlKey || event.metaKey) && event.key.toLowerCase()==='s'){event.preventDefault();activeMenu='';void save();}
      return;
    }
    if (event.target instanceof Element && event.target.closest('[role="menu"]')) return;
    if (event.key === 'Escape' && drawerOpen && !detailsOpen && !testingOpen) {
      if (structureOpen && event.target instanceof Element && event.target.closest('.structure-view')) return;
      event.preventDefault(); closeDrawer(); return;
    }
    const editable = event.target instanceof HTMLElement && (event.target.matches('input,textarea,select') || event.target.isContentEditable);
    if (!editable && workspaceView === 'design' && !(event.target instanceof Element && event.target.closest('.structure-workspace,.structure-view,.source-details,#document-drawer,.testing-drawer,.agent-panel,.chat-resizer,.drawer-resizer,.canvas-toolbar'))) {
      if (['Delete', 'Backspace'].includes(event.key)) { event.preventDefault(); removeSelection(); }
      if (event.key === 'F2') { event.preventDefault(); editSelectedText(); }
      if (event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); reorderSelection(event.key === 'ArrowUp' ? -1 : 1); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') { event.preventDefault(); duplicateSelection(); }
    }
    if (!(event.ctrlKey || event.metaKey)) return;
    if (event.key.toLowerCase() === 's') { event.preventDefault(); save(); }
    else if (!editable && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
  }
  function removeSelection() {
    if (!source || !selectedNode || selectedNode.id === source.root) return;
    const parent = compositionParent(source, selectedNode.id);
    if (apply({ requestId: crypto.randomUUID(), reason: 'Delete selection', commands: [{ op: 'remove', nodeId: selectedNode.id, detachFromParent: true }] }) && parent) selectOccurrence(`${source.id}|${parent.nodeId}`);
  }
  function duplicateSelection() {
    if (!source || !selectedNode) return;
    const copy = duplicateSubtree(source, selectedNode.id);
    if (copy && apply(copy.draft)) selectOccurrence(`${source.id}|${copy.nodeId}`);
    else notice = 'Select a source element or container to duplicate.';
  }
  function reorderSelection(delta: number) {
    if (!source || !selectedNode) return;
    const parent = compositionParent(source, selectedNode.id);
    if (!parent) return;
    const index = parent.children.indexOf(selectedNode.id) + delta;
    if (index < 0 || index >= parent.children.length) return;
    apply({ requestId: crypto.randomUUID(), reason: 'Reorder selection', commands: [{ op: 'move', nodeId: selectedNode.id, newParentId: parent.nodeId, slotName: parent.slotName, index }] });
  }
  async function beginCreate() { if (textDraftDirty || sourceDraftDirty) { notice = 'Apply or cancel your text/source draft before creating a screen.'; return; } createDialog.showModal(); await tick(); nameInput.focus(); nameInput.select(); }
  function exportSource() {
    if (!source) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify({ application: screenApplication(source), uiDocuments: [{ document: source }] }, null, 2)], { type: 'application/json' }));
    const anchor = globalThis.document.createElement('a'); anchor.href = url; anchor.download = `${source.id}.json`; anchor.click(); URL.revokeObjectURL(url);
  }
  function applySource() {
    if (!source || !bridge) return;
    if (bridge.getSnapshot().revision !== sourceDraftRevision) { issues = [{ code: 'UI_DOC_STALE_REVISION', message: 'The visual source changed after this draft began. Discard the JSON draft and retry against the current source.' }]; return; }
    try {
      const document = JSON.parse(sourceDraft) as UiDocument;
      const problems = screenIssues(document);
      if (problems.length) { issues = problems; return; }
      if (apply({ requestId: crypto.randomUUID(), reason: 'Apply canonical source', commands: [{ op: 'replaceDocument', document }] },true)) { sourceDraftDirty = false; compositionFocus=undefined; const root=nodeItem(source,`${source.id}|${source.root}`);if(root)updateSelection([root]); }
    } catch { issues = [{ code: 'STUDIO_JSON_INVALID', message: 'Enter valid canonical UI document JSON.' }]; }
  }
</script>

<svelte:window onkeydowncapture={event=>{
  if(event.key==='Escape'&&!structureOpen&&!activeMenu&&event.target instanceof Element&&event.target.closest('.design-frame .uv-canvas,[role=tree]')&&!event.target.closest('input,textarea,[contenteditable=true]')&&workspaceSelection.items.length&&!textDraftDirty&&!sourceDraftDirty){event.preventDefault();event.stopPropagation();clearWorkspaceSelection();return;}
  if(!structureOpen || activeMenu || !(event.target instanceof Element) || event.target.closest('[role="menu"]'))return;
  // Canvas tools are portaled and retained, but their global shortcuts must not
  // claim keyboard interaction from the active Structure work surface.
  if(event.key==='F10' && !event.shiftKey){event.preventDefault();event.stopPropagation();}
  if(event.key==='Escape' && event.target.closest('.agent-panel'))event.preventDefault();
  if(event.key==='Escape' && event.target.closest('.canvas-modes')){event.preventDefault();event.stopPropagation();dismissStructure();}
}} onkeydown={shortcuts} onbeforeunload={event => { if (textDraftDirty || sourceDraftDirty || [...sessions.values()].some(session => session.getSnapshot().dirty)) { event.preventDefault(); event.returnValue = ''; } }} />
<ControlScope class="vict-rhea">
<div class="vict-app studio-designer studio-workspace" data-workspace-view={workspaceView}>
  <header data-studio-typography class="studio-type-scope design-toolbar workspace-header">
    <WorkspaceBrand />
    <Menubar.Root class="studio-menus workspace-menus" aria-label="Studio menus" bind:value={activeMenu} loop>
      <WorkspaceMenu label="File" value="file" {activeMenu} bind:trigger={renameButton}>
        <Menubar.Item disabled={textDraftDirty || sourceDraftDirty} onSelect={()=>void beginCreate()}>New screen</Menubar.Item>
        <Menubar.Sub>
          <Menubar.SubTrigger disabled={!library.length || textDraftDirty || sourceDraftDirty}>Open screen<span aria-hidden="true">›</span></Menubar.SubTrigger>
          <Menubar.Portal><Menubar.SubContent aria-label="Open screen" data-studio-typography class="studio-type-scope workspace-menu open-screen-menu" align="start" alignOffset={-5} sideOffset={2} collisionPadding={8}>
            <Menubar.RadioGroup value={source?.id ?? ''}>
              {#each library as item (item.id)}<Menubar.RadioItem value={item.id} closeOnSelect onSelect={()=>openScreen(item.id)}><span class="screen-menu-name" title={item.name}>{item.name}</span><span aria-hidden="true">{source?.id===item.id?'\u2713':''}</span></Menubar.RadioItem>{/each}
            </Menubar.RadioGroup>
          </Menubar.SubContent></Menubar.Portal>
        </Menubar.Sub>
        <Menubar.Item disabled={!source || textDraftDirty || sourceDraftDirty} onSelect={()=>void beginRename()}>Rename screen</Menubar.Item>
        <Menubar.Separator />
        <Menubar.Item aria-label="Save" disabled={!compilation?.ok || sourceDraftDirty || textDraftDirty} onSelect={()=>void save()}>Save <kbd>Ctrl+S</kbd></Menubar.Item>
        <Menubar.Item title="Reload the saved screen and reset the preview" disabled={!source || snapshot?.dirty || sourceDraftDirty || textDraftDirty || snapshot?.storedRevision === 'r1'} onSelect={()=>void reopen()}>Reload saved version</Menubar.Item>
      </WorkspaceMenu>
      <WorkspaceMenu label="Edit" value="edit" {activeMenu}>
        <Menubar.Item title="Undo · Ctrl+Z" aria-label="Undo" disabled={!snapshot?.canUndo} onSelect={undo}>Undo <kbd>Ctrl+Z</kbd></Menubar.Item>
        <Menubar.Item aria-label="Redo" disabled={!snapshot?.canRedo} onSelect={redo}>Redo <kbd>Ctrl+Shift+Z</kbd></Menubar.Item>
      </WorkspaceMenu>
      <WorkspaceMenu label="View" value="view" {activeMenu} bind:trigger={viewButton}>
        <Menubar.CheckboxItem aria-label="Chat" checked={chatOpen} onSelect={() => void toggleChat()}>Chat<span aria-hidden="true">{chatOpen?'✓':''}</span></Menubar.CheckboxItem>
        <Menubar.CheckboxItem aria-label="Document" checked={drawerOpen && !testingOpen} onSelect={() => void toggleDocument()}>Document<span aria-hidden="true">{drawerOpen && !testingOpen?'✓':''}</span></Menubar.CheckboxItem>
        <Menubar.Separator />
        <Menubar.RadioGroup bind:value={width} aria-label="Canvas size">
          {#each [{value:'fluid',label:'Fit canvas'},{value:'768',label:'Tablet · 768'},{value:'390',label:'Phone · 390'}] as option}<Menubar.RadioItem value={option.value} closeOnSelect>{option.label}<span aria-hidden="true">{width===option.value?'\u2713':''}</span></Menubar.RadioItem>{/each}
        </Menubar.RadioGroup>
      </WorkspaceMenu>
      <WorkspaceMenu label="Preview" value="preview" {activeMenu}>
        <Menubar.Item disabled={!source || textDraftDirty || sourceDraftDirty || renamingScreen} onSelect={()=>void openTesting()}>Try scenarios…</Menubar.Item>
        <Menubar.Item disabled={!source || snapshot?.dirty || sourceDraftDirty || textDraftDirty || snapshot?.storedRevision==='r1'} onSelect={()=>{if(source && !snapshot?.dirty && !sourceDraftDirty && !textDraftDirty && snapshot?.storedRevision!=='r1')location.href=`/run-screen?screen=${encodeURIComponent(source.id)}${canvasWidth>0?`&width=${canvasWidth}`:''}`;}}>Run saved<span aria-hidden="true">↗</span></Menubar.Item>
        <Menubar.Item onSelect={resetRuntime}>Reset test</Menubar.Item>
      </WorkspaceMenu>
    </Menubar.Root>
    <div class="screen-picker">{#if renamingScreen}<input class="screen-name-edit" aria-label="Screen name" bind:this={screenNameInput} bind:value={screenNameDraft} maxlength="80" onkeydown={renameKey} onblur={finishRename} />{:else}<span class="current-screen" title={source?screenName(source):'No screen'}>{source?screenName(source):'No screen'}</span>{/if}</div>
    <span class="save-state">{textDraftDirty ? '● Unapplied property draft' : sourceDraftDirty ? '● Unapplied JSON draft' : snapshot?.dirty ? '● Unsaved changes' : snapshot?.storedRevision === 'r1' ? '○ New screen' : '✓ Saved'}</span>
    <a class="operator-link" href="/" aria-label="Operator tools" title="Operator tools">↗</a>
  </header>
  {#if source && bridge}
  {#snippet floatingTools()}
    <div data-studio-typography class="studio-type-scope">
    <SelectionPalette revealSignal={selectionToolsReveal} locked={textDraftDirty || sourceDraftDirty} onOpenComposition={selectedSlots.length && selectedNode?.id!==compositionFocus?.nodeId ? ()=>openComposition() : undefined} bind:page={palettePage} name={compositionName(source, selectedNode?.id ?? source.root)} focusSignal={paletteFocus}>
      {#snippet objectProperties(section: 'Content' | 'Style' | 'Behavior')}
        <fieldset class="editor-guard" disabled={sourceDraftDirty || dataDraftDirty}><Inspector contextual editTextSignal={section === 'Behavior' ? undefined : editTextSignal} onTextDraftChange={(dirty: boolean) => propertyDraftDirty = dirty} {section} document={source} selectedOccurrence={selected} onApply={apply} lastIssues={issues} componentDescriptors={catalogDescriptors} knownActionIds={designerCatalogs.actionIds} {actionInputs} knownRouteIds={['screen']} labels={editorLabels} styleConditions={[{ id: 'compact', label: 'Compact · ≤600px' }]} readEffective={effective} /></fieldset>
      {/snippet}
      {#snippet format()}{@render objectProperties(formatSection)}{/snippet}
      {#snippet connect()}{@render objectProperties('Behavior')}{/snippet}
      {#snippet insert()}<Composer {compositionFocus} document={source} selectedNodeId={selectedNode?.id} recipes={screenRecipes} descriptors={catalogDescriptors} compact showArrange={false} onApply={apply} onInserted={(id: string) => { selectOccurrence(`${source.id}|${id}`); notice = 'Added to your screen. Double-click text to edit.'; }} />{/snippet}
      {#snippet arrange()}<Composer document={source} selectedNodeId={selectedNode?.id} recipes={screenRecipes} descriptors={catalogDescriptors} compact showInsert={false} onApply={apply} onDuplicate={duplicateSelection} onDetached={(parentId: string)=>{selectOccurrence(`${source.id}|${parentId}`);notice='Content kept aside. Use Insert → Reuse to place it again.';}} />{#if !selectedNode || selectedNode.id === source.root}<p class="palette-hint">Select an element to move, duplicate or delete it.</p>{/if}{/snippet}
    </SelectionPalette>
    </div>
  {/snippet}
  <div class="agent-workspace" class:chat-open={chatOpen} bind:clientWidth={availableWidth}>
  <div data-studio-typography class="studio-type-scope agent-panel" hidden={!chatOpen} style:--chat-width={`${chatWidth}px`}><header class="panel-header chat-heading"><strong>Chat</strong><button type="button" aria-label="Hide chat" title="Hide chat" onclick={()=>void toggleChat()}>×</button></header><AgentChat screenLabel={screenName(source)} selectionLabel={selectionLabel} blocked={textDraftDirty || sourceDraftDirty || renamingScreen} getContext={() => bridge ? {document:bridge.document, cursor:documentCursor(bridge.document,bridge.getSnapshot().revision,agentEpoch), ...(selected ? {selection:selected} : {}),selectionSet:selectionSet(workspaceSelection)} : undefined} getCapture={cursor => captureDesignerPreview(canvasScroll?.querySelector<HTMLElement>('.design-frame') ?? undefined,cursor,()=>bridge ? {cursor:documentCursor(bridge.document,bridge.getSnapshot().revision,agentEpoch),mode,state:{runtimeValues,simulation:{denied:simulation.denied,failNext:simulation.failNext}},selection:selected,composition:compositionFocus ? `${compositionFocus.nodeId}/${compositionFocus.slotName}` : undefined,structureOpen} : undefined,canvasScroll)} applyProposal={receiveAgentProposal} /></div>
  <div class="chat-resizer" hidden={!chatOpen}><PanelResizer label="Chat width" value={chatWidth} min={240} max={400} onChange={(value:number)=>chatWidth=value} /></div>
  <div class="design-workspace" bind:this={workspaceElement} bind:clientWidth={workspaceWidth} class:drawer-open={rightOpen} class:has-object-tools={mode === 'design' && !!selectedNode && paletteRequested} style:--drawer-width={`${effectiveDrawerWidth}px`}>
    <WorkspaceContextMenu scope={workspaceElement} enabled={workspaceView === 'design'} resolve={canvasContext} owns={ownsCanvasTarget} />
    <main class="design-stage">
      <div data-studio-typography class="studio-type-scope canvas-toolbar workspace-tools"><WorkspaceModes view={workspaceView} onChange={changeView} leftOpen={chatOpen} rightOpen={drawerOpen && !testingOpen} onToggleLeft={()=>void toggleChat()} onToggleRight={()=>void toggleDocument()}/>{#if compositionFocus && !structureOpen}<div class="composition-back"><CompositionNavigator compact document={source} focus={compositionFocus} descriptors={catalogDescriptors} disabled={textDraftDirty || sourceDraftDirty} onNavigate={navigateComposition} /></div>{/if}{#if activeTest && !structureOpen}<div class="canvas-test-tools"><button type="button" class="test-indicator" aria-label={`Testing: ${activeTest.label}`} onclick={()=>void openTesting()}>Testing: {activeTest.label}</button><button type="button" title="Return to starting values and clear simulated failures" onclick={resetRuntime}>Reset test</button></div>{/if}</div>


      <div class="canvas-scroll workspace-scroll" hidden={structureOpen} inert={structureOpen} bind:this={canvasScroll}>
        <div class="design-frame workspace-screen" bind:clientWidth={canvasWidth} style:max-width={width === 'fluid' ? 'none' : `${width}px`}>
          <EditorCanvas document={source} catalogs={designerCatalogs} extensions={catalogDescriptors} extensionImplementations={catalogImplementations}
            {compositionFocus} onOpenComposition={openComposition}
            selectionTools={selectedNode && paletteRequested ? floatingTools : undefined}
            {selectionToolsReveal} selectionToolsPinned={textDraftDirty}
            selectionToolsPlacement="below"
            onEditTextRequest={editSelectedText}
            onOccurrencesChange={(id:string,occurrences:readonly string[])=>{if(id===source?.id){renderedDocument=id;renderedOccurrences=occurrences;}}}
            textSelectionContainerHighlight selectionHighlightSignal={workspaceView} interactionMode={mode} selectedOccurrences={mode==='design'?selectedOccurrences:[]} onSelectionIntent={canvasSelection} onClearSelection={clearWorkspaceSelection} selectedOccurrence={mode === 'design' ? selected : undefined} onSelect={mode === 'design' ? selectOccurrence : () => {}} {dispatch} navigate={() => { notice = 'This application contains one screen.'; }}
            stateValues={runtimeValues} onStateChange={(key: string, value: UiValue) => runtimeValues = { ...runtimeValues, [key]: value }} {resetSignal}
            actionState={screenActionState} onPlan={(next: UiRenderPlan) => { plan = next; }}
            onRenderDiagnostic={(diagnostic: { code: string; message: string }) => { issues = [...issues.slice(-4), diagnostic]; }} ariaLabel="Screen canvas" />
          {#if compositionFocus && !focusedMembers?.size}<div class="empty-composition"><h2>This composition is empty</h2><p>Select the composition, then choose Insert in its tools.</p></div>{:else if Object.keys(source.nodes).length === 1}<div class="empty-canvas"><span>＋</span><h1>What will you make?</h1><p>Select this screen to open its tools, then choose Insert.</p></div>{/if}
        </div>
      </div>
      <section class="structure-workspace" aria-label="Structure workspace" hidden={!structureOpen} inert={!structureOpen}>
        <StructureView selection={workspaceSelection} onSelectionIntent={updateSelection} context={structureContext} focusSelection={structureFocusId} presentation="drawer" active={structureOpen} document={source} revision={snapshot?.revision ?? ''} selectedNodeId={selectedNode?.id} descriptors={catalogDescriptors} recipes={screenRecipes} blocked={textDraftDirty || sourceDraftDirty || renamingScreen} onSelect={(occurrence:string)=>selectStructureNode(occurrence,true)} onDeselect={clearWorkspaceSelection} onMove={moveFromStructure} onNotice={message => notice = message} onNavigate={structureNavigate} onDismiss={dismissStructure} onInspect={inspectSource} onCloseInspect={closeDetails} inspectionSelection={detailId} inspectionExpanded={detailsOpen} inspectionLabel="Selection" objectCommands={occurrence=>objectContext(occurrence,false)?.commands ?? []} />
      </section>
    </main>
    <div class="drawer-resizer" hidden={!rightOpen}><PanelResizer label="Document drawer width" value={effectiveDrawerWidth} min={280} max={460} reverse onChange={(value: number) => drawerWidth = value} /></div>
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <aside id="document-drawer" hidden={!drawerOpen || testingOpen} data-studio-typography class="studio-type-scope document-drawer" aria-label="Document and Selection" onkeydown={documentKeys}>
      <WorkspaceDetails bind:context={drawerContext} onClose={closeDrawer}>
      {#snippet documentContent()}<DocumentPanels bind:active={documentPanel}>
        {#snippet layersContent()}{#if plan}<Layers scope={{state:runtimeValues,tokens:Object.fromEntries(Object.entries(source.tokens).map(([key,value])=>[key,value.value]))}} {selectedSourceIds} selectedOccurrences={selectedOccurrences} onSelectionIntent={layerSelection} compact hideTextContent showSelectionDetails={false} labels={editorLabels} {plan} document={source} selectedOccurrence={selected} onSelect={selectFromStructure} onInspect={(occurrence:string,nodeId:string,detail:string,sourceOnly?:boolean)=>{if(textDraftDirty || sourceDraftDirty || renamingScreen)return;if(sourceOnly){updateSelection([{kind:'node',id:structureId(source.id,'node',nodeId)}]);}else{selectFromStructure(occurrence);layerProvenance={occurrence,detail};}inspectSource(structureId(source.id,'node',nodeId));}} onOpenComposition={navigateComposition} componentDescriptors={catalogDescriptors} />{/if}{/snippet}
        {#snippet dataContent()}
          {#if selectedData && source.localState[selectedData]}
            {#key selectedData}<fieldset class="editor-guard" disabled={sourceDraftDirty || propertyDraftDirty}><StateInitialEditor compact document={source} expression={{type:'ref',path:`state.${selectedData}`}} labels={editorLabels} onApply={apply} onDirtyChange={(dirty:boolean)=>dataDraftDirty=dirty}>{#snippet toolbar({apply:applyValue,dirty}:{apply:()=>void;dirty:boolean})}<DataEditorHeader name={dataName(selectedData!)} type={dataType(source.localState[selectedData!]!.type)} {dirty} onBack={()=>openData()} onApply={applyValue} />{/snippet}</StateInitialEditor></fieldset>{/key}
          {:else}
            <div class="section-heading"><h2>Screen data</h2><span>Saved starting values</span></div>
            <div class="data-list">{#each Object.entries(source.localState) as [key,declaration] (key)}<button type="button" class="data-row" disabled={sourceDraftDirty || propertyDraftDirty} onclick={()=>openData(key)}><span><strong>{dataName(key)}</strong><small>{dataType(declaration.type)}</small></span><span class="data-preview">{dataPreview(declaration.initial)}</span><span aria-hidden="true">›</span></button>{/each}</div>
            {#if !Object.keys(source.localState).length}<p class="panel-hint">This screen has no saved data.</p>{/if}
          {/if}
        {/snippet}
        {#snippet actionsContent()}
          <div class="section-heading"><h2>Available actions</h2><span>Connect them from an object's tools</span></div>
          {#each designerCatalogs.actionIds as id}<section class="action-card"><div><h3>{(editorLabels.actions[id as keyof typeof editorLabels.actions] ?? id).replace(' (simulated)','')}</h3><span class="simulation-badge" title="Local preview only; no live effects">Simulated</span></div><p>Uses</p><div class="action-inputs">{#each Object.keys(actionInputs[id] ?? {}) as key}<span>{editorLabels.actionInputs[key as keyof typeof editorLabels.actionInputs] ?? key}</span>{:else}<span>No inputs</span>{/each}</div></section>{/each}
        {/snippet}
        {#snippet sourceContent()}
          <AuthoringGuidance document={source} />
          <label class="sr-only" for="canonical-source">Canonical UI document</label><textarea id="canonical-source" class="source-editor" disabled={textDraftDirty} wrap="off" spellcheck="false" bind:value={sourceDraft} oninput={() => sourceDraftDirty = true}></textarea>
          <div class="source-actions"><button type="button" disabled={!sourceDraftDirty || textDraftDirty} onclick={applySource}>Apply source</button><button type="button" disabled={!sourceDraftDirty} onclick={() => { sourceDraftDirty = false; sourceDraft = JSON.stringify(source, null, 2); sourceDraftRevision = snapshot?.revision ?? ''; issues = []; }}>Discard draft</button><button type="button" onclick={exportSource}>Export</button></div>
          <details class="studio-disclosure application-attachment"><summary>Document information</summary><p>Saved revision <code>{snapshot?.storedRevision}</code></p><p>Application version <code>{compilation?.ok?compilation.plan.applicationVersion:'Compilation pending'}</code></p><h3>Generated application definition</h3><p>Generated by Studio to connect this screen to VICT.</p><pre class="source-preview">{JSON.stringify(screenApplication(source), null, 2)}</pre></details>
        {/snippet}
      </DocumentPanels>{/snippet}
      {#snippet selectionContent()}<WorkspaceSelectionDetails onSelectionIntent={selectRelated} renderedOccurrences={currentOccurrences} selection={workspaceSelection} onInspect={item=>updateSelection([item])} onRemove={item=>updateSelection([item],'toggle')} context={structureContext} document={source} {layerProvenance} blocked={textDraftDirty || sourceDraftDirty || renamingScreen} bind:page={detailsPage} onClose={()=>{if(workspaceSelection.items.length)clearWorkspaceSelection();else closeDetails();}} onSelect={selectDetail} onNavigate={structureNavigate} />{/snippet}
      </WorkspaceDetails>
    </aside>
    {#if testingOpen}<aside class="testing-drawer" aria-label="Testing"><TryScenarios document={source} active={activeTest?.id} values={runtimeValues} {activity} blocked={textDraftDirty || sourceDraftDirty || renamingScreen} onChoose={chooseTest} onReset={resetRuntime} onTry={()=>void tryCanvas()} onClose={closeTesting} onChange={changeTestValue} /></aside>{/if}
  </div>
  </div>
  {/if}
  <footer data-studio-typography class="studio-type-scope design-status workspace-status"><span role="status">{notice}</span></footer>
  {#if issues.length}<div class="design-errors" role="alert">{#each issues as issue}<p>{issue.code}: {issue.message}</p>{/each}</div>{/if}
  {#if compilation && !compilation.ok}<div class="design-errors" role="alert">{#each [...compilation.issues, ...(compilation.uiIssues ?? [])] as issue}<p>{issue.code}: {issue.message}</p>{/each}</div>{/if}
  <dialog data-studio-typography class="studio-type-scope create-screen-dialog" bind:this={createDialog} onclose={() => renameButton?.focus()}><form onsubmit={event => { event.preventDefault(); if (!screenTitle.trim()) return; createScreen(screenTitle.trim()); createDialog.close(); }}><p class="panel-eyebrow">A BLANK CANVAS</p><h2>Create a screen</h2><p>Start small. Add content, connect behavior, and run what you save.</p><label>Screen name<input bind:this={nameInput} bind:value={screenTitle} maxlength="80" required /></label><div><button type="button" onclick={() => createDialog.close()}>Cancel</button><button class="primary" type="submit">Create screen</button></div></form></dialog>
</div>
</ControlScope>
