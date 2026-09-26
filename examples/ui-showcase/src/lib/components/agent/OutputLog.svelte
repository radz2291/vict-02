<script lang="ts">
  /**
   * Registered product surface cmp.output-log@1: the tool output log of
   * one coding-agent session. The session-scoped log rows arrive as
   * DECLARED view data (`lines: { view: 'v.agentLog' }` — the host loader
   * applies the session scope); the island never inspects the URL and
   * never self-fetches. Presentation is a real engineering log —
   * monospace, leveled, inside the catalog ScrollArea — never a generic
   * alert.
   */
  import '@victframework/ui-svelte/catalog.css';
  import { ControlScope } from '@victframework/ui-svelte/controls';
  import { ScrollArea } from '@victframework/ui-svelte/catalog/scroll-area';

  let {
    kind,
    lines,
  }: {
    kind: string;
    lines?: readonly Record<string, unknown>[];
  } = $props();

  interface LogRow {
    id: string;
    at: string;
    level: string;
    tool: string;
    line: string;
  }

  const entries = $derived((lines ?? []) as readonly LogRow[]);
  let viewport = $state<HTMLDivElement | null>(null);

  // The log reads oldest → newest; keep the newest line in view.
  $effect(() => {
    void entries.length;
    void Promise.resolve();
    if (viewport !== null) viewport.scrollTop = viewport.scrollHeight;
  });

  function timeOf(at: string): string {
    return at.length >= 16 ? at.slice(11, 16) : at;
  }
</script>

<ControlScope>
  <section class="log" data-testid="output-log" aria-label="Tool output log">
    <p class="log-head">
      <span>Tool output</span>
      <span class="log-count">{entries.length} {entries.length === 1 ? 'line' : 'lines'}</span>
    </p>
    {#if entries.length === 0}
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
            {#each entries as entry (entry.id)}
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
