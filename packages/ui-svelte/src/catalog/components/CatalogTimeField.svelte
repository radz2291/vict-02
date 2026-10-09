<script lang="ts">
  import { TimeField } from '../time-field.js';
  import { timeValue } from './b3-values.js';
  import type { UiSvelteComponentProps } from '../../document/extensions.js';
  let { props, io, presentation }: UiSvelteComponentProps = $props();
  const valueText = $derived(props.value);
  let value = $derived(timeValue(valueText));
  const minText = $derived(props.min);
  const minValue = $derived(timeValue(minText));
  const maxText = $derived(props.max);
  const maxValue = $derived(timeValue(maxText));
  const placeholderText = $derived(props.placeholder);
  const placeholder = $derived(timeValue(placeholderText));
  const hourCycle = $derived(props.hourCycle === 12 ? 12 : 24);
  const locale = $derived(new Intl.Locale(String(props.locale ?? 'en-GB'), { hourCycle: hourCycle === 12 ? 'h12' : 'h23' }).toString());
  const granularity = $derived(props.granularity === 'second' ? 'second' : props.granularity === 'hour' ? 'hour' : 'minute');
</script>
<div {...presentation?.target('root')}>
<TimeField.Root bind:value
  {locale} {hourCycle} {granularity}
  {minValue} {maxValue} {placeholder}
  disabled={props.disabled === true} readonly={props.readonly === true} required={props.required === true}
  onValueChange={(next) => { const text = next ? (granularity === 'second' ? next.toString() : next.toString().slice(0, 5)) : ''; if (text !== props.value) io?.emit('valueChange', text); }}>
  <TimeField.Label>{String(props.label ?? 'Inspection time')}</TimeField.Label>
  <TimeField.Input>
    {#snippet children({ segments })}
      {#each segments as segment}
        {#if segment.part === 'hour'}
          <TimeField.Segment part={segment.part}>
            {#snippet child({ props: attributes })}
              <!-- Keep the public attachment and handlers while announcing
                   the displayed hour in the configured 12/24-hour range. -->
              <span {...attributes}
                aria-valuenow={hourCycle === 12 ? (Number(attributes['aria-valuenow']) % 12 || 12) : Number(attributes['aria-valuenow'])}
                aria-valuetext={attributes['aria-valuetext'] === 'Empty' ? 'Empty' : hourCycle === 24 ? segment.value : `${segment.value} ${value && value.hour >= 12 ? 'PM' : 'AM'}`}>{segment.value}</span>
            {/snippet}
          </TimeField.Segment>
        {:else}
          <TimeField.Segment part={segment.part}>{segment.value}</TimeField.Segment>
        {/if}
      {/each}
    {/snippet}
  </TimeField.Input>
  {@render io?.slots?.help?.()}
</TimeField.Root>
</div>
