<script lang="ts">
  import { onMount, tick } from 'svelte';
  import {
    Composer, CompositionNavigator, EditorBridge, EditorCanvas, Inspector, Layers,
    SelectionPalette, StateInitialEditor, StateValuesPanel, authoredOccurrence,
    compositionName, compositionSlots, compositionTrail, firstCompositionSlot, resolveOccurrence,
    type CompositionFocus, type TransactionDraft,
    duplicateSubtree, compositionParent,
  } from '@victframework/ui-editor';
  import { ControlScope } from '@victframework/ui-svelte';
  import type { UiRenderPlan, UiValue } from '@victframework/ui';
  import { actionInputs, catalogDescriptors, catalogImplementations, compileScreen, designerCatalogs, screenActionState } from './application.js';
  import { screenPlacementIssues } from './placement.js';
  import AuthoringGuidance from './AuthoringGuidance.svelte';
  import { screenRecipes } from './recipes.js';
  import { screenStore } from './storage.js';
  import { createScreenSimulation, screenDispatcher } from './execution.js';
  import { createShowcaseFixture, showcaseCatalog } from './showcase.js';
  import { structureMove, structureId, projectStructure, type StructureEditRequest, type StructureHandoff } from './structure.js';
  import StructureView from './StructureView.svelte';
  import SourceDetails from './SourceDetails.svelte';
  import StructureDock from './StructureDock.svelte';
  import WorkspaceContextMenu from './WorkspaceContextMenu.svelte';
  import { sourceCapabilities, type WorkspaceContext } from './workspace-context.js';
  import '@victframework/ui-svelte/styles.css';
  import '@victframework/ui-svelte/catalog.css';
  import '@victframework/ui-svelte/rhea.css';
  import './studio-theme.css';

  let bridge = $state<EditorBridge>();
  let version = $state(0);
  let recipeId = $state('slider');
  let search = $state('');
  let mode = $state<'design' | 'interact'>('design');
  let documentOpen = $state(true);
  let structureOpen = $state(false);
  let structureExpanded = $state(false);
  let showcaseWidth = $state(0);
  let tools = $state<'inspector' | 'palette'>('inspector');
  let compositionFocus = $state<CompositionFocus>();
  let exampleFocus = $state<CompositionFocus>();
  let targetNodeId = $state('');
  let plan = $state<UiRenderPlan>();
  let propertyDraft = $state(false);
  let canvasDraft = $state(false);
  let dataDraft = $state(false);
  let selectedData = $state('');
  let runtimeValues = $state<Record<string, UiValue>>({});
  let resetSignal = $state(Symbol('showcase'));
  let notice = $state('Loading the disposable example…');
  let issues = $state<readonly { code: string; message: string }[]>([]);
  let saved = $state(false);
  let unsubscribe: (() => void) | undefined;
  let canvasRoot = $state<HTMLDivElement>();
  let showcaseRoot = $state<HTMLElement>();
  let detailsOpen = $state(false);
  let detailsPage = $state<'properties'|'relationships'>('properties');
  let detailId = $state<string>();
  const rightOpen = $derived(documentOpen || detailsOpen);
  let detailsReturn:HTMLElement|undefined;
  let paletteRequested = $state(true);
  let palettePage = $state<'format'|'insert'|'arrange'|'connect'>('format');
  let paletteFocus = $state<symbol>();
  function inspect(id=source && selectedNodeId?structureId(source.id,'node',selectedNodeId):undefined,page:'properties'|'relationships'='properties') {
    const active=globalThis.document.activeElement;
    detailsReturn = active instanceof HTMLElement && !active.closest('[role="menu"]') ? active : undefined;
    detailId=id;detailsPage=page;detailsOpen=true;
  }
  function closeDetails(){detailsOpen=false;void tick().then(()=>{const target=detailsReturn?.isConnected && !detailsReturn.closest('[hidden],[inert]')?detailsReturn:showcaseRoot?.querySelector<HTMLElement>(structureOpen?'.inspection-toggle':'[aria-label="Inspect example source"]');target?.focus({preventScroll:true});});}
  function selectDetail(id:string){if(!source || blocked)return;detailId=id;const node=projectStructure(source).nodes.find(node=>node.id===id);if(node?.data.occurrence)selectStructure(node.data.occurrence);}
  function objectContext(occurrence:string):WorkspaceContext|undefined {
    if(!source)return;
    const capability=sourceCapabilities(source,occurrence);
    if(!capability.report?.node)return;
    const target=()=>{if(!blocked){selectStructure(occurrence);paletteRequested=false;}};
    const act=(action:()=>void)=>{target();if(!blocked && capability.direct)action();};
    return {label:'Example object commands',prepare:target,commands:[
      {label:'Inspect',disabled:blocked,run:()=>inspect(structureId(source!.id,'node',capability.report!.sourceNodeId))},
      {label:'Edit properties',disabled:blocked || !capability.direct,run:()=>act(()=>{structureExpanded=false;detailsOpen=false;changeMode('design');tools='palette';paletteRequested=true;palettePage='format';paletteFocus=Symbol('edit-handoff');})},
      {label:'Duplicate',separator:true,disabled:blocked || !capability.removable,run:()=>act(()=>{const copy=duplicateSubtree(source!,capability.report!.sourceNodeId);if(copy && apply(copy.draft))selectNode(copy.nodeId);})},
      {label:'Delete',disabled:blocked || !capability.removable,run:()=>act(()=>{const id=capability.report!.sourceNodeId;const parent=compositionParent(source!,id);if(apply({requestId:crypto.randomUUID(),reason:'Delete example selection',commands:[{op:'remove',nodeId:id,detachFromParent:true}]}))selectNode(parent?.nodeId??source!.root);})},
    ]};
  }
  function canvasContext(target:Element):WorkspaceContext|undefined {
    if(!source || mode!=='design' || (!canvasRoot?.contains(target) && !ownsCanvasTarget(target)))return;
    const occurrence=target.closest<HTMLElement>('[data-ui-occ]')?.dataset.uiOcc;
    if(occurrence && resolveOccurrence(occurrence,source).sourceNodeId!==source.root)return objectContext(occurrence);
    return {label:'Example canvas commands',prepare:()=>{if(!blocked){bridge?.select(undefined);paletteRequested=false;}},commands:[{label:'Insert…',disabled:blocked,run:()=>{selectNode(source!.root);tools='palette';paletteRequested=true;palettePage='insert';}},{label:'Reset preview',run:resetPreview}]};
  }
  function ownsCanvasTarget(target:Element):boolean {
    const owner=canvasRoot?.querySelector<HTMLElement>('[data-ui-owner-root]')?.dataset.uiOwnerRoot;
    return !!owner && target.closest<HTMLElement>('[data-ui-owner]')?.dataset.uiOwner===owner;
  }
  const simulation = createScreenSimulation({ denied: false, failNext: false });
  const snapshot = $derived.by(() => { void version; return bridge?.getSnapshot(); });
  const source = $derived.by(() => { void version; return bridge?.document; });
  const selected = $derived(snapshot?.selectedOccurrence);
  const selectedNodeId = $derived(source && selected ? resolveOccurrence(selected, source).sourceNodeId : undefined);
  const blocked = $derived(propertyDraft || canvasDraft || dataDraft);
  const compilation = $derived(source ? compileScreen(source) : undefined);
  const visibleRecipes = $derived(showcaseCatalog.filter(entry => `${entry.label} ${entry.id} ${entry.description} ${entry.category}`.toLowerCase().includes(search.toLowerCase())));
  const recipe = $derived(showcaseCatalog.find(entry => entry.id === recipeId));

  function resetPreview() {
    simulation.reset(); runtimeValues = {}; resetSignal = Symbol('showcase-reset');
  }
  function openExample(id: string) {
    if (blocked) { notice = 'Apply or cancel your draft before changing examples.'; return; }
    const fixture = createShowcaseFixture(id);
    const memory = new Map<string, string>();
    const next = new EditorBridge({
      catalogs: designerCatalogs,
      validateDocument: screenPlacementIssues,
      initial: { document: fixture.document, storedRevision: 'r1' },
      store: screenStore({ getItem: key => memory.get(key) ?? null, setItem: (key, value) => { memory.set(key, value); } }, fixture.document.id),
    });
    unsubscribe?.(); bridge = next; version++;
    unsubscribe = next.subscribe(() => version++);
    recipeId = id; targetNodeId = fixture.targetNodeId; exampleFocus = fixture.parentFocus;
    compositionFocus = fixture.parentFocus; mode = 'design';
    selectedData = ''; plan = undefined; saved = false; issues = [];
    resetPreview();
    next.select(authoredOccurrence(next.document, fixture.targetNodeId) ?? `${next.document.id}|${fixture.targetNodeId}`);
    notice = `${showcaseCatalog.find(entry => entry.id === id)?.label} · fresh in-memory example. Switching examples or refreshing discards it.`;
  }
  onMount(() => {
    const requested = new URL(window.location.href).searchParams.get('recipe');
    openExample(showcaseCatalog.some(entry => entry.id === requested) ? requested! : 'slider');
    return () => { unsubscribe?.(); simulation.reset(); };
  });
  function select(occurrence: string) {
    if (blocked) { notice = 'Apply or cancel your draft before changing selection.'; return; }
    bridge?.select(occurrence);
    if(source)detailId=structureId(source.id,'node',resolveOccurrence(occurrence,source).sourceNodeId);
    paletteRequested=true;
  }
  function selectNode(id: string) {
    if (source) select(authoredOccurrence(source, id) ?? `${source.id}|${id}`);
  }
  function selectStructure(occurrence: string) {
    if (blocked || !source) return;
    select(occurrence);
    paletteRequested=false;
  }
  function apply(draft: TransactionDraft): boolean {
    if (blocked || !bridge) { notice = 'Apply or cancel your draft first.'; return false; }
    const result = bridge.apply(draft);
    issues = result.ok ? [] : result.issues;
    if (result.ok) {
      notice = `${draft.reason ?? 'Change applied'} · in-memory working copy`;
      if (selected && !resolveOccurrence(selected, bridge.document).node) selectNode(bridge.document.root);
    }
    return result.ok;
  }
  function history(action: 'undo' | 'redo') {
    if (blocked || !bridge) return;
    const result = bridge[action](); issues = result.ok ? [] : result.issues;
    notice = result.ok ? `${action === 'undo' ? 'Undid' : 'Redid'} the authored change.` : 'History action refused.';
  }
  function save() {
    if (blocked || !bridge || !compilation?.ok) return;
    const result = bridge.save(); issues = result.ok ? [] : result.issues;
    if (result.ok) saved = true;
    notice = result.ok ? `Saved revision ${result.storedRevision} in this example’s memory store.` : 'Save refused.';
  }
  function reopen() {
    if (blocked || !bridge || !saved) return;
    const result = bridge.reopen();
    issues = result.ok ? [] : [{ code: result.code, message: result.message ?? 'Reopen failed.' }];
    if (result.ok) { resetPreview(); compositionFocus = undefined; selectNode(bridge.document.root); }
    notice = result.ok ? 'Reopened the saved in-memory revision; history and preview state reset.' : 'Reopen refused.';
  }
  function navigateComposition(focus?: CompositionFocus) {
    if (blocked || !source) return;
    if (focus && !compositionSlots(source, focus.nodeId, catalogDescriptors).includes(focus.slotName)) return;
    compositionFocus = focus; selectNode(focus?.nodeId ?? source.root);
  }
  function openComposition(occurrence = selected) {
    if (!source || !occurrence || blocked) return;
    const id = resolveOccurrence(occurrence, source).sourceNodeId;
    const slotName = firstCompositionSlot(compositionSlots(source, id, catalogDescriptors));
    if (slotName) navigateComposition({ nodeId: id, slotName });
  }
  function move(request: StructureEditRequest): boolean {
    if (!bridge) return false;
    const result = structureMove(bridge.document, bridge.getSnapshot().revision, request, blocked, catalogDescriptors, screenRecipes);
    if (!result.ok) { notice = result.message; return false; }
    return apply(result.draft);
  }
  function changeMode(next: 'design' | 'interact') {
    if (blocked) return;
    if (mode !== next) { mode = next; compositionFocus = undefined; resetPreview(); }
  }
  async function structureNavigate(request: StructureHandoff) {
    if (blocked) return;
    if (request.occurrence) selectStructure(request.occurrence);
    if (request.destination === 'layers') { documentOpen = true; detailsOpen = false; }
    if (request.destination === 'design' && request.occurrence && source) {
      structureExpanded=false;detailsOpen=false;await tick();
      const find = () => [...(canvasRoot?.querySelectorAll<HTMLElement>('[data-ui-occ]') ?? [])].find(element => element.dataset.uiOcc === request.occurrence && element.getClientRects().length);
      if (!find()) {
        if (mode === 'interact') { notice = 'Switch to Design to locate source inside a closed composition.'; return; }
        const id = resolveOccurrence(request.occurrence, source).sourceNodeId;
        const nearest = compositionTrail(source, { nodeId: id, slotName: '' }).at(-2);
        compositionFocus = nearest && compositionSlots(source, nearest.nodeId, catalogDescriptors).includes(nearest.slotName) ? nearest : undefined;
        await tick();
      }
      const target = find(); target?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); target?.focus({ preventScroll: true });
      notice = target ? 'Located on canvas.' : 'This source has no visible canvas element.'; return;
    }
    if (request.destination === 'inspector') {structureExpanded=false;detailsOpen=false;changeMode('design');tools = 'palette';paletteRequested=true;palettePage='format';paletteFocus=Symbol('edit-handoff');return;}
    if (request.destination === 'data') selectedData = request.key ?? '';
    await tick();
    const selector = request.destination === 'layers' ? '.layers' : request.destination === 'data' ? '[data-structure-data]' : request.destination === 'actions' ? '[data-structure-actions]' : '.canvas';
    const element = canvasRoot?.closest('.studio-showcase')?.querySelector<HTMLElement>(selector);
    if (element instanceof HTMLDetailsElement) element.open = true;
    element?.scrollIntoView({ block: 'nearest' }); element?.focus({ preventScroll: true });
    notice = `Opened ${request.destination} for ${request.sourceId ?? request.key ?? 'selected source'} in this disposable example.`;
  }
  async function dispatch(actionId: string, input?: unknown) {
    if (!compilation?.ok || mode !== 'interact') return { ok: false, code: 'SHOWCASE_DESIGN_MODE' };
    const result = await screenDispatcher(compilation.plan, simulation).execute(actionId, input);
    notice = `Local simulation: ${result.message ?? (result.ok ? 'succeeded' : result.code)}`;
    return result;
  }
  function effective(occurrence: string, property: string) {
    const element = [...(canvasRoot?.querySelectorAll<HTMLElement>('[data-ui-occ]') ?? [])].find(entry => entry.dataset.uiOcc === occurrence && entry.getBoundingClientRect().width > 0);
    return element ? getComputedStyle(element).getPropertyValue(property) : undefined;
  }
