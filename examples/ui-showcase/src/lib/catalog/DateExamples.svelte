<script lang="ts">
  import { Calendar } from '@victframework/ui-svelte/catalog/calendar';
  import { DateField } from '@victframework/ui-svelte/catalog/date-field';
  import { DatePicker } from '@victframework/ui-svelte/catalog/date-picker';
  import { DateRangeField } from '@victframework/ui-svelte/catalog/date-range-field';
  import { DateRangePicker } from '@victframework/ui-svelte/catalog/date-range-picker';
  import { RangeCalendar } from '@victframework/ui-svelte/catalog/range-calendar';
  import { TimeField } from '@victframework/ui-svelte/catalog/time-field';
  import { CalendarGrid, Portal } from '@victframework/ui-svelte/controls';
  import { parseDate, Time, type DateValue } from '@victframework/ui-svelte/dates';
  import Example from './Example.svelte';
  const first = parseDate('2026-10-01');
  let date = $state<DateValue | undefined>(parseDate('2026-10-08'));
  let range = $state<{ start: DateValue | undefined; end: DateValue | undefined }>({
    start: parseDate('2026-10-08'),
    end: parseDate('2026-10-12'),
  });
  let locale = $state('en-GB');
  let constrainedDate = $state<DateValue | undefined>(first);
  let dateError = $derived(!constrainedDate || constrainedDate.compare(first.add({ days: 1 })) < 0);
</script>

<div class="vict-control-row catalog-wide">
  <label for="date-locale">Date language</label><select
    id="date-locale"
    class="vict-select"
    bind:value={locale}
    ><option value="en-GB">English (UK)</option><option value="fr-FR">Français</option><option
      value="ms-MY">Bahasa Melayu</option
    ></select
  >
