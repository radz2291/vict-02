/**
 * VERIFICATION PROBE (round 3) — disclosed defect A: end-only / partial date
 * ranges. The amendment makes partial ranges first-class: empty, start-only,
 * end-only, complete, clearing either endpoint, restoring, external updates.
 * Displayed values and authored state must agree at every step. Assertions
 * are additive — never weaken them.
 */
import { describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import CatalogDateRangeField from '../src/catalog/components/CatalogDateRangeField.svelte';
import type { UiSvelteComponentIO } from '../src/document/extensions.js';

const cleanups: (() => void | Promise<void>)[] = [];
function host(): HTMLElement {
  const target = document.createElement('div');
  document.body.append(target);
  return target;
}
function ioCapturing(emitLog: { name: string; value: unknown }[]): UiSvelteComponentIO {
  return {
    emit: (name: string, value: unknown) => {
      emitLog.push({ name, value });
    },
  } as unknown as UiSvelteComponentIO;
}
type Mount = { target: HTMLElement; emits: { name: string; value: unknown }[]; setProps: (next: Record<string, unknown>) => void };
function mountRange(props: Record<string, unknown>): Mount {
  const target = host();
  const emits: { name: string; value: unknown }[] = [];
  const instance = mount(CatalogDateRangeField, {
    target,
    props: { props, io: ioCapturing(emits), presentation: undefined },
  });
  cleanups.push(() => unmount(instance));
  return {
    target,
    emits,
    setProps(next) {
      Object.assign(props, next);
      (instance as unknown as { $set(next: { props: Record<string, unknown> }): void }).$set({ props: { ...props } });
      flushSync();
    },
  };
}
function inputs(m: Mount) {
  flushSync();
  type Dump = { segs: string[]; placeholders: (string | null)[] };
  const read = (f: Element | undefined): Dump => ({
    segs: f ? [...f.querySelectorAll('[role="spinbutton"]')].map(s => (s.textContent ?? '').trim()) : [],
    placeholders: f ? [...f.querySelectorAll('[data-placeholder]')].map(s => s.getAttribute('data-placeholder')) : [],
  });
  const fields = [...m.target.querySelectorAll('.vict-control-row > *')].filter(e => e.tagName !== 'SPAN');
  return fields.map(read);
}
function segEls(m: Mount, which: 0 | 1) {
  flushSync();
  const fields = [...m.target.querySelectorAll('.vict-control-row > *')].filter(e => e.tagName !== 'SPAN');
  const field = fields[which];
  return field ? [...field.querySelectorAll<HTMLElement>('[role="spinbutton"]')] : [];
}
function pressKey(el: HTMLElement, key: string) {
  el.focus();
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  flushSync();
}

describe('disclosed defect A: partial date ranges are first-class (DateRangeField adapter)', () => {
  it('complete range renders both fields with values and emits nothing', () => {
    const m = mountRange({ start: '2026-10-12', end: '2026-10-16', locale: 'en-GB' });
    const [start, end] = inputs(m);
    expect(start?.segs.join('/')).toBe('12/10/2026');
    expect(end?.segs.join('/')).toBe('16/10/2026');
    expect(m.emits).toEqual([]);
  });

  it('end-only: mounting with an empty start keeps the end visible and state-agreed', () => {
    const m = mountRange({ start: '', end: '2026-10-16', locale: 'en-GB' });
    const [start, end] = inputs(m);
    // The end value MUST stay visible; empty start is first-class, not a
    // reason to blank the whole range.
    expect(end?.segs.join('/'), 'end stays displayed with start empty').toBe('16/10/2026');
    expect(start?.segs.join('') ?? '').not.toContain('2026');
    expect(m.emits).toEqual([]);
  });

  it('clearing the start of a complete range preserves the displayed end', () => {
    const m = mountRange({ start: '2026-10-12', end: '2026-10-16', locale: 'en-GB' });
    const startSegs = segEls(m, 0);
    for (let i = startSegs.length - 1; i >= 0; i -= 1) pressKey(startSegs[i]!, 'Backspace');
    const [start, end] = inputs(m);
    expect(end?.segs.join('/'), 'end must remain displayed after clearing start').toBe('16/10/2026');
    expect(m.emits.filter(e => e.name === 'startChange')).toContainEqual({ name: 'startChange', value: '' });
  });

  it('restoring the cleared start re-completes the range', () => {
    const m = mountRange({ start: '', end: '2026-10-16', locale: 'en-GB' });
    const startSegs = segEls(m, 0);
    // day, month, year segments in order
    for (const [i, digits] of [['1', '2'], ['1', '0'], ['2', '0', '2', '6']].entries()) {
      for (const d of digits as string[]) pressKey(startSegs[i]!, d);
    }
    const [start, end] = inputs(m);
    expect(start?.segs.join('/'), 'start restored').toBe('12/10/2026');
    expect(end?.segs.join('/'), 'end unaffected').toBe('16/10/2026');
    expect(m.emits.filter(e => e.name === 'startChange').at(-1)?.value).toBe('2026-10-12');
  });

  it('external state update: changing props.start updates the display without noise emits', () => {
    const m = mountRange({ start: '2026-10-12', end: '2026-10-16', locale: 'en-GB' });
    m.setProps({ start: '2026-10-11' });
    const [start] = inputs(m);
    expect(start?.segs.join('/')).toBe('11/10/2026');
    expect(m.emits).toEqual([]);
  });

  it('reversed authored range: truthful invalid feedback, no reversed emit', () => {
    const m = mountRange({ start: '2026-10-20', end: '2026-10-16', locale: 'en-GB' });
    // The runtime must refuse to treat the reversed pair as valid and say so.
    const t = m.target.textContent ?? '';
    expect(/must be on or after|must not precede/i.test(t), 'visible invalid feedback').toBe(true);
    expect(m.target.querySelector('[aria-invalid="true"]')).toBeTruthy();
    expect(m.emits).toEqual([]);
  });
});
