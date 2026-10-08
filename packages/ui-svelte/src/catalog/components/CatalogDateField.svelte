<script lang="ts">
  import { DateField } from 'bits-ui';
  import { dateValue, dateText } from './b3-values.js';
  import type { UiSvelteComponentProps } from '../../document/extensions.js';
  let { props, io, presentation }: UiSvelteComponentProps = $props();
  const locale = $derived(String(props.locale ?? 'en-GB'));
  const minValue = $derived(dateValue(props.min));
  const maxValue = $derived(dateValue(props.max));
  const placeholder = $derived(dateValue(props.placeholder));
  const disabled = $derived(props.disabled === true);
  const readonly = $derived(props.readonly === true);
  const label = $derived(String(props.label ?? 'Inspection date'));
  let value = $derived(dateValue(props.value));
</script>
<DateField.Root {...presentation?.target('root')} bind:value {locale} {minValue} {maxValue} {placeholder} {disabled} {readonly}
  required={props.required === true} granularity="day" onValueChange={(next) => io?.emit('valueChange', dateText(next))}>
  <DateField.Label>{label}</DateField.Label>
  <DateField.Input>
    {#snippet children({ segments })}{#each segments as segment}<DateField.Segment part={segment.part}>{segment.value}</DateField.Segment>{/each}{/snippet}
  </DateField.Input>
  {@render io?.slots?.help?.()}
</DateField.Root>
