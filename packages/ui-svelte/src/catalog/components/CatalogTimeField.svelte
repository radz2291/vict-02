<script lang="ts">
  import { TimeField } from 'bits-ui';
  import { timeValue } from './b3-values.js';
  import type { UiSvelteComponentProps } from '../../document/extensions.js';
  let { props, io, presentation }: UiSvelteComponentProps = $props();
  let value = $derived(timeValue(props.value));
  const granularity = $derived(props.granularity === 'second' ? 'second' : props.granularity === 'hour' ? 'hour' : 'minute');
</script>
<TimeField.Root {...presentation?.target('root')} bind:value
  locale={String(props.locale ?? 'en-GB')} hourCycle={props.hourCycle === 12 ? 12 : 24} {granularity}
  minValue={timeValue(props.min)} maxValue={timeValue(props.max)} placeholder={timeValue(props.placeholder)}
  disabled={props.disabled === true} readonly={props.readonly === true} required={props.required === true}
  onValueChange={(next) => io?.emit('valueChange', next ? (granularity === 'second' ? next.toString() : next.toString().slice(0, 5)) : '')}>
  <TimeField.Label>{String(props.label ?? 'Inspection time')}</TimeField.Label>
  <TimeField.Input>{#snippet children({ segments })}{#each segments as segment}<TimeField.Segment part={segment.part}>{segment.value}</TimeField.Segment>{/each}{/snippet}</TimeField.Input>
  {@render io?.slots?.help?.()}
</TimeField.Root>
