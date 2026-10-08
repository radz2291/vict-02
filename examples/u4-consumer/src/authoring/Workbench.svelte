<script lang="ts">
  /**
   * The consumer's authoring workbench: the SAME control edited through
   * select → inspect/edit → connect outputs → undo/redo → save → reload →
   * replayed by the finished app (§6 catalog proof). Editor modules are
   * @victframework/ui-editor; document semantics stay in the frozen session
   * engine. Preview state seeds the canvas run only.
   */
  import { tick } from 'svelte';
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
  import {
    b1CatalogDescriptors,
    b1CatalogImplementations,
    compileConsumerDocuments,
  } from '../product/registrations.js';
  import {
    consumerActionIds,
    consumerViewData,
    consumerViewFields,
  } from '../product/definition.js';
  import { taskControlsDocument, taskShellDocument } from '../product/documents.js';

  type DocId = 'controls' | 'shell';
  interface Blade {
    readonly id: DocId;
    readonly label: string;
    readonly seed: typeof taskControlsDocument;
    readonly storeKey: string;
    readonly bridge: EditorBridge;
  }

  const SEED_REVISION = 'r1';
  const FORMAT = 'vict.u4-consumer-store@1';

  function openStore(key: string) {
    return createLocalStorageDocumentStore(
      typeof localStorage !== 'undefined' ? localStorage : memoryStorage(),
      { key, format: FORMAT, seedStoredRevision: SEED_REVISION },
    );
  }
  function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
    const map = new Map<string, string>();
    return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
  }

  function openBlade(id: DocId, label: string, seed: typeof taskControlsDocument): Blade {
    const store = openStore(`u4-consumer.${id}`);
    const stored = store.rawLoad();
    const initial =
      stored.status === 'loaded'
        ? { document: stored.document, storedRevision: stored.storedRevision }
        : { document: seed, storedRevision: SEED_REVISION };
    return {
      id,
      label,
      seed,
      storeKey: `u4-consumer.${id}`,
      bridge: new EditorBridge({ store, initial }),
    };
  }

  const blades: Blade[] = $state([
    openBlade('controls', 'Task controls', taskControlsDocument),
    openBlade('shell', 'App shell + dialog', taskShellDocument),
  ]);
  let currentId = $state<DocId>('controls');
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
  let stateValues = $state<Record<string, UiValue>>({});
  let activity = $state<string[]>([]);
  function log(text: string): void {
    const stamp = new Date().toLocaleTimeString();
    activity = [...activity.slice(-60), `${stamp} ${text}`];
  }
  function select(occurrence: string): void {
    current.bridge.select(occurrence);
    selectedOccurrence = occurrence;
  }

  const catalogs = {
    ...{ elements: { elements: [], globalAttributes: ['role', 'aria-label', 'data-test-id'] } },
    actionIds: consumerActionIds,
    viewFields: consumerViewFields,
  };
  const compilePlan = compileConsumerDocuments();
  if (!compilePlan.ok) {
    log(`SEEDED DOCUMENTS FAILED TO COMPILE (${compilePlan.issues.length} issues)`);
  }

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

  // Declared-action feedback: the app's own action authority (unchanged by
  // the component ABI). Button loading is authored state wired reactively.
  async function dispatch(actionId: string, input?: unknown): Promise<unknown> {
    log(`Action ${actionId} ${input ? JSON.stringify(input) : ''}`);
    if (actionId === 'task.submit') {
      applyDraft({
        requestId: `app-loading-${Date.now()}`,
        commands: [
          { op: 'bindExpression', nodeId: 'submitBtn', target: { kind: 'prop', name: 'loading' }, expression: { type: 'literal', value: true } },
        ],
      });
      await new Promise((resolve) => setTimeout(resolve, 500));
      applyDraft({
        requestId: `app-done-${Date.now()}`,
        commands: [
          { op: 'bindExpression', nodeId: 'submitBtn', target: { kind: 'prop', name: 'loading' }, expression: { type: 'literal', value: false } },
        ],
      });
    }
    if (actionId === 'task.assign') {
      applyDraft({
        requestId: `app-close-${Date.now()}`,
        commands: [
          { op: 'setOutputBinding', nodeId: 'assignTrigger', output: 'openChange', binding: { setState: { key: 'assignOpen', value: { type: 'literal', value: false } } } },
        ],
      });
    }
    return { ok: true };
  }
  function navigate(): void {}
</script>

<ControlScope>
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
    <a class="app-link" href="/app.html" target="_blank" rel="noreferrer">Open finished app ↗</a>
  </nav>

  <div class="main">
    <div class="canvas-scroll">
      <EditorCanvas
        document={workingDocument}
        {catalogs}
        extensions={b1CatalogDescriptors}
        extensionImplementations={b1CatalogImplementations}
        {stateValues}
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
        stateValues = next;
      }}
    />
    <Inspector
      document={workingDocument}
      {selectedOccurrence}
      onApply={applyDraft}
      {lastIssues}
      knownActionIds={consumerActionIds}
      knownViewFields={consumerViewFields}
      componentDescriptors={b1CatalogDescriptors}
    />
    {#if plan !== undefined}
      <Layers
        {plan}
        document={workingDocument}
        {selectedOccurrence}
        onSelect={select}
        scope={{ view: consumerViewData, record: {}, state: {}, tokens: {} }}
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
