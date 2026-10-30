<script lang="ts">
  import './disclosures.css';
  import { onMount } from 'svelte';
  import { applyUiEdit, type UiDocument, type UiStyleSource } from '@victframework/ui';
  import { EditorBridge, attachStyleSource, defineStyleSource, type TransactionDraft } from '@victframework/ui-editor';
  import { DocumentHost } from '@victframework/ui-svelte';
  import { catalogDescriptors, catalogImplementations, compileScreen, designerCatalogs, newScreen } from './application.js';
  import { screenPlacementIssues } from './placement.js';
  import { screenStore } from './storage.js';

  const sharedId = 'shared-card';
  const declarations = (values: Record<string, string>): UiStyleSource['declarations'] => Object.entries(values).map(([property, value]) => ({ property, value: { type: 'text', value } }));
  function cardStyle(plum: boolean): UiStyleSource {
    return { id: sharedId, declarations: declarations({
      flex: '1 1 140px', 'min-width': '0', padding: '16px', 'border-radius': '10px',
      border: `1px solid ${plum ? '#d9c9e6' : '#cad8ef'}`,
      'background-color': plum ? '#f4edf8' : '#edf3ff', color: plum ? '#59366d' : '#284977',
      'font-size': '14px', 'line-height': '1.5', 'font-weight': '600',
    }) };
  }

  // Bootstrap one disposable canonical fixture through public commands, then
  // open its clean editor session. No second source store or owner screen.
  let initial: UiDocument = {
    ...newScreen('Shared style example', 'core-shared-style-fixture'),
    localState: {}, conditions: {},
    nodes: {
      screen: { kind: 'element', id: 'screen', tag: 'main', attributes: { 'aria-label': 'Two cards sharing one style source' }, children: ['card-a', 'card-b'], localStyle: declarations({ display: 'flex', 'flex-wrap': 'wrap', gap: '12px', padding: '8px', 'font-family': 'system-ui, sans-serif' }) },
      'card-a': { kind: 'element', id: 'card-a', tag: 'article', attributes: { 'aria-label': 'Launch brief card' }, children: ['copy-a'] },
      'card-b': { kind: 'element', id: 'card-b', tag: 'article', attributes: { 'aria-label': 'Project status card' }, children: ['copy-b'] },
      'copy-a': { kind: 'text', id: 'copy-a', content: { type: 'literal', value: 'Launch brief' } },
      'copy-b': { kind: 'text', id: 'copy-b', content: { type: 'literal', value: 'Project status' } },
    },
  };
  function seed(draft: TransactionDraft) {
    const result = applyUiEdit({ document: initial, revision: 'fixture' }, { ...draft, expectedDocumentRevision: 'fixture' }, designerCatalogs);
    if (!result.ok) throw new Error(result.issues.map(issue => issue.code).join(', '));
    initial = result.document;
  }
  seed(defineStyleSource({ requestId: 'seed-shared-style', document: initial, source: cardStyle(false) }));
  for (const nodeId of ['card-a', 'card-b']) seed(attachStyleSource({ requestId: `attach-${nodeId}`, document: initial, sourceId: sharedId, nodeId }));
  const memory = new Map<string, string>();
  const bridge = new EditorBridge({ catalogs: designerCatalogs, validateDocument: screenPlacementIssues, initial: { document: initial, storedRevision: 'r1' }, store: screenStore({ getItem: key => memory.get(key) ?? null, setItem: (key, value) => { memory.set(key, value); } }, initial.id) });
  let version = $state(0);
  onMount(() => bridge.subscribe(() => { version++; }));
  const source = $derived.by(() => { void version; return bridge.document; });
  const snapshot = $derived.by(() => { void version; return bridge.getSnapshot(); });
  const compiled = $derived(compileScreen(source));
  const plan = $derived(compiled.ok ? Object.values(compiled.plan.documentPlans ?? {})[0] : undefined);
  const plum = $derived(source.styleSources[sharedId]?.declarations.some(item => item.property === 'background-color' && item.value.type === 'text' && item.value.value === '#f4edf8') ?? false);
  let saved = $state(false);
  let notice = $state('Two attachments · one canonical style source.');
  let resetSignal = $state(Symbol('shared-style-preview'));
  let receipt = $state<Record<string, unknown>>({ action: 'Fixture ready', sourceId: sharedId, attachedNodes: ['card-a', 'card-b'], savedInMemory: false });
  function record(action: string, ok: boolean, result: unknown) {
    const current = bridge.getSnapshot();
    receipt = { action, ok, revision: current.revision, contentDigest: current.contentDigest, dirty: current.dirty, storedRevision: current.storedRevision, savedInMemory: saved, result };
  }
  function updateShared() {
    try {
      const result = bridge.apply(defineStyleSource({ requestId: crypto.randomUUID(), document: bridge.document, source: cardStyle(!plum), replace: true }));
      notice = result.ok ? 'Shared declarations updated for both cards · one Undo.' : 'Style update refused; source preserved.';
      record('Replace shared style', result.ok, result.ok ? { sourceId: sharedId, attachedNodes: ['card-a', 'card-b'] } : result);
    } catch (error) { notice = 'Style update refused; source preserved.'; record('Replace shared style', false, { code: error instanceof Error ? error.name : 'StyleSourceEditError' }); }
  }
  function history(action: 'undo' | 'redo') {
    const result = bridge[action]();
    notice = result.ok ? `${action === 'undo' ? 'Undid' : 'Redid'} the shared style change on both cards.` : 'History action refused.';
    record(action, result.ok, result.ok ? { sourceId: sharedId } : result);
  }
  function save() {
    const result = bridge.save();
    if (result.ok) saved = true;
    notice = result.ok ? 'Canonical source saved in this fixture’s private memory store.' : 'Save refused; source preserved.';
    record('Explicit memory Save', result.ok, result);
  }
  function reopen() {
    const result = bridge.reopen();
    if (result.ok) resetSignal = Symbol('shared-style-reopen');
    notice = result.ok ? 'Saved canonical source reopened; preview runtime reset.' : 'Reopen refused; working source preserved.';
    record('Reopen saved source', result.ok, result);
  }
