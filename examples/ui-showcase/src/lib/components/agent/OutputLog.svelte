<script lang="ts">
  /**
   * Registered product surface cmp.output-log@1: the tool output log of
   * one coding-agent session. It fetches its lines through the DECLARED
   * query action (act.queryLog) for the workspace route's session and
   * presents them as a real engineering log — monospace, leveled, and
   * inside the catalog ScrollArea — never as a generic alert.
   */
  import '@victframework/ui-svelte/catalog.css';
  import { ControlScope } from '@victframework/ui-svelte/controls';
  import { ScrollArea } from '@victframework/ui-svelte/catalog/scroll-area';
  import { useVictActions } from '@victframework/ui-svelte/component-actions';
  import { onAgentDataChanged } from './bus.js';

  let { logActionId }: { logActionId: string } = $props();

  const actions = useVictActions();

  interface LogRow {
    id: string;
    at: string;
    level: string;
    tool: string;
    line: string;
  }

  let lines = $state<LogRow[]>([]);
  let failed = $state(false);
  let viewport = $state<HTMLDivElement | null>(null);

  const sessionId = $derived.by(() => {
    if (typeof window === 'undefined') return '';
    const parts = window.location.pathname.split('/').filter((part) => part !== '');
    return parts.length >= 3 && parts[0] === 'agent' && parts[1] === 'sessions'
      ? (parts[2] ?? '')
      : '';
  });

  async function refresh(): Promise<void> {
    if (sessionId === '') return;
    failed = false;
    try {
      const result = await actions.run(logActionId, {
        filters: { sessionId },
        sort: [
          { field: 'at', direction: 'asc' },
          { field: 'id', direction: 'asc' },
        ],
        limit: 200,
      });
      lines = result && result.ok === true ? ((result.value as { rows?: LogRow[] }).rows ?? []) : [];
      if (result && result.ok === false) failed = true;
    } catch {
      failed = true;
    }
    // The log reads oldest → newest; keep the newest line in view.
    await Promise.resolve();
    if (viewport !== null) viewport.scrollTop = viewport.scrollHeight;
  }

  $effect(() => {
    void sessionId;
    void refresh();
    return onAgentDataChanged(() => void refresh());
  });

  function timeOf(at: string): string {
    return at.length >= 16 ? at.slice(11, 16) : at;
  }
</script>

<ControlScope>
  <section class="log" data-testid="output-log" aria-label="Tool output log">
    <p class="log-head">
      <span>Tool output</span>
      <span class="log-count">{lines.length} {lines.length === 1 ? 'line' : 'lines'}</span>
    </p>
    {#if failed}
      <p class="vict-alert" role="alert">The output log could not be loaded. It will retry when the session changes.</p>
    {:else if lines.length === 0}
      <p class="vict-state" data-state="empty">No output recorded for this session yet.</p>
    {:else}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <ScrollArea.Root type="always" class="log-viewport-root">
        <ScrollArea.Viewport
          class="log-viewport"
          tabindex={0}
          aria-label="Tool output for this session"
          bind:ref={viewport}
          data-testid="log-viewport"
        >
          <ol class="log-lines" role="log" aria-label="Tool output lines">
            {#each lines as entry (entry.id)}
              <li class="log-line log-line--{entry.level}" data-testid="log-line" data-level={entry.level}>
                <span class="log-time">{timeOf(entry.at)}</span>
                <span class="log-level">{entry.level}</span>
                <span class="log-tool">{entry.tool}</span>
                <span class="log-text">{entry.line}</span>
              </li>
            {/each}
          </ol>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical">
          <ScrollArea.Thumb />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    {/if}
  </section>
</ControlScope>

<style>
  .log {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .log-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    margin: 0;
    font-weight: 600;
  }
  .log-count {
    font-weight: 400;
    font-size: 0.85rem;
    opacity: 0.72;
  }
  .log-viewport-root {
    height: 300px;
  }
  .log-viewport {
    height: 100%;
  }
  .log-lines {
    list-style: none;
    margin: 0;
    padding: 12px 14px;
    font-family: ui-monospace, 'Cascadia Mono', 'JetBrains Mono', Menlo, Consolas, monospace;
    font-size: 0.82rem;
    line-height: 1.55;
  }
  .log-line {
    display: block;
    padding-block: 1px;
    white-space: normal;
    word-break: break-word;
  }
  .log-time,
  .log-tool {
    opacity: 0.66;
  }
  .log-time {
    margin-right: 7px;
  }
  .log-level {
    display: inline-block;
    margin-right: 7px;
    text-transform: uppercase;
    font-size: 0.72rem;
    letter-spacing: 0.04em;
    padding: 0 5px;
    border-radius: 4px;
    border: 1px solid var(--vict-color-border);
  }
  .log-tool {
    margin-right: 7px;
  }
  .log-line--error .log-level {
    color: var(--vict-color-danger);
    border-color: var(--vict-color-danger);
  }
  .log-line--warn .log-level {
    color: var(--vict-color-warning);
    border-color: var(--vict-color-warning);
  }
  .log-line--command .log-text {
    font-weight: 600;
  }
  .log-text {
    display: inline;
    min-width: 0;
  }
</style>
