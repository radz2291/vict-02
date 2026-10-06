<script lang="ts">
  /**
   * Studio-style workbench (PROOF-DESIGN §3.3) — composes the EXPORTED
   * editor modules (EditorCanvas / Layers / Inspector / HistoryPanel /
   * EditorBridge / the reusable localStorage store) around a navigation
   * rail, a central preview with size control, an adjustable inspector and
   * an activity area. Two documents share the workbench: the service page
   * (the real page, persisted) and the presentation fixture (also
   * persisted). Panel sizing works by pointer AND keyboard (the separator
   * is a focusable ARIA separator).
   */
  import { browser } from '$app/environment';
  import {
    EditorBridge,
    EditorCanvas,
    HistoryPanel,
    Inspector,
    Layers,
  } from '@victframework/ui-editor';
  import { loadPresentable, openDesignStore } from '$lib/design/persistence';
  import {
    designCatalogs,
    type ContactOutcome,
    readContactFields,
    validateContact,
  } from '$lib/design/adapter';
  import {
    serviceDocument,
    SERVICE_STORE_KEY,
    DESIGN_STORE_FORMAT,
    SERVICE_SEED_REVISION,
  } from '$lib/design/service-document';
  import { fixtureDocument, FIXTURE_STORE_KEY } from '$lib/design/fixture-document';
  import type { UiRenderPlan } from '@victframework/ui';

  interface WorkbenchDocument {
    readonly id: 'service' | 'fixture';
    readonly label: string;
    readonly seed: typeof serviceDocument | typeof fixtureDocument;
    readonly storeKey: string;
  }

  const DOCUMENTS: WorkbenchDocument[] = [
    { id: 'service', label: 'Service page', seed: serviceDocument, storeKey: SERVICE_STORE_KEY },
    { id: 'fixture', label: 'Graph fixture', seed: fixtureDocument, storeKey: FIXTURE_STORE_KEY },
  ];

  interface Blade {
    readonly doc: WorkbenchDocument;
    readonly bridge: EditorBridge;
    readonly banner: string | null;
  }

  function openBlade(doc: WorkbenchDocument): Blade {
    // Shared persistence (with the design-catalog validation gate): the
    // workbench and /service open the SAME store per key, so saved edits
    // render in the finished page.
    const store = openDesignStore(doc.storeKey);
    if (!browser) {
      return {
        doc,
        bridge: new EditorBridge({
          store,
          initial: { document: doc.seed, storedRevision: SERVICE_SEED_REVISION },
        }),
        banner: null,
      };
    }
    const opened = loadPresentable(store, doc.seed);
    const bridge = new EditorBridge({
      store,
      initial: { document: opened.document, storedRevision: opened.storedRevision },
    });
    return { doc, bridge, banner: opened.banner };
  }

  const blades: Blade[] = $state(DOCUMENTS.map(openBlade));
  let currentId = $state<'service' | 'fixture'>('service');
  let version = $state(0);

  const current = $derived(blades.find((blade) => blade.doc.id === currentId) ?? blades[0]);
  const state = $derived(
    (version, current?.bridge.getSnapshot()),
  );
  // Version-tracked working document: bridge mutations are external to
  // Svelte's reactivity, so the canvas/inspector re-render off `version`.
  const workingDocument = $derived((version, current.bridge.document));

  $effect(() => {
    const unsubs = blades.map((blade) => blade.bridge.subscribe(() => (version += 1)));
    return () => unsubs.forEach((unsub) => unsub());
  });

  // --- selection + plan + activity --------------------------------------
  let selectedOccurrence = $state<string | undefined>(undefined);
  let plan = $state<UiRenderPlan | undefined>(undefined);
  let activity = $state<{ at: number; kind: 'info' | 'error' | 'save'; text: string }[]>([]);
  let activityOpen = $state(true);

  function log(kind: 'info' | 'error' | 'save', text: string): void {
    const at = new Date();
    const stamp = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}:${String(at.getSeconds()).padStart(2, '0')}`;
    activity = [...activity.slice(-80), { at: Date.now(), kind, text: `${stamp} ${text}` }];
  }

  function select(occurrence: string): void {
    selectedOccurrence = occurrence;
    log('info', `Selected ${occurrence}`);
  }

  function applyDraft(draft: Parameters<EditorBridge['apply']>[0]): void {
    const outcome = current.bridge.apply(draft);
    if (outcome.ok) {
      const command = draft.commands[0];
      const target = 'nodeId' in command ? command.nodeId : (command as { id?: string }).id ?? '';
      const summary =
        command.op === 'setProperty' && command.property === 'textLiteral'
          ? `text of ${target}`
          : `${command.op} on ${target}`;
      log('info', `Applied ${summary}`);
    } else {
      const first = outcome.issues[0];
      log('error', `Refused ${draft.requestId}: ${first?.code ?? 'UNKNOWN'} — ${first?.message ?? ''}`);
    }
  }

  function undo(): void {
    const outcome = current.bridge.undo();
    log(outcome.ok ? 'info' : 'error', outcome.ok ? 'Undo' : 'Undo refused (nothing to undo)');
  }

  function redo(): void {
    const outcome = current.bridge.redo();
    log(outcome.ok ? 'info' : 'error', outcome.ok ? 'Redo' : 'Redo refused (nothing to redo)');
  }

  function save(): void {
    const outcome = current.bridge.save();
    if (outcome.ok) {
      current.banner = null;
      log('save', `Saved as stored revision ${outcome.storedRevision} (persists across reload)`);
    } else {
      const first = outcome.issues[0];
      log('error', `Save FAILED (${first?.code ?? 'UNKNOWN'}): ${first?.message ?? 'storage error'}`);
    }
  }

  function reloadStored(): void {
    const result = current.bridge.reopen();
    if (result.ok) {
      selectedOccurrence = undefined;
      log('save', `Reopened stored revision ${result.storedRevision} (history cleared)`);
    } else {
      log('error', `Reopen refused (${result.code})`);
    }
  }

  // --- preview size control ---------------------------------------------
  const SIZES = [
    { id: 'full', label: 'Full width', width: '100%' },
    { id: '1024', label: '1024', width: '1024px' },
    { id: '390', label: '390 (phone)', width: '390px' },
    { id: '480', label: '480 container', width: '480px' },
  ] as const;
  let sizeId = $state<(typeof SIZES)[number]['id']>('full');
  const frameWidth = $derived(SIZES.find((size) => size.id === sizeId)?.width ?? '100%');

  // --- inspector sizing (pointer + keyboard) -----------------------------
  let inspectorWidth = $state(320);

  function resizeBy(delta: number): void {
    inspectorWidth = Math.min(560, Math.max(240, inspectorWidth + delta));
  }

  function startDrag(event: PointerEvent): void {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = inspectorWidth;
    const move = (moveEvent: PointerEvent) => {
      resizeBy(startWidth - moveEvent.clientX - (startX - moveEvent.clientX) * 0 - startX + startX);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    const onMove = (moveEvent: PointerEvent) => {
      inspectorWidth = Math.min(560, Math.max(240, startWidth + (startX - moveEvent.clientX)));
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', up);
  }

  function onSeparatorKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      resizeBy(16);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      resizeBy(-16);
    } else if (event.key === 'Home') {
      event.preventDefault();
      inspectorWidth = 320;
    }
  }

  // --- form outcome (service document only) ------------------------------
  let contactOutcome: ContactOutcome | null = $state(null);

  async function dispatch(actionId: string): Promise<unknown> {
    if (actionId === 'design.submitContact') {
      const fields = readContactFields(document.body);
      contactOutcome = validateContact(fields);
      log(contactOutcome.status === 'ok' ? 'save' : 'error', `Form: ${contactOutcome.heading}`);
      return contactOutcome;
    }
    return { status: 'denied', heading: `Unknown action ${actionId}`, issues: [] };
  }

  function navigate(): void {}

  const styleConditions = $derived(
    Object.entries(current.doc.seed.conditions ?? {})
      .filter(([, condition]) => condition.kind === 'media' || condition.kind === 'container')
      .map(([id, condition]) => ({
        id,
        label:
          condition.kind === 'media'
            ? `Window: ${condition.query}`
            : `Container “${condition.name}”: ${condition.query}`,
      })),
  );

  function readEffective(occurrence: string, property: string): string | undefined {
    if (!browser) return undefined;
    const el = document.querySelector(`[data-ui-occ='${occurrence.replace(/'/g, "\\'")}']`);
    if (el === null) return undefined;
    return window.getComputedStyle(el).getPropertyValue(property) || undefined;
  }
