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
  import { tick } from 'svelte';
  import { browser } from '$app/environment';
  import {
    EditorBridge,
    EditorCanvas,
    HistoryPanel,
    Inspector,
    Layers,
    type EditorLabels,
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

  const SERVICE_LABELS: EditorLabels = {
    nodes: {
      'svc.root': 'Home page',
      'svc.hero': 'Introduction',
      'svc.heroTitle': 'Page heading',
      'svc.overlapWrap': 'Survey banner position',
      'svc.overlapCard': 'Survey card',
      'svc.services': 'Services section',
      'svc.cardsGrid': 'Service cards',
      'svc.cardKitchens': 'Kitchens card',
      'svc.cardBathrooms': 'Bathrooms card',
      'svc.cardAdaptations': 'Adaptations card (accent override)',
      'svc.story': 'How we work',
      'svc.storyAside': 'At a glance (sticky)',
      'svc.stickyCard': 'Documented card',
      'svc.contact': 'Request a quote',
      'svc.form': 'Quote form',
      'svc.submitButton': 'Send request button',
    },
    definitions: { 'def.serviceCard': 'Service card' },
    actions: { 'design.submitContact': 'Send request (simulated)' },
  };
  const FIXTURE_LABELS: EditorLabels = {
    nodes: {
      'fx.root': 'Fixture canvas',
      'fx.graph': 'Graph sample',
      'fx.boxIntake': 'Intake box',
      'fx.boxTriage': 'Triage box',
      'fx.boxReview': 'Review panel box',
      'fx.boxArchive': 'Archive box',
      'fx.boxNotesColumn': 'Margin notes',
    },
  };
  const labelsFor = (id: 'service' | 'fixture'): EditorLabels =>
    id === 'service' ? SERVICE_LABELS : FIXTURE_LABELS;

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
    /** Truthful stored-data notice; cleared only on an acknowledged save. */
    banner: string | null;
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
  // `snapshotState` (renamed from `state`: the identifier collided with the
  // $state rune under broad svelte-check). Reading `version` keeps these
  // derived values version-tracked: bridge mutations are external to
  // Svelte's reactivity, so the canvas/inspector re-render off `version`.
  const snapshotState = $derived.by(() => {
    void version;
    return current?.bridge.getSnapshot();
  });
  const workingDocument = $derived.by(() => {
    void version;
    return current.bridge.document;
  });

  $effect(() => {
    const unsubs = blades.map((blade) => blade.bridge.subscribe(() => (version += 1)));
    return () => unsubs.forEach((unsub) => unsub());
  });

  // --- selection + plan + activity --------------------------------------
  let selectedOccurrence = $state<string | undefined>(undefined);
  let plan = $state<UiRenderPlan | undefined>(undefined);
  // Renderer-scope invalidation for effective-value measurements: bumped by
  // Svelte ticks after source/DOM changes, window resizes and canvas-frame
  // ResizeObserver callbacks (the documented mounting requirement).
  let domVersion = $state(0);
  // Canvas frame element: observed so container-driven width changes (the
  // preview size control) also invalidate effective-value measurements.
  let frameEl = $state<HTMLElement | undefined>(undefined);
  let lastIssues = $state<readonly { code: string; message: string }[]>([]);
  let activity = $state<{ at: number; kind: 'info' | 'error' | 'save'; text: string }[]>([]);
  let activityOpen = $state(true);

  function log(kind: 'info' | 'error' | 'save', text: string): void {
    const at = new Date();
    const stamp = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}:${String(at.getSeconds()).padStart(2, '0')}`;
    activity = [...activity.slice(-80), { at: Date.now(), kind, text: `${stamp} ${text}` }];
  }

  function select(occurrence: string): void {
    // Single source of selection truth: the bridge. Canvas, Layers and
    // Inspector all derive from the same occurrence.
    current.bridge.select(occurrence);
    selectedOccurrence = occurrence;
    log('info', `Selected ${occurrence}`);
  }

  function applyDraft(draft: Parameters<EditorBridge['apply']>[0]): void {
    const outcome = current.bridge.apply(draft);
    lastIssues = outcome.ok ? [] : outcome.issues;
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
    const up = () => {
      window.removeEventListener('pointermove', onMove);
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
      .map(([id, condition]) => {
        if (condition.kind === 'media') {
          return { id, label: `Window: ${condition.query}` };
        }
        return {
          id,
          label:
            condition.kind === 'container'
              ? `Container “${condition.name}”: ${condition.query}`
              : id,
        };
      }),
  );

  function readEffective(occurrence: string, property: string): string | undefined {
    // Reading domVersion makes every Inspector measurement reactive to the
    // host invalidation effects below (source ticks, frame resize, window
    // resize) — the documented mounting requirement.
    void domVersion;
    if (!browser) return undefined;
    const el = document.querySelector(`[data-ui-occ='${occurrence.replace(/'/g, "\\'")}']`);
    if (el === null) return undefined;
    return window.getComputedStyle(el).getPropertyValue(property) || undefined;
  }

  // Host-side measurement invalidation: source/DOM ticks (including preview
  // width changes), canvas-frame resizing and window resizing all bump
  // domVersion, which readEffective depends on.
  $effect(() => {
    version;
    sizeId;
    void tick().then(() => (domVersion += 1));
  });
  $effect(() => {
    if (!browser || !frameEl) return;
    const observer = new ResizeObserver(() => (domVersion += 1));
    observer.observe(frameEl);
    const refresh = () => (domVersion += 1);
    window.addEventListener('resize', refresh);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', refresh);
    };
  });
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
      <button type="button" onclick={undo} disabled={!snapshotState?.canUndo}>Undo</button>
      <button type="button" onclick={redo} disabled={!snapshotState?.canRedo}>Redo</button>
      <button type="button" onclick={save}>Save</button>
      <button type="button" onclick={reloadStored}>Reload stored</button>
      <span class="wb-rail-heading">Status</span>
      <span style="padding: 0 10px; font-size: 12px; color: #a7b5ad">
        {#if snapshotState?.dirty}Unsaved changes{:else}Saved{/if}
        <br />
        stored revision {snapshotState?.storedRevision}
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
        <div class="wb-canvas-frame" bind:this={frameEl} style={`width:${frameWidth}; max-width:100%`}>
          <EditorCanvas
            document={workingDocument}
            catalogs={designCatalogs}
            selectedOccurrence={selectedOccurrence}
            onSelect={select}
            dispatch={dispatch}
            navigate={navigate}
            onRenderDiagnostic={(diagnostic) => log('error', `${diagnostic.code}: ${diagnostic.message}`)}
            onPlan={(compiledPlan) => { plan = compiledPlan; void tick().then(() => (domVersion += 1)); }}
            ariaLabel={`${current.doc.label} canvas`}
          />
        </div>
      </div>
    </div>

    <!-- Focusable ARIA separator: the WAI-ARIA splitter pattern (pointer +
         arrow-key resizing). svelte-check's a11y rules do not model
         role="separator" as interactive, so the two warnings are justified. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
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
        lastIssues={lastIssues}
        knownActionIds={designCatalogs.actionIds}
        knownTokenIds={Object.keys(current.doc.seed.tokens)}
        styleConditions={styleConditions}
        labels={labelsFor(currentId)}
        readEffective={readEffective}
      />
      {#if plan !== undefined}
        <Layers
          plan={plan}
          document={workingDocument}
          labels={labelsFor(currentId)}
          selectedOccurrence={selectedOccurrence}
          onSelect={select}
          scope={{ view: {}, record: {}, state: {}, tokens: {} }}
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
