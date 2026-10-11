<script lang="ts">
  import { Calendar, RangeCalendar } from 'bits-ui';
  import type { DateValue } from '@internationalized/date';
  type GridParts = Pick<
    typeof Calendar,
    | 'Header'
    | 'PrevButton'
    | 'Heading'
    | 'NextButton'
    | 'Grid'
    | 'GridHead'
    | 'GridRow'
    | 'HeadCell'
    | 'GridBody'
    | 'Cell'
    | 'Day'
  >;
  type RangeParts = Pick<typeof RangeCalendar, keyof GridParts>;
  let {
    parts = Calendar,
    months,
    weekdays,
    range,
    onSelectDate,
  }: {
    parts?: GridParts | RangeParts;
    months: { value: DateValue; weeks: DateValue[][] }[];
    weekdays: string[];
    /** A controlled authored range uses one selection channel. Bits still owns
     * date availability, month navigation, roving focus and DOM attachments. */
    range?: { start: DateValue | undefined; end: DateValue | undefined };
    onSelectDate?: (date: DateValue) => void;
  } = $props();
  let hovered = $state<DateValue | undefined>();
  function selection(attributes: Record<string, unknown>, date: DateValue): Record<string, unknown> {
    if (!range) return attributes;
    const start = range.start?.compare(date) === 0;
    const end = range.end?.compare(date) === 0;
    const middle = !!range.start && !!range.end && range.start.compare(date) < 0 && range.end.compare(date) > 0;
    const selected = start || end || middle;
    const highlighted = !!range.start && !range.end && !!hovered &&
      (range.start.compare(date) <= 0 && hovered.compare(date) >= 0 || hovered.compare(date) <= 0 && range.start.compare(date) >= 0);
    return { ...attributes, 'aria-selected': attributes.role === 'gridcell' ? String(selected) : undefined,
      'data-selected': selected ? '' : undefined, 'data-selection-start': start ? '' : undefined,
      'data-selection-end': end ? '' : undefined, 'data-range-start': start ? '' : undefined,
      'data-range-end': end || start && !range.end ? '' : undefined, 'data-range-middle': middle ? '' : undefined,
      'data-highlighted': highlighted ? '' : undefined };
  }
  function activate(event: MouseEvent | KeyboardEvent, date: DateValue, attributes: Record<string, unknown>): void {
    if (event instanceof KeyboardEvent && event.key !== 'Enter' && event.key !== ' ') {
      (attributes.onkeydown as ((event: KeyboardEvent) => void) | undefined)?.(event);
      return;
    }
    event.preventDefault(); event.stopPropagation();
    if (attributes['aria-disabled'] !== 'true' && attributes['data-disabled'] === undefined && attributes['data-unavailable'] === undefined) onSelectDate?.(date);
  }
</script>

<parts.Header>
  <parts.PrevButton aria-label="Previous month">‹</parts.PrevButton>
  <parts.Heading />
  <parts.NextButton aria-label="Next month">›</parts.NextButton>
</parts.Header>
<div class="vict-calendar-months">
  {#each months as month (month.value.toString())}
    <parts.Grid>
      <parts.GridHead
        ><parts.GridRow>
          {#each weekdays as day, index (index)}<parts.HeadCell>{day}</parts.HeadCell>{/each}
        </parts.GridRow></parts.GridHead
      >
      <parts.GridBody>
        {#each month.weeks as week, index (index)}
          <parts.GridRow>
            {#each week as date (date.toString())}
              {#if onSelectDate && range}
                <parts.Cell {date} month={month.value}>
                  {#snippet child({ props: attributes })}
                    <td {...selection(attributes, date)}>
                      <parts.Day>
                        {#snippet child({ props: dayAttributes })}
                          <div {...selection(dayAttributes, date)}
                            onclick={(event) => activate(event, date, dayAttributes)}
                            onkeydown={(event) => activate(event, date, dayAttributes)}
                            onmouseenter={(event) => { hovered = date; (dayAttributes.onmouseenter as ((event: MouseEvent) => void) | undefined)?.(event); }}>{date.day}</div>
                        {/snippet}
                      </parts.Day>
                    </td>
                  {/snippet}
                </parts.Cell>
              {:else}<parts.Cell {date} month={month.value}><parts.Day /></parts.Cell>{/if}
            {/each}
          </parts.GridRow>
        {/each}
      </parts.GridBody>
    </parts.Grid>
  {/each}
</div>
{#if range}<span class="range-announcement" aria-live="polite">{range.start?.toString() ?? 'No start'} to {range.end?.toString() ?? 'No end'}</span>{/if}

<style>
  .range-announcement { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
</style>
