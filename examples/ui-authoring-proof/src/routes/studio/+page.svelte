<script lang="ts">
  /**
   * Studio — the authoring host. Composes the EXPORTED editor modules
   * (EditorBridge/EditorCanvas/Inspector/HistoryPanel) and the preview
   * session modules. This route is NOT part of the normal application entry
   * graph (verified by test/entry-isolation.test.ts).
   */
  import {
    EditorBridge,
    EditorCanvas,
    HistoryPanel,
    Inspector,
    setStyle,
    setTextLiteral,
    type TransactionDraft,
  } from '@victframework/ui-editor';
  import { createPreviewSession, type PreviewSession } from '@victframework/ui-preview';
  import {
    compileUiDocument,
    defaultSemanticElementCatalog,
    type UiDocument,
  } from '@victframework/ui';
  import { browser } from '$app/environment';
  import { inspectionPlan, studioDocumentCatalogs } from '$lib/product/compile.js';
  {
    /* the shared compiled artifact (U1-02): the studio starts from the SAME bytes */
    void inspectionPlan();
  }
  import { productExtensions } from '$lib/product/documents.js';
  import { productImplementations } from '$lib/product/extensions.js';
  import { inspectionDetailDocument } from '$lib/product/definitions.js';
  import { createAuthoringStore, SEED_STORED_REVISION, type StorageLike } from '$lib/authoring/store.js';

  /** Visible-diagnostic text for an unusable store, per corruption class: */
  function describeStoreProblem(problem: {
    readonly message: string;
    readonly overwritable?: boolean;
  }): string {
    return problem.overwritable === false
      ? `Stored authoring data is unreadable and has been PRESERVED (${problem.message}). The store refuses to overwrite it — a save will fail until the stored data is cleared (browser site data for this origin).`
      : `Stored authoring data was not usable (${problem.message}). A fresh seed document was loaded; the next successful save replaces the stored data.`;
  }

  /* ---- editor bridge over the LOCAL authoring store (U1-04) ----------
     Persistence = browser localStorage: a successful save survives a full
     page reload, leaving/reopening the route, and browser restarts. The
     store is the revision AUTHORITY (stale editors are rejected). On
     startup the SAVED source is loaded; the seed is used only when the
     store is empty; corrupt/incompatible content surfaces a visible
     diagnostic instead of a silent fake reopen. */
  // SSR renders with an empty memory shim; the BROWSER (where authoring
  // happens) persists to localStorage. localStorage survives full page
  // reloads, route changes and browser restarts for this origin.
  const ssrMemoryShim: StorageLike = {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  };
  const store = createAuthoringStore(browser ? window.localStorage : ssrMemoryShim, studioDocumentCatalogs);
  const initialLoad = store.rawLoad();
  let storeDiagnostic: string | null = $state(
    initialLoad.status === 'invalid' ? describeStoreProblem(initialLoad) : null,
  );

  const initialAuthoring =
    initialLoad.status === 'loaded'
      ? { document: initialLoad.document, storedRevision: initialLoad.storedRevision }
      : initialLoad.status === 'invalid' && initialLoad.overwritable
        ? {
            // Readable envelope, invalid document: seed the CONTENT fresh but
            // baseline at the RECORDED stored revision, so the replacement
            // save is accepted by the authoritative store (the banner's
            // 'next successful save replaces' claim is then true).
            document: structuredClone(inspectionDetailDocument),
            storedRevision: initialLoad.storedRevision ?? SEED_STORED_REVISION,
          }
        : { document: structuredClone(inspectionDetailDocument), storedRevision: SEED_STORED_REVISION };

  const bridge = new EditorBridge({ store, initial: initialAuthoring });

  let workingDocument: UiDocument = $state(bridge.document);
  let bridgeState: ReturnType<typeof bridge.getSnapshot> = $state(bridge.getSnapshot());
  let lastIssues: readonly { readonly code: string; readonly message: string }[] = $state([]);

  $effect.root(() => {
    $effect(() => {
      const unsubscribe = bridge.subscribe(() => {
        workingDocument = bridge.document;
        bridgeState = bridge.getSnapshot();
      });
      return unsubscribe;
    });
  });

  function applyDraft(draft: TransactionDraft): void {
    const outcome = bridge.apply(draft);
    lastIssues = outcome.ok ? [] : outcome.issues.map((issue) => ({ code: issue.code, message: issue.message }));
  }

  /* ---- preview session (scenario switcher) --------------------------- */
  const scenarios = {
    normal: {
      schema: 'vict.ui-scenario@1' as const,
      scenarioId: 'scn.normal',
      references: { application: { id: 'app.inspection', revision: '1' }, documents: { 'doc.inspection-detail': '1' } },
      seeds: { domain: { rows: { inspection: [
        { id: 'i-101', title: 'Cold-chain compressor room', status: 'submitted', domainRevision: 3 },
      ] } } },
      actors: [{ actorId: 's.hart', role: 'supervisor', permissions: ['qlt.inspection.approve'] }],
      operations: [
        { op: 'inspection.approve', implementation: 'simulated' as const, outcome: { kind: 'success' as const } },
        { op: 'inspection:mutate', implementation: 'simulated' as const, outcome: { kind: 'success' as const } },
      ],
      resetBoundary: 'session' as const,
    },
    missingCoverage: {
      schema: 'vict.ui-scenario@1' as const,
      scenarioId: 'scn.missing',
      references: { application: { id: 'app.inspection', revision: '1' }, documents: { 'doc.inspection-detail': '1' } },
      seeds: { domain: { rows: { inspection: [
        { id: 'i-101', title: 'Cold-chain compressor room', status: 'submitted', domainRevision: 3 },
      ] } } },
      actors: [{ actorId: 's.hart', role: 'supervisor', permissions: ['qlt.inspection.approve'] }],
      operations: [{ op: 'inspection.approve', implementation: 'unavailable' as const }],
      resetBoundary: 'session' as const,
    },
    latency: {
      schema: 'vict.ui-scenario@1' as const,
      scenarioId: 'scn.latency',
      references: { application: { id: 'app.inspection', revision: '1' }, documents: { 'doc.inspection-detail': '1' } },
      seeds: { domain: { rows: { inspection: [
        { id: 'i-101', title: 'Cold-chain compressor room', status: 'submitted', domainRevision: 3 },
      ] } } },
      actors: [{ actorId: 's.hart', role: 'supervisor', permissions: ['qlt.inspection.approve'] }],
      operations: [
        { op: 'inspection.approve', implementation: 'simulated' as const, outcome: { kind: 'success' as const, delayMs: 800 } },
        { op: 'inspection:mutate', implementation: 'simulated' as const, outcome: { kind: 'success' as const } },
      ],
      resetBoundary: 'session' as const,
    },
  };

  type ScenarioName = keyof typeof scenarios;
  let scenarioName: ScenarioName = $state('normal');
  /** The simulated approve double — registered OUTSIDE serialized source. */
  const previewRuntime = {
    snapshotDoubles: () => new Map([['inspection.approve', async () => ({ decided: true, actor: 's.hart' })]]),
  };
  let preview: PreviewSession = $state(
    createPreviewSession({ scenario: scenarios.normal, runtime: previewRuntime }),
  );
  let previewNote: string = $state('Scenario ready. Approve runs against the simulated double.');
  let resetSignal: symbol = $state(Symbol('preview-init'));

  function switchScenario(name: ScenarioName): void {
    scenarioName = name;
    // reset() FENCES the old session (in-flight results become SESSION_STALE);
    // the new session carries the newly selected scenario.
    preview = preview.reset();
    preview = createPreviewSession({
      scenario: scenarios[name],
      runtime: previewRuntime,
      onStale: (info) => {
        previewNote = `SESSION_STALE — a result from ${info.sessionId} was dropped (session was reset).`;
      },
    });
    // a NEW session identity must also reset the rendered document state
    resetSignal = Symbol(`reset-${preview.id}`);
    previewNote = `Switched to '${name}' — session ${preview.id}.`;
  }

  let approveInFlight = $state(false);
  async function previewApprove(): Promise<void> {
    if (approveInFlight) return; // duplicate-submit prevention (scenario 4)
    approveInFlight = true;
    try {
      const result = await preview.run('inspection.approve', { id: 'i-101', expectedDomainRevision: 3 });
      if (result.ok) {
        previewNote = `Approved in session ${result.sessionId}.`;
      } else {
        previewNote = `${result.code} — ${result.message}`;
      }
    } finally {
      approveInFlight = false;
    }
  }

  /* ---- studio-side compile of the working document ------------------- */
  const workingPlan = $derived.by(() =>
    compileUiDocument(workingDocument, defaultSemanticElementCatalog(), productExtensions, studioDocumentCatalogs),
  );

  let selectedOccurrence: string | undefined = $state(undefined);
  const selectedReport = $derived(
    selectedOccurrence === undefined
      ? undefined
      : resolveSelected(selectedOccurrence, workingDocument),
  );
  function resolveSelected(occurrence: string, document: UiDocument) {
    const parts = occurrence.split('|');
    const nodeId = parts[1] ?? '';
    const nodes = (document.nodes ?? {}) as Record<string, { kind?: string; content?: { type: string; value?: string } }>;
    const instanceSegments = parts.slice(2).filter((segment) => segment.includes('@'));
    return {
      nodeId,
      kind: nodes[nodeId]?.kind ?? '(missing)',
      owningDefinition: instanceSegments[0]?.split('@')[1],
      node: nodes[nodeId],
    };
  }

  /* ---- measurement instrumentation (U1-08 feedback budget) ----------- */
  let lastEditFeedbackMs: number | null = $state(null);
  function applyMeasured(draft: TransactionDraft): void {
    const started = performance.now();
    applyDraft(draft);
    lastEditFeedbackMs = performance.now() - started;
  }
