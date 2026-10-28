<script lang="ts">
  import * as Marker from '../upstream/ui/marker/index.js';
  import { Button } from '../upstream/ui/button/index.js';
  import type { UiComponentPresentation } from '@victframework/ui-svelte';

  let { label, onRestore, canRestore, presentation }: {
    label: string;
    onRestore?: () => void;
    /** Host-owned availability; restoring never happens inside this component. */
    canRestore?: boolean;
    presentation?: UiComponentPresentation;
  } = $props();
</script>

<Marker.Root variant="separator">
  <Marker.Content class="inline-flex items-center gap-2">
    <span {...presentation?.target('label')}>{label}</span>
    {#if canRestore ?? !!onRestore}
      <Button {...presentation?.target('restore')} size="xs" variant="outline" aria-label={`Restore to ${label}`}
        disabled={!onRestore} onclick={onRestore}>
        Restore
      </Button>
    {/if}
  </Marker.Content>
</Marker.Root>
