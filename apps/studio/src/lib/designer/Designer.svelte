<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import { beforeNavigate } from '$app/navigation';
  import { ControlScope } from '@victframework/ui-svelte';
  import { Composer, EditorBridge, EditorCanvas, Inspector, Layers, StateValuesPanel, PanelResizer, StateInitialEditor, SelectionPalette, setAttribute, resolveOccurrence, compositionParent, compositionName, literalTextTarget, duplicateSubtree, type TransactionDraft } from '@victframework/ui-editor';
  import { createPreviewSession } from '@victframework/ui-preview';
  import { CompositionNavigator, authoredOccurrence, compositionSlots, compositionMembers, compositionTrail, firstCompositionSlot, type CompositionFocus } from '@victframework/ui-editor';
  import type { UiDocument, UiRenderPlan, UiValue } from '@victframework/ui';
  import { newScreen, compileScreen, screenIssues, screenApplication, screenName, screenActionState, designerCatalogs, actionInputs, catalogDescriptors, catalogImplementations } from './application.js';
  import { screenStore, savedScreens } from './storage.js';
  import { screenRecipes } from './recipes.js';
  import { createScreenSimulation, screenDispatcher } from './execution.js';
  import { Menubar } from '@victframework/ui-svelte/catalog/menubar';
  import WorkspaceMenu from './WorkspaceMenu.svelte';
  import WorkspaceBrand from './WorkspaceBrand.svelte';
  import '@victframework/ui-svelte/styles.css';
  import '@victframework/ui-svelte/catalog.css';
  import './workspace.css';
  import './designer.css';

  let bridge = $state<EditorBridge>();
  let version = $state(0);
  let library = $state<{ id: string; name: string }[]>([]);
  const sessions = new Map<string, EditorBridge>();
  let unsubscribe: (() => void) | undefined;
  const snapshot = $derived.by(() => { void version; return bridge?.getSnapshot(); });
  const authoredRevision = $derived(snapshot?.revision);
  const source = $derived.by(() => { void version; return bridge?.document; });
  const compilation = $derived(source ? compileScreen(source) : undefined);
  const selected = $derived(snapshot?.selectedOccurrence);
  const selectedNode = $derived(source && selected ? resolveOccurrence(selected, source).node : undefined);
  let compositionFocus=$state<CompositionFocus>();
  let canvasScroll=$state<HTMLDivElement>();
  const selectedSlots=$derived(source && selectedNode?compositionSlots(source,selectedNode.id,catalogDescriptors):[]);
  const focusedMembers=$derived(source && compositionFocus?compositionMembers(source,compositionFocus):undefined);
  $effect(()=>{if(source && compositionFocus && !compositionSlots(source,compositionFocus.nodeId,catalogDescriptors).includes(compositionFocus.slotName)) {compositionFocus=undefined;notice='Composition is no longer available. Returned to the screen.';}});
  async function navigateComposition(next:CompositionFocus|undefined) {
    if(!source || textDraftDirty || sourceDraftDirty){notice='Apply or cancel your property or source edit before changing composition.';return;}
    if(next && !compositionSlots(source,next.nodeId,catalogDescriptors).includes(next.slotName))return;
    const previous=compositionFocus;
    compositionFocus=next;
    const nodeId=next?.nodeId ?? (previous?compositionTrail(source,previous)[0]?.nodeId:undefined) ?? source.root;
    bridge?.select(authoredOccurrence(source,nodeId) ?? `${source.id}|${source.root}`);
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
    if(source && !textDraftDirty && !sourceDraftDirty){
      const report=resolveOccurrence(occurrence,source);
      if(!report.repeatKeys.length && !report.instancePath.some(step=>source.componentDefinitions[step.definitionId])){
        const nearest=compositionTrail(source,{nodeId:report.sourceNodeId,slotName:''}).at(-2);
        if(nearest && compositionSlots(source,nearest.nodeId,catalogDescriptors).includes(nearest.slotName))compositionFocus=nearest;
      }
    }
    selectOccurrence(occurrence, false);

  }
  let plan = $state<UiRenderPlan>();
  let issues = $state<readonly { code: string; message: string }[]>([]);
  let notice = $state('Start with an empty screen. Add a heading or section to begin.');
  let drawerTab = $state('Layers');
  let formatSection = $state<'Content' | 'Style' | 'Behavior'>('Style');
  let editTextSignal = $state<symbol>();
  let selectionToolsReveal = $state<symbol>();
  let propertyDraftDirty = $state(false);
  let dataDraftDirty = $state(false);
  const textDraftDirty = $derived(propertyDraftDirty || dataDraftDirty);
  let selectedData = $state<string>();
  const dataName = (key:string) => editorLabels.state[key as keyof typeof editorLabels.state] ?? key;
  const dataType = (type:string) => ({string:'Text',boolean:'Yes / No',number:'Number',stringList:'Text list',numberList:'Number list'}[type] ?? type);
  function dataPreview(value:unknown) {return Array.isArray(value) ? `${value.length} items` : typeof value==='boolean' ? value?'Yes':'No' : value === '' ? 'Empty' : String(value);}
  function changeDocumentTab(tab:string) {if(dataDraftDirty || sourceDraftDirty) {notice='Apply or cancel your draft first.';return;} drawerTab=tab;selectedData=undefined;}
  function openData(key?:string) {if(dataDraftDirty) {notice='Apply or cancel your draft first.';return;} selectedData=key;}
  async function toggleDocument() {if(drawerOpen)closeDrawer();else {if(textDraftDirty){notice='Apply or cancel your edit first.';return;} drawerOpen=true;await tick();globalThis.document.querySelector<HTMLButtonElement>('.sidebar-tabs button[aria-pressed=true]')?.focus();}}

  let palettePage = $state<'format' | 'insert' | 'arrange' | 'connect'>('format');
  let paletteRequested = $state(false);
  let paletteFocus = $state<symbol>();
  let width = $state('fluid');
  let canvasWidth=$state(0);
  let mode = $state<'design' | 'interact'>('design');
  let drawerOpen = $state(false);
  let drawerWidth = $state(320);
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
  let documentButton=$state<HTMLButtonElement>();
  function closeDrawer() { if(dataDraftDirty || sourceDraftDirty) {notice='Apply or cancel your draft before closing Document.';return;} drawerOpen = false; documentButton?.focus(); }
  const editorLabels = { actions: { 'demo.submit': 'Submit (simulated)' }, nodes: { screen: 'Screen' },
    state: { message: 'Message', accepted: 'Agreement', dialogOpen: 'Dialog open', busy: 'Submitting', actionError: 'Action error', actionResult: 'Action result' },
    actionInputs: { message: 'Message', accepted: 'Agreement' } };
  function selectOccurrence(occurrence: string, revealTools = true) {
    if (textDraftDirty || (drawerOpen && sourceDraftDirty)) { notice = 'Apply or cancel your edit first.'; return; }
    if(drawerTab!=='Layers') drawerOpen=false;
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
    bridge?.select(occurrence);
    palettePage = 'format'; paletteRequested = revealTools;
    formatSection = reportSection(occurrence);
    if (revealTools && matchMedia('(max-width: 760px)').matches) drawerOpen = false;
    if(revealTools) selectionToolsReveal = Symbol('selection-tools');
  }
  function editSelectedText(occurrence = selected) {
    if (!occurrence || !source || textDraftDirty) return;
    const report = resolveOccurrence(occurrence, source);
    if (report.instancePath.some(step=>source.componentDefinitions[step.definitionId]) || report.repeatKeys.length || !literalTextTarget(source, report.sourceNodeId)) return;
    selectOccurrence(occurrence);
    editTextSignal = Symbol('edit');
  }
  function reportSection(occurrence: string): 'Content' | 'Style' {
    const node = source && resolveOccurrence(occurrence, source).node;
    return node?.kind === 'component' || (node?.kind === 'element' && ['input', 'textarea'].includes(node.tag)) ? 'Content' : 'Style';
  }
  function changeMode(next: 'design' | 'interact') { if (textDraftDirty) { notice = 'Apply or cancel your property edit first.'; return; } compositionFocus=undefined;mode = next; resetRuntime(); notice = next === 'design' ? 'Design mode · select and edit without running behavior.' : 'Interact mode · simulated behavior, no live effects.'; }
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
    adapter.reset(); preview.reset();
    const document = bridge?.document;
    preview = createPreviewSession({ scenario: { ...scenario, references: {
      application: { id: document ? `studio.${document.id}` : 'studio.screen', revision: '1' },
      documents: document ? { [document.id]: document.revision } : {},
    } }, dataAdapter: { adapter, context: actor => ({ permissions: actor.permissions, effect: 'write', actor: actor.actorId }) } });
    runtimeValues = {}; resetSignal = Symbol('reset'); activity = [];
  }
  function openSession(next: EditorBridge) {
    compositionFocus=undefined;
    palettePage = 'format'; paletteRequested = false;
    unsubscribe?.(); bridge = next; version++;
    unsubscribe = next.subscribe(() => version++);
    plan = undefined; issues = []; resetRuntime();
    next.select(`${next.document.id}|${next.document.root}`);
    try { localStorage.setItem('vict.studio.active-screen', next.document.id); } catch { /* document save reports storage failures */ }
  }
  function createScreen(title: string) {
    const document = newScreen(title);
    const next = new EditorBridge({ catalogs: designerCatalogs, store: screenStore(localStorage, document.id), initial: { document, storedRevision: 'r1' } });
    sessions.set(document.id, next);
    library = [...library, { id: document.id, name: title }];
    openSession(next); drawerTab = 'Layers'; drawerOpen = false;
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
    const next = new EditorBridge({ catalogs: designerCatalogs, store, initial: loaded });
    sessions.set(id, next); openSession(next); notice = 'Loaded the saved screen.';
  }
  onMount(() => {
    try {
      library = savedScreens(localStorage);
      const active = localStorage.getItem('vict.studio.active-screen');
      if (active && library.some(item => item.id === active)) openScreen(active);
      else if (library[0]) openScreen(library[0].id);
      else createScreen('Untitled screen');
    } catch { issues = [{ code: 'STUDIO_STORAGE_UNAVAILABLE', message: 'Browser storage is unavailable. Enable storage to author and save screens.' }]; }
    return () => { unsubscribe?.(); };
  });
  function apply(draft: TransactionDraft): boolean {
    if (textDraftDirty) { notice = 'Apply or cancel your property edit first.'; return false; }
    if (!bridge) return false;
    const result = bridge.apply(draft);
    issues = result.ok ? [] : result.issues;
    if (result.ok) {
      notice = `${draft.reason ?? 'Change applied'} · unsaved`;
      if (selected && !resolveOccurrence(selected, bridge.document).node) bridge.select(`${bridge.document.id}|${bridge.document.root}`);
    }
    return result.ok;
  }
  function undo() { if (!bridge) return; if (textDraftDirty) { notice = 'Apply or cancel your property edit first.'; return; } const result = bridge.undo(); issues = result.ok ? [] : result.issues; notice = result.ok ? 'Undid the last authored change.' : 'Nothing to undo.'; }
  function redo() { if (!bridge) return; if (textDraftDirty) { notice = 'Apply or cancel your property edit first.'; return; } const result = bridge.redo(); issues = result.ok ? [] : result.issues; notice = result.ok ? 'Redid the authored change.' : 'Nothing to redo.'; }
  function save(): boolean {
    if (textDraftDirty) { notice = 'Apply or cancel your property edit before saving.'; return false; }
    if (sourceDraftDirty) { notice = 'Apply or discard your JSON draft before saving.'; return false; }
    if (!bridge || !compilation?.ok) { notice = 'Resolve source diagnostics before saving.'; return false; }
    const result = bridge.save(); issues = result.ok ? [] : result.issues;
    if (!result.ok) { notice = 'Save refused. Your edits are still in this session.'; return false; }
    notice = `Saved ${screenName(result.document)} · revision ${result.storedRevision}`;
    library = library.map(item => item.id === result.document.id ? { id: item.id, name: screenName(result.document) } : item);
    return true;
  }
  function reopen() {
    if (textDraftDirty) { notice = 'Apply or cancel your property edit before reloading.'; return; }
    if (!bridge) return;
    if (sourceDraftDirty) { notice = 'Apply or discard your JSON draft before reloading.'; return; }
    if (snapshot?.dirty) { notice = 'Save or undo your changes before reloading the saved screen.'; return; }
    const result = bridge.reopen();
    if (!result.ok) { issues = [{ code: result.code, message: result.message ?? 'Reload failed.' }]; return; }
    compositionFocus=undefined;paletteRequested = false; palettePage = 'format';
    resetRuntime(); bridge.select(`${bridge.document.id}|${bridge.document.root}`); issues = []; notice = `Reloaded revision ${result.storedRevision}; runtime state reset.`;
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
    if(activeMenu) {
      if((event.ctrlKey || event.metaKey) && event.key.toLowerCase()==='s'){event.preventDefault();activeMenu='';void save();}
      return;
    }
    if (event.key === 'Escape' && drawerOpen) { event.preventDefault(); closeDrawer(); return; }
    const editable = event.target instanceof HTMLElement && (event.target.matches('input,textarea,select') || event.target.isContentEditable);
    if (!editable && mode === 'design') {
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
      if (apply({ requestId: crypto.randomUUID(), reason: 'Apply canonical source', commands: [{ op: 'replaceDocument', document }] })) { sourceDraftDirty = false; compositionFocus=undefined; bridge.select(`${source.id}|${source.root}`); }
    } catch { issues = [{ code: 'STUDIO_JSON_INVALID', message: 'Enter valid canonical UI document JSON.' }]; }
  }
  // Authored revisions invalidate any in-flight simulation without adding history.
  $effect.pre(() => { if (authoredRevision) untrack(resetRuntime); });
