<script lang="ts">
  /**
   * Registered product surface cmp.session-picker@1: the project +
   * session chooser of the coding-agent workspace. The session and
   * project lists arrive as DECLARED view data (`sessions: { view:
   * 'v.agentSessions' }`, `projects: { view: 'v.agentProjects' }` — the
   * host loader loads them for the screen); the island never self-fetches
   * and navigates with ordinary links to the session routes. Presentation
   * reuses the VICT tokens, status styles and the catalog Select.
   */
  import '@victframework/ui-svelte/catalog.css';
  import { ControlScope, ChevronDown } from '@victframework/ui-svelte/controls';
  import { Select } from '@victframework/ui-svelte/catalog/select';
  import { Progress } from '@victframework/ui-svelte/catalog/progress';
  import { AlertDialog } from '@victframework/ui-svelte/catalog/alert-dialog';
  import { useVictActions } from '@victframework/ui-svelte/component-actions';
  import { ActionFeedback } from '@victframework/ui-svelte';
  import { actionFeedback, type UiActionFeedback } from '@victframework/ui';

  let {
    kind,
    sessions,
    projects,
    resetActionId,
  }: {
    kind: string;
    sessions?: readonly Record<string, unknown>[];
    projects?: readonly Record<string, unknown>[];
    resetActionId: string;
  } = $props();

  const actions = useVictActions();

  interface SessionRow {
    id: string;
    projectId: string;
    task: string;
    status: string;
    progress: number;
    branch: string;
    model: string;
    updatedAt: string;
    durationMin: number;
    filesChanged: number;
    tokens: number;
  }
  interface ProjectRow {
    id: string;
    name: string;
    description: string;
  }

  const sessionRows = $derived((sessions ?? []) as readonly SessionRow[]);
  const projectRows = $derived((projects ?? []) as readonly ProjectRow[]);
  let project = $state('all');
  let resetOpen = $state(false);
  let resetting = $state(false);
  let resetFeedback = $state<UiActionFeedback | null>(null);

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

  function sessionSort(a: SessionRow, b: SessionRow): number {
    // Deterministic presentation: waiting first, then running, then the
    // rest by session id — the chooser is a triage list, not a feed.
    const rank: Record<string, number> = { awaiting_approval: 0, running: 1, failed: 2, completed: 3 };
    return (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || (a.id < b.id ? -1 : 1);
  }

  const visible = $derived(
    project === 'all'
      ? [...sessionRows].sort(sessionSort)
      : [...sessionRows].filter((s) => s.projectId === project).sort(sessionSort),
  );

  /** Deterministic restart of the whole demo (application-controlled close). */
  async function resetDemo(): Promise<void> {
    if (resetting) return;
    resetting = true;
    resetFeedback = null;
    try {
      const result = await actions.run(resetActionId);
      if (result) {
        resetFeedback = actionFeedback(result, { success: 'Demo data restored.' }, true);
        if (resetFeedback.kind === 'success') {
          resetOpen = false;
          // The renderer's invalidation hook reloads the declared views;
          // the fresh session/project rows arrive as props.
        }
      }
    } catch {
      resetFeedback = actionFeedback({ ok: false }, {}, true);
    } finally {
      resetting = false;
    }
  }
</script>

<ControlScope>
  <section class="picker" data-testid="session-picker">
    <div class="picker-bar">
      <span id="picker-project-label" class="vict-control-label">Project</span>
      <Select.Root
        type="single"
        bind:value={project}
        disabled={projectRows.length === 0}
      >
        <Select.Trigger aria-labelledby="picker-project-label" class="picker-select">
          <span>{project === 'all' ? 'All projects' : project}</span>
          <ChevronDown />
        </Select.Trigger>
        <Select.Portal>
          <Select.Content sideOffset={6} align="start" collisionPadding={16}>
            <Select.Item value="all">All projects</Select.Item>
            {#each projectRows as item (item.id)}
              <Select.Item value={item.id}>{item.name}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Portal>
      </Select.Root>
      <span class="picker-count" role="status">
        {`${visible.length} ${visible.length === 1 ? 'session' : 'sessions'}`}
      </span>
      <AlertDialog.Root bind:open={resetOpen}>
        <AlertDialog.Trigger
          class="vict-btn vict-btn--quiet"
          data-testid="reset-open"
          disabled={resetting}
          >Reset demo data</AlertDialog.Trigger
        >
        <AlertDialog.Portal>
          <AlertDialog.Overlay />
          <AlertDialog.Content>
            <AlertDialog.Title>Reset the demo data?</AlertDialog.Title>
            <AlertDialog.Description>
              Every session, transcript, file change and log line returns to its original state.
              The action is deterministic and local to this preview.
            </AlertDialog.Description>
            <div class="vict-control-row">
              <AlertDialog.Cancel>Keep current data</AlertDialog.Cancel>
              <AlertDialog.Action
                class="vict-btn vict-btn--danger"
                data-testid="reset-confirm"
                disabled={resetting}
                onclick={() => void resetDemo()}
              >
                {resetting ? 'Resetting…' : 'Reset demo data'}
              </AlertDialog.Action>
            </div>
            {#if resetFeedback !== null && resetFeedback.kind !== 'success'}
              <p class="vict-field-error" role="alert">{resetFeedback.message}</p>
            {/if}
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
      {#if resetFeedback !== null && resetFeedback.kind === 'success'}
        <span class="picker-reset-done" role="status" data-testid="reset-done">{resetFeedback.message}</span>
      {/if}
    </div>

    {#if visible.length === 0}
      <p class="vict-state" data-state="empty">
        No sessions for this project yet. Choose another project, or reset the demo data.
      </p>
    {:else}
      <ul class="picker-list" data-testid="session-list">
        {#each visible as session (session.id)}
          <li>
            <a
              class="picker-card"
              href={`/agent/sessions/${session.id}`}
              data-testid="session-card"
              data-status={session.status}
            >
              <span class="picker-card-head">
                <span class="vict-status vict-status--{TONES[session.status] ?? 'neutral'}"
                  >{LABELS[session.status] ?? session.status}</span
                >
                <strong class="picker-id">{session.id}</strong>
                <span class="picker-branch">{session.branch}</span>
              </span>
              <span class="picker-task">{session.task}</span>
              <Progress.Root value={session.progress} max={100} class="picker-progress" aria-label={`Task progress · ${session.progress}%`}>
                <div class="vict-metric-fill" style={`--vict-value:${session.progress}%`}></div>
              </Progress.Root>
              <span class="picker-meta">
                {session.projectId} · {session.filesChanged}
                {session.filesChanged === 1 ? 'file' : 'files'} ·
                {session.durationMin} min · updated {session.updatedAt.slice(11, 16)}
              </span>
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</ControlScope>

<style>
  .picker {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .picker-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .picker-bar .vict-control-label {
    margin: 0;
  }
  .picker-select {
    width: 280px;
    max-width: 100%;
  }
  .picker-count {
    color: var(--vict-color-text);
    opacity: 0.72;
    font-size: 0.92rem;
    margin-left: auto;
  }
  .picker-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 14px;
  }
  .picker-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
    padding: 16px;
    border: 1px solid var(--vict-color-border);
    border-radius: var(--vict-radius-base);
    background: var(--vict-color-surface);
    color: var(--vict-color-text);
    text-decoration: none;
    box-shadow: var(--vict-elevation-low);
  }
  .picker-card:hover {
    border-color: var(--vict-color-accent);
  }
  .picker-card:focus-visible {
    outline: 2px solid var(--vict-color-focus);
    outline-offset: 2px;
  }
  .picker-card-head {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .picker-id {
    font-family: var(--vict-font-family);
  }
  .picker-branch {
    margin-left: auto;
    font-size: 0.85rem;
    opacity: 0.72;
  }
  .picker-task {
    font-size: 1rem;
    line-height: 1.45;
  }
  .picker-progress {
    height: 8px;
  }
  .picker-meta {
    font-size: 0.85rem;
    opacity: 0.72;
  }
  .picker-reset-done {
    font-size: 0.9rem;
    color: var(--vict-color-success, var(--vict-color-text));
  }
</style>
