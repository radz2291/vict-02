<script lang="ts">
  import CatalogRangeInputs from './CatalogRangeInputs.svelte';
  import { catalogRangeState } from './range-state.svelte.js';
  import { dateValue, rangeIsOrdered } from './b3-values.js';
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
  const range = catalogRangeState(() => props, () => io);
  const invalid = $derived(!rangeIsOrdered(range.value));
</script>
<div {...presentation?.target('root')} data-date-range-field-root="" aria-invalid={invalid || undefined}>
  <div data-date-range-field-label="">{label}</div>
  <CatalogRangeInputs value={range.value} change={range.set} {label} {locale} {minValue} {maxValue} {placeholder} {disabled} {readonly} required={props.required === true} />
  {#if invalid}<span class="vict-field-error" role="status">The end of the inspection window must be on or after its start.</span>{/if}
  {@render io?.slots?.help?.()}
</div>
