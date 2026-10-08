<script lang="ts">
  import { DateRangePicker, RangeCalendar } from 'bits-ui';
  import CalendarGrid from '../../CalendarGrid.svelte';
  import CatalogPortal from './CatalogPortal.svelte';
  import CatalogPart from './CatalogPart.svelte';
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
  let open = $derived(props.open === true);
  let triggerRef = $state<HTMLButtonElement | null>(null);
  let contentRef = $state<HTMLDivElement | null>(null);
</script>
<div {...presentation?.target('root')} aria-invalid={invalid || undefined}>
  <DateRangePicker.Root bind:value bind:open {locale} {minValue} {maxValue} {placeholder} {disabled} {readonly} {weekStartsOn} {numberOfMonths}
    required={props.required === true} granularity="day"
    validate={(range) => rangeIsOrdered(range) ? undefined : 'End must not precede start.'}
    onValueChange={change} onStartValueChange={changeStart} onEndValueChange={changeEnd}
    onOpenChange={(next) => io?.emit('openChange', next)}>
    <DateRangePicker.Label>{label}</DateRangePicker.Label>
    <div class="vict-control-row">
      <DateRangePicker.Input type="start">{#snippet children({ segments })}{#each segments as segment}<DateRangePicker.Segment part={segment.part}>{segment.value}</DateRangePicker.Segment>{/each}{/snippet}</DateRangePicker.Input><span>to</span><DateRangePicker.Input type="end">{#snippet children({ segments })}{#each segments as segment}<DateRangePicker.Segment part={segment.part}>{segment.value}</DateRangePicker.Segment>{/each}{/snippet}</DateRangePicker.Input>
      <DateRangePicker.Trigger class="vict-btn vict-btn--secondary" bind:ref={triggerRef} aria-label={`Choose ${label}`}>
        {#snippet child({ props: attributes })}<CatalogPart as="button" {attributes} bind:ref={triggerRef}>Calendar</CatalogPart>{/snippet}
      </DateRangePicker.Trigger>
    </div>
    <CatalogPortal {open} {presentation}>
      <DateRangePicker.Content {...presentation?.target('content')} class={`${presentation?.target('content').class ?? ''} vict-control-panel`} sideOffset={8} collisionPadding={16} bind:ref={contentRef}>
        {#snippet child({ props: attributes, wrapperProps })}
          <div {...wrapperProps}><CatalogPart as="div" {attributes} bind:ref={contentRef}>
            <DateRangePicker.Calendar>{#snippet children({ months, weekdays })}<CalendarGrid parts={RangeCalendar} {months} {weekdays} />{/snippet}</DateRangePicker.Calendar>
            {@render io?.slots?.content?.()}
            <DateRangePicker.Close class="vict-btn vict-btn--quiet">Close calendar</DateRangePicker.Close>
          </CatalogPart></div>
        {/snippet}
      </DateRangePicker.Content>
    </CatalogPortal>
  {#if invalid}<span class="vict-field-error" role="status">The end of the inspection window must be on or after its start.</span>{/if}
    {@render io?.slots?.help?.()}
  </DateRangePicker.Root>
</div>
