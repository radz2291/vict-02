<script lang="ts">
  import { DateField } from '../date-field.js';
  import { dateValue, dateText } from './b3-values.js';
  import type { UiSvelteComponentProps } from '../../document/extensions.js';
  let { props, io, presentation }: UiSvelteComponentProps = $props();
  const locale = $derived(String(props.locale ?? 'en-GB'));
  const minText = $derived(props.min);
  const minValue = $derived(dateValue(minText));
  const maxText = $derived(props.max);
  const maxValue = $derived(dateValue(maxText));
  const placeholderText = $derived(props.placeholder);
  const placeholder = $derived(dateValue(placeholderText));
  const disabled = $derived(props.disabled === true);
  const readonly = $derived(props.readonly === true);
  const label = $derived(String(props.label ?? 'Inspection date'));
  const valueText = $derived(props.value);
  let value = $derived(dateValue(valueText));
</script>
<div {...presentation?.target('root')}>
<DateField.Root bind:value {locale} {minValue} {maxValue} {placeholder} {disabled} {readonly}
  required={props.required === true} granularity="day" onValueChange={(next) => { const text = dateText(next); if (text !== props.value) io?.emit('valueChange', text); }}>
  <DateField.Label>{label}</DateField.Label>
  <DateField.Input>
    {#snippet children({ segments })}{#each segments as segment}<DateField.Segment part={segment.part}>{segment.value}</DateField.Segment>{/each}{/snippet}
  </DateField.Input>
  {@render io?.slots?.help?.()}
</DateField.Root>
</div>
