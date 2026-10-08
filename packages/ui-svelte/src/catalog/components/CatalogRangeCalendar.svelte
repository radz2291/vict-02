<script lang="ts">
  import { RangeCalendar } from '../range-calendar.js';
  import CalendarGrid from '../../CalendarGrid.svelte';
  import { dateValue, rangeIsOrdered, emitRange, type CatalogDateRange, numeric } from './b3-values.js';
  import type { DateValue } from '../../dates.js';
  import type { UiSvelteComponentProps } from '../../document/extensions.js';
  let { props, io, presentation }: UiSvelteComponentProps = $props();
  const locale = $derived(String(props.locale ?? 'en-GB'));
  const minValue = $derived(dateValue(props.min));
  const maxValue = $derived(dateValue(props.max));
  const placeholder = $derived(dateValue(props.placeholder));
  const disabled = $derived(props.disabled === true);
  const readonly = $derived(props.readonly === true);
  const label = $derived(String(props.label ?? 'Inspection window'));
  const weekStartsOn = $derived(Math.min(6, Math.max(0, Math.floor(numeric(props.weekStartsOn, 1)))) as 0 | 1 | 2 | 3 | 4 | 5 | 6);
  const numberOfMonths = $derived(Math.max(1, Math.floor(numeric(props.numberOfMonths, 1))));
  let value = $derived({ start: dateValue(props.start), end: dateValue(props.end) });
  const invalid = $derived(!rangeIsOrdered(value));
  function change(next: CatalogDateRange | undefined) {
    const range = next ?? { start: undefined, end: undefined };
    value = range;
    emitRange(io, props, range);
  }
  function changeStart(start: DateValue | undefined) { change({ start, end: value.end }); }
  function changeEnd(end: DateValue | undefined) { change({ start: value.start, end }); }
</script>
<RangeCalendar.Root {...presentation?.target('root')} bind:value {locale} {minValue} {maxValue} {placeholder} {disabled} {readonly} {weekStartsOn} {numberOfMonths}
  minDays={Math.max(1, Math.floor(numeric(props.minDays, 1)))} maxDays={numeric(props.maxDays, 0) > 0 ? Math.floor(numeric(props.maxDays, 0)) : undefined}
  calendarLabel={label} aria-invalid={invalid || undefined}
  onValueChange={change} onStartValueChange={changeStart} onEndValueChange={changeEnd}>
  {#snippet children({ months, weekdays })}
    <CalendarGrid parts={RangeCalendar} {months} {weekdays} />
  {#if invalid}<span class="vict-field-error" role="status">The end of the inspection window must be on or after its start.</span>{/if}
    {@render io?.slots?.help?.()}
  {/snippet}
</RangeCalendar.Root>
