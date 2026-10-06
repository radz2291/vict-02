<script lang="ts">
  const browser = typeof window !== 'undefined';
  import { tick } from 'svelte';
  import { EditorBridge, EditorCanvas, Inspector, Layers, createLocalStorageDocumentStore, type TransactionDraft } from '@victframework/ui-editor';
  import { compileUiDocument, validateUiDocument } from '@victframework/ui';
  import { reviewDocument, reviewLabels, reviewCatalogs, REVIEW_STORE_KEY } from './review-document';
  const memory = new Map<string, string>();
  const store = createLocalStorageDocumentStore(browser ? window.localStorage : { getItem: key => memory.get(key) ?? null, setItem: (key, value) => void memory.set(key, value) }, { key: REVIEW_STORE_KEY, format: 'vict.inspector-review@1', seedStoredRevision: '1', validateDocument: d => validateUiDocument(d, reviewCatalogs) });
  const loaded = store.load();
  const bridge = new EditorBridge({ store, initial: loaded.status === 'loaded' ? loaded : { document: reviewDocument, storedRevision: loaded.status === 'invalid' ? loaded.storedRevision ?? '1' : '1' } });
  let version = $state(0);
  let status = $state(loaded.status === 'invalid' ? `Stored data could not open: ${loaded.message}. ${loaded.overwritable ? 'Successful save will replace it.' : 'Bytes preserved; save will refuse.'}` : 'Edits are local until saved.');
  let issues = $state<readonly { code: string; message: string }[]>([]);
  let panel = $state('Inspector');
  let size = $state('Full');
  let canvas = $state<HTMLElement | undefined>(undefined);
  let domVersion = $state(0);
  $effect(() => bridge.subscribe(() => version++));
  const working = $derived.by(() => { version; return bridge.document; });
  const snapshot = $derived.by(() => { version; return bridge.getSnapshot(); });
  const selected = $derived(snapshot.selectedOccurrence);
  const compiled = $derived(compileUiDocument(working, reviewCatalogs.elements, [], { actionIds: reviewCatalogs.actionIds }));
  $effect(() => { version; size; void tick().then(() => domVersion++); });
  $effect(() => {
    if (!browser || !canvas) return;
    const observer = new ResizeObserver(() => domVersion++);
    observer.observe(canvas);
    const refresh = () => domVersion++;
    window.addEventListener('resize', refresh);
    return () => { observer.disconnect(); window.removeEventListener('resize', refresh); };
  });
  function apply(draft: TransactionDraft) { const result = bridge.apply(draft); issues = result.ok ? [] : result.issues; status = result.ok ? 'Change applied. Save to keep it.' : 'Change rejected; source unchanged.'; }
  function select(occurrence: string) { bridge.select(occurrence); panel = 'Inspector'; }
  function effective(occurrence: string, property: string) {
    domVersion;
    const element = canvas ? Array.from(canvas.querySelectorAll<HTMLElement>('[data-ui-occ]')).find(e => e.dataset.uiOcc === occurrence) : undefined;
    return element ? getComputedStyle(element).getPropertyValue(property) : undefined;
  }
  function save() { const result = bridge.save(); issues = result.ok ? [] : result.issues; status = result.ok ? `Saved · revision ${result.storedRevision}` : 'Save refused. Stored bytes unchanged.'; }
  function reopen() { const result = bridge.reopen(); status = result.ok ? `Reopened · revision ${result.storedRevision}` : `Reopen refused: ${result.code}`; }