</script>

<svelte:head>
  <style>
    .studio {
      display: grid;
      grid-template-columns: 1fr 320px;
      gap: 16px;
      padding: 16px;
      font-family: system-ui, sans-serif;
      color: #1c2430;
    }
    .studio-canvas {
      border: 1px solid #d9dde3;
      border-radius: 8px;
      padding: 16px;
      min-height: 400px;
      overflow: auto;
    }
    .studio-side {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .studio-panel {
      border: 1px solid #d9dde3;
      border-radius: 8px;
      padding: 12px;
    }
    .studio-panel h2 {
      font-size: 1rem;
      margin: 0 0 8px;
    }
    .studio-note {
      font-size: 0.85rem;
      color: #5b6572;
    }
    .studio-store-diagnostic {
      background: #fdeaea;
      color: #8f1f1f;
      border-radius: 8px;
      padding: 8px 12px;
    }
    .scenario-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin: 8px 0;
    }
    .scenario-button {
      font: inherit;
      font-size: 0.85rem;
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid #93a1b3;
      background: white;
      cursor: pointer;
    }
    .preview-note {
      font-size: 0.85rem;
      padding: 8px;
      border-radius: 6px;
      background: #eef2f7;
      min-height: 2.4em;
    }
    @media (max-width: 900px) {
      .studio {
        grid-template-columns: 1fr;
      }
    }
  </style>
