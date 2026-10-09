<script lang="ts">
  import { Calendar } from '../calendar.js';
  import CalendarGrid from '../../CalendarGrid.svelte';
  import { dateValue, dateText, numeric } from './b3-values.js';
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
  const weekStartsOn = $derived(Math.min(6, Math.max(0, Math.floor(numeric(props.weekStartsOn, 1)))) as 0 | 1 | 2 | 3 | 4 | 5 | 6);
  const numberOfMonths = $derived(Math.max(1, Math.floor(numeric(props.numberOfMonths, 1))));
  const valueText = $derived(props.value);
  let value = $derived(dateValue(valueText));
</script>
<Calendar.Root {...presentation?.target('root')} type="single" bind:value {locale} {minValue} {maxValue} {placeholder} {disabled} {readonly} {weekStartsOn} {numberOfMonths}
  calendarLabel={label} onValueChange={(next) => { const text = dateText(next); if (text !== props.value) io?.emit('valueChange', text); }}>
  {#snippet children({ months, weekdays })}<CalendarGrid {months} {weekdays} />{@render io?.slots?.help?.()}{/snippet}
</Calendar.Root>