</script>

<div class="wb">
  <div class="wb-body">
    <nav class="wb-rail" aria-label="Workbench navigation">
      <span class="wb-rail-heading">Documents</span>
      {#each DOCUMENTS as doc (doc.id)}
        <button
          type="button"
          aria-pressed={currentId === doc.id}
          onclick={() => {
            currentId = doc.id;
            selectedOccurrence = undefined;
            contactOutcome = null;
            log('info', `Opened ${doc.label}`);
          }}
        >
          {doc.label}
        </button>
      {/each}
      <span class="wb-rail-heading">Edit</span>
      <button type="button" onclick={undo} disabled={!state?.canUndo}>Undo</button>
      <button type="button" onclick={redo} disabled={!state?.canRedo}>Redo</button>
      <button type="button" onclick={save}>Save</button>
      <button type="button" onclick={reloadStored}>Reload stored</button>
      <span class="wb-rail-heading">Status</span>
      <span style="padding: 0 10px; font-size: 12px; color: #a7b5ad">
        {#if state?.dirty}Unsaved changes{:else}Saved{/if}
        <br />
        stored revision {state?.storedRevision}
      </span>
    </nav>

    <div class="wb-main">
      <div class="wb-toolbar">
        <label>
          Preview size
          <select
            value={sizeId}
            onchange={(event) => (sizeId = (event.currentTarget as HTMLSelectElement).value as typeof sizeId)}
          >
            {#each SIZES as size (size.id)}
              <option value={size.id}>{size.label}</option>
            {/each}
          </select>
        </label>
        <span style="color: #5c6b63">
          Sizing the frame never edits the source — container rules respond to the frame,
          media rules to the window.
        </span>
        {#if current.banner !== null}
          <span role="alert" style="color: #b3401f; font-weight: bold">⚠ {current.banner}</span>
        {/if}
      </div>
      <div class="wb-canvas-scroll">
        <div class="wb-canvas-frame" style={`width:${frameWidth}; max-width:100%`}>
          <EditorCanvas
            document={workingDocument}
            catalogs={designCatalogs}
            selectedOccurrence={selectedOccurrence}
            onSelect={select}
            dispatch={dispatch}
            navigate={navigate}
            onRenderDiagnostic={(diagnostic) => log('error', `${diagnostic.code}: ${diagnostic.message}`)}
            onPlan={(compiledPlan) => (plan = compiledPlan)}
            ariaLabel={`${current.doc.label} canvas`}
          />
        </div>
      </div>
    </div>

    <div
      class="wb-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize inspector (left and right arrows)"
      tabindex="0"
      onpointerdown={startDrag}
      onkeydown={onSeparatorKey}
    ></div>

    <div class="wb-inspector" style={`width:${inspectorWidth}px`}>
      <Inspector
        document={workingDocument}
        selectedOccurrence={selectedOccurrence}
        onApply={applyDraft}
        styleConditions={styleConditions}
        readEffective={readEffective}
      />
      {#if plan !== undefined}
        <Layers
          plan={plan}
          selectedOccurrence={selectedOccurrence}
          onSelect={select}
          ariaLabel="Layers"
        />
      {/if}
      <HistoryPanel
        revision={state?.revision ?? ''}
        storedRevision={state?.storedRevision ?? ''}
        dirty={state?.dirty ?? false}
        canUndo={state?.canUndo ?? false}
        canRedo={state?.canRedo ?? false}
        onUndo={undo}
        onRedo={redo}
        onSave={save}
        onReopen={reloadStored}
      />
    </div>
  </div>

  <div class="wb-activity">
    <div class="wb-activity-header">
      <strong>Activity</strong>
      {#if contactOutcome !== null && currentId === 'service'}
        <span role="status">
          Form: {contactOutcome.heading}
          {contactOutcome.status === 'denied'
            ? contactOutcome.issues.map((issue) => issue.message).join(' ')
            : contactOutcome.detail}
        </span>
      {/if}
      <button
        type="button"
        aria-expanded={activityOpen}
        onclick={() => (activityOpen = !activityOpen)}
      >
        {activityOpen ? 'Hide' : 'Show'}
      </button>
    </div>
    {#if activityOpen}
      <ul class="wb-activity-list" aria-live="polite">
        {#each [...activity].reverse() as entry (entry.at)}
          <li data-kind={entry.kind}>{entry.text}</li>
        {/each}
      </ul>
    {/if}
  </div>
</div>
