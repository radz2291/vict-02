)<script lang="ts">
  /** Inspection detail — DOCUMENT MODE screen rendered by the one renderer. */
  import { DocumentHost } from '@victframework/ui-svelte';
  import { inspectionPlan } from '$lib/product/compile.js';
  import type { ActivityRow } from '$lib/product/domain.js';
  import type { ActionResult } from '@victframework/ui-svelte';

  let { data }: {
    data: {
      id: string;
      actorRole: string;
      record: Record<string, unknown>;
      activity: readonly ActivityRow[];
    };
  } = $props();

  const { detailPlan } = inspectionPlan();

  // Server-loaded data is the base; every successful action refreshes a local
  // override THROUGH the boundary (the same fetch path as the action itself),
  // so status, findings/evidence and the activity trail stay coherent.
  interface RefreshedView {
    readonly record?: Record<string, unknown>;
    readonly activity?: readonly ActivityRow[];
  }
  let refreshed = $state<RefreshedView | null>(null);

  const record = $derived(refreshed?.record ?? data.record);
  const activity = $derived(refreshed?.activity ?? data.activity);

  async function refresh(): Promise<void> {
    const response = await fetch(`/api/inspection/inspection-get?as=${data.actorRole}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: data.id }),
    });
    const result = (await response.json()) as ActionResult;
    if (result.ok) {
      const nextRecord = result.value as Record<string, unknown>;
      const trail = await fetch(`/api/inspection/inspection-activity?as=${data.actorRole}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: data.id }),
      });
      const trailResult = (await trail.json()) as ActionResult;
      const rows = trailResult.ok
        ? ((trailResult.value as { rows: readonly ActivityRow[] }).rows ?? [])
        : activity;
      refreshed = { record: nextRecord, activity: rows };
    }
  }

  /** The acting identity of this deployment view (server holds the grants). */
  function actor() {
    return { role: data.actorRole, actorId: data.actorRole === 'supervisor' ? 's.hart' : 't.nguyen' };
  }

  type Feedback = { readonly kind: 'idle' | 'pending' | 'success' | 'error'; readonly message: string };

  let feedback: Feedback = $state({ kind: 'idle', message: '' });
  let busy = $state(false);
  let rejectionReason = $state('');
  let newFindingDescription = $state('');
  let newFindingSeverity = $state<'low' | 'medium' | 'high'>('low');
  let newEvidenceLabel = $state('');
  let newEvidenceKind = $state<'note' | 'image-ref'>('note');

  const status = $derived(String(record['status']));
  const isSupervisor = $derived(data.actorRole === 'supervisor');
  const isAssignedTechnician = $derived(
    data.actorRole === 'technician' && record['technician'] === 't.nguyen',
  );

  /**
   * The ONE action dispatch path: the document's own declared interactions
   * AND the native host controls both POST through the server boundary
   * (U1-05); the server process's adapter enforces permissions and rules.
   */
  async function runDeclaredAction(actionId: string, input?: unknown): Promise<ActionResult> {
    if (busy) {
      return { ok: false, code: 'BUSY', message: 'An operation is already being recorded.' };
    }
    busy = true;
    feedback = { kind: 'pending', message: 'Recording…' };
    try {
      const response = await fetch(
        `/api/inspection/${actionId.replaceAll('.', '-')}?as=${data.actorRole}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input ?? {}),
        },
      );
      const result = (await response.json()) as ActionResult;
      if (result.ok) {
        await refresh();
        feedback = { kind: 'success', message: 'Recorded — status and activity refreshed.' };
      } else {
        feedback = { kind: 'error', message: `${result.code}: ${result.message}` };
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      feedback = { kind: 'error', message: `NETWORK: ${message}` };
      return { ok: false, code: 'NETWORK', message };
    } finally {
      busy = false;
    }
  }

  async function approve(): Promise<void> {
    await runDeclaredAction('inspection.approve', {
      id: record['id'],
      expectedDomainRevision: record['domainRevision'],
    });
  }

  async function reject(): Promise<void> {
    const result = await runDeclaredAction('inspection.reject', {
      id: record['id'],
      expectedDomainRevision: record['domainRevision'],
      rejectionReason,
    });
    if (result.ok) rejectionReason = '';
  }

  async function submit(): Promise<void> {
    await runDeclaredAction('inspection.submit', { id: record['id'] });
  }

  async function revise(): Promise<void> {
    await runDeclaredAction('inspection.revise', { id: record['id'] });
  }

  async function addFinding(): Promise<void> {
    const result = await runDeclaredAction('finding.add', {
      id: `f-${crypto.randomUUID().slice(0, 8)}`,
      inspectionId: record['id'],
      severity: newFindingSeverity,
      description: newFindingDescription,
    });
    if (result.ok) newFindingDescription = '';
  }

  async function addEvidence(): Promise<void> {
    const result = await runDeclaredAction('evidence.add', {
      id: `e-${crypto.randomUUID().slice(0, 8)}`,
      inspectionId: record['id'],
      label: newEvidenceLabel,
      kind: newEvidenceKind,
    });
    if (result.ok) newEvidenceLabel = '';
  }

  const viewScope: Record<string, unknown> = $derived({
    findings: record['findings'] ?? [],
    evidence: record['evidence'] ?? [],
    activity: activity.map((row: ActivityRow) => ({ entry: row.entry, actor: row.actor })),
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
      flex-wrap: wrap;
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
    .decision-button.warn {
      border-color: #8f1f1f;
      background: #8f1f1f;
    }
    .decision-button.neutral {
      border-color: #45566d;
      background: #45566d;
    }
    .decision-button:disabled {
      opacity: 0.6;
      cursor: progress;
    }
    .reason-field {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-basis: 100%;
    }
    .reason-input {
      font: inherit;
      flex: 1;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid #b8c2cf;
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
    .trail {
      margin: 20px 0 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 0.85rem;
    }
    .trail li {
      padding: 8px 10px;
      border: 1px solid #e3e7ee;
      border-radius: 8px;
      display: flex;
      gap: 10px;
    }
    .trail-when {
      color: #5b6572;
      white-space: nowrap;
    }
    .trail-actor {
      font-weight: 600;
      white-space: nowrap;
    }
  </style>
</svelte:head>

<main class="app-page">
  <nav class="app-subtitle" aria-label="Breadcrumb">
    <a href="/?as={data.actorRole}">← Queue</a> · viewing as <strong>{data.actorRole}</strong>
    ({data.actorRole === 'supervisor' ? 's.hart' : 't.nguyen'})
  </nav>

  {#if feedback.kind !== 'idle'}
    {#if feedback.kind === 'error'}
      <p class="feedback feedback-error" role="alert">{feedback.message}</p>
    {:else}
      <p class="feedback feedback-{feedback.kind}" role="status">{feedback.message}</p>
    {/if}
  {/if}

  <!-- The SAME compiled document plan the studio canvas edits (U1-02).
       The document's declared interactions dispatch through the SAME
       real adapter boundary as the native controls below (U1-05). -->
  <DocumentHost
    plan={detailPlan}
    view={viewScope}
    record={record}
    dispatch={runDeclaredAction}
    navigate={() => undefined}
    ariaLabel="Inspection detail"
  />

  <div class="decision-bar">
    {#if status === 'submitted' && isSupervisor}
      <button type="button" class="decision-button" onclick={approve} disabled={busy}>
        {busy ? 'Recording…' : 'Approve this inspection'}
      </button>
      <button type="button" class="decision-button warn" onclick={reject} disabled={busy || rejectionReason.trim().length === 0}>
        Reject with reason
      </button>
      <span class="reason-field">
        <label class="app-note" for="rejection-reason">Rejection reason (mandatory)</label>
        <input
          id="rejection-reason"
          class="reason-input"
          type="text"
          bind:value={rejectionReason}
          placeholder="Why is this being returned?"
        />
      </span>
    {/if}
    {#if status === 'rejected' && isAssignedTechnician}
      <button type="button" class="decision-button neutral" onclick={revise} disabled={busy}>
        Revise — return to draft for corrections
      </button>
    {/if}
    {#if status === 'draft' && isAssignedTechnician}
      <button type="button" class="decision-button" onclick={submit} disabled={busy}>
        Submit for decision
      </button>
    {/if}
    <span class="app-note">
      Every control here — and the document's own Approve interaction — dispatches the SAME declared
      action through the SAME server-side adapter boundary; denials, conflicts and stale decisions
      surface identically from either.
    </span>
  </div>

  {#if (status === 'draft' || status === 'submitted') && data.actorRole === 'technician'}
    <div class="decision-bar">
      <span class="reason-field">
        <label class="app-note" for="finding-description">Add finding</label>
        <select
          class="reason-input"
          style="max-width: 120px"
          aria-label="Finding severity"
          bind:value={newFindingSeverity}
        >
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
        </select>
        <input
          id="finding-description"
          class="reason-input"
          type="text"
          bind:value={newFindingDescription}
          placeholder="Finding description"
        />
        <button
          type="button"
          class="decision-button neutral"
          onclick={addFinding}
          disabled={busy || newFindingDescription.trim().length === 0}
        >
          Add finding
        </button>
      </span>
      <span class="reason-field">
        <label class="app-note" for="evidence-label">Add evidence</label>
        <select
          class="reason-input"
          style="max-width: 120px"
          aria-label="Evidence kind"
          bind:value={newEvidenceKind}
        >
          <option value="note">note</option>
          <option value="image-ref">image-ref</option>
        </select>
        <input
          id="evidence-label"
          class="reason-input"
          type="text"
          bind:value={newEvidenceLabel}
          placeholder="Evidence label"
        />
        <button
          type="button"
          class="decision-button neutral"
          onclick={addEvidence}
          disabled={busy || newEvidenceLabel.trim().length === 0}
        >
          Add evidence
        </button>
      </span>
    </div>
  {/if}

  <section aria-label="Activity trail">
    <h2 class="app-subtitle">Activity trail</h2>
    <ul class="trail">
      {#each activity as entry (entry.id)}
        <li>
          <span class="trail-when">{entry.at}</span>
          <span class="trail-actor">{entry.actor}</span>
          <span>{entry.entry}</span>
        </li>
      {/each}
    </ul>
  </section>
</main>
