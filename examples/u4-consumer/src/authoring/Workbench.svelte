<script lang="ts">
  /**
   * The consumer's authoring workbench: the SAME control edited through
   * select → inspect/edit → connect outputs → undo/redo → save → reload →
   * replayed by the finished app (§6 catalog proof). Editor modules are
   * @victframework/ui-editor; document semantics stay in the frozen session
   * engine. Preview state seeds the canvas run only.
   */
  import { tick, untrack } from 'svelte';
  import { ControlScope } from '@victframework/ui-svelte';
  import type { UiRenderPlan, UiValue } from '@victframework/ui';
  import {
    EditorBridge,
    EditorCanvas,
    HistoryPanel,
    Inspector,
    Layers,
    StateValuesPanel,
    createLocalStorageDocumentStore,
  } from '@victframework/ui-editor';
  import { createPreviewSession } from '@victframework/ui-preview';
  import { createConsumerAdapter, createConsumerDispatcher } from '../product/execution.js';
  import {
    consumerCatalogs, consumerActionInputs, documentIssues,
    catalogDescriptors,
    catalogImplementations,
    compileConsumerDocuments,
  } from '../product/registrations.js';
  import {
    consumerActionIds, consumerActions, consumerActionState, consumerViewFor,
    consumerViewFields,
  } from '../product/definition.js';
  import { inspectionDocuments, inspectionRoutes, type ConsumerRouteId } from '../product/operations.js';
  import type { UiDocument } from '@victframework/ui';

  type DocId = ConsumerRouteId;
  interface Blade {
    readonly id: DocId;
    readonly label: string;
    readonly seed: UiDocument;
    readonly storeKey: string;
    readonly bridge: EditorBridge;
  }

  const SEED_REVISION = 'r1';
  const FORMAT = 'vict.u4-consumer-store@1';

  function openStore(key: string) {
    return createLocalStorageDocumentStore(
      typeof localStorage !== 'undefined' ? localStorage : memoryStorage(),
      { key, format: FORMAT, seedStoredRevision: SEED_REVISION, validateDocument: documentIssues },
    );
  }
  function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
    const map = new Map<string, string>();
    return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
  }

  let loadIssues = $state<string[]>([]);
  function openBlade(id: DocId, label: string, seed: UiDocument): Blade {
    const store = openStore(`u4-consumer.${id}`);
    const stored = store.rawLoad();
    if (stored.status === 'invalid') loadIssues.push(stored.message);
    const initial =
      stored.status === 'loaded'
        ? { document: stored.document, storedRevision: stored.storedRevision }
        : { document: seed, storedRevision: stored.status === 'invalid' && stored.storedRevision ? stored.storedRevision : SEED_REVISION };
    return {
      id,
      label,
      seed,
      storeKey: `u4-consumer.${id}`,
      bridge: new EditorBridge({ store, initial, catalogs: consumerCatalogs }),
    };
  }

  const blades: Blade[] = $state(inspectionRoutes.map(route => openBlade(route.id, route.label,
    inspectionDocuments.find(document => document.id === route.documentId)!)));
  let currentId = $state<DocId>('queue');
  let version = $state(0);
  const current = $derived(blades.find((blade) => blade.id === currentId) ?? blades[0]);
  const snapshotState = $derived.by(() => {
    void version;
    return current.bridge.getSnapshot();
  });
  const workingDocument = $derived.by(() => {
    void version;
    return current.bridge.document;
  });
  $effect(() => {
    const unsubs = blades.map((blade) => blade.bridge.subscribe(() => (version += 1)));
    return () => unsubs.forEach((unsub) => unsub());
  });

  let selectedOccurrence = $state<string | undefined>(undefined);
  let plan = $state<UiRenderPlan | undefined>(undefined);
  let lastIssues = $state<readonly { code: string; message: string }[]>([]);
  let stateByDocument = $state<Record<DocId, Record<string, UiValue>>>({ controls: {}, shell: {}, queue: {}, detail: {}, schedule: {} });
  const stateValues = $derived(stateByDocument[currentId]);
  let resetSignal = $state(Symbol('preview'));
  let simulation = $state({ denied: false, failNext: false });
  const adapter = createConsumerAdapter(simulation);
  let preview = createPreviewSession({
    scenario: { schema: 'vict.ui-scenario@1', scenarioId: 'u4.task-preview', references: { application: { id: 'u4.consumer', revision: '1' }, documents: {} },
      seeds: { domain: { rows: {} } }, actors: [{ actorId: 'consumer', role: 'reviewer', permissions: ['task.write'] }],
      operations: consumerActions.map(action => ({ op: `${action.resourceId}:${action.op}`, implementation: 'simulated' })), resetBoundary: 'session' },
    dataAdapter: { adapter, context: actor => ({ permissions: actor.permissions, effect: 'write', actor: actor.actorId }) },
  });
  const productCompilation = $derived.by(() => { void version; return compileConsumerDocuments(blades.map(blade => blade.bridge.document)); });
  const productView = $derived(consumerViewFor(blades.map(blade => blade.bridge.document), currentId));
  function resetRuntime() { adapter.reset(); preview = preview.reset(); resetSignal = Symbol('preview-reset'); stateByDocument[currentId] = {}; }
  $effect(() => { void currentId; untrack(resetRuntime); });
  let activity = $state<string[]>([]);
  function log(text: string): void {
    const stamp = new Date().toLocaleTimeString();
    activity = [...activity.slice(-60), `${stamp} ${text}`];
  }
  function select(occurrence: string): void {
    current.bridge.select(occurrence);
    selectedOccurrence = occurrence;
  }

  const catalogs = consumerCatalogs;

  function applyDraft(draft: Parameters<EditorBridge['apply']>[0]): void {
    const outcome = current.bridge.apply(draft);
    lastIssues = outcome.ok ? [] : outcome.issues;
    if (outcome.ok) {
      const command = draft.commands[0];
      const target = 'nodeId' in command ? command.nodeId : '';
      log(`Applied ${command.op} on ${target}`);
    } else {
      const first = outcome.issues[0];
      log(`Refused: ${first?.code ?? 'UNKNOWN'} — ${first?.message ?? ''}`);
    }
  }
  function undo(): void {
    const outcome = current.bridge.undo();
    log(outcome.ok ? 'Undo' : 'Undo refused (nothing to undo)');
  }
  function redo(): void {
    const outcome = current.bridge.redo();
    log(outcome.ok ? 'Redo' : 'Redo refused (nothing to redo)');
  }
  function save(): void {
    const outcome = current.bridge.save();
    if (outcome.ok) log(`Saved revision ${outcome.storedRevision}`);
    else log(`Save FAILED: ${outcome.issues[0]?.code ?? 'UNKNOWN'}`);
  }
  function reloadStored(): void {
    const result = current.bridge.reopen();
    if (result.ok) {
      selectedOccurrence = undefined;
      resetRuntime();
      log(`Reopened stored revision ${result.storedRevision}`);
    } else {
      log(`Reopen refused (${result.code})`);
    }
  }
  function resetSeed(): void {
    // No bridge reset op exists (records stay authoritative): clearing the
    // envelope + reloading re-seeds from the committed seed document.
    if (typeof localStorage !== 'undefined') localStorage.removeItem(current.storeKey);
    location.reload();
  }

  async function dispatch(actionId: string, input?: unknown): Promise<unknown> {
    const compilation = productCompilation;
    if (!compilation.ok) return { ok: false, code: 'APPLICATION_INVALID', message: 'The working application cannot compile.' };
    const dispatcher = createConsumerDispatcher(compilation.plan, adapter, async (op, payload) => { const result = await preview.run(op, payload); return result.ok ? { ok: true, value: result.value } : { ok: false, code: result.code, message: result.message }; });
    const result = await dispatcher.execute(actionId, input);
    log(`${actionId}: ${result.ok ? result.message ?? 'Succeeded' : result.message}`);
    return result;
  }
  function navigate(routeId: string): void {
    if (inspectionRoutes.some(route => route.id === routeId)) { currentId = routeId as DocId; selectedOccurrence = undefined; }
  }
  function readEffective(occurrence: string, property: string): string | undefined {
    const targets = Array.from(globalThis.document.querySelectorAll<HTMLElement>('[data-ui-occ]')).filter(element => element.dataset.uiOcc === occurrence);
    const primary = targets.find(element => element.hasAttribute('data-ui-primary'));
    // A closed primary part has no measurable value; its trigger is a separate part.
    const target = primary ? (primary.getBoundingClientRect().width > 0 ? primary : undefined) : targets.find(element => element.dataset.uiPart === undefined && element.getBoundingClientRect().width > 0);
    return target ? getComputedStyle(target).getPropertyValue(property) : undefined;
  }
