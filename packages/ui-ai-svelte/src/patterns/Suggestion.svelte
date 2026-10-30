<script lang="ts">
  import { Button } from '../upstream/ui/button/index.js';
  import type { UiComponentPresentation } from '@victframework/ui-svelte';

  let { text, onSelect, presentation }: {
    text: string;
    onSelect?: (text: string) => void;
    presentation?: UiComponentPresentation;
  } = $props();
</script>

<Button {...presentation?.target('select')} variant="outline" size="sm" class={`shrink-0 ${presentation?.target('select').class??''}`}
  disabled={!onSelect} onclick={() => onSelect?.(text)}>
  {text}
</Button>