</script>

<section class="shared-style-showcase" aria-label="Actual shared style source editing">
  <div class="heading"><h3>One style, two cards</h3><span>Actual canonical editing · no provider</span></div>
  <div class="controls" aria-label="Shared style example commands">
    <button type="button" onclick={updateShared}>Use {plum ? 'blue' : 'plum'}</button>
    <button type="button" onclick={() => history('undo')} disabled={!snapshot.canUndo}>Undo</button>
    <button type="button" onclick={() => history('redo')} disabled={!snapshot.canRedo}>Redo</button>
    <button type="button" onclick={save} disabled={!snapshot.dirty && saved}>Save in memory</button>
    <button type="button" onclick={reopen} disabled={!saved} title="Restore the last explicit memory Save; discard this fixture’s unsaved changes">Reopen saved</button>
  </div>
  <div class="preview">
    {#if plan}<DocumentHost {plan} localState={source.localState} extensionDescriptors={catalogDescriptors} extensionImplementations={catalogImplementations} {resetSignal} dispatch={async () => ({ ok: false, code: 'FIXTURE_HAS_NO_ACTIONS' })} navigate={() => {}} ariaLabel="Shared style rendered cards" />{:else}<p role="alert">This fixture could not compile.</p>{/if}
  </div>
  <p class="notice" role="status">{notice}</p>
  <p class="scope">Preview runtime is temporary. Save stores canonical source only in this private memory example; refresh discards it.</p>
  <details class="studio-disclosure"><summary>Actual source and last receipt</summary><pre>{JSON.stringify({ canonicalSource: source, receipt }, null, 2)}</pre></details>
</section>

<style>
  .shared-style-showcase{margin-top:24px;padding:16px;border:1px solid #d7dfe9;border-radius:9px;background:#fff;color:#263246;min-width:0;font:12px/1.5 system-ui,sans-serif}
  .heading{display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:4px 16px}.heading h3{margin:0;font-size:16px}.heading span,.scope{color:#617088;font-size:11px}
  .controls{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 8px}.controls button{border:1px solid #c5d0e0;border-radius:5px;background:#fff;color:#284977;padding:5px 9px;font:inherit;cursor:pointer}.controls button:disabled{opacity:.5;cursor:default}
  button:focus-visible,summary:focus-visible{outline:2px solid #355cc9;outline-offset:3px}.preview{max-height:140px;overflow:auto;min-width:0;border:1px solid #e5eaf2;border-radius:7px}.notice{margin:8px 0 3px}.scope{margin:0}details{margin-top:8px}summary{cursor:pointer;color:#355cc9}pre{max-height:220px;margin:8px 0 0;padding:10px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;background:#f4f7fb;border-radius:5px;font-size:11px}
</style>
