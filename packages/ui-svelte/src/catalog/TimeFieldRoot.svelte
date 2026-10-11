<script lang="ts" generics="T extends TimeValue = Time">
  import { TimeField, getBitsConfig } from 'bits-ui';
  import { setContext } from 'svelte';
  import type { Time } from '@internationalized/date';
  import { timeFieldContext, type TimeValue, type TimeFieldContext } from './time-field-context.js';
  let { value = $bindable(), placeholder = $bindable(), hourCycle, locale, onValueChange, ...rest }: TimeField.RootProps<T> = $props();
  const config = getBitsConfig();
  const requestedLocale = $derived(locale ?? config.defaultLocale.current ?? 'en');
  const cycle = $derived(hourCycle ?? (new Intl.DateTimeFormat(requestedLocale, { hour: 'numeric' }).resolvedOptions().hour12 ? 12 : 24));
  // Bits 2.19.3 leaves hour12 unspecified for 12h segment construction.
  // Carry the explicit cycle in the requested locale, preserving its language,
  // region, numbering system and field order instead of substituting en-US.
  const fieldLocale = $derived(new Intl.Locale(requestedLocale, { hourCycle: cycle === 12 ? 'h12' : 'h23' }).toString());
  setContext<TimeFieldContext>(timeFieldContext, {
    value: () => value,
    cycle: () => cycle,
    editable: (part) => !rest.disabled && !rest.readonly && !rest.readonlySegments?.includes(part as 'hour' | 'dayPeriod'),
    change(next) { value = next as T | undefined; onValueChange?.(value); },
  });
</script>

<TimeField.Root {...rest} bind:value bind:placeholder locale={fieldLocale} hourCycle={cycle} {onValueChange} />
