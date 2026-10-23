<script lang="ts">
  import * as Marker from '../upstream/ui/marker/index.js';
  import { Button } from '../upstream/ui/button/index.js';

  let { label, onRestore, canRestore }: {
    label: string;
    onRestore?: () => void;
    /** Host-owned availability; restoring never happens inside this component. */
    canRestore?: boolean;
  } = $props();
</script>

<Marker.Root variant="separator">
  <Marker.Content class="inline-flex items-center gap-2">
    {label}
    {#if canRestore ?? !!onRestore}
      <Button size="xs" variant="outline" aria-label={`Restore to ${label}`}
        disabled={!onRestore} onclick={onRestore}>
        Restore
      </Button>
    {/if}
  </Marker.Content>
</Marker.Root>
