<script lang="ts">
  import { TimeField } from 'bits-ui';
  import { getContext } from 'svelte';
  import { timeFieldContext, type TimeFieldContext } from './time-field-context.js';
  let { ref = $bindable(null), child, children, ...rest }: TimeField.InputProps = $props();
  const field = getContext<TimeFieldContext>(timeFieldContext);
  function displayed(segments: Parameters<NonNullable<TimeField.InputProps['children']>>[0]['segments']) {
    return segments.map(segment => segment.part === 'dayPeriod'
      ? { ...segment, value: (field.value()?.hour ?? 0) >= 12 ? 'PM' : 'AM' }
      : segment);
  }
</script>

<TimeField.Input {...rest} bind:ref>
  {#snippet child({ props: attributes, segments })}
    {#if child}{@render child({ props: attributes, segments: displayed(segments) })}
    {:else}<div {...attributes}>{@render children?.({ segments: displayed(segments) })}</div>{/if}
  {/snippet}
</TimeField.Input>
