import type { UiSvelteComponentIO } from '../../document/extensions.js';
import type { DateValue } from '../../dates.js';
import {
  dateValue,
  dateText,
  emitRange,
  rangeIsOrdered,
  type CatalogDateRange,
} from './b3-values.js';

/** One writable range at the public primitive boundary. Function bindings run
 * before the primitive's callbacks, so normalize before publishing/displaying.
 * Compare against the current transition, not last-rendered authored props:
 * Bits emits overlapping value and endpoint callbacks within the same turn. */
export function catalogRangeState(
  getProps: () => Readonly<Record<string, unknown>>,
  getIO: () => UiSvelteComponentIO | undefined,
) {
  const start = $derived(getProps().start);
  const end = $derived(getProps().end);
  let value: CatalogDateRange = $derived({ start: dateValue(start), end: dateValue(end) });

  function set(proposed: CatalogDateRange | undefined, calendar = false): void {
    const previous = value;
    let next = proposed ?? { start: undefined, end: undefined };
    // An end-only window is a preserved field value, not an anchor for a new
    // calendar selection. Restart before accepting a possibly reversed pair.
    if (calendar && !previous.start && previous.end && next.start) {
      next = { start: next.start, end: undefined };
    }
    if (!rangeIsOrdered(next)) return;
    if (
      dateText(previous.start) === dateText(next.start) &&
      dateText(previous.end) === dateText(next.end)
    )
      return;
    value = { ...next };
    const before = { start: dateText(previous.start), end: dateText(previous.end) };
    if (calendar && !previous.start && previous.end && next.start) {
      getIO()?.emit('startChange', dateText(next.start));
      getIO()?.emit('endChange', '');
    } else emitRange(getIO(), before, next);
  }

  function select(date: DateValue): void {
    const props = getProps();
    if (props.disabled === true || props.readonly === true) return;
    const current = value;
    let next: CatalogDateRange;
    if (!current.start || current.end) next = { start: date, end: undefined };
    else if (current.start.compare(date) === 0) next = { start: undefined, end: undefined };
    else {
      next =
        current.start.compare(date) < 0
          ? { start: current.start, end: date }
          : { start: date, end: current.start };
      const days =
        Math.round(
          (next.end!.toDate('UTC').getTime() - next.start!.toDate('UTC').getTime()) / 86400000,
        ) + 1;
      if (
        (typeof props.minDays === 'number' && days < props.minDays) ||
        (typeof props.maxDays === 'number' && props.maxDays > 0 && days > props.maxDays)
      )
        next = { start: date, end: undefined };
    }
    set(next, true);
  }

  return {
    get value() {
      return value;
    },
    set,
    select,
  };
}
