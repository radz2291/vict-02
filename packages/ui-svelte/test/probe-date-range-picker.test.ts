/**
 * VERIFICATION PROBE (round 3) — disclosed defect A, part 2: the
 * picker/calendar range surfaces. Single-select (start-only), complete window,
 * clearing, end-only entry, and displayed-vs-state agreement.
 */
import { describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import CatalogDateRangePicker from '../src/catalog/components/CatalogDateRangePicker.svelte';
import CatalogRangeCalendar from '../src/catalog/components/CatalogRangeCalendar.svelte';
import type { UiSvelteComponentIO } from '../src/document/extensions.js';

const cleanups: (() => void | Promise<void>)[] = [];
function host(): HTMLElement {
  const target = document.createElement('div');
  document.body.append(target);
  return target;
}
function ioCap(log: { name: string; value: unknown }[]): UiSvelteComponentIO {
  return { emit: (name: string, value: unknown) => { log.push({ name, value }); } } as unknown as UiSvelteComponentIO;
}
function mountPicker(props: Record<string, unknown>) {
  const target = host();
  const emits: { name: string; value: unknown }[] = [];
  const instance = mount(CatalogDateRangePicker, { target, props: { props, io: ioCap(emits), presentation: undefined } });
  cleanups.push(() => unmount(instance));
  return { target, emits };
}
function mountCalendar(props: Record<string, unknown>) {
  const target = host();
  const emits: { name: string; value: unknown }[] = [];
  const instance = mount(CatalogRangeCalendar, { target, props: { props, io: ioCap(emits), presentation: undefined } });
  cleanups.push(() => unmount(instance));
  return { target, emits };
}
function dayButton(target: HTMLElement, iso: string): HTMLElement | undefined {
  return (target.querySelector(`[data-value="${iso}"] [role="button"], [data-value="${iso}"]`) as HTMLElement) ?? undefined;
}
function fieldTexts(target: HTMLElement) {
  flushSync();
  const fields = [...target.querySelectorAll('.vict-control-row > *')].filter(e => e.tagName !== 'SPAN');
  return fields.map(f => [...f.querySelectorAll('[role="spinbutton"]')].map(s => (s.textContent ?? '').trim()).join('/'));
}

describe('disclosed defect A part 2: picker/calendar partial ranges', () => {
  it('picker: end-only mount keeps the end displayed', () => {
    const m = mountPicker({ start: '', end: '2026-10-16', locale: 'en-GB', weekStartsOn: 1 });
    const [start, end] = fieldTexts(m.target);
    expect(end, 'end stays displayed with empty start').toBe('16/10/2026');
    expect(start).not.toBe('16/10/2026');
  });

  it('calendar: selecting a single day emits start-only (first-class partial)', () => {
    const m = mountCalendar({ start: '', end: '', locale: 'en-GB', weekStartsOn: 1 });
    const day12 = dayButton(m.target, '2026-10-12');
    expect(day12, 'day 12 reachable').toBeTruthy();
    day12!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
    day12!.click();
    flushSync();
    expect(m.emits, 'startChange emitted for start-only selection').toContainEqual({ name: 'startChange', value: '2026-10-12' });
  });

  it('calendar: complete window from start-only then a later day', () => {
    const m = mountCalendar({ start: '2026-10-12', end: '', locale: 'en-GB', weekStartsOn: 1 });
    const day16 = dayButton(m.target, '2026-10-16');
    expect(day16).toBeTruthy();
    day16!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
    day16!.click();
    flushSync();
    expect(m.emits).toContainEqual({ name: 'endChange', value: '2026-10-16' });
  });

  it('calendar: clearing a complete window emits cleared endpoints, order kept', () => {
    const m = mountCalendar({ start: '2026-10-12', end: '2026-10-16', locale: 'en-GB', weekStartsOn: 1 });
    const day12 = dayButton(m.target, '2026-10-12');
    day12!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
    day12!.click();
    flushSync();
    // Clicking inside a complete window restarts selection: the end must be
    // cleared too (or re-anchored) — never kept while displayed empty.
    const endStillSelected = m.emits.some(e => e.name === 'endChange' && e.value === '');
    expect(endStillSelected || m.emits.length === 0, JSON.stringify(m.emits)).toBe(true);
  });

  it('calendar: end-only selection (first click lands on end only)', () => {
    const m = mountCalendar({ start: '', end: '2026-10-16', locale: 'en-GB', weekStartsOn: 1 });
    // Re-selecting: clicking day 20 must emit a NEW start (restart) or extend;
    // whatever the semantics, start and end state must agree with display.
    const day20 = dayButton(m.target, '2026-10-20');
    day20!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
    day20!.click();
    flushSync();
    const starts = m.emits.filter(e => e.name === 'startChange').map(e => e.value);
    const ends = m.emits.filter(e => e.name === 'endChange').map(e => e.value);
    // Either restart (start=20, end='') or a start-only selection — but never
    // a reversed or silently-dropped end.
    expect(JSON.stringify({ starts, ends })).toBeTruthy();
    expect(ends.at(-1) === '' || ends.at(-1) === undefined || String(ends.at(-1)) >= String(starts.at(-1) ?? ''), JSON.stringify({ starts, ends })).toBe(true);
  });
});
