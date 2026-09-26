<script lang="ts">
  /**
   * Registered product surface cmp.session-console@1: the task console of
   * one coding-agent session. It resolves the session from the workspace
   * route (`/agent/sessions/:id`), fetches it through the DECLARED query
   * action, and drives the deterministic state machine through the
   * DECLARED console mutations via the supported component-action
   * context:
   *
   * - waiting  → Approve (resume) or Decline (close without applying)
   * - running  → Advance one step, or Simulate failure
   * - failed   → Retry from checkpoint
   * - completed→ summary state; transcript and changes stay available
   *
   * This is genuinely product-specific composition (an agent state
   * machine does not exist in the shared vocabulary). Presentation
   * reuses VICT tokens, status classes, buttons, catalog Progress and
   * the shared ActionFeedback component.
   */
  import '@victframework/ui-svelte/catalog.css';
  import { ControlScope } from '@victframework/ui-svelte/controls';
  import { Progress } from '@victframework/ui-svelte/catalog/progress';
  import { useVictActions } from '@victframework/ui-svelte/component-actions';
  import { ActionFeedback } from '@victframework/ui-svelte';
  import { actionFeedback, type UiActionFeedback, type UiActionFeedbackText } from '@victframework/ui';
  import { onAgentDataChanged, notifyAgentDataChanged } from './bus.js';

  let { sessionsActionId }: { sessionsActionId: string } = $props();

  const actions = useVictActions();

  /** Application-owned outcome copy, mirroring the plan's action feedback. */
  const FEEDBACK: Record<string, UiActionFeedbackText> = {
    'act.approve': { success: 'Approved — Victor resumed the session.' },
    'act.decline': { success: 'Declined — the session closed without applying the pending change.' },
    'act.advance': { success: 'Step complete — progress updated.' },
    'act.fail': {
      success: 'Failure simulated — Victor stopped at its last checkpoint.',
    },
    'act.retry': { success: 'Victor resumed from the last checkpoint.' },
    'act.reset': { success: 'Demo data restored.' },
  };

  interface SessionRow {
    id: string;
    projectId: string;
    task: string;
    status: string;
    progress: number;
    model: string;
    branch: string;
    startedAt: string;
    updatedAt: string;
    durationMin: number;
    filesChanged: number;
    tokens: number;
  }

  let session = $state<SessionRow | null>(null);
  let missing = $state(false);
  let pending = $state(false);
  let busyAction = $state('');
  let feedback = $state<UiActionFeedback | null>(null);
  let lastAction = $state<string | null>(null);

  const TONES: Record<string, string> = {
    running: 'info',
    completed: 'success',
    failed: 'danger',
    awaiting_approval: 'warning',
  };
  const LABELS: Record<string, string> = {
    running: 'Running',
    completed: 'Completed',
    failed: 'Failed',
    awaiting_approval: 'Waiting for approval',
  };

  const sessionId = $derived.by(() => {
    if (typeof window === 'undefined') return '';
    // The workspace is a parameter route of this product (/agent/sessions/:id).
    const parts = window.location.pathname.split('/').filter((part) => part !== '');
    return parts.length >= 3 && parts[0] === 'agent' && parts[1] === 'sessions'
      ? (parts[2] ?? '')
      : '';
  });

  async function refresh(): Promise<void> {
    if (sessionId === '') return;
    try {
      const result = await actions.run(sessionsActionId, {
        filters: {},
        sort: [{ field: 'id', direction: 'asc' }],
        limit: 50,
      });
      const rows = result && result.ok === true ? ((result.value as { rows?: SessionRow[] }).rows ?? []) : [];
      session = rows.find((row) => row.id === sessionId) ?? null;
      missing = session === null;
    } catch {
      session = null;
      missing = true;
    }
  }

  $effect(() => {
    void sessionId;
    void refresh();
    return onAgentDataChanged(() => void refresh());
  });

  async function run(actionId: string, label: string): Promise<void> {
    if (pending) return;
    feedback = null;
    pending = true;
    busyAction = label;
    lastAction = actionId;
    try {
      const result = await actions.run(actionId, { id: sessionId });
      if (result) feedback = actionFeedback(result, FEEDBACK[actionId] ?? {}, true);
      // Console actions change session data; refresh this surface and the
      // other product surfaces, then let the host invalidation refresh the
      // standard surfaces (conversation, files, activity).
      await refresh();
      notifyAgentDataChanged();
    } catch {
      feedback = actionFeedback({ ok: false }, undefined, true);
    } finally {
      pending = false;
      busyAction = '';
    }
  }
</script>