</script>

<svelte:window onkeydown={shortcuts} onbeforeunload={event => { if (textDraftDirty || sourceDraftDirty || [...sessions.values()].some(session => session.getSnapshot().dirty)) { event.preventDefault(); event.returnValue = ''; } }} />
<ControlScope>
<div class="vict-app studio-designer studio-workspace">
  <header class="design-toolbar workspace-header">
    <WorkspaceBrand />
    <Menubar.Root class="studio-menus workspace-menus" aria-label="Studio menus" bind:value={activeMenu} loop>
      <WorkspaceMenu label="File" value="file" {activeMenu} bind:trigger={renameButton}>
        <Menubar.Item disabled={textDraftDirty || sourceDraftDirty} onSelect={()=>void beginCreate()}>New screen</Menubar.Item>
        <Menubar.Sub>
          <Menubar.SubTrigger disabled={!library.length || textDraftDirty || sourceDraftDirty}>Open screen<span aria-hidden="true">›</span></Menubar.SubTrigger>
          <Menubar.Portal><Menubar.SubContent aria-label="Open screen" class="workspace-menu open-screen-menu" align="start" alignOffset={-5} sideOffset={2} collisionPadding={8}>
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
      <WorkspaceMenu label="View" value="view" {activeMenu}>
        <Menubar.RadioGroup bind:value={width} aria-label="Canvas size">
          {#each [{value:'fluid',label:'Fit canvas'},{value:'768',label:'Tablet · 768'},{value:'390',label:'Phone · 390'}] as option}<Menubar.RadioItem value={option.value} closeOnSelect>{option.label}<span aria-hidden="true">{width===option.value?'\u2713':''}</span></Menubar.RadioItem>{/each}
        </Menubar.RadioGroup>
      </WorkspaceMenu>
      <WorkspaceMenu label="Preview" value="preview" {activeMenu}>
        <Menubar.Item disabled={!source || snapshot?.dirty || sourceDraftDirty || textDraftDirty || snapshot?.storedRevision==='r1'} onSelect={()=>{if(source && !snapshot?.dirty && !sourceDraftDirty && !textDraftDirty && snapshot?.storedRevision!=='r1')location.href=`/run-screen?screen=${encodeURIComponent(source.id)}${canvasWidth>0?`&width=${canvasWidth}`:''}`;}}>Run saved<span aria-hidden="true">↗</span></Menubar.Item>
        <Menubar.Item onSelect={resetRuntime}>Reset preview</Menubar.Item>
      </WorkspaceMenu>
    </Menubar.Root>
    <div class="screen-picker">{#if renamingScreen}<input class="screen-name-edit" aria-label="Screen name" bind:this={screenNameInput} bind:value={screenNameDraft} maxlength="80" onkeydown={renameKey} onblur={finishRename} />{:else}<span class="current-screen" title={source?screenName(source):'No screen'}>{source?screenName(source):'No screen'}</span>{/if}</div>
    <span class="save-state">{textDraftDirty ? '● Unapplied property draft' : sourceDraftDirty ? '● Unapplied JSON draft' : snapshot?.dirty ? '● Unsaved changes' : snapshot?.storedRevision === 'r1' ? '○ New screen' : '✓ Saved'}</span>
    <a class="operator-link" href="/" aria-label="Operator tools" title="Operator tools">↗</a>
  </header>
  {#if source && bridge}
  {#snippet floatingTools()}
    <SelectionPalette revealSignal={selectionToolsReveal} locked={textDraftDirty || sourceDraftDirty} onOpenComposition={selectedSlots.length && selectedNode?.id!==compositionFocus?.nodeId ? ()=>openComposition() : undefined} bind:page={palettePage} name={compositionName(source, selectedNode?.id ?? source.root)} focusSignal={paletteFocus}>
      {#snippet objectProperties(section: 'Content' | 'Style' | 'Behavior')}
        <Inspector contextual editTextSignal={section === 'Behavior' ? undefined : editTextSignal} onTextDraftChange={(dirty: boolean) => propertyDraftDirty = dirty} {section} document={source} selectedOccurrence={selected} onApply={apply} lastIssues={issues} componentDescriptors={catalogDescriptors} knownActionIds={designerCatalogs.actionIds} {actionInputs} knownRouteIds={['screen']} labels={editorLabels} styleConditions={[{ id: 'compact', label: 'Compact · ≤600px' }]} readEffective={effective} />
      {/snippet}
      {#snippet format()}{@render objectProperties(formatSection)}{/snippet}
      {#snippet connect()}{@render objectProperties('Behavior')}{/snippet}
      {#snippet insert()}<Composer {compositionFocus} document={source} selectedNodeId={selectedNode?.id} recipes={screenRecipes} descriptors={catalogDescriptors} compact showArrange={false} onApply={apply} onInserted={(id: string) => { selectOccurrence(`${source.id}|${id}`); notice = 'Added to your screen. Double-click text to edit.'; }} />{/snippet}
      {#snippet arrange()}<Composer document={source} selectedNodeId={selectedNode?.id} recipes={[]} descriptors={catalogDescriptors} compact showInsert={false} onApply={apply} onDuplicate={duplicateSelection} onDetached={(parentId: string)=>{selectOccurrence(`${source.id}|${parentId}`);notice='Content kept aside. Use Insert → Reuse to place it again.';}} />{#if !selectedNode || selectedNode.id === source.root}<p class="palette-hint">Select an element to move, duplicate or delete it.</p>{/if}{/snippet}
    </SelectionPalette>
  {/snippet}
  <div class="design-workspace" class:drawer-open={drawerOpen} class:has-object-tools={mode === 'design' && !!selectedNode && paletteRequested} style:--drawer-width={`${drawerWidth}px`}>
    <main class="design-stage">
      <div class="canvas-toolbar workspace-tools"><div class="canvas-modes" aria-label="Canvas mode"><button type="button" aria-pressed={mode === 'design'} onclick={() => changeMode('design')}>Design</button><button type="button" aria-pressed={mode === 'interact'} onclick={() => changeMode('interact')}>Interact</button></div>{#if compositionFocus}<div class="composition-back"><CompositionNavigator compact document={source} focus={compositionFocus} descriptors={catalogDescriptors} disabled={textDraftDirty || sourceDraftDirty} onNavigate={navigateComposition} /></div>{/if}<button type="button" bind:this={documentButton} class="panel-toggle" aria-expanded={drawerOpen} aria-controls="document-drawer" onclick={toggleDocument}>Document</button></div>

      <div class="canvas-scroll workspace-scroll" bind:this={canvasScroll}>
        <div class="design-frame workspace-screen" bind:clientWidth={canvasWidth} style:max-width={width === 'fluid' ? 'none' : `${width}px`}>
          <EditorCanvas document={source} catalogs={designerCatalogs} extensions={catalogDescriptors} extensionImplementations={catalogImplementations}
            {compositionFocus} onOpenComposition={openComposition}
            selectionTools={(!drawerOpen || drawerTab==='Layers') && selectedNode && paletteRequested ? floatingTools : undefined}
            {selectionToolsReveal} selectionToolsPinned={textDraftDirty}
            selectionToolsPlacement="below"
            onEditTextRequest={editSelectedText}
            interactionMode={mode} selectedOccurrence={mode === 'design' ? selected : undefined} onSelect={mode === 'design' ? selectOccurrence : () => {}} {dispatch} navigate={() => { notice = 'This application contains one screen.'; }}
            stateValues={runtimeValues} onStateChange={(key: string, value: UiValue) => runtimeValues = { ...runtimeValues, [key]: value }} {resetSignal}
            actionState={screenActionState} onPlan={(next: UiRenderPlan) => { plan = next; }}
            onRenderDiagnostic={(diagnostic: { code: string; message: string }) => { issues = [...issues.slice(-4), diagnostic]; }} ariaLabel="Screen canvas" />
          {#if compositionFocus && !focusedMembers?.size}<div class="empty-composition"><h2>This composition is empty</h2><p>Select the composition, then choose Insert in its tools.</p></div>{:else if Object.keys(source.nodes).length === 1}<div class="empty-canvas"><span>＋</span><h1>What will you make?</h1><p>Select this screen to open its tools, then choose Insert.</p></div>{/if}
        </div>
      </div>
      <details class="simulation-panel workspace-simulation"><summary>Simulated execution <span>Local preview · no live effects</span></summary><div class="simulation-body"><label><input type="checkbox" bind:checked={simulation.denied} /> Deny demo writes</label><label><input type="checkbox" bind:checked={simulation.failNext} /> Fail next action</label><StateValuesPanel localState={source.localState} stateValues={runtimeValues} onChange={(key: string, value: UiValue | undefined) => { const next = { ...runtimeValues }; if (value === undefined) delete next[key]; else next[key] = value; runtimeValues = next; }} />{#each activity as entry}<p role="status">{entry}</p>{/each}<p class="panel-hint">Connect checkedChange to accepted, bind checked to state.accepted, then map a Button's press → Submit using state.message and state.accepted. Runtime values never enter undo history.</p></div></details>
    </main>
    {#if drawerOpen}
    <div class="drawer-resizer"><PanelResizer label="Document drawer width" value={drawerWidth} min={280} max={460} reverse onChange={(value: number) => drawerWidth = value} /></div>
    <aside id="document-drawer" class="document-drawer" class:source-drawer={drawerTab==='Source'} aria-label="Document">
      <nav class="sidebar-tabs" aria-label="Document sections">{#each ['Layers', 'Data', 'Actions', 'Source'] as tab}<button type="button" aria-pressed={drawerTab === tab} disabled={(dataDraftDirty || sourceDraftDirty) && drawerTab!==tab} onclick={() => changeDocumentTab(tab)}>{tab}</button>{/each}<button class="close-document" type="button" aria-label="Close document" onclick={closeDrawer}>×</button></nav>
      <div class="sidebar-body" class:source-body={drawerTab==='Source'}>
        {#if drawerTab === 'Layers'}
          {#if plan}<Layers compact hideTextContent {plan} document={source} selectedOccurrence={selected} onSelect={selectFromStructure} onOpenComposition={navigateComposition} componentDescriptors={catalogDescriptors} />{/if}
        {:else if drawerTab === 'Data'}
          {#if selectedData && source.localState[selectedData]}
            <button class="data-back" type="button" disabled={dataDraftDirty} onclick={()=>openData()}>← All data</button>
            <div class="data-heading"><h2>{dataName(selectedData)}</h2><span>{dataType(source.localState[selectedData]!.type)}</span></div>
            {#key selectedData}<StateInitialEditor compact document={source} expression={{type:'ref',path:`state.${selectedData}`}} labels={editorLabels} onApply={apply} onDirtyChange={(dirty:boolean)=>dataDraftDirty=dirty} />{/key}
          {:else}
            <div class="section-heading"><h2>Screen data</h2><span>Saved starting values</span></div>
            <div class="data-list">{#each Object.entries(source.localState) as [key,declaration] (key)}<button type="button" class="data-row" onclick={()=>openData(key)}><span><strong>{dataName(key)}</strong><small>{dataType(declaration.type)}</small></span><span class="data-preview">{dataPreview(declaration.initial)}</span><span aria-hidden="true">›</span></button>{/each}</div>
            {#if !Object.keys(source.localState).length}<p class="panel-hint">This screen has no saved data.</p>{/if}
          {/if}
        {:else if drawerTab === 'Actions'}
          <div class="section-heading"><h2>Available actions</h2><span>Connect them from an object's tools</span></div>
          {#each designerCatalogs.actionIds as id}<section class="action-card"><div><h3>{(editorLabels.actions[id as keyof typeof editorLabels.actions] ?? id).replace(' (simulated)','')}</h3><span class="simulation-badge" title="Local preview only; no live effects">Simulated</span></div><p>Uses</p><div class="action-inputs">{#each Object.keys(actionInputs[id] ?? {}) as key}<span>{editorLabels.actionInputs[key as keyof typeof editorLabels.actionInputs] ?? key}</span>{:else}<span>No inputs</span>{/each}</div></section>{/each}
        {:else}
          <label class="sr-only" for="canonical-source">Canonical UI document</label><textarea id="canonical-source" class="source-editor" wrap="off" spellcheck="false" bind:value={sourceDraft} oninput={() => sourceDraftDirty = true}></textarea>
          <div class="source-actions"><button type="button" disabled={!sourceDraftDirty} onclick={applySource}>Apply source</button><button type="button" disabled={!sourceDraftDirty} onclick={() => { sourceDraftDirty = false; sourceDraft = JSON.stringify(source, null, 2); sourceDraftRevision = snapshot?.revision ?? ''; issues = []; }}>Discard draft</button><button type="button" onclick={exportSource}>Export</button></div>
          <details class="application-attachment"><summary>Application attachment</summary><pre class="source-preview">{JSON.stringify(screenApplication(source), null, 2)}</pre></details>
        {/if}
      </div>
    </aside>
    {/if}
  </div>
  {/if}
  <footer class="design-status workspace-status"><span role="status">{notice}</span><span title={compilation?.ok ? compilation.plan.applicationVersion : 'Application compilation pending'}>{compilation?.ok ? `@3 · ${compilation.plan.applicationVersion.slice(0, 15)}…` : 'Application source pending'}</span></footer>
  {#if issues.length}<div class="design-errors" role="alert">{#each issues as issue}<p>{issue.code}: {issue.message}</p>{/each}</div>{/if}
  {#if compilation && !compilation.ok}<div class="design-errors" role="alert">{#each [...compilation.issues, ...(compilation.uiIssues ?? [])] as issue}<p>{issue.code}: {issue.message}</p>{/each}</div>{/if}
  <dialog class="create-screen-dialog" bind:this={createDialog} onclose={() => renameButton?.focus()}><form onsubmit={event => { event.preventDefault(); if (!screenTitle.trim()) return; createScreen(screenTitle.trim()); createDialog.close(); }}><p class="panel-eyebrow">A BLANK CANVAS</p><h2>Create a screen</h2><p>Start small. Add content, connect behavior, and run what you save.</p><label>Screen name<input bind:this={nameInput} bind:value={screenTitle} maxlength="80" required /></label><div><button type="button" onclick={() => createDialog.close()}>Cancel</button><button class="primary" type="submit">Create screen</button></div></form></dialog>
</div>
</ControlScope>
