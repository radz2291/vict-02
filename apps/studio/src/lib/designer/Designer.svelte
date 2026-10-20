<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import { beforeNavigate } from '$app/navigation';
  import { ControlScope } from '@victframework/ui-svelte';
  import { Composer, EditorBridge, EditorCanvas, Inspector, Layers, StateValuesPanel, PanelResizer, StateInitialEditor, SelectionPalette, setAttribute, resolveOccurrence, compositionParent, compositionName, duplicateSubtree, type TransactionDraft } from '@victframework/ui-editor';
  import { createPreviewSession } from '@victframework/ui-preview';
  import type { UiDocument, UiRenderPlan, UiValue } from '@victframework/ui';
  import { newScreen, compileScreen, screenIssues, screenApplication, screenName, screenActionState, designerCatalogs, actionInputs, catalogDescriptors, catalogImplementations } from './application.js';
  import { screenStore, savedScreens } from './storage.js';
  import { screenRecipes } from './recipes.js';
  import { createScreenSimulation, screenDispatcher } from './execution.js';
  import '@victframework/ui-svelte/styles.css';
  import '@victframework/ui-svelte/catalog.css';
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
  let plan = $state<UiRenderPlan>();
  let issues = $state<readonly { code: string; message: string }[]>([]);
  let notice = $state('Start with an empty screen. Add a heading or section to begin.');
  let drawerTab = $state('Structure');
  let formatSection = $state<'Content' | 'Style' | 'Behavior'>('Style');
  let editTextSignal = $state<symbol>();
  let selectionToolsReveal = $state<symbol>();
  let canvasTextEditing = $state(false);
  let palettePage = $state<'format' | 'insert' | 'arrange' | 'connect'>('format');
  let paletteRequested = $state(false);
  let paletteFocus = $state<symbol>();
  let width = $state('fluid');
  let mode = $state<'design' | 'interact'>('design');
  let drawerOpen = $state(false);
  let drawerWidth = $state(320);
  let documentButton: HTMLButtonElement;
  function closeDrawer() { drawerOpen = false; documentButton?.focus(); }
  const editorLabels = { actions: { 'demo.submit': 'Submit (simulated)' }, nodes: { screen: 'Screen' },
    state: { message: 'Message', accepted: 'Agreement', dialogOpen: 'Dialog open', busy: 'Submitting', actionError: 'Action error', actionResult: 'Action result' },
    actionInputs: { message: 'Message', accepted: 'Agreement' } };
  function selectOccurrence(occurrence: string) {
    if (source) {
      const report = resolveOccurrence(occurrence, source);
      const parent = report.node?.kind === 'text' && !report.instancePath.length && !report.repeatKeys.length ? compositionParent(source, report.node.id) : undefined;
      const owner = parent ? source.nodes[parent.nodeId] : undefined;
      if (owner?.kind === 'element' && owner.children.length === 1) occurrence = `${source.id}|${owner.id}`;
    }
    bridge?.select(occurrence);
    palettePage = 'format'; paletteRequested = true;
    formatSection = reportSection(occurrence);
    if (matchMedia('(max-width: 760px)').matches) drawerOpen = false;
    selectionToolsReveal = Symbol('selection-tools');
  }
  function reportSection(occurrence: string): 'Content' | 'Style' {
    const node = source && resolveOccurrence(occurrence, source).node;
    return node?.kind === 'component' || (node?.kind === 'element' && ['input', 'textarea'].includes(node.tag)) ? 'Content' : 'Style';
  }
  function changeMode(next: 'design' | 'interact') { if (canvasTextEditing) { notice = 'Apply or cancel your canvas text edit first.'; return; } mode = next; resetRuntime(); notice = next === 'design' ? 'Design mode · select and edit without running behavior.' : 'Interact mode · simulated behavior, no live effects.'; }
  let createDialog: HTMLDialogElement;
  let nameInput: HTMLInputElement;
  let screenTitle = $state('My first screen');
  let sourceDraft = $state('');
  let sourceDraftRevision = '';
  let sourceDraftDirty = $state(false);
  $effect(() => { if (source && !untrack(() => sourceDraftDirty)) { sourceDraft = JSON.stringify(source, null, 2); sourceDraftRevision = snapshot?.revision ?? ''; } });
  beforeNavigate(navigation => {
    if (!navigation.willUnload && (canvasTextEditing || sourceDraftDirty || [...sessions.values()].some(session => session.getSnapshot().dirty))) {
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
    openSession(next); drawerTab = 'Structure'; drawerOpen = false;
    notice = 'New screen · not saved yet.';
  }
  function openScreen(id: string) {
    if (canvasTextEditing) { notice = 'Apply or cancel your canvas text edit before switching screens.'; return; }
    if (sourceDraftDirty) { notice = 'Apply or discard your JSON draft before switching screens.'; return; }
    const existing = sessions.get(id);
    if (existing) { openSession(existing); notice = 'Screen opened. In-session edits are retained.'; return; }
    const store = screenStore(localStorage, id);
    const loaded = store.rawLoad();
    if (loaded.status !== 'loaded') { notice = loaded.status === 'invalid' ? loaded.message : 'This screen has not been saved.'; issues = [{ code: 'STUDIO_OPEN_REFUSED', message: notice }]; return; }
    const next = new EditorBridge({ catalogs: designerCatalogs, store, initial: loaded });
    sessions.set(id, next); openSession(next); notice = 'Reopened the saved source.';
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
    if (canvasTextEditing) { notice = 'Apply or cancel your canvas text edit first.'; return false; }
    if (!bridge) return false;
    const result = bridge.apply(draft);
    issues = result.ok ? [] : result.issues;
    if (result.ok) {
      notice = `${draft.reason ?? 'Change applied'} · unsaved`;
      if (selected && !resolveOccurrence(selected, bridge.document).node) bridge.select(`${bridge.document.id}|${bridge.document.root}`);
    }
    return result.ok;
  }
  function undo() { if (!bridge) return; if (canvasTextEditing) { notice = 'Apply or cancel your canvas text edit first.'; return; } const result = bridge.undo(); issues = result.ok ? [] : result.issues; notice = result.ok ? 'Undid the last authored change.' : 'Nothing to undo.'; }
  function redo() { if (!bridge) return; if (canvasTextEditing) { notice = 'Apply or cancel your canvas text edit first.'; return; } const result = bridge.redo(); issues = result.ok ? [] : result.issues; notice = result.ok ? 'Redid the authored change.' : 'Nothing to redo.'; }
  function save(): boolean {
    if (canvasTextEditing) { notice = 'Apply or cancel your canvas text edit before saving.'; return false; }
    if (sourceDraftDirty) { notice = 'Apply or discard your JSON draft before saving.'; return false; }
    if (!bridge || !compilation?.ok) { notice = 'Resolve source diagnostics before saving.'; return false; }
    const result = bridge.save(); issues = result.ok ? [] : result.issues;
    if (!result.ok) { notice = 'Save refused. Your edits are still in this session.'; return false; }
    notice = `Saved ${screenName(result.document)} · revision ${result.storedRevision}`;
    library = library.map(item => item.id === result.document.id ? { id: item.id, name: screenName(result.document) } : item);
    return true;
  }
  function reopen() {
    if (canvasTextEditing) { notice = 'Apply or cancel your canvas text edit before reopening.'; return; }
    if (!bridge) return;
    if (sourceDraftDirty) { notice = 'Apply or discard your JSON draft before reopening.'; return; }
    if (snapshot?.dirty) { notice = 'Save or undo your changes before reopening the stored source.'; return; }
    const result = bridge.reopen();
    if (!result.ok) { issues = [{ code: result.code, message: result.message ?? 'Reopen failed.' }]; return; }
    paletteRequested = false; palettePage = 'format';
    resetRuntime(); bridge.select(`${bridge.document.id}|${bridge.document.root}`); issues = []; notice = `Reopened revision ${result.storedRevision}; runtime state reset.`;
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
    if (event.key === 'Escape' && drawerOpen) { event.preventDefault(); closeDrawer(); return; }
    const editable = event.target instanceof HTMLElement && (event.target.matches('input,textarea,select') || event.target.isContentEditable);
    if (!editable && mode === 'design') {
      if (['Delete', 'Backspace'].includes(event.key)) { event.preventDefault(); removeSelection(); }
      if (event.key === 'F2') { event.preventDefault(); editTextSignal = Symbol('edit'); }
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
  function openInsert() {
    if (!source || !bridge) return;
    if (canvasTextEditing) { notice = 'Apply or cancel your canvas text edit first.'; return; }
    if (!selectedNode) bridge.select(`${source.id}|${source.root}`);
    palettePage = 'insert'; paletteRequested = true;
    selectionToolsReveal = Symbol('add'); paletteFocus = Symbol('focus-insert');
  }
  async function beginCreate() { if (canvasTextEditing || sourceDraftDirty) { notice = 'Apply or cancel your text/source draft before creating a screen.'; return; } createDialog.showModal(); await tick(); nameInput.focus(); nameInput.select(); }
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
      if (apply({ requestId: crypto.randomUUID(), reason: 'Apply canonical source', commands: [{ op: 'replaceDocument', document }] })) { sourceDraftDirty = false; bridge.select(`${source.id}|${source.root}`); }
    } catch { issues = [{ code: 'STUDIO_JSON_INVALID', message: 'Enter valid canonical UI document JSON.' }]; }
  }
  // Authored revisions invalidate any in-flight simulation without adding history.
  $effect.pre(() => { if (authoredRevision) untrack(resetRuntime); });
</script>

<svelte:window onkeydown={shortcuts} onbeforeunload={event => { if (canvasTextEditing || sourceDraftDirty || [...sessions.values()].some(session => session.getSnapshot().dirty)) { event.preventDefault(); event.returnValue = ''; } }} />
<ControlScope>
<div class="vict-app studio-designer">
  <header class="studio-header"><a class="studio-brand" href="/design"><span class="brand-mark">V</span><strong>VICT <span>Studio</span></strong></a><span class="product-mode">DESIGNER</span><div class="header-spacer"></div><a class="operator-link" href="/">Operator tools ↗</a></header>
  <div class="design-toolbar">
    <div class="screen-picker"><label class="sr-only" for="screen-picker">Screen</label><select id="screen-picker" value={source?.id ?? ''} onchange={event => openScreen(event.currentTarget.value)}>{#each library as item (item.id)}<option value={item.id}>{item.name}</option>{/each}</select><button type="button" onclick={beginCreate} aria-label="New screen">＋ New</button></div>
    <div class="history-controls"><button type="button" disabled={!snapshot?.canUndo} onclick={undo} title="Undo · Ctrl+Z">Undo</button><button type="button" disabled={!snapshot?.canRedo} onclick={redo} title="Redo · Ctrl+Shift+Z">Redo</button></div>
    <div class="canvas-modes" aria-label="Canvas mode"><button type="button" aria-pressed={mode === 'design'} onclick={() => changeMode('design')}>Design</button><button type="button" aria-pressed={mode === 'interact'} onclick={() => changeMode('interact')}>Interact</button></div>
    {#if mode === 'design'}<button type="button" class="add-element" onclick={openInsert}>＋ Add</button>{/if}
    <span class="save-state">{sourceDraftDirty ? '● Unapplied JSON draft' : snapshot?.dirty ? '● Unsaved changes' : snapshot?.storedRevision === 'r1' ? '○ New screen' : '✓ Saved'}</span>
    <div class="toolbar-end"><button type="button" bind:this={documentButton} class="panel-toggle" aria-expanded={drawerOpen} aria-controls="document-drawer" onclick={() => drawerOpen = !drawerOpen}>Document</button><button type="button" onclick={reopen} disabled={!source || snapshot?.dirty || sourceDraftDirty || snapshot?.storedRevision === 'r1'}>Reopen</button><button type="button" onclick={save} disabled={!compilation?.ok || sourceDraftDirty}>Save</button><a class="run-button" aria-disabled={!source || snapshot?.dirty || sourceDraftDirty || snapshot?.storedRevision === 'r1'} href={source && !snapshot?.dirty && !sourceDraftDirty && snapshot?.storedRevision !== 'r1' ? `/run-screen?screen=${encodeURIComponent(source.id)}` : undefined}>Run saved ↗</a></div>
  </div>
  {#if source && bridge}
  {#snippet floatingTools()}
    <SelectionPalette bind:page={palettePage} name={compositionName(source, selectedNode?.id ?? source.root)} focusSignal={paletteFocus}>
      {#snippet objectProperties(section: 'Content' | 'Style' | 'Behavior')}
        <Inspector contextual onEditText={() => editTextSignal = Symbol('edit')} {section} document={source} selectedOccurrence={selected} onApply={apply} lastIssues={issues} componentDescriptors={catalogDescriptors} knownActionIds={designerCatalogs.actionIds} {actionInputs} knownRouteIds={['screen']} labels={editorLabels} styleConditions={[{ id: 'compact', label: 'Compact · ≤600px' }]} readEffective={effective} />
      {/snippet}
      {#snippet format()}{@render objectProperties(formatSection)}{/snippet}
      {#snippet connect()}{@render objectProperties('Behavior')}{/snippet}
      {#snippet insert()}<Composer document={source} selectedNodeId={selectedNode?.id} recipes={screenRecipes} descriptors={catalogDescriptors} compact showArrange={false} onApply={apply} onInserted={(id: string) => { selectOccurrence(`${source.id}|${id}`); notice = 'Added to your screen. Double-click text to edit.'; }} />{/snippet}
      {#snippet arrange()}<Composer document={source} selectedNodeId={selectedNode?.id} recipes={[]} descriptors={catalogDescriptors} compact showInsert={false} onApply={apply} onDuplicate={duplicateSelection} />{#if !selectedNode || selectedNode.id === source.root}<p class="palette-hint">Select an element to move, duplicate or delete it.</p>{/if}{/snippet}
    </SelectionPalette>
  {/snippet}
  <div class="design-workspace" class:drawer-open={drawerOpen} style:--drawer-width={`${drawerWidth}px`}>
    <main class="design-stage">
      <div class="canvas-toolbar"><span><span class="live-dot"></span>{mode === 'design' ? 'Design · selection only' : 'Interact · simulated'}</span><label><span class="sr-only">Canvas width</span><select aria-label="Canvas width" bind:value={width}><option value="fluid">Fit canvas</option><option value="768">Tablet · 768</option><option value="390">Phone · 390</option></select></label><button type="button" onclick={resetRuntime} title="Reset ephemeral runtime values">Reset preview</button></div>
      <div class="canvas-scroll"><div class="canvas-caption">{screenName(source)} <span>{width === 'fluid' ? 'Responsive' : `${width}px`}</span></div>
        <div class="design-frame" style:max-width={width === 'fluid' ? 'none' : `${width}px`}>
          <EditorCanvas document={source} catalogs={designerCatalogs} extensions={catalogDescriptors} extensionImplementations={catalogImplementations}
            selectionTools={selectedNode && (selectedNode.id !== source.root || paletteRequested) ? floatingTools : undefined}
            {selectionToolsReveal}
            selectionToolsPlacement="below"
            onApply={(draft: TransactionDraft) => { canvasTextEditing = false; return apply(draft); }} {editTextSignal} onTextEditingChange={(editing: boolean) => canvasTextEditing = editing}
            interactionMode={mode} selectedOccurrence={mode === 'design' ? selected : undefined} onSelect={mode === 'design' ? selectOccurrence : () => {}} {dispatch} navigate={() => { notice = 'This application contains one screen.'; }}
            stateValues={runtimeValues} onStateChange={(key: string, value: UiValue) => runtimeValues = { ...runtimeValues, [key]: value }} {resetSignal}
            actionState={screenActionState} onPlan={(next: UiRenderPlan) => { plan = next; }}
            onRenderDiagnostic={(diagnostic: { code: string; message: string }) => { issues = [...issues.slice(-4), diagnostic]; }} ariaLabel="Screen canvas" />
          {#if Object.keys(source.nodes).length === 1}<div class="empty-canvas"><span>＋</span><h1>What will you make?</h1><p>Choose ＋ Add to start. Select anything to open its tools.</p></div>{/if}
        </div>
      </div>
      <details class="simulation-panel"><summary>Simulated execution <span>Local preview · no live effects</span></summary><div class="simulation-body"><label><input type="checkbox" bind:checked={simulation.denied} /> Deny demo writes</label><label><input type="checkbox" bind:checked={simulation.failNext} /> Fail next action</label><StateValuesPanel localState={source.localState} stateValues={runtimeValues} onChange={(key: string, value: UiValue | undefined) => { const next = { ...runtimeValues }; if (value === undefined) delete next[key]; else next[key] = value; runtimeValues = next; }} />{#each activity as entry}<p role="status">{entry}</p>{/each}<p class="panel-hint">Connect checkedChange to accepted, bind checked to state.accepted, then map a Button's press → Submit using state.message and state.accepted. Runtime values never enter undo history.</p></div></details>
    </main>
    {#if drawerOpen}
    <div class="drawer-resizer"><PanelResizer label="Document drawer width" value={drawerWidth} min={280} max={460} reverse onChange={(value: number) => drawerWidth = value} /></div>
    <aside id="document-drawer" class="document-drawer" aria-label="Document">
      <div class="drawer-heading"><strong>Document</strong><button type="button" aria-label="Close document" onclick={closeDrawer}>×</button></div>
      <nav class="sidebar-tabs" aria-label="Document sections">{#each ['Structure', 'Logic', 'Source'] as tab}<button type="button" aria-pressed={drawerTab === tab} onclick={() => drawerTab = tab}>{tab}</button>{/each}</nav>
      <div class="sidebar-body">
        {#if drawerTab === 'Structure'}
          <label class="document-name">Screen name<input aria-label="Screen name" value={screenName(source)} onchange={event => apply(setAttribute({ requestId: crypto.randomUUID(), nodeId: source.root, name: 'aria-label', value: event.currentTarget.value }))} /></label>
          {#if plan}<Layers {plan} document={source} selectedOccurrence={selected} onSelect={selectOccurrence} componentDescriptors={catalogDescriptors} />{/if}
        {:else if drawerTab === 'Logic'}
          <p class="panel-hint">Define starting values here. Select an object to connect it through its tools.</p>
          <h3>State</h3>
          {#each Object.entries(source.localState) as [key, declaration] (key)}<details class="state-definition"><summary>{editorLabels.state[key as keyof typeof editorLabels.state] ?? key}<small>{declaration.type}</small></summary><StateInitialEditor document={source} expression={{ type: 'ref', path: `state.${key}` }} labels={editorLabels} onApply={apply} /></details>{/each}
          <h3>Declared actions</h3>
          {#each designerCatalogs.actionIds as id}<div class="declared-action"><strong>{editorLabels.actions[id as keyof typeof editorLabels.actions] ?? id}</strong><span>Simulated · no live effects</span><small>Inputs: {Object.keys(actionInputs[id] ?? {}).join(', ') || 'None'}</small></div>{/each}
          <p class="panel-hint">The supported action is supplied by the application. Edit state declarations in Source; Connect assigns them to objects.</p>
        {:else}
          <p class="panel-eyebrow">CANONICAL SOURCE</p><p class="panel-hint">Humans and agents edit this same UI document. Keep its id and revision. Apply validates the source and creates one undoable change.</p>
          <label class="sr-only" for="canonical-source">Canonical UI document</label><textarea id="canonical-source" class="source-editor" spellcheck="false" bind:value={sourceDraft} oninput={() => sourceDraftDirty = true}></textarea>
          <div class="source-actions"><button type="button" disabled={!sourceDraftDirty} onclick={applySource}>Apply source</button><button type="button" disabled={!sourceDraftDirty} onclick={() => { sourceDraftDirty = false; sourceDraft = JSON.stringify(source, null, 2); sourceDraftRevision = snapshot?.revision ?? ''; issues = []; }}>Discard JSON draft</button></div>
          <details><summary>Application attachment</summary><pre class="source-preview">{JSON.stringify(screenApplication(source), null, 2)}</pre></details>
          <button type="button" onclick={exportSource}>Export application + source</button>
        {/if}
      </div>
    </aside>
    {/if}
  </div>
  {/if}
  <footer class="design-status"><span role="status">{notice}</span><span title={compilation?.ok ? compilation.plan.applicationVersion : 'Application compilation pending'}>{compilation?.ok ? `@3 · ${compilation.plan.applicationVersion.slice(0, 15)}…` : 'Application source pending'}</span></footer>
  {#if issues.length}<div class="design-errors" role="alert">{#each issues as issue}<p>{issue.code}: {issue.message}</p>{/each}</div>{/if}
  {#if compilation && !compilation.ok}<div class="design-errors" role="alert">{#each [...compilation.issues, ...(compilation.uiIssues ?? [])] as issue}<p>{issue.code}: {issue.message}</p>{/each}</div>{/if}
  <dialog class="create-screen-dialog" bind:this={createDialog} onclose={() => { globalThis.document.querySelector<HTMLButtonElement>('[aria-label="New screen"]')?.focus(); }}><form onsubmit={event => { event.preventDefault(); if (!screenTitle.trim()) return; createScreen(screenTitle.trim()); createDialog.close(); }}><p class="panel-eyebrow">A BLANK CANVAS</p><h2>Create a screen</h2><p>Start small. Add content, connect behavior, and run what you save.</p><label>Screen name<input bind:this={nameInput} bind:value={screenTitle} maxlength="80" required /></label><div><button type="button" onclick={() => createDialog.close()}>Cancel</button><button class="primary" type="submit">Create screen</button></div></form></dialog>
</div>
</ControlScope>