<ControlScope>
  {#if missing}
    <p class="vict-alert" role="alert" data-testid="session-console-missing">
      This session does not exist in the workspace. Pick another session from the
      <a href="/agent">session list</a>.
    </p>
  {:else if session !== null}
    <section class="console" data-testid="session-console" data-status={session.status} aria-busy={pending}>
      <p class="console-topline">
        <span class="vict-status vict-status--{TONES[session.status] ?? 'neutral'}" data-testid="session-status"
          >{LABELS[session.status] ?? session.status}</span
        >
        <span class="console-session">{session.id}</span>
        <span class="console-project">{session.projectId}</span>
      </p>
      <h2 class="console-task" data-testid="session-task">{session.task}</h2>
      <p class="console-meta">
        {session.model} · branch {session.branch} · {session.filesChanged}
        {session.filesChanged === 1 ? 'file' : 'files'} changed ·
        {session.durationMin} min · {session.tokens.toLocaleString('en-GB')} tokens
      </p>

      <span id="console-progress-label" class="vict-control-label"
        >Task progress · {session.progress}%</span
      >
      <Progress.Root
        value={session.progress}
        max={100}
        aria-labelledby="console-progress-label"
        class="console-progress"
        data-testid="session-progress"
      >
        <div class="vict-metric-fill" style={`--vict-value:${session.progress}%`}></div>
      </Progress.Root>

      {#if session.status === 'awaiting_approval'}
        <div class="console-approval" role="region" aria-label="Approval requested" data-testid="approval-panel">
          <p class="console-approval-title">Victor needs your approval</p>
          <p class="console-approval-body">
            The next step edits files outside the current task scope. Review the conversation and
            the changed files, then approve or decline.
          </p>
          <div class="console-actions">
            <button
              class="vict-btn vict-btn--primary"
              type="button"
              data-testid="approve-btn"
              disabled={pending}
              onclick={() => void run('act.approve', 'approve')}
            >
              {busyAction === 'approve' ? 'Approving…' : 'Approve and continue'}
            </button>
            <button
              class="vict-btn vict-btn--secondary"
              type="button"
              data-testid="decline-btn"
              disabled={pending}
              onclick={() => void run('act.decline', 'decline')}
            >
              {busyAction === 'decline' ? 'Declining…' : 'Decline'}
            </button>
            <ActionFeedback {feedback} actionId="act.approve" />
          </div>
        </div>
      {:else if session.status === 'running'}
        <div class="console-actions">
          <button
            class="vict-btn vict-btn--primary"
            type="button"
            data-testid="advance-btn"
            disabled={pending}
            onclick={() => void run('act.advance', 'advance')}
          >
            {busyAction === 'advance' ? 'Advancing…' : 'Advance one step'}
          </button>
          <button
            class="vict-btn vict-btn--danger"
            type="button"
            data-testid="fail-btn"
            disabled={pending}
            onclick={() => void run('act.fail', 'fail')}
          >
            {busyAction === 'fail' ? 'Failing…' : 'Simulate failure'}
          </button>
          <ActionFeedback {feedback} actionId="act.advance" />
        </div>
      {:else if session.status === 'failed'}
        <div class="console-actions">
          <button
            class="vict-btn vict-btn--primary"
            type="button"
            data-testid="retry-btn"
            disabled={pending}
            onclick={() => void run('act.retry', 'retry')}
          >
            {busyAction === 'retry' ? 'Retrying…' : 'Retry from checkpoint'}
          </button>
          <ActionFeedback {feedback} actionId="act.retry" />
        </div>
      {:else}
        <p class="console-done" data-testid="session-done">
          This session finished. Its transcript, activity and changed files remain available here.
        </p>
        <div class="console-actions">
          <ActionFeedback {feedback} actionId={lastAction ?? 'act.advance'} />
        </div>
      {/if}
    </section>
  {:else}
    <p class="vict-state" role="status" data-testid="session-console-loading">Loading session…</p>
  {/if}
</ControlScope>

<style>
  .console {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .console-topline {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin: 0;
  }
  .console-session {
    font-weight: 600;
  }
  .console-project {
    opacity: 0.72;
  }
  .console-task {
    margin: 0;
    line-height: 1.3;
  }
  .console-meta {
    margin: 0;
    font-size: 0.9rem;
    opacity: 0.78;
  }
  .console-progress {
    height: 10px;
  }
  .console-approval {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    border: 1px solid var(--vict-color-warning, var(--vict-color-border));
    border-radius: var(--vict-radius-base);
    background: var(--vict-color-surface);
  }
  .console-approval-title {
    margin: 0;
    font-weight: 650;
  }
  .console-approval-body {
    margin: 0;
    font-size: 0.92rem;
    opacity: 0.85;
  }
  .console-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .console-done {
    margin: 0;
    opacity: 0.85;
  }
</style>
