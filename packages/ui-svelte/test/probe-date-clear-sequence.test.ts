/**
 * VERIFICATION PROBE (round 3a) — CORRECTED ORACLE for date clearing.
 *
 * Oracle correction record (supersedes historical/
 * probe-date-range-partial-v1.historical.ts):
 *   The pinned bits-ui@2.19.3 source deletes digits incrementally
 *   (BaseNumericSegmentState.#handleBackspace: "12"->"1"->null;
 *   DateFieldYearSegmentState.#handleYearBackspace: "2026"->"202"->"20"->"2"->null)
 *   and pads a partial year on focusout via prependYearZeros ("202"->"0202",
 *   a valid calendar year). One Backspace per segment therefore never
 *   established a full clear, and "0202-10-12" intermediates are legitimate
 *   edits — not garbage. This probe uses a genuine complete-clearing
 *   sequence and asserts:
 *     1. a fully cleared endpoint emits the empty convention (''),
 *     2. the other endpoint remains intact and visible,
 *     3. restoration works,
 *     4. display and accepted state agree,
 *     5. controlled synchronization does not create repeated echo emissions,
 *   while any intermediate emissions must be valid calendar dates.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import DateClearFixture from './DateClearFixture.svelte';

const cleanups: (() => void | Promise<void>)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) void cleanup();
});

type Mount = {
  target: HTMLElement;
  emits: { name: string; value: unknown }[];
  setProps: (next: { start: string; end: string }) => void;
};

function mountRange(initial: { start: string; end: string }): Mount {
  const target = document.createElement('div');
  document.body.append(target);
  const emits: { name: string; value: unknown }[] = [];
  const instance = mount(DateClearFixture, { target, props: { emits, initial } });
  cleanups.push(() => unmount(instance));
  return {
    target,
    emits,
    setProps(next) {
      (instance as unknown as { setRange(next: { start: string; end: string }): void }).setRange(
        next,
      );
      flushSync();
    },
  };
}

type FieldDump = { segs: string[] };

function fieldDump(target: HTMLElement, which: 0 | 1): FieldDump {
  flushSync();
  const fields = [...target.querySelectorAll('.vict-control-row > *')].filter(
    (e) => e.tagName !== 'SPAN',
  );
  const field = fields[which];
  return {
    segs: field
      ? [...field.querySelectorAll('[role="spinbutton"]')].map((s) => (s.textContent ?? '').trim())
      : [],
  };
}

function segEls(target: HTMLElement, which: 0 | 1): HTMLElement[] {
  flushSync();
  const fields = [...target.querySelectorAll('.vict-control-row > *')].filter(
    (e) => e.tagName !== 'SPAN',
  );
  const field = fields[which];
  return field ? [...field.querySelectorAll<HTMLElement>('[role="spinbutton"]')] : [];
}

function pressKey(el: HTMLElement, key: string): void {
  el.focus();
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  flushSync();
}

/** Genuine complete-clearing sequence: per the pinned bits-ui 2.19.3 deletion
 * semantics a 2-digit segment needs 2 Backspaces and the year 4; the segment
 * then renders its placeholder text (dd/mm/yyyy for en-GB). */
function clearField(target: HTMLElement, which: 0 | 1): void {
  const presses = [2, 2, 4];
  const segs = segEls(target, which);
  for (const [i, seg] of segs.entries()) {
    for (let k = 0; k < (presses[i] ?? 0); k += 1) pressKey(seg, 'Backspace');
  }
  const dump = fieldDump(target, which);
  expect(dump.segs.join('/'), `field ${which} fully cleared to placeholders`).toBe('dd/mm/yyyy');
}

const isValidIsoDate = (value: unknown): boolean => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