</script>

<ControlScope>
<div class="vict-app">
<div class="consumer-workbench">
  <nav class="rail" aria-label="Workbench controls">
    <span class="rail-heading">Documents</span>
    {#each blades as blade (blade.id)}
      <button type="button" aria-pressed={currentId === blade.id} onclick={() => { currentId = blade.id; selectedOccurrence = undefined; }}>
        {blade.label}
      </button>
    {/each}
    <span class="rail-heading">Edit</span>
    <button type="button" onclick={undo} disabled={!snapshotState?.canUndo}>Undo</button>
    <button type="button" onclick={redo} disabled={!snapshotState?.canRedo}>Redo</button>
    <button type="button" onclick={save}>Save</button>
    <button type="button" onclick={reloadStored}>Reload stored</button>
    <button type="button" onclick={resetSeed}>Reset to seed</button>
    <span class="rail-heading">Status</span>
    <span class="status">{snapshotState?.dirty ? 'Unsaved changes' : 'Saved'} · rev {snapshotState?.storedRevision}</span>
    <a class="app-link" href={`/app.html?doc=${currentId}`} target="_blank" rel="noreferrer">Open finished app ↗</a>
  </nav>

  <div class="main">
    {#each loadIssues as issue}<p role="alert">{issue}. Using the seed; saved bytes are preserved.</p>{/each}
    <fieldset><legend>Simulated execution</legend>
      <label><input type="checkbox" bind:checked={simulation.denied} /> Deny write permission</label>
      <label><input type="checkbox" bind:checked={simulation.failNext} /> Fail the next operation</label>
      <button type="button" onclick={resetRuntime}>Reset preview state</button>
    </fieldset>
    <div class="canvas-scroll">
      <EditorCanvas
        document={workingDocument}
        view={productView}
        {catalogs}
        extensions={catalogDescriptors}
        extensionImplementations={catalogImplementations}
        {stateValues}
        {resetSignal}
        actionState={consumerActionState}
        onStateChange={(key, value) => stateByDocument[currentId] = { ...stateValues, [key]: value }}
        selectedOccurrence={selectedOccurrence}
        onSelect={select}
        {dispatch}
        {navigate}
        onRenderDiagnostic={(diagnostic) => log(`RENDER ${diagnostic.code}: ${diagnostic.message}`)}
        onPlan={(compiledPlan) => { plan = compiledPlan; void tick(); }}
        ariaLabel={`${current.label} canvas`}
      />
    </div>
  </div>

  <div class="inspector">
    <StateValuesPanel
      localState={workingDocument.localState}
      {stateValues}
      onChange={(key, value) => {
        const next = { ...stateValues };
        if (value === undefined) delete next[key];
        else next[key] = value;
        stateByDocument[currentId] = next;
      }}
    />
    <Inspector
      document={workingDocument}
      {selectedOccurrence}
      onApply={applyDraft}
      lastIssues={[...lastIssues, ...(plan?.diagnostics ?? [])]}
      knownActionIds={consumerActionIds}
      knownRouteIds={inspectionRoutes.map(route => route.id)}
      actionInputs={consumerActionInputs}
      {readEffective}
      knownViewFields={consumerViewFields}
      componentDescriptors={catalogDescriptors}
    />
    {#if plan !== undefined}
      <Layers
        {plan}
        document={workingDocument}
        {selectedOccurrence}
        onSelect={select}
        scope={{ view: productView, record: {}, state: stateValues, tokens: {} }}
        ariaLabel="Layers"
      />
    {/if}
    <HistoryPanel
      revision={snapshotState?.revision ?? ''}
      storedRevision={snapshotState?.storedRevision ?? ''}
      dirty={snapshotState?.dirty ?? false}
      canUndo={snapshotState?.canUndo ?? false}
      canRedo={snapshotState?.canRedo ?? false}
      onUndo={undo}
      onRedo={redo}
      onSave={save}
      onReopen={reloadStored}
    />
    <details class="activity" open>
      <summary>Activity</summary>
      <ul>
        {#each activity as line (line)}<li>{line}</li>{/each}
      </ul>
    </details>
  </div>
</div>
</div>
</ControlScope>

<style>
  .consumer-workbench { display: grid; grid-template-columns: 170px minmax(0, 1fr) 340px; height: 100vh; font: 13px/1.5 system-ui, sans-serif; color: #1c2430; background: #fff; }
  .rail { border-right: 1px solid #dfe4ec; padding: 12px 10px; display: flex; flex-direction: column; gap: 6px; background: #f6f8fb; }
  .rail-heading { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #67758c; margin-top: 6px; }
  .rail button, .rail .app-link { text-align: left; padding: 6px 9px; border: 1px solid #dfe4ec; border-radius: 6px; background: #fff; cursor: pointer; color: inherit; text-decoration: none; font-size: 12.5px; }
  .rail button[aria-pressed='true'] { background: #e8efff; border-color: #b8cbf5; }
  .status { font-size: 11.5px; color: #67758c; }
  .main { display: flex; flex-direction: column; min-width: 0; }
  .canvas-scroll { overflow: auto; flex: 1; padding: 18px; }
  .inspector { border-left: 1px solid #dfe4ec; overflow: auto; background: #f8f9fb; }
  .activity { margin: 8px; font-size: 11.5px; }
  .activity ul { max-height: 160px; overflow: auto; margin: 4px 0; padding-left: 16px; }
  @media (max-width: 980px) {
    .consumer-workbench { grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 1fr) auto; height: auto; min-height: 100vh; }
    .rail { flex-direction: row; flex-wrap: wrap; align-items: center; border-right: 0; border-bottom: 1px solid #dfe4ec; }
    .inspector { border-left: 0; border-top: 1px solid #dfe4ec; }
  }
</style>
