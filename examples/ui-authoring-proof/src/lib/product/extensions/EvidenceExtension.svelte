<script lang="ts">
  import type { UiSvelteExtensionProps } from '@victframework/ui-svelte';
  let { props }: UiSvelteExtensionProps = $props();
</script>
<figure>
  <div class="placeholder" aria-hidden="true">{props.kind === 'note' ? 'NOTE' : 'IMAGE REFERENCE'}</div>
  <figcaption><strong>{String(props.label ?? '')}</strong><span>{props.kind === 'note' ? 'Labelled note · demo evidence' : 'Labelled placeholder · image unavailable in this demo'}</span></figcaption>
</figure>
<style>
  figure { margin: 0; border: 1px solid var(--vict-color-border); border-radius: 8px; overflow: hidden; }
  .placeholder { background: #edf2f1; color: #586c73; padding: 28px 16px; font-size: 10px; letter-spacing: .12em; text-align: center; }
  figcaption { padding: 14px; display: flex; flex-direction: column; gap: 6px; }
  strong { font-size: 14px; }
  span { color: var(--vict-color-textMuted); font-size: 12px; }
</style>