</script>

<ControlScope class="vict-rhea">
<section class="studio-showcase" aria-label="Studio authoring showcase" data-showcase-recipe={recipeId} bind:this={showcaseRoot} bind:clientWidth={showcaseWidth}>
  <WorkspaceContextMenu scope={showcaseRoot} enabled={mode==='design'} resolve={canvasContext} owns={ownsCanvasTarget} />
  <header>
    <h2>Designer: all {showcaseCatalog.length} recipes</h2>
    <p>Real editor components, canonical edits, and valid parent compositions. Each example is disposable. Save and reopen use a private memory store; refreshing or changing recipes starts over.</p>
  </header>
  <div class="catalog-picker">
    <label>Search recipes <input type="search" bind:value={search} placeholder="Slider, menu, list…" /></label>
    <label>Recipe ({visibleRecipes.length} of {showcaseCatalog.length})
      <select aria-label="Showcase recipe" value={recipeId} disabled={blocked} onchange={event => openExample(event.currentTarget.value)}>
        {#if !visibleRecipes.some(entry => entry.id === recipeId)}<option value={recipeId}>{recipe?.label} (selected)</option>{/if}
        {#each visibleRecipes as entry}<option value={entry.id}>{entry.label} · {entry.category}</option>{/each}
      </select>
    </label>
    <button type="button" disabled={blocked} onclick={() => openExample(recipeId)}>Reset example</button>
  </div>
  {#if bridge && source && snapshot}
    <p><strong>{recipe?.label}</strong> — {recipe?.description} {#if recipe?.placements.length}This part is composed within {recipe.placements[0]?.definitionId} / {recipe.placements[0]?.slotName}.{/if}</p>
    <div class="toolbar" aria-label="Example controls">
      <button type="button" disabled={blocked} aria-expanded={documentOpen} onclick={() => { if(detailsOpen){detailsOpen=false;documentOpen=true;} else documentOpen = !documentOpen; }}>Document</button>
      <button type="button" disabled={blocked} aria-pressed={mode === 'design'} onclick={() => changeMode('design')}>Design</button>
      <button type="button" disabled={blocked} aria-pressed={mode === 'interact'} onclick={() => changeMode('interact')}>Interact</button>
      <button type="button" disabled={blocked || !snapshot.canUndo} onclick={() => history('undo')}>Undo</button>
      <button type="button" disabled={blocked || !snapshot.canRedo} onclick={() => history('redo')}>Redo</button>
      <button type="button" disabled={blocked || !compilation?.ok} onclick={save}>Save in memory</button>
      <button type="button" disabled={blocked || !saved} title="Discard working edits and reload this example’s saved memory revision" onclick={reopen}>Reopen saved</button>
      <button type="button" onclick={resetPreview}>Reset preview</button>
    </div>
    <p role="status" class="notice">{notice}</p>
    {#if issues.length}<ul class="issues" role="alert">{#each issues as issue}<li>{issue.code}: {issue.message}</li>{/each}</ul>{/if}
    <div class="editor-grid" class:document-open={rightOpen}>
      <aside class="layers showcase-document" hidden={!documentOpen || detailsOpen} tabindex="-1" aria-label="Example Document">
        <nav class="toolbar" aria-label="Example Document sections"><strong>Layers</strong><button type="button" aria-label="Inspect example source" aria-expanded={detailsOpen} onclick={()=>inspect()}>Inspect</button></nav>
        <div class="example-document-content">
          <div class="example-layers">{#if plan}<Layers {plan} document={source} selectedOccurrence={selected} onSelect={selectStructure} onApply={apply} componentDescriptors={catalogDescriptors} onOpenComposition={navigateComposition} />{/if}</div>
        </div>
      </aside>
      {#if detailsOpen}<aside class="showcase-document showcase-inspection" aria-label="Example Inspect"><SourceDetails document={source} selectedId={detailId} {blocked} bind:page={detailsPage} onClose={closeDetails} onSelect={selectDetail} onNavigate={structureNavigate} /></aside>{/if}
      <div class="preview-column" inert={detailsOpen && showcaseWidth < 1000}>
        <div class="composition-tools">
          <button type="button" disabled={blocked} onclick={() => { if (!blocked) { compositionFocus = exampleFocus; selectNode(targetNodeId); } }}>Select example part</button>
          <button type="button" disabled={blocked} onclick={() => openComposition()}>Open selected composition</button>
          {#if compositionFocus}<CompositionNavigator document={source} focus={compositionFocus} descriptors={catalogDescriptors} disabled={blocked} onNavigate={navigateComposition} />{/if}
        </div>
        <div class="canvas" class:structure-covered={structureOpen && structureExpanded} inert={structureOpen && structureExpanded} bind:this={canvasRoot}>
          {#key recipeId}
              <EditorCanvas document={source} catalogs={designerCatalogs} extensions={catalogDescriptors} extensionImplementations={catalogImplementations}
                {compositionFocus} onOpenComposition={openComposition} interactionMode={mode}
                selectedOccurrence={mode === 'design' ? selected : undefined} onSelect={select} onApply={apply}
                selectionTools={tools === 'palette' && mode === 'design' && paletteRequested ? palette : undefined} selectionToolsPinned={blocked}
                {dispatch} navigate={() => notice = 'This example has one screen.'}
                stateValues={runtimeValues} onStateChange={(key: string, value: UiValue) => runtimeValues = { ...runtimeValues, [key]: value }}
                {resetSignal} actionState={screenActionState} onPlan={(next: UiRenderPlan) => plan = next}
                onTextEditingChange={(dirty: boolean) => canvasDraft = dirty}
                onRenderDiagnostic={(diagnostic: { code: string; message: string }) => issues = [...issues.slice(-4), diagnostic]} ariaLabel="Showcase canvas" />
          {/key}
        </div>
        <StructureDock bind:open={structureOpen} bind:expanded={structureExpanded} availableHeight={600}><StructureView presentation="drawer" active={structureOpen} document={source} revision={snapshot.revision} {selectedNodeId} {blocked} descriptors={catalogDescriptors} recipes={screenRecipes} onSelect={selectStructure} onDeselect={() => { if (!blocked) {bridge?.select(undefined);detailId=undefined;} }} onMove={move} onNotice={message => notice = message} onNavigate={structureNavigate} onDismiss={() => {if(structureExpanded)structureExpanded=false;else structureOpen=false;}} onInspect={inspect} onCloseInspect={closeDetails} inspectionSelection={detailId} onInspectSelection={id=>detailId=id} inspectionExpanded={detailsOpen} objectCommands={occurrence=>objectContext(occurrence)?.commands??[]} /></StructureDock>
        <details><summary>Insert and arrange (Composer)</summary><Composer document={source} {selectedNodeId} recipes={screenRecipes} descriptors={catalogDescriptors} {compositionFocus} onApply={apply} onInserted={selectNode} onDetached={selectNode} /></details>
        <details data-structure-data tabindex="-1"><summary>Data: authored starting values</summary>
          <label>State declaration <select aria-label="Authored state declaration" value={selectedData} disabled={blocked} onchange={event => selectedData = event.currentTarget.value}><option value="">Choose a value</option>{#each Object.values(source.localState) as declaration}<option value={declaration.key}>{declaration.key} · {declaration.type}</option>{/each}</select></label>
          {#if selectedData}{#key `${recipeId}:${selectedData}`}<StateInitialEditor document={source} expression={{ type: 'ref', path: `state.${selectedData}` }} onApply={apply} onDirtyChange={(dirty: boolean) => dataDraft = dirty} />{/key}{/if}
        </details>
        <details data-structure-actions tabindex="-1"><summary>Actions: declared simulation</summary><p>This screen declares demo.submit. Its input is message and accepted; execution is simulated in Interact. Source relationships do not prove an action ran.</p><code>demo.submit → local screen simulation</code></details>
        <details><summary>Preview values (temporary runtime data)</summary><p>Interact changes these values. Action calls use the local screen simulation with no live effects.</p>{#key recipeId}<StateValuesPanel localState={source.localState} stateValues={runtimeValues} onChange={(key: string, value: UiValue | undefined) => { const next = { ...runtimeValues }; if (value === undefined) delete next[key]; else next[key] = value; runtimeValues = next; }} />{/key}</details>
      </div>
      <aside class="inspector" tabindex="-1"><h3>Selected source</h3>
        <div class="toolbar"><button type="button" disabled={blocked} aria-pressed={tools === 'inspector'} onclick={() => tools = 'inspector'}>Docked Inspector</button><button type="button" disabled={blocked} aria-pressed={tools === 'palette'} onclick={() => tools = 'palette'}>Selection palette</button></div>
        {#if tools === 'inspector'}<Inspector document={source} selectedOccurrence={selected} onApply={apply} lastIssues={issues} componentDescriptors={catalogDescriptors} knownActionIds={designerCatalogs.actionIds} knownRouteIds={designerCatalogs.routeIds} {actionInputs} readEffective={effective} onTextDraftChange={(dirty: boolean) => propertyDraft = dirty} />{:else}<p>Select source on the design canvas to use its floating Format, Insert, Arrange and Connect tools. F10 focuses the palette.</p>{/if}
      </aside>
    </div>
    <AuthoringGuidance document={source} />
    <details><summary>Canonical source (read only)</summary><pre>{JSON.stringify(source, null, 2)}</pre></details>
  {/if}
</section>
</ControlScope>

{#snippet palette()}
  {#if source && selectedNodeId}
    <SelectionPalette bind:page={palettePage} focusSignal={paletteFocus} name={compositionName(source, selectedNodeId)} format={formatTools} insert={insertTools} arrange={arrangeTools} connect={connectTools} locked={blocked} onOpenComposition={() => openComposition()} />
  {/if}
{/snippet}
{#snippet formatTools()}{#if source}<Inspector contextual document={source} selectedOccurrence={selected} onApply={apply} componentDescriptors={catalogDescriptors} readEffective={effective} onTextDraftChange={(dirty: boolean) => propertyDraft = dirty} />{/if}{/snippet}
{#snippet insertTools()}{#if source}<Composer compact document={source} {selectedNodeId} recipes={screenRecipes} descriptors={catalogDescriptors} {compositionFocus} showArrange={false} onApply={apply} onInserted={selectNode} />{/if}{/snippet}
{#snippet arrangeTools()}{#if source}<Composer compact document={source} {selectedNodeId} recipes={screenRecipes} descriptors={catalogDescriptors} {compositionFocus} showInsert={false} onApply={apply} onDetached={selectNode} />{/if}{/snippet}
{#snippet connectTools()}{#if source}<Inspector contextual section="Behavior" document={source} selectedOccurrence={selected} onApply={apply} componentDescriptors={catalogDescriptors} knownActionIds={designerCatalogs.actionIds} knownRouteIds={designerCatalogs.routeIds} {actionInputs} />{/if}{/snippet}

<style>
  .studio-showcase { color: #243047; font: 14px/1.5 system-ui, sans-serif; }
  h2 { font-size: 24px; margin: 0 0 12px; } h3 { font-size: 15px; margin: 0 0 12px; }
  header p { max-width: 900px; color: #59677b; }
  .catalog-picker, .toolbar, .composition-tools { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .catalog-picker { align-items: end; padding: 16px; background: #edf1f7; border-radius: 10px; }
  label { display: grid; gap: 4px; min-width: 0; max-width: 100%; } button, input, select { font: inherit; color: inherit; padding: 7px 10px; border: 1px solid #bdc8d8; border-radius: 6px; background: white; }
  input, select { min-width: 0; max-width: 100%; box-sizing: border-box; } select { width: 100%; }
  button { cursor: pointer; } button[aria-pressed=true] { background: #e3eaff; border-color: #627ccc; } :disabled { opacity: .5; cursor: default; }
  .notice { padding: 10px 12px; background: #eef3ff; border-radius: 6px; } .issues { color: #9d2828; }
  .editor-grid { position: relative; display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; align-items: start; }
  .editor-grid.document-open { grid-template-columns: minmax(340px, 1fr) minmax(280px, 360px); }
  .editor-grid > .preview-column { grid-column: 1; grid-row: 1; }
  .showcase-document { grid-column: 2; grid-row: 1; padding: 0; height: 600px; display: flex; flex-direction: column; }
  .showcase-document > nav { padding: 10px; flex-shrink: 0; }
  .example-document-content { display:flex; flex-direction:column; flex:1; min-height:0; position:relative; overflow:hidden; }
  .example-layers {overflow:auto;min-height:0;flex:1;}
  .showcase-document > div:not(.structure) { overflow: auto; }
  .showcase-document[hidden] { display: none; }
  .inspector { grid-column: 1 / -1; }
  aside { padding: 12px; background: white; border: 1px solid #d7dfe9; border-radius: 8px; max-height: 850px; overflow: auto; min-width: 0; }
  .canvas.structure-covered { height:0; border:0; visibility:hidden; }
  .preview-column { min-width: 0; } .composition-tools { margin-bottom: 10px; }
  .canvas { height: 560px; overflow: auto; border: 1px solid #d7dfe9; background: white; border-radius: 8px; container: studio-screen / inline-size; }
  details { border: 1px solid #d7dfe9; border-radius: 8px; background: white; padding: 12px; margin-top: 12px; }
  summary { cursor: pointer; font-weight: 600; } details[open] > summary { margin-bottom: 14px; } pre { overflow: auto; max-height: 400px; font-size: 12px; }
  @media(max-width: 1100px) { .editor-grid.document-open { grid-template-columns: minmax(0, 1fr); } .showcase-document { grid-column: 1; grid-row: 2; height: 480px; } .inspector { grid-column: 1 / -1; max-height: none; } }
  @media(max-width:1100px) { .showcase-inspection { position:absolute; top:0; right:0; grid-column:1; grid-row:1; width:min(360px,100%); height:600px; z-index:20; } }
  @media(max-width: 700px) { aside { margin-bottom: 12px; } .catalog-picker label { width: 100%; } .canvas { height: 460px; } }
</style>