describe('oracle correction: full-clear sequence on a range endpoint (DateRangeField)', () => {
  it('documents the pinned incremental deletion: one Backspace is a partial edit, padding yields a valid year', () => {
    const m = mountRange({ start: '2026-10-12', end: '2026-10-16' });
    const year = segEls(m.target, 0).at(-1)!;
    pressKey(year, 'Backspace');
    expect(
      (year.textContent ?? '').trim(),
      'one Backspace deletes one year digit (bits-ui 2.19.3)',
    ).toBe('202');
    // Leaving the segment pads the partial year: 202 -> 0202 — a valid year,
    // not garbage. Any emitted intermediate must be a valid calendar date.
    year.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    flushSync();
    const emitted = m.emits.filter((e) => e.name === 'startChange').map((e) => e.value);
    for (const value of emitted)
      expect(isValidIsoDate(value), `intermediate ${String(value)} is a valid isoDate`).toBe(true);
    expect(emitted.at(-1), 'padded partial-year value').toBe('0202-10-12');
  });

  it('a fully cleared start emits the empty convention, keeps the end displayed, and does not echo', () => {
    const m = mountRange({ start: '2026-10-12', end: '2026-10-16' });
    clearField(m.target, 0);

    // 2. The other endpoint remains intact and visible; 4. display agrees.
    expect(
      fieldDump(m.target, 1).segs.join('/'),
      'end stays displayed after start fully cleared',
    ).toBe('16/10/2026');
    expect(fieldDump(m.target, 0).segs.join('/'), 'start shows placeholders after clear').toBe(
      'dd/mm/yyyy',
    );

    // 1. The fully cleared endpoint emits the empty convention, and every
    // intermediate emission was a valid calendar date.
    const changes = m.emits.filter((e) => e.name === 'startChange').map((e) => e.value);
    expect(changes.at(-1), 'fully cleared start emits the empty convention').toBe('');
    for (const value of changes)
      expect(isValidIsoDate(value) || value === '', `intermediate ${String(value)} valid`).toBe(
        true,
      );
    expect(
      m.emits.filter((e) => e.name === 'endChange'),
      'end never emitted while only the start was edited',
    ).toEqual([]);

    // 5. Controlled synchronization: the host acknowledging '' must not cause
    // repeated echo emissions.
    const after = m.emits.length;
    m.setProps({ start: '', end: '2026-10-16' });
    m.setProps({ start: '', end: '2026-10-16' });
    expect(
      m.emits.slice(after),
      'no echo emissions when controlled state acknowledges the cleared value',
    ).toEqual([]);
    expect(fieldDump(m.target, 0).segs.join('/'), 'start still blank after host acknowledges').toBe(
      'dd/mm/yyyy',
    );
    expect(fieldDump(m.target, 1).segs.join('/'), 'end still displayed').toBe('16/10/2026');
  });

  it('restoring the fully cleared start re-completes the range; display and state agree', () => {
    const m = mountRange({ start: '', end: '2026-10-16' });
    const startSegs = segEls(m.target, 0);
    for (const [i, digits] of [
      ['1', '2'],
      ['1', '0'],
      ['2', '0', '2', '6'],
    ].entries()) {
      for (const d of digits as string[]) pressKey(startSegs[i]!, d);
    }
    expect(fieldDump(m.target, 0).segs.join('/'), 'start restored on display').toBe('12/10/2026');
    expect(fieldDump(m.target, 1).segs.join('/'), 'end unaffected').toBe('16/10/2026');
    const changes = m.emits.filter((e) => e.name === 'startChange').map((e) => e.value);
    expect(changes.at(-1), 'restored start emitted').toBe('2026-10-12');
    for (const value of changes)
      expect(isValidIsoDate(value) || value === '', `intermediate ${String(value)} valid`).toBe(
        true,
      );

    // Host acknowledges the restored value: no echo emissions, then a full
    // clear from the acknowledged state still emits the empty convention.
    m.setProps({ start: '2026-10-12', end: '2026-10-16' });
    const after = m.emits.length;
    clearField(m.target, 0);
    const changes2 = m.emits
      .slice(after)
      .filter((e) => e.name === 'startChange')
      .map((e) => e.value);
    expect(changes2.at(-1), 'clear from acknowledged state emits the empty convention').toBe('');
    for (const value of changes2)
      expect(isValidIsoDate(value) || value === '', `intermediate ${String(value)} valid`).toBe(
        true,
      );
    m.setProps({ start: '', end: '2026-10-16' });
    expect(m.emits.slice(after).length, 'exactly the user-driven transitions, no echoes').toBe(
      changes2.length,
    );
  });

  it('a fully cleared end emits the empty convention and keeps the start displayed', () => {
    const m = mountRange({ start: '2026-10-12', end: '2026-10-16' });
    clearField(m.target, 1);
    expect(
      fieldDump(m.target, 0).segs.join('/'),
      'start stays displayed after end fully cleared',
    ).toBe('12/10/2026');
    expect(fieldDump(m.target, 1).segs.join('/'), 'end blanked to placeholders').toBe('dd/mm/yyyy');
    const changes = m.emits.filter((e) => e.name === 'endChange').map((e) => e.value);
    expect(changes.at(-1), 'fully cleared end emits the empty convention').toBe('');
    for (const value of changes)
      expect(isValidIsoDate(value) || value === '', `intermediate ${String(value)} valid`).toBe(
        true,
      );
  });
});
