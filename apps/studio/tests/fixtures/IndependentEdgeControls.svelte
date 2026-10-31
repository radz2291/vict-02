<script lang="ts">
  import type { UiScopedSlotFrame } from '@victframework/ui-svelte';
  let { frame, target, expose }: { frame: UiScopedSlotFrame; target: string; expose: (target: string, frame: UiScopedSlotFrame) => void } = $props();
  $effect(() => { expose(target, frame); });
</script>
<input aria-label={`${target} color`} value={String(frame.state?.color ?? '')} disabled={frame.props.readOnly === true} oninput={(event) => frame.onStateChange?.('color', event.currentTarget.value)}/>
<button onclick={() => frame.onOutput?.('reset')} disabled={frame.props.readOnly === true}>Reset {target}</button>
