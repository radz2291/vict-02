<script lang="ts">
  /** Inspection detail — DOCUMENT MODE screen rendered by the one renderer. */
  import { DocumentHost } from '@victframework/ui-svelte';
  import { inspectionPlan } from '$lib/product/compile.js';
  import {
    InspectionDataAdapter,
    createInspectionServer,
    grantsForRole,
    seedDomain,
    type ActivityRow,
  } from '$lib/product/domain.js';
  import type { ActionResult } from '@victframework/ui-svelte';

  let { data }: { data: { id: string; actorRole: string } } = $props();

  const { detailPlan } = inspectionPlan();
  const server = createInspectionServer(new InspectionDataAdapter(seedDomain()));

  /** The acting identity of this deployment view (server holds the grants). */
  function actor() {
    return { role: data.actorRole, actorId: data.actorRole === 'supervisor' ? 's.hart' : 't.nguyen' };
  }

  type DetailState = {
    readonly record: Record<string, unknown> | null;
    readonly activity: readonly ActivityRow[];
    readonly feedback: { readonly kind: 'idle' | 'pending' | 'success' | 'error'; readonly message: string };
  };

  let state: DetailState = $state({
    record: null,
    activity: [],
    feedback: { kind: 'idle', message: '' },
  });

  let busy = $state(false);

  async function loadDetail(id: string): Promise<void> {
    const result = await server.dispatch('inspection.list', {}, actor());
    const rows = result.ok ? ((result.value as { rows: Record<string, unknown>[] }).rows ?? []) : [];
    const record = rows.find((row) => row.id === id) ?? null;
    state = { ...state, record, activity: server.adapter.activityFor(id) };
  }

  loadDetail(data.id);

  /**
   * The ONE action dispatch path: the document's own declared interactions
   * AND the native host control both go through this boundary (U1-05).
   */
  async function runDeclaredAction(actionId: string, input?: unknown): Promise<ActionResult> {
    if (busy) {
      return { ok: false, code: 'BUSY', message: 'A decision is already being recorded.' };
    }
    busy = true;
    state = { ...state, feedback: { kind: 'pending', message: 'Recording decision…' } };
    const result = await server.dispatch(actionId, input, actor());
    if (result.ok) {
      await loadDetail(data.id);
      state = {
        ...state,
        feedback: { kind: 'success', message: 'Decision recorded — status and activity refreshed.' },
      };
    } else {
      state = { ...state, feedback: { kind: 'error', message: `${result.code}: ${result.message}` } };
    }
    busy = false;
    return result;
  }

  async function approve(): Promise<void> {
    if (state.record === null) return;
    await runDeclaredAction('inspection.approve', {
      id: state.record['id'],
      expectedDomainRevision: state.record['domainRevision'],
    });
  }

  const viewScope: Record<string, unknown> = $derived({
    findings: state.record?.['findings'] ?? [],
    evidence: state.record?.['evidence'] ?? [],
    activity: state.activity.map((row) => ({ entry: row.entry, actor: row.actor })),
  });
</script>

<svelte:head>
  <style>
    /* Product shell presentation (not document source) */
    .app-page {
      max-width: 1040px;
      margin: 0 auto;
      padding: 24px;
      font-family: system-ui, sans-serif;
      color: #1c2430;
    }
    .app-header h1 {
      font-size: 1.4rem;
      margin: 0 0 4px;
    }
    .app-subtitle {
      color: #5b6572;
      margin: 0 0 20px;
      font-size: 0.9rem;
    }
    .decision-bar {
      display: flex;
      gap: 12px;
      align-items: center;
      margin: 16px 0;
    }
    .decision-button {
      font: inherit;
      padding: 8px 16px;
      border-radius: 8px;
      border: 1px solid #0a6c96;
      background: #0a6c96;
      color: white;
      cursor: pointer;
    }
    .decision-button:disabled {
      opacity: 0.6;
      cursor: progress;
    }
    .feedback {
      font-size: 0.9rem;
      padding: 8px 12px;
      border-radius: 8px;
    }
    .feedback-success {
      background: #e5f6ec;
      color: #116337;
    }
    .feedback-error {
      background: #fdeaea;
      color: #8f1f1f;
    }
    .feedback-pending {
      background: #eef2f7;
      color: #33445c;
    }
    .queue-status,
    .app-note {
      font-size: 0.85rem;
      color: #5b6572;
    }
  </style>
</svelte:head>

<main class="app-page">
  <nav class="app-subtitle" aria-label="Breadcrumb">
    <a href="/?as={data.actorRole}">← Queue</a> · viewing as <strong>{data.actorRole}</strong>
    ({grantsForRole(data.actorRole).join(', ')})
  </nav>

  {#if state.feedback.kind !== 'idle'}
    {#if state.feedback.kind === 'error'}
      <p class="feedback feedback-error" role="alert">{state.feedback.message}</p>
    {:else}
      <p class="feedback feedback-{state.feedback.kind}" role="status">{state.feedback.message}</p>
    {/if}
  {/if}

  {#if state.record !== null}
    <!-- The SAME compiled document plan the studio canvas edits (U1-02).
         The document's declared interactions dispatch through the SAME
         real adapter boundary as the native control below (U1-05). -->
    <DocumentHost
      plan={detailPlan}
      view={viewScope}
      record={state.record}
      dispatch={runDeclaredAction}
      navigate={() => undefined}
      ariaLabel="Inspection detail"
    />
    <div class="decision-bar">
      <button
        type="button"
        class="decision-button"
        onclick={approve}
        disabled={busy}
      >
        {busy ? 'Recording decision…' : 'Approve this inspection'}
      </button>
      <span class="app-note">
        The document's Approve button and this control dispatch the SAME declared action through
        the SAME adapter boundary — denials and stale decisions surface identically from either.
      </span>
    </div>
  {:else}
    <p role="alert">Inspection not found.</p>
  {/if}
</main>