</svelte:head>

<main class="studio">
  <section class="studio-canvas" aria-label="Authoring canvas">
    <h1 class="studio-panel">Studio — inspection detail (working document)</h1>
    {#if storeDiagnostic !== null}
      <p class="studio-note studio-store-diagnostic" role="alert">⚠ {storeDiagnostic}</p>
    {/if}
    <p class="studio-note">
      Click an element to select its source occurrence. Edits go through exported transactional
      commands; the canvas renders the working document through the same renderer as the product.
    </p>
    <EditorCanvas
      document={workingDocument}
      catalogs={{ elements: defaultSemanticElementCatalog(), ...studioDocumentCatalogs }}
      extensions={productExtensions}
      extensionImplementations={productImplementations}
      stateValues={{ actorRole: 'supervisor', actorId: 's.hart', hasFindings: true, hasEvidence: true, findingCount: 2, evidenceCount: 1 }}
      selectedOccurrence={selectedOccurrence}
      onSelect={(occurrence) => {
        selectedOccurrence = occurrence;
        bridge.select(occurrence);
      }}
      dispatch={async (actionId, input) => {
        // Declared interactions in the canvas run through the PREVIEW
        // boundary (scenario session) — never a silent stub.
        const result = await preview.run(actionId, input);
        previewNote = result.ok
          ? `Canvas interaction '${actionId}' settled in ${result.sessionId}.`
          : `${result.code} — ${result.message}`;
        return result;
      }}
      navigate={() => undefined}
      view={{ findings: [
        { id: 'f-1', description: 'Seal wear beyond tolerance', severity: 'high' },
        { id: 'f-2', description: 'Label fade on shutoff valve', severity: 'low' },
      ], evidence: [{ id: 'e-1', kind: 'image-ref', label: 'Compressor seal photo' }], activity: [{ id: 'a-1', at: '2026-10-06T09:00:00.000Z', entry: 'Inspection submitted', actor: 't.nguyen' }] }}
      record={{ id: 'i-101', title: 'Cold-chain compressor room', status: 'submitted', technician: 't.nguyen', supervisor: 's.hart', domainRevision: 3 }}
      localState={workingDocument.localState}
      ariaLabel="Inspection detail canvas"
    />
    <p class="studio-note">
      Last command round trip: {lastEditFeedbackMs === null ? '—' : `${lastEditFeedbackMs.toFixed(1)} ms`} (budget ≤ 100 ms)
      {#if workingPlan.ok}
        · working plan compiled: {workingPlan.plan.sourceDigest.slice(0, 12)}…
      {:else}
        · working plan DOES NOT COMPILE (shown in canvas)
      {/if}
    </p>
  </section>

  <aside class="studio-side">
    <div class="studio-panel">
      <HistoryPanel
        revision={bridgeState.revision}
        storedRevision={bridgeState.storedRevision}
        dirty={bridgeState.dirty}
        canUndo={bridgeState.canUndo}
        canRedo={bridgeState.canRedo}
        onUndo={() => bridge.undo()}
        onRedo={() => bridge.redo()}
        onSave={() => {
          const outcome = bridge.save();
          if (outcome.ok) {
            // Acknowledged persistence succeeded: a stored corruption banner
            // (if any) is now stale — the corrupt bytes were replaced. Cleared
            // ONLY here; a failed save keeps the diagnostic visible.
            storeDiagnostic = null;
            previewNote = `Saved as stored revision ${outcome.storedRevision} (persisted — survives reload).`;
          } else {
            const issue = outcome.issues[0];
            previewNote = `Save FAILED (${issue?.code ?? 'UNKNOWN'}): ${issue?.message ?? 'storage error'}. ` +
              'Your unsaved edits are kept — fix the storage problem and save again.';
          }
        }}
        onReopen={() => {
          const result = bridge.reopen();
          if (result.ok) {
            storeDiagnostic = null;
            previewNote = `Reopened stored revision ${result.storedRevision} from persisted bytes (fresh session, history cleared).`;
          } else if (result.code === 'UI_STORE_INVALID') {
            storeDiagnostic = describeStoreProblem({
              message: result.message ?? 'invalid',
              overwritable: result.overwritable,
            });
            previewNote = 'Reopen REFUSED — the stored payload is corrupt or incompatible.';
          } else {
            previewNote = 'Reopen refused — no stored document exists yet.';
          }
        }}
      />
    </div>

    <div class="studio-panel">
      <Inspector
        document={workingDocument}
        selectedOccurrence={selectedOccurrence}
        onApply={applyMeasured}
        lastIssues={lastIssues}
        knownActionIds={['inspection.approve']}
        knownRouteIds={['queue', 'detail']}
        knownTokenIds={['space.xs', 'space.sm', 'space.md', 'space.lg', 'color.accent', 'radius.md']}
      />
      <div class="scenario-row">
        <button
          type="button"
          class="scenario-button"
          onclick={() => applyMeasured(setTextLiteral({ requestId: `q-${Date.now()}`, nodeId: selectedReport?.nodeId ?? 'n.approveLabel', value: 'Approve inspection' }))}
          disabled={selectedReport?.nodeId === undefined}
        >
          Quick edit: text
        </button>
        <button
          type="button"
          class="scenario-button"
          onclick={() => applyMeasured(setStyle({ requestId: `q-${Date.now()}`, nodeId: selectedReport?.nodeId ?? 'n.title', property: 'color', value: { type: 'token', id: 'color.accent' } }))}
          disabled={selectedReport?.nodeId === undefined}
        >
          Quick edit: accent color
        </button>
      </div>
    </div>

    <div class="studio-panel" aria-label="Preview">
      <h2>Preview (simulated)</h2>
      <div class="scenario-row">
        {#each Object.keys(scenarios) as name}
          <button type="button" class="scenario-button" onclick={() => switchScenario(name as ScenarioName)}>
            {name}
          </button>
        {/each}
        <button type="button" class="scenario-button" onclick={previewApprove} disabled={approveInFlight}>
          {approveInFlight ? 'Approving…' : 'Run approve'}
        </button>
      </div>
      <p class="preview-note" role="status">{previewNote}</p>
    </div>
  </aside>
</main>
