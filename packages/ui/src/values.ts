/**
 * `UiValue` — the serializable value carrier for every widened value-type
 * boundary (amendment §10.1a, frozen at payload `4cfe5b37…`).
 *
 * A `UiValue` is a scalar, or a frozen-order JSON array of homogeneous,
 * finite scalars. Library objects (DateValue, Time, DateRange, Svelte/Bits
 * types) never cross a `UiValueType`-typed boundary; adapters convert at
 * the library boundary only. This module is the ONLY place value-shape
 * rules live — every widened boundary imports the same guard
 * (`isUiValueOfType`); there are no per-package reimplementations.
 *
 * Pure data + pure predicates: no DOM, no framework, no date-library
 * dependency (the ISO calendar acceptance below is the format+calendar
 * check `@internationalized/date`'s `parseDate`/`parseTime` apply; the
 * cross-check with the actual parsers is a ui-svelte test obligation).
 */

import type { UiValueType } from './document.js';

/** The serializable carrier crossing every widened boundary (§10.1a). */
export type UiValue = string | number | boolean | readonly string[] | readonly number[];

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIME_PATTERN = /^\d{2}:\d{2}(:\d{2})?$/;

function isIsoCalendarDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const daysInMonth =
    month === 2
      ? (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
        ? 29
        : 28
      : month === 4 || month === 6 || month === 9 || month === 11
        ? 30
        : 31;
  return day <= daysInMonth;
}

function isIsoClockTime(value: string): boolean {
  if (!ISO_TIME_PATTERN.test(value)) return false;
  const hour = Number(value.slice(0, 2));
  const minute = Number(value.slice(3, 5));
  const second = value.length >= 6 ? Number(value.slice(6, 8)) : 0;
  return hour < 24 && minute < 60 && second < 60;
}

/** True when `type` is inside the widened `UiValueType` vocabulary. */
export function isUiValueType(type: string): type is UiValueType {
  return (
    type === 'string' ||
    type === 'number' ||
    type === 'boolean' ||
    type === 'stringList' ||
    type === 'numberList' ||
    type === 'isoDate' ||
    type === 'isoTime'
  );
}

/**
 * The ONE shared value guard. Every widened boundary validates through
 * this function and no other shape check:
 *
 * - `string`    → typeof `'string'`
 * - `number`    → typeof `'number'` and finite (NaN/±Infinity rejected)
 * - `boolean`   → typeof `'boolean'`
 * - `stringList`→ array; every member typeof `'string'` (`[]` is the
 *                 valid empty list; `null`/mixed/NaN members rejected)
 * - `numberList`→ array; every member a finite number
 * - `isoDate`   → `YYYY-MM-DD` and a valid Gregorian calendar date
 *                 (what `parseDate` accepts; e.g. `2026-13-45` rejected)
 * - `isoTime`   → `HH:MM` or `HH:MM:SS` with valid clock fields
 *                 (what `parseTime` accepts)
 *
 * Non-array non-scalars (library objects, plain objects) are never a
 * `UiValue` for any type.
 */
export function isUiValueOfType(value: unknown, type: UiValueType): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'stringList':
      return Array.isArray(value) && value.every((member) => typeof member === 'string');
    case 'numberList':
      return (
        Array.isArray(value) &&
        value.every((member) => typeof member === 'number' && Number.isFinite(member))
      );
    case 'isoDate':
      return typeof value === 'string' && isIsoCalendarDate(value);
    case 'isoTime':
      return typeof value === 'string' && isIsoClockTime(value);
    default:
      return false;
  }
}

/**
 * The canonical empty value for a type per the §10.1 empty-value
 * conventions: `''` for string, `[]` for lists; numbers, booleans and
 * ISO date/time scalars have no empty representation (absence is
 * expressed by omitting the key, never by a sentinel).
 */
export function uiValueEmptyFor(type: UiValueType): UiValue | undefined {
  switch (type) {
    case 'string':
      return '';
    case 'stringList':
      return [];
    case 'numberList':
      return [];
    default:
      return undefined;
  }
}
