<script lang="ts">
  import { DatePicker } from '../date-picker.js';
  import CalendarGrid from '../../CalendarGrid.svelte';
  import CatalogPortal from './CatalogPortal.svelte';
  import { catalogFocusReturn, catalogPickerOpenFocus } from './focus-return.js';
  import { dateValue, dateText, numeric } from './b3-values.js';
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
  const label = $derived(String(props.label ?? 'Inspection date'));
  const weekStartsOn = $derived(Math.min(6, Math.max(0, Math.floor(numeric(props.weekStartsOn, 1)))) as 0 | 1 | 2 | 3 | 4 | 5 | 6);
  const numberOfMonths = $derived(Math.max(1, Math.floor(numeric(props.numberOfMonths, 1))));
  const valueText = $derived(props.value);
  let value = $derived(dateValue(valueText));
  const authoredOpen = $derived(props.open === true);
  let open = $derived(authoredOpen);
  // The public picker also closes by writing its bindable open value directly.
  // Publish those writes, including calendar selection, to the declared state.
  $effect(() => { if (open !== authoredOpen) io?.emit('openChange', open); });
  let triggerRef = $state<HTMLButtonElement | null>(null);
  let contentRef = $state<HTMLDivElement | null>(null);
  const focusCalendar = catalogPickerOpenFocus(() => contentRef);
  const restoreTrigger = catalogFocusReturn(() => triggerRef);
</script>
<div {...presentation?.target('root')}>
  <DatePicker.Root bind:value bind:open {locale} {minValue} {maxValue} {placeholder} {disabled} {readonly}
    required={props.required === true} {weekStartsOn} {numberOfMonths}
    onValueChange={(next) => { const text = dateText(next); if (text !== props.value) io?.emit('valueChange', text); }} onOpenChange={(next) => io?.emit('openChange', next)}>
    <DatePicker.Label>{label}</DatePicker.Label>
    <div class="vict-control-row">
      <DatePicker.Input>{#snippet children({ segments })}{#each segments as segment}<DatePicker.Segment part={segment.part}>{segment.value}</DatePicker.Segment>{/each}{/snippet}</DatePicker.Input>
      <DatePicker.Trigger class="vict-btn vict-btn--secondary" bind:ref={triggerRef} aria-label={`Open ${label} calendar`}>Calendar</DatePicker.Trigger>
    </div>
    <CatalogPortal {open} {presentation}>
      <DatePicker.Content {...presentation?.target('content')} class={`${presentation?.target('content').class ?? ''} vict-control-panel`} sideOffset={8} collisionPadding={16} bind:ref={contentRef} onOpenAutoFocus={focusCalendar} onCloseAutoFocus={restoreTrigger}>
            <DatePicker.Calendar>{#snippet children({ months, weekdays })}<CalendarGrid {months} {weekdays} />{/snippet}</DatePicker.Calendar>
            {@render io?.slots?.content?.()}
            <DatePicker.Close class="vict-btn vict-btn--quiet">Close calendar</DatePicker.Close>
      </DatePicker.Content>
    </CatalogPortal>
    {@render io?.slots?.help?.()}
  </DatePicker.Root>
</div>
