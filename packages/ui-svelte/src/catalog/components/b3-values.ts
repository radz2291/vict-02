/** Library objects stay at the catalog boundary; authored values remain scalars. */
import { parseDate, parseTime, type DateValue, type Time } from '../../dates.js';
import type { UiSvelteComponentIO } from '../../document/extensions.js';

export function dateValue(value: unknown): DateValue | undefined {
  if (typeof value !== 'string' || value === '') return undefined;
  try { return parseDate(value); } catch { return undefined; }
}
export function timeValue(value: unknown): Time | undefined {
  if (typeof value !== 'string' || value === '') return undefined;
  try { return parseTime(value); } catch { return undefined; }
}
export function numeric(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
export function dateText(value: DateValue | undefined): string {
  return value?.toString() ?? '';
}
export type CatalogDateRange = { start: DateValue | undefined; end: DateValue | undefined };
export function rangeIsOrdered(value: CatalogDateRange): boolean {
  return !value.start || !value.end || value.start.compare(value.end) <= 0;
}
/** Emit changed scalar endpoints only. Update the farther endpoint first when
 * moving a complete window so each externally observable state is ordered. */
export function emitRange(io: UiSvelteComponentIO | undefined, props: Readonly<Record<string, unknown>>, value: CatalogDateRange): void {
  if (!rangeIsOrdered(value)) return;
  const start = dateText(value.start), end = dateText(value.end);
  const emitStart = () => { if (start !== props.start) io?.emit('startChange', start); };
  const emitEnd = () => { if (end !== props.end) io?.emit('endChange', end); };
  if (start && typeof props.end === 'string' && props.end && start > props.end) {
    emitEnd(); emitStart();
  } else { emitStart(); emitEnd(); }
}
