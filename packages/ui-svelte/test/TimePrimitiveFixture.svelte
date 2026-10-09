<script lang="ts">
  /** Round-3 probe fixture: the PUBLIC TimeField primitive with configurable
   * locale/hourCycle — reproduces disclosed defect B at the primitive level. */
  import { TimeField } from '../src/catalog/time-field.js';
  import { parseTime, type Time } from '../src/dates.js';

  let { locale = 'en-GB', hourCycle = 12, value = '13:30', granularity = 'minute' }: { locale?: string; hourCycle?: 12 | 24; value?: string; granularity?: 'hour' | 'minute' | 'second' } = $props();
  let time: Time | undefined = $state(parseTime(value));
</script>

<TimeField.Root bind:value={time} {locale} {hourCycle} {granularity}>
  <TimeField.Label>Probe time</TimeField.Label>
  <TimeField.Input>
    {#snippet children({ segments })}
      {#each segments as segment}
        <TimeField.Segment part={segment.part}>{segment.value}</TimeField.Segment>
      {/each}
    {/snippet}
  </TimeField.Input>
</TimeField.Root>
