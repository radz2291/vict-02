<script lang="ts">
  import { Slider } from '../slider.js';
  import { numeric } from './b3-values.js';
  import type { UiSvelteComponentProps } from '../../document/extensions.js';
  let { props, io, presentation }: UiSvelteComponentProps = $props();
  let value = $derived(Array.isArray(props.value) ? [...props.value] as number[] : []);
  const min = $derived(numeric(props.min, 0));
  const max = $derived(numeric(props.max, 100));
  const valid = $derived(value.length > 0 && min < max && numeric(props.step, 1) > 0 && value.every((n, i) => Number.isFinite(n) && n >= min && n <= max && (i === 0 || n >= value[i - 1]!)));
</script>
<div>
  <span class="vict-control-label">{String(props.label ?? '')}</span>
  {#if valid}
    <Slider.Root {...presentation?.target('root')} type="multiple" bind:value {min} {max}
      step={numeric(props.step, 1)} disabled={props.disabled === true}
      orientation={props.orientation === 'vertical' ? 'vertical' : 'horizontal'}
      aria-label={String(props.label ?? 'Range')}
      onValueChange={(next) => io?.emit('valueChange', [...next])}
      onValueCommit={(next) => io?.emit('valueCommit', [...next])}>
      {#snippet children({ thumbs })}
        <Slider.Range />
        {#each thumbs as thumb}<Slider.Thumb index={thumb} aria-label={`${String(props.label ?? 'Value')} ${thumb + 1}`} />{/each}
      {/snippet}
    </Slider.Root>
  {:else}
    <div {...presentation?.target('root')} class={`${presentation?.target('root').class ?? ''} vict-field-error`} role="status">Supply an ordered, nonempty numeric list within the slider bounds and a positive step.</div>
  {/if}
  {@render io?.slots?.help?.()}
</div>