</script>
<svelte:head><title>Inspector & Layers · VICT review</title></svelte:head>
{#if browser}
<div class="review">
  <header class="toolbar"><div><strong>VICT / Editor review</strong><span>Inspector & Layers usability candidate</span></div><nav aria-label="Editing history"><button type="button" disabled={!snapshot.canUndo} onclick={() => bridge.undo()}>Undo</button><button type="button" disabled={!snapshot.canRedo} onclick={() => bridge.redo()}>Redo</button><button type="button" onclick={save}>Save</button><button type="button" onclick={reopen}>Reopen saved</button></nav></header>
  <div class="status" role="status">{status} <span>{snapshot.dirty ? 'Unsaved changes' : 'No unsaved changes'}</span></div>
  <nav class="mobile" aria-label="Review panels">{#each ['Canvas', 'Layers', 'Inspector'] as name}<button type="button" aria-pressed={panel === name} onclick={() => panel = name}>{name}</button>{/each}</nav>
  <div class="workspace">
    <div class="layers" class:active={panel === 'Layers'}>{#if compiled.ok}<Layers plan={compiled.plan} document={working} labels={reviewLabels} selectedOccurrence={selected} onSelect={select} scope={{ view: {}, record: {}, state: {}, tokens: {} }} />{/if}</div>
    <main class="canvas-area" class:active={panel === 'Canvas'}><div class="canvas-tools"><span>Page preview</span><label>Preview width<select aria-label="Preview width" bind:value={size}>{#each ['Full', '480', '390'] as width}<option>{width}</option>{/each}</select></label></div><div class="scroll"><div class="canvas" bind:this={canvas} style:width={size === 'Full' ? '100%' : `${size}px`}><EditorCanvas document={working} catalogs={reviewCatalogs} selectedOccurrence={selected} onSelect={select} dispatch={async id => { status = `Preview action: ${reviewLabels.actions?.[id] ?? id}. No backend effect in this review fixture.`; }} navigate={() => {}} /></div></div></main>
    <div class="inspector" class:active={panel === 'Inspector'}><Inspector document={working} selectedOccurrence={selected} onApply={apply} lastIssues={issues} labels={reviewLabels} knownActionIds={reviewCatalogs.actionIds} knownTokenIds={Object.keys(working.tokens)} styleConditions={[{ id: 'narrow', label: 'Window ≤ 700px' }, { id: 'compact', label: 'Canvas ≤ 480px' }]} readEffective={effective} /></div>
  </div>
</div>
{/if}
<style>
  .review { font: 13px/1.5 system-ui, sans-serif; color: #202938; background: #e7ebf1; }
  .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 20px; background: #fff; border-bottom: 1px solid #d7dce5; }
  .toolbar span { display: block; font-size: 11px; color: #667085; }
  button, select { font: inherit; padding: 6px 9px; border: 1px solid #cbd3df; border-radius: 5px; background: #fff; color: inherit; cursor: pointer; margin: 2px; }
  button:disabled { opacity: .4; } :focus-visible { outline: 2px solid #365bd7; outline-offset: 2px; }
  .status { padding: 7px 20px; font-size: 11px; border-bottom: 1px solid #d7dce5; display: flex; justify-content: space-between; gap: 16px; }
  .workspace { display: grid; grid-template-columns: 220px minmax(0, 1fr) 320px; height: calc(100vh - 180px); min-height: 500px; }
  .layers, .inspector { min-width: 0; overflow: auto; border-right: 1px solid #d7dce5; background: #f8f9fb; }
  .inspector { border-right: 0; border-left: 1px solid #d7dce5; }
  .canvas-area { min-width: 0; display: flex; flex-direction: column; }
  .canvas-tools { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 16px; font-size: 11px; }
  .scroll { overflow: auto; flex: 1; padding: 16px; }
  .canvas { margin: auto; container: review-canvas / inline-size; }
  .mobile { display: none; }
  @media(max-width: 1100px) { .workspace { grid-template-columns: 180px minmax(0, 1fr) 300px; } }
  @media(max-width: 700px) {
    .toolbar { flex-wrap: wrap; padding: 10px; } .toolbar nav { display: flex; flex-wrap: wrap; }
    .status { padding: 8px 10px; flex-wrap: wrap; gap: 2px; }
    .mobile { display: flex; padding: 7px; } .mobile button { flex: 1; } .mobile [aria-pressed=true] { background: #edf1ff; color: #365bd7; }
    .workspace { display: block; height: calc(100vh - 255px); min-height: 400px; }
    .layers, .canvas-area, .inspector { display: none; height: 100%; } .active { display: block; } .canvas-area.active { display: flex; }
    .scroll { padding: 8px; }
  }
</style>


