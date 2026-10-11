import type { Time, CalendarDateTime, ZonedDateTime } from '@internationalized/date';
export type TimeValue = Time | CalendarDateTime | ZonedDateTime;
export const timeFieldContext = Symbol('vict.time-field');
export interface TimeFieldContext {
  value(): TimeValue | undefined;
  cycle(): 12 | 24;
  editable(part: string): boolean;
  change(value: TimeValue | undefined): void;
}
