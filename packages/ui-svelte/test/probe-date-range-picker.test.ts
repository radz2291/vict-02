/**
 * VERIFICATION PROBE (round 3a) — CORRECTED ORACLES for calendar/picker range
 * selection. Replaces the round-3 pointer-click tests, which happy-dom could
 * not deliver (documented environment limit) and whose weak fallback
 * assertions ("truthy JSON string", "permitting no emissions") proved
 * nothing. Interaction now uses the keyboard path (focus + Enter), which is
 * a genuine user input path that runs in happy-dom AND the browser; pointer
 * selection remains browser-verified (U4-FULL-CATALOG-VERIFY-03 §6).
 *
 * Pinned contracts (bits-ui 2.19.3 + catalog adapter):
 *   - one user selection action emits each state transition EXACTLY ONCE;
 *   - selecting from an end-only mount must stay ordered: it restarts the
 *     selection (start = picked day, end cleared) — never a silent reversed
 *     range, and the displayed selection must agree with the emitted state;
 *   - end-only mounts keep the end displayed with placeholders on start.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import CatalogDateRangePicker from '../src/catalog/components/CatalogDateRangePicker.svelte';
import CatalogRangeCalendar from '../src/catalog/components/CatalogRangeCalendar.svelte';
import type { UiSvelteComponentIO } from '../src/document/extensions.js';

const cleanups: (() => void | Promise<void>)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) void cleanup();
});

function ioCap(log: { name: string; value: unknown }[]): UiSvelteComponentIO {
  return {
    emit: (name: string, value: unknown) => {
      log.push({ name, value });
    },
  } as unknown as UiSvelteComponentIO;
}

function mountPicker(props: Record<string, unknown>) {
  const target = document.createElement('div');
  document.body.append(target);
  const emits: { name: string; value: unknown }[] = [];
  const instance = mount(CatalogDateRangePicker, {
    target,
    props: { props, io: ioCap(emits), presentation: undefined },
  });
  cleanups.push(() => unmount(instance));
  return { target, emits };
}

function mountCalendar(props: Record<string, unknown>) {
  const target = document.createElement('div');
  document.body.append(target);
  const emits: { name: string; value: unknown }[] = [];
  const instance = mount(CatalogRangeCalendar, {
    target,
    props: { props, io: ioCap(emits), presentation: undefined },
  });
  cleanups.push(() => unmount(instance));
  return { target, emits };
}

/** The interactive day element (bits-ui renders a focusable button inside the
 * grid cell). */
function dayButton(target: HTMLElement, iso: string): HTMLElement {
  const cell = target.querySelector(`[data-value="${iso}"]`);
  const inner = cell?.querySelector('button, [role="button"], [tabindex]');
  const el = (inner ?? cell) as HTMLElement | null;
  if (!el) throw new Error(`day ${iso} not reachable`);
  return el;
}

function pressEnter(el: HTMLElement): void {
  el.focus();
  el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  flushSync();
}

function isSelected(target: HTMLElement, iso: string): boolean {
  flushSync();
  const cell = target.querySelector(`[data-value="${iso}"]`);
  return cell?.getAttribute('aria-selected') === 'true';
}

function isSelectionStart(target: HTMLElement, iso: string): boolean {
  return (
    target.querySelector(`[data-value="${iso}"]`)?.hasAttribute('data-selection-start') ?? false
  );
}

describe('oracle correction: calendar/picker range selection (keyboard path)', () => {
  it('picker: end-only mount keeps the end displayed and the start placeholder', () => {
    const m = mountPicker({ start: '', end: '2026-10-16', locale: 'en-GB', weekStartsOn: 1 });
    flushSync();
    const fields = [...m.target.querySelectorAll('.vict-control-row > *')].filter(
      (e) => e.tagName !== 'SPAN',
    );
    const texts = fields.map((f) =>
      [...f.querySelectorAll('[role="spinbutton"]')]
        .map((s) => (s.textContent ?? '').trim())
        .join('/'),
    );
    expect(texts[1], 'end stays displayed with empty start').toBe('16/10/2026');
    expect(texts[0], 'start shows placeholders').toBe('dd/mm/yyyy');
    expect(m.emits, 'mount emits nothing').toEqual([]);
  });

  it('calendar: the first selection emits exactly one startChange', () => {
    const m = mountCalendar({ start: '', end: '', locale: 'en-GB', weekStartsOn: 1 });
    pressEnter(dayButton(m.target, '2026-10-20'));
    expect(m.emits, 'one user action, one emitted transition (no duplicate emissions)').toEqual([
      { name: 'startChange', value: '2026-10-20' },
    ]);
    expect(isSelected(m.target, '2026-10-20'), 'picked day displayed as selected').toBe(true);
    expect(
      isSelectionStart(m.target, '2026-10-20'),
      'picked day displayed as the selection start',
    ).toBe(true);
  });

  it('calendar: completing from start-only emits exactly one endChange', () => {
    const m = mountCalendar({ start: '2026-10-12', end: '', locale: 'en-GB', weekStartsOn: 1 });
    pressEnter(dayButton(m.target, '2026-10-16'));
    expect(m.emits, 'completing the window emits the end exactly once').toEqual([
      { name: 'endChange', value: '2026-10-16' },
    ]);
    expect(isSelected(m.target, '2026-10-16'), 'end day displayed as selected').toBe(true);
    expect(isSelectionStart(m.target, '2026-10-12'), 'start day still the selection start').toBe(
      true,
    );
  });

  it('calendar: restarting from a complete window emits exactly the end-clear', () => {
    const m = mountCalendar({
      start: '2026-10-12',
      end: '2026-10-16',
      locale: 'en-GB',
      weekStartsOn: 1,
    });
    pressEnter(dayButton(m.target, '2026-10-12'));
    expect(
      m.emits,
      'restart clears the end exactly once; the unchanged start is not re-emitted',
    ).toEqual([{ name: 'endChange', value: '' }]);
    expect(isSelectionStart(m.target, '2026-10-12'), 'start stays the selection start').toBe(true);
    expect(isSelected(m.target, '2026-10-16'), 'previous end is deselected on display').toBe(false);
  });

  it('calendar: selecting from an end-only mount stays ordered and display agrees with state', () => {
    const m = mountCalendar({ start: '', end: '2026-10-16', locale: 'en-GB', weekStartsOn: 1 });
    pressEnter(dayButton(m.target, '2026-10-20'));
    // Restart semantics: the picked day becomes the start, the old end is
    // cleared — one coherent transition, never a silent reversed range.
    expect(m.emits, 'end-only selection emits the coherent restart transition').toEqual([
      { name: 'startChange', value: '2026-10-20' },
      { name: 'endChange', value: '' },
    ]);
    expect(isSelectionStart(m.target, '2026-10-20'), 'picked day displayed as the new start').toBe(
      true,
    );
    expect(isSelected(m.target, '2026-10-16'), 'old end deselected — no reversed display').toBe(
      false,
    );
    expect(
      m.target.querySelector('[aria-invalid="true"]'),
      'no invalid state after an ordered interaction',
    ).toBeNull();
  });
});
