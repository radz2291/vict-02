<script lang="ts">
  import type { Snippet } from 'svelte';
  let { docId, feedback, onPick, children }: {
    docId: 'controls' | 'shell';
    feedback: string[];
    onPick: (next: 'controls' | 'shell') => void;
    children: Snippet;
  } = $props();
</script>

<div class="vict-app">
  <header class="shell-header">
    <strong>Tasks</strong>
    <nav aria-label="Screens">
      <button type="button" aria-current={docId === 'controls' ? 'page' : undefined} onclick={() => onPick('controls')}>Controls</button>
      <button type="button" aria-current={docId === 'shell' ? 'page' : undefined} onclick={() => onPick('shell')}>Shell + dialog</button>
    </nav>
    <a href="/index.html" target="_blank" rel="noreferrer">Open authoring ↗</a>
  </header>
  <main class="shell-main">
    {@render children()}
    <aside class="action-feedback" aria-live="polite" data-testid="action-feedback">
      {#each feedback as line, index (index)}<p>{line}</p>{/each}
    </aside>
  </main>
</div>

<style>
  .vict-app { min-height: 100vh; font: 14px/1.5 system-ui, sans-serif; color: #1c2430; background: #fbfcfe; }
  .shell-header { display: flex; gap: 14px; align-items: center; padding: 12px 22px; border-bottom: 1px solid #dfe4ec; background: #fff; }
  .shell-header nav { display: flex; gap: 8px; }
  .shell-header button { padding: 6px 12px; border: 1px solid #dfe4ec; border-radius: 6px; background: #fff; cursor: pointer; font: inherit; }
  .shell-header button[aria-current='page'] { background: #e8efff; border-color: #b8cbf5; }
  .shell-header a { margin-left: auto; font-size: 12.5px; }
  .shell-main { padding: 22px; }
  .action-feedback { margin-top: 18px; font-size: 12px; color: #4a5568; }
  .action-feedback p { margin: 2px 0; }
</style>