</div>
<Example family="calendar" title="Calendar">
  <Calendar.Root
    type="single"
    bind:value={date}
    {locale}
    placeholder={first}
    minValue={first}
    isDateDisabled={(day) => day.day === 15}
    calendarLabel="Review date"
    weekStartsOn={1}
  >
    {#snippet children({ months, weekdays })}<CalendarGrid {months} {weekdays} />{/snippet}
  </Calendar.Root>
  <p class="vict-control-help">
    Dates before October and 15 October are unavailable. Selected: {date?.toString() ?? 'None'}.
  </p>
</Example>
<Example family="date-field" title="Date field">
  <DateField.Root bind:value={date} {locale} placeholder={first}
    ><DateField.Label>Review date</DateField.Label><DateField.Input
      >{#snippet children({ segments })}{#each segments as segment}<DateField.Segment
            part={segment.part}>{segment.value}</DateField.Segment
          >{/each}{/snippet}</DateField.Input
    ></DateField.Root
  >
  <DateField.Root
    bind:value={constrainedDate}
    minValue={first.add({ days: 1 })}
    {locale}
    errorMessageId={dateError ? 'catalog-date-error' : undefined}
    ><DateField.Label>Earliest permitted review</DateField.Label><DateField.Input
      aria-describedby={dateError ? 'catalog-date-error' : undefined}
      >{#snippet children({ segments })}{#each segments as segment}<DateField.Segment
            part={segment.part}
            aria-describedby={dateError ? 'catalog-date-error' : undefined}
            >{segment.value}</DateField.Segment
          >{/each}{/snippet}</DateField.Input
    ></DateField.Root
  >
  {#if dateError}<span class="vict-field-error" id="catalog-date-error"
      >Choose 2 October 2026 or later.</span
    >{/if}
  <DateField.Root value={first} disabled {locale}
    ><DateField.Label>Contract date · locked</DateField.Label><DateField.Input
      >{#snippet children({ segments })}{#each segments as segment}<DateField.Segment
            part={segment.part}>{segment.value}</DateField.Segment
          >{/each}{/snippet}</DateField.Input
    ></DateField.Root
  >
</Example>
<Example family="date-picker" title="Date picker">
  <DatePicker.Root bind:value={date} {locale} placeholder={first}>
    <DatePicker.Label>Scheduled review</DatePicker.Label>
    <div class="vict-control-row">
      <DatePicker.Input
        >{#snippet children({ segments })}{#each segments as segment}<DatePicker.Segment
              part={segment.part}>{segment.value}</DatePicker.Segment
            >{/each}{/snippet}</DatePicker.Input
      ><DatePicker.Trigger
        class="vict-btn vict-btn--secondary"
        aria-label="Choose scheduled review date">Calendar</DatePicker.Trigger
      >
    </div>
    <DatePicker.Portal
      ><DatePicker.Content sideOffset={8} collisionPadding={16} class="vict-control-panel"
        ><DatePicker.Calendar>
          {#snippet children({ months, weekdays })}<CalendarGrid {months} {weekdays} />{/snippet}
        </DatePicker.Calendar><DatePicker.Close class="vict-btn vict-btn--quiet"
          >Close calendar</DatePicker.Close
        ></DatePicker.Content
      ></DatePicker.Portal
    >
  </DatePicker.Root>
</Example>
<Example family="date-range-field" title="Date range field">
  <DateRangeField.Root bind:value={range} {locale} placeholder={first}>
    <DateRangeField.Label>Delivery window</DateRangeField.Label>
    <div class="vict-control-row">
      <DateRangeField.Input type="start"
        >{#snippet children({ segments })}{#each segments as segment}<DateRangeField.Segment
              part={segment.part}>{segment.value}</DateRangeField.Segment
            >{/each}{/snippet}</DateRangeField.Input
      >
      <span>to</span>
      <DateRangeField.Input type="end"
        >{#snippet children({ segments })}{#each segments as segment}<DateRangeField.Segment
              part={segment.part}>{segment.value}</DateRangeField.Segment
            >{/each}{/snippet}</DateRangeField.Input
      >
    </div>
  </DateRangeField.Root>
</Example>
<Example family="date-range-picker" title="Date range picker">
  <DateRangePicker.Root bind:value={range} {locale} placeholder={first}>
    <DateRangePicker.Label>Booking window</DateRangePicker.Label>
    <div class="vict-control-row">
      <DateRangePicker.Input type="start"
        >{#snippet children({ segments })}{#each segments as segment}<DateRangePicker.Segment
              part={segment.part}>{segment.value}</DateRangePicker.Segment
            >{/each}{/snippet}</DateRangePicker.Input
      >
      <span>to</span><DateRangePicker.Input type="end"
        >{#snippet children({ segments })}{#each segments as segment}<DateRangePicker.Segment
              part={segment.part}>{segment.value}</DateRangePicker.Segment
            >{/each}{/snippet}</DateRangePicker.Input
      >
      <DateRangePicker.Trigger
        class="vict-btn vict-btn--secondary"
        aria-label="Choose booking window">Calendar</DateRangePicker.Trigger
      >
    </div>
    <Portal
      ><DateRangePicker.Content sideOffset={8} collisionPadding={16} class="vict-control-panel"
        ><DateRangePicker.Calendar>
          {#snippet children({ months, weekdays })}<CalendarGrid
              parts={RangeCalendar}
              {months}
              {weekdays}
            />{/snippet}
        </DateRangePicker.Calendar><DateRangePicker.Close class="vict-btn vict-btn--quiet"
          >Close calendar</DateRangePicker.Close
        ></DateRangePicker.Content
      ></Portal
    >
  </DateRangePicker.Root>
</Example>
<Example family="range-calendar" title="Range calendar">
  <RangeCalendar.Root
    bind:value={range}
    {locale}
    placeholder={first}
    calendarLabel="Delivery window"
    weekStartsOn={1}
  >
    {#snippet children({ months, weekdays })}<CalendarGrid
        parts={RangeCalendar}
        {months}
        {weekdays}
      />{/snippet}
  </RangeCalendar.Root>
  <span class="vict-control-help"
    >{range.start?.toString() ?? 'Start'} → {range.end?.toString() ?? 'End'}</span
  >
</Example>
<Example family="time-field" title="Time field">
  <TimeField.Root
    value={new Time(9, 30)}
    {locale}
    hourCycle={24}
    minValue={new Time(9)}
    maxValue={new Time(17)}
  >
    <TimeField.Label>Meeting time · Kuala Lumpur</TimeField.Label><TimeField.Input
      >{#snippet children({ segments })}{#each segments as segment}<TimeField.Segment
            part={segment.part}>{segment.value}</TimeField.Segment
          >{/each}{/snippet}</TimeField.Input
    >
  </TimeField.Root>
  <p class="vict-control-help">
    09:00–17:00 local wall time. This flow stores time separately; it does not infer a timezone or
    convert to UTC.
  </p>
</Example>
