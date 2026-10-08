<script lang="ts">
  import { DateRangeField } from '../date-range-field.js';
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
<DateRangeField.Root {...presentation?.target('root')} bind:value {locale} {minValue} {maxValue} {placeholder} {disabled} {readonly}
  required={props.required === true} granularity="day" aria-invalid={invalid || undefined}
  validate={(range) => rangeIsOrdered(range) ? undefined : 'End must not precede start.'}
  onValueChange={change} onStartValueChange={changeStart} onEndValueChange={changeEnd}>
  <DateRangeField.Label>{label}</DateRangeField.Label>
  <div class="vict-control-row">
    <DateRangeField.Input type="start">{#snippet children({ segments })}{#each segments as segment}<DateRangeField.Segment part={segment.part}>{segment.value}</DateRangeField.Segment>{/each}{/snippet}</DateRangeField.Input><span>to</span><DateRangeField.Input type="end">{#snippet children({ segments })}{#each segments as segment}<DateRangeField.Segment part={segment.part}>{segment.value}</DateRangeField.Segment>{/each}{/snippet}</DateRangeField.Input>
  </div>
  {#if invalid}<span class="vict-field-error" role="status">The end of the inspection window must be on or after its start.</span>{/if}
  {@render io?.slots?.help?.()}
</DateRangeField.Root>
