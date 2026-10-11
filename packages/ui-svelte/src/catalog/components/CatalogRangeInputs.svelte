<script lang="ts">
  import { DateField } from '../date-field.js';
  import type { DateValue } from '../../dates.js';
  import type { CatalogDateRange } from './b3-values.js';
  import type { Snippet } from 'svelte';
  let { value, change, label, locale, minValue, maxValue, placeholder, disabled, readonly, required, children }: {
    value: CatalogDateRange;
    change: (range: CatalogDateRange) => void;
    label: string;
    locale: string;
    minValue?: DateValue;
    maxValue?: DateValue;
    placeholder?: DateValue;
    disabled: boolean;
    readonly: boolean;
    required: boolean;
    children?: Snippet;
  } = $props();
</script>

<!-- Each endpoint uses the public scalar field's controlled value channel.
     The pinned composite field's watcher omits end-only external updates.
     Scalar fields retain its incremental segment editing and validation. -->
<div class="vict-control-row">
  <DateField.Root value={value.start} {locale} {minValue} {maxValue} {placeholder} {disabled} {readonly} {required} granularity="day"
    onValueChange={(start) => change({ start, end: value.end })}>
    <DateField.Input aria-label={`${label}, start`}>
      {#snippet children({ segments })}{#each segments as segment}<DateField.Segment part={segment.part}>{segment.value}</DateField.Segment>{/each}{/snippet}
    </DateField.Input>
  </DateField.Root>
  <span>to</span>
  <DateField.Root value={value.end} {locale} {minValue} {maxValue} {placeholder} {disabled} {readonly} {required} granularity="day"
    onValueChange={(end) => change({ start: value.start, end })}>
    <DateField.Input aria-label={`${label}, end`}>
      {#snippet children({ segments })}{#each segments as segment}<DateField.Segment part={segment.part}>{segment.value}</DateField.Segment>{/each}{/snippet}
    </DateField.Input>
  </DateField.Root>
  {@render children?.()}
</div>
