<script lang="ts">
  import type { UiDocument } from '@victframework/ui';
  import { screenAuthoringGuidance } from './placement.js';
  let { document }: { document: UiDocument } = $props();
  const guidance=$derived(screenAuthoringGuidance(document));
</script>

{#if guidance.count}
  <details class="authoring-guidance">
    <summary>Source guidance ({guidance.count})</summary>
    <p>These notes do not block Save or Run. Retained legacy source remains unchanged. Runtime checks still apply.</p>
    <ul>{#each guidance.items as item}<li><strong>{item.legacy?'Compatibility':item.code}</strong>{#if item.nodeId}<code>{item.nodeId}</code>{/if}<span>{item.message}</span>{#if item.path}<small>{item.path}</small>{/if}</li>{/each}</ul>
    {#if guidance.more}<p>Showing the first 20 notes. Resolve these and review the remaining guidance.</p>{/if}
  </details>
{/if}

<style>
  .authoring-guidance {margin:8px 0;padding:10px;border:1px solid var(--vict-border,#dce2eb);border-radius:6px;font-size:12px;}
  summary {cursor:pointer;font-weight:600;}
  p {line-height:1.5;color:var(--vict-muted,#687994);}
  ul {padding-left:18px;max-height:280px;overflow:auto;}
  li {margin:12px 0;overflow-wrap:anywhere;}
  code {margin-left:8px;} span,small {display:block;margin-top:4px;}
</style>
