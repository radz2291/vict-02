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
  }: {
    parts?: GridParts | RangeParts;
    months: { value: DateValue; weeks: DateValue[][] }[];
    weekdays: string[];
  } = $props();
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
              <parts.Cell {date} month={month.value}><parts.Day /></parts.Cell>
            {/each}
          </parts.GridRow>
        {/each}
      </parts.GridBody>
    </parts.Grid>
  {/each}
</div>
