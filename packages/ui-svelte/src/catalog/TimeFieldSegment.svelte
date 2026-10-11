<script lang="ts">
  import { TimeField } from 'bits-ui';
  import { getContext, tick } from 'svelte';
  import { timeFieldContext, type TimeFieldContext } from './time-field-context.js';
  let { part, ref = $bindable(null), children, child, ...rest }: TimeField.SegmentProps = $props();
  const field = getContext<TimeFieldContext>(timeFieldContext);
  let typedHour: string | undefined;

  function text(attributes: Record<string, unknown>): string | undefined {
    if (field.cycle() !== 12) return undefined;
    if (part === 'dayPeriod') return (field.value()?.hour ?? 0) >= 12 ? 'PM' : 'AM';
    if (part === 'hour' && attributes['aria-valuetext'] !== 'Empty') {
      return String(Number(attributes['aria-valuenow']) % 12 || 12).padStart(2, '0');
    }
    return undefined;
  }
  function decorate(attributes: Record<string, unknown>): Record<string, unknown> {
    const display = text(attributes);
    if (display === undefined) return attributes;
    const period = (field.value()?.hour ?? 0) >= 12 ? 'PM' : 'AM';
    return { ...attributes,
      'aria-valuemin': part === 'dayPeriod' ? 0 : attributes['aria-valuemin'],
      'aria-valuemax': part === 'dayPeriod' ? 1 : attributes['aria-valuemax'],
      'aria-valuenow': part === 'hour' ? Number(display) : period === 'PM' ? 1 : 0,
      'aria-valuetext': part === 'hour' ? `${display} ${period}` : period,
      onkeydown: (event: KeyboardEvent) => keydown(event, attributes.onkeydown),
      onbeforeinput: (event: InputEvent) => {
        if (part === 'dayPeriod' && /^[ap]$/i.test(event.data ?? '') && field.editable(part)) {
          event.preventDefault(); setPeriod(event.data!.toUpperCase() === 'P');
        } else (attributes.onbeforeinput as ((event: InputEvent) => void) | undefined)?.(event);
      },
      onfocusout: (event: FocusEvent) => {
        typedHour = undefined;
        (attributes.onfocusout as ((event: FocusEvent) => void) | undefined)?.(event);
      },
    };
  }
  function setPeriod(pm: boolean): void {
    const current = field.value();
    if (current) field.change(current.set({ hour: current.hour % 12 + (pm ? 12 : 0) }));
  }
  function keydown(event: KeyboardEvent, fallback: unknown): void {
    const current = field.value();
    if (!event.ctrlKey && !event.metaKey && !event.altKey && field.editable(part) && current) {
      if (part === 'dayPeriod' && ['ArrowUp', 'ArrowDown', 'a', 'A', 'p', 'P', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const pm = event.key === 'p' || event.key === 'P' || event.key === 'End' ? true
          : event.key === 'a' || event.key === 'A' || event.key === 'Home' ? false : current.hour < 12;
        setPeriod(pm); return;
      }
      // The pinned primitive derives its typed-hour PM hint by comparing a
      // localized period to the English literal "PM". Own that conversion at
      // this public segment boundary; other editing/navigation remains Bits'.
      if (part === 'hour' && /^[0-9]$/.test(event.key)) {
        event.preventDefault();
        const combined = (typedHour ?? '') + event.key;
        typedHour = Number(combined) <= 12 ? combined : event.key;
        const hour = Number(typedHour);
        field.change(current.set({ hour: hour % 12 + (current.hour >= 12 ? 12 : 0) }));
        if (typedHour.length === 2 || hour > 1) {
          typedHour = undefined;
          const target = event.currentTarget as HTMLElement;
          // Let the controlled value reach Bits' segment state before blur:
          // its focusout padding otherwise commits the previous hour again.
          void tick().then(() => {
            if (!target.isConnected || target.ownerDocument.activeElement !== target) return;
            const segments = [...(target.parentElement?.querySelectorAll<HTMLElement>('[role="spinbutton"]') ?? [])];
            segments[segments.indexOf(target) + 1]?.focus();
          });
        }
        return;
      }
    }
    (fallback as ((event: KeyboardEvent) => void) | undefined)?.(event);
  }
</script>

<TimeField.Segment {...rest} {part} bind:ref>
  {#snippet child({ props: attributes })}
    {@const corrected = decorate(attributes)}
    {#if child}{@render child({ props: corrected })}
    {:else}<span {...corrected}>{#if text(attributes) !== undefined}{text(attributes)}{:else}{@render children?.()}{/if}</span>{/if}
  {/snippet}
</TimeField.Segment>
