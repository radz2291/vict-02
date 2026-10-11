<script lang="ts">
  import { RangeCalendar } from '../range-calendar.js';
  import CalendarGrid from '../../CalendarGrid.svelte';
  import { dateValue, rangeIsOrdered, numeric } from './b3-values.js';
  import { catalogRangeState } from './range-state.svelte.js';
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
  const label = $derived(String(props.label ?? 'Inspection window'));
  const weekStartsOn = $derived(Math.min(6, Math.max(0, Math.floor(numeric(props.weekStartsOn, 1)))) as 0 | 1 | 2 | 3 | 4 | 5 | 6);
  const numberOfMonths = $derived(Math.max(1, Math.floor(numeric(props.numberOfMonths, 1))));
  const range = catalogRangeState(() => props, () => io);
  const invalid = $derived(!rangeIsOrdered(range.value));
</script>
<RangeCalendar.Root {...presentation?.target('root')} bind:value={() => range.value, (next) => range.set(next, true)} {locale} {minValue} {maxValue} {placeholder} {disabled} {readonly} {weekStartsOn} {numberOfMonths}
  minDays={Math.max(1, Math.floor(numeric(props.minDays, 1)))} maxDays={numeric(props.maxDays, 0) > 0 ? Math.floor(numeric(props.maxDays, 0)) : undefined}
  calendarLabel={label} aria-invalid={invalid || undefined}>
  {#snippet children({ months, weekdays })}
    <CalendarGrid parts={RangeCalendar} {months} {weekdays} range={range.value} onSelectDate={range.select} />
  {#if invalid}<span class="vict-field-error" role="status">The end of the inspection window must be on or after its start.</span>{/if}
    {@render io?.slots?.help?.()}
  {/snippet}
</RangeCalendar.Root>
