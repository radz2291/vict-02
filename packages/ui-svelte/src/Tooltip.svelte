<script lang="ts">
  import { Tooltip } from 'bits-ui';
  let { label, text }: { label: string; text: string } = $props();
</script>
<Tooltip.Provider delayDuration={250}>
  <Tooltip.Root>
    <Tooltip.Trigger class="vict-help" aria-label={label}>?</Tooltip.Trigger>
    <Tooltip.Content role="tooltip" class="vict-tooltip" sideOffset={8}>{text}</Tooltip.Content>
  </Tooltip.Root>
</Tooltip.Provider>
