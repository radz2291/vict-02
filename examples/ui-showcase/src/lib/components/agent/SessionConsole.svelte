<script lang="ts">
  /**
   * Registered product surface cmp.session-console@1: the task console of
   * one coding-agent session. All session context arrives as DECLARED
   * route-context props (fields of the workspace route's session record,
   * supplied by the shared renderer) and every console action dispatches
   * through the supported component-action context with the DECLARED
   * input binding `{ id: { param: 'id' } }` — the island never inspects
   * the URL and never self-fetches:
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
  import { tick } from 'svelte';
  import { ControlScope } from '@victframework/ui-svelte/controls';
  import { Progress } from '@victframework/ui-svelte/catalog/progress';
  import { useVictActions } from '@victframework/ui-svelte/component-actions';
  import { ActionFeedback } from '@victframework/ui-svelte';
  import { actionFeedback, type UiActionFeedback, type UiActionFeedbackText } from '@victframework/ui';

  let {
    kind,
    id,
    projectId,
    task,
    status,
    progress,
    model,
    branch,
    durationMin,
    filesChanged,
    tokens,
  }: {
    kind: string;
    id?: string;
    projectId?: string;
    task?: string;
    status?: string;
    progress?: number;
    model?: string;
    branch?: string;
    durationMin?: number;
    filesChanged?: number;
    tokens?: number;
  } = $props();

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
  };

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

  /** The declared record context: present only for an existing session. */
  const missing = $derived(typeof id !== 'string' || id.length === 0);

  async function run(actionId: string, label: string): Promise<void> {
    if (pending) return;
    feedback = null;
    pending = true;
    busyAction = label;
    lastAction = actionId;
    try {
      // No explicit input: the surface's declared input binding
      // `{ id: { param: 'id' } }` supplies the current record identity.
      const result = await actions.run(actionId);
      if (result) feedback = actionFeedback(result, FEEDBACK[actionId] ?? {}, true);
      // Console actions change session data; the shared renderer resolves
      // an action only AFTER its route refresh has settled, so this
      // feedback line and the refreshed status badge always agree.
    } catch {
      feedback = actionFeedback({ ok: false }, undefined, true);
    } finally {
      pending = false;
      busyAction = '';
      // A state-changing action usually swaps the console's control branch
      // (the clicked button is gone). Keyboard focus must follow the new
      // primary control instead of dropping to <body>.
      await tick();
      const section = document.querySelector('[data-testid=session-console]');
      if (section === null || section.contains(document.activeElement)) return;
      const primary = section.querySelector<HTMLElement>(
        '[data-testid=approve-btn], [data-testid=advance-btn], [data-testid=retry-btn]',
      );
      if (primary !== null) {
        primary.focus();
      } else {
        section.querySelector<HTMLElement>('[data-testid=session-done]')?.focus();
      }
    }
  }
</script>

<ControlScope>
  {#if missing}
    <p class="vict-alert" role="alert" data-testid="session-console-missing">
      This session does not exist in the workspace. Pick another session from the
      <a href="/agent">session list</a>.
    </p>
  {:else if id !== undefined}
    <section class="console" data-testid="session-console" data-status={status ?? ""} aria-busy={pending}>
      <p class="console-topline">
        <span class="vict-status vict-status--{TONES[status ?? ''] ?? 'neutral'}" data-testid="session-status"
          >{LABELS[status ?? ''] ?? status}</span
        >
        <span class="console-session">{id ?? ""}</span>
        <span class="console-project">{projectId ?? ""}</span>
      </p>
      <h2 class="console-task" data-testid="session-task">{task ?? ""}</h2>
      <p class="console-meta">
        {model ?? ""} · branch {branch ?? ""} · {filesChanged ?? 0}
        {(filesChanged ?? 0) === 1 ? 'file' : 'files'} changed ·
        {durationMin ?? 0} min · {(tokens ?? 0).toLocaleString('en-GB')} tokens
      </p>

      <span id="console-progress-label" class="vict-control-label"
        >Task progress · {progress ?? 0}%</span
      >
      <Progress.Root
        value={progress ?? 0}
        max={100}
        aria-labelledby="console-progress-label"
        class="console-progress"
        data-testid="session-progress"
      >
        <div class="vict-metric-fill" style={`--vict-value:${progress ?? 0}%`}></div>
      </Progress.Root>

      {#if status === 'awaiting_approval'}
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
      {:else if status === 'running'}
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
      {:else if status === 'failed'}
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
        <p class="console-done" data-testid="session-done" tabindex="-1">
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
