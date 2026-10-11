<script lang="ts">
  import { DateRangePicker } from '../date-range-picker.js';
  import { RangeCalendar } from '../range-calendar.js';
  import CalendarGrid from '../../CalendarGrid.svelte';
  import CatalogPortal from './CatalogPortal.svelte';
  import { catalogFocusReturn, catalogPickerOpenFocus } from './focus-return.js';
  import { dateValue, rangeIsOrdered, numeric } from './b3-values.js';
  import { catalogRangeState } from './range-state.svelte.js';
  import CatalogRangeInputs from './CatalogRangeInputs.svelte';
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
  const authoredOpen = $derived(props.open === true);
  let open = $derived(authoredOpen);
  $effect(() => { if (open !== authoredOpen) io?.emit('openChange', open); });
  let triggerRef = $state<HTMLButtonElement | null>(null);
  let contentRef = $state<HTMLDivElement | null>(null);
  const focusCalendar = catalogPickerOpenFocus(() => contentRef);
  const restoreTrigger = catalogFocusReturn(() => triggerRef);
</script>
<div {...presentation?.target('root')} aria-invalid={invalid || undefined}>
  <DateRangePicker.Root bind:value={() => range.value, (next) => range.set(next, true)} bind:open {locale} {minValue} {maxValue} {placeholder} {disabled} {readonly} {weekStartsOn} {numberOfMonths}
    required={props.required === true} granularity="day"
    validate={(range) => rangeIsOrdered(range) ? undefined : 'End must not precede start.'}
    onOpenChange={(next) => io?.emit('openChange', next)}>
    <DateRangePicker.Label>{label}</DateRangePicker.Label>
    <CatalogRangeInputs value={range.value} change={range.set} {label} {locale} {minValue} {maxValue} {placeholder} {disabled} {readonly} required={props.required === true}>
      <DateRangePicker.Trigger class="vict-btn vict-btn--secondary" bind:ref={triggerRef} aria-label={`Open ${label} calendar`}>Calendar</DateRangePicker.Trigger>
    </CatalogRangeInputs>
    <CatalogPortal {open} {presentation}>
      <DateRangePicker.Content {...presentation?.target('content')} class={`${presentation?.target('content').class ?? ''} vict-control-panel`} sideOffset={8} collisionPadding={16} bind:ref={contentRef} onOpenAutoFocus={focusCalendar} onCloseAutoFocus={restoreTrigger}>
            <DateRangePicker.Calendar>{#snippet children({ months, weekdays })}<CalendarGrid parts={RangeCalendar} {months} {weekdays} range={range.value} onSelectDate={(date) => { range.select(date); if (range.value.start && range.value.end) open = false; }} />{/snippet}</DateRangePicker.Calendar>
            {@render io?.slots?.content?.()}
            <DateRangePicker.Close class="vict-btn vict-btn--quiet">Close calendar</DateRangePicker.Close>
      </DateRangePicker.Content>
    </CatalogPortal>
  {#if invalid}<span class="vict-field-error" role="status">The end of the inspection window must be on or after its start.</span>{/if}
    {@render io?.slots?.help?.()}
  </DateRangePicker.Root>
</div>
