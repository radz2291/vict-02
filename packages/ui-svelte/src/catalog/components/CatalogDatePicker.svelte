<script lang="ts">
  import { DatePicker } from 'bits-ui';
  import CalendarGrid from '../../CalendarGrid.svelte';
  import CatalogPortal from './CatalogPortal.svelte';
  import CatalogPart from './CatalogPart.svelte';
  import { dateValue, dateText, numeric } from './b3-values.js';
  import type { UiSvelteComponentProps } from '../../document/extensions.js';
  let { props, io, presentation }: UiSvelteComponentProps = $props();
  const locale = $derived(String(props.locale ?? 'en-GB'));
  const minValue = $derived(dateValue(props.min));
  const maxValue = $derived(dateValue(props.max));
  const placeholder = $derived(dateValue(props.placeholder));
  const disabled = $derived(props.disabled === true);
  const readonly = $derived(props.readonly === true);
  const label = $derived(String(props.label ?? 'Inspection date'));
  const weekStartsOn = $derived(Math.min(6, Math.max(0, Math.floor(numeric(props.weekStartsOn, 1)))) as 0 | 1 | 2 | 3 | 4 | 5 | 6);
  const numberOfMonths = $derived(Math.max(1, Math.floor(numeric(props.numberOfMonths, 1))));
  let value = $derived(dateValue(props.value));
  let open = $derived(props.open === true);
  let triggerRef = $state<HTMLButtonElement | null>(null);
  let contentRef = $state<HTMLDivElement | null>(null);
</script>
<div {...presentation?.target('root')}>
  <DatePicker.Root bind:value bind:open {locale} {minValue} {maxValue} {placeholder} {disabled} {readonly}
    required={props.required === true} {weekStartsOn} {numberOfMonths}
    onValueChange={(next) => io?.emit('valueChange', dateText(next))} onOpenChange={(next) => io?.emit('openChange', next)}>
    <DatePicker.Label>{label}</DatePicker.Label>
    <div class="vict-control-row">
      <DatePicker.Input>{#snippet children({ segments })}{#each segments as segment}<DatePicker.Segment part={segment.part}>{segment.value}</DatePicker.Segment>{/each}{/snippet}</DatePicker.Input>
      <DatePicker.Trigger class="vict-btn vict-btn--secondary" bind:ref={triggerRef} aria-label={`Choose ${label}`}>
        {#snippet child({ props: attributes })}<CatalogPart as="button" {attributes} bind:ref={triggerRef}>Calendar</CatalogPart>{/snippet}
      </DatePicker.Trigger>
    </div>
    <CatalogPortal {open} {presentation}>
      <DatePicker.Content {...presentation?.target('content')} class={`${presentation?.target('content').class ?? ''} vict-control-panel`} sideOffset={8} collisionPadding={16} bind:ref={contentRef}>
        {#snippet child({ props: attributes, wrapperProps })}
          <div {...wrapperProps}><CatalogPart as="div" {attributes} bind:ref={contentRef}>
            <DatePicker.Calendar>{#snippet children({ months, weekdays })}<CalendarGrid {months} {weekdays} />{/snippet}</DatePicker.Calendar>
            {@render io?.slots?.content?.()}
            <DatePicker.Close class="vict-btn vict-btn--quiet">Close calendar</DatePicker.Close>
          </CatalogPart></div>
        {/snippet}
      </DatePicker.Content>
    </CatalogPortal>
    {@render io?.slots?.help?.()}
  </DatePicker.Root>
</div>
