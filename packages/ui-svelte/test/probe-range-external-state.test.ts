/**
 * VERIFICATION PROBE (round 3) — disclosed defect A, part 3: external state
 * updates through the host supply channel (the preview-state panel path).
 * Visible values and authored state must agree after every external edit.
 */
import { describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import RangeStateFixture from './RangeStateFixture.svelte';

const cleanups: (() => void | Promise<void>)[] = [];
function host(): HTMLElement {
  const target = document.createElement('div');
  document.body.append(target);
  return target;
}
function rangeDisplay(target: HTMLElement): string[] {
  flushSync();
  const rows = [...target.querySelectorAll('.vict-control-row')];
  return rows.map(row =>
    [...row.querySelectorAll('[role="spinbutton"]')].map(s => (s.textContent ?? '').trim()).join('/'),
  );
}

describe('disclosed defect A part 3: external state updates reach the range display', () => {
  it('clearing the supplied start blanks the displayed start; the end stays', () => {
    const target = host();
    const instance = mount(RangeStateFixture, { target });
    cleanups.push(() => unmount(instance));
    expect(rangeDisplay(target), 'initial complete range').toEqual(['12/10/2026/16/10/2026']);

    (instance as unknown as { setSupplied(next: Record<string, unknown>): void }).setSupplied({
      windowStart: '',
      windowEnd: '2026-10-16',
    });
    const after = rangeDisplay(target);
    expect(after, 'start cleared externally, end preserved on display').toEqual(['dd/mm/yyyy/16/10/2026']);
  });

  it('clearing the supplied end blanks the displayed end; the start stays', () => {
    const target = host();
    const instance = mount(RangeStateFixture, { target });
    cleanups.push(() => unmount(instance));
    (instance as unknown as { setSupplied(next: Record<string, unknown>): void }).setSupplied({
      windowStart: '2026-10-12',
      windowEnd: '',
    });
    expect(rangeDisplay(target), 'end cleared externally, start preserved on display').toEqual(['12/10/2026/dd/mm/yyyy']);
  });

  it('restoring both supplied endpoints re-displays the complete range', () => {
    const target = host();
    const instance = mount(RangeStateFixture, { target });
    cleanups.push(() => unmount(instance));
    const api = instance as unknown as { setSupplied(next: Record<string, unknown>): void };
    api.setSupplied({ windowStart: '', windowEnd: '' });
    expect(rangeDisplay(target)).toEqual(['dd/mm/yyyy/dd/mm/yyyy']);
    api.setSupplied({ windowStart: '2026-11-02', windowEnd: '2026-11-09' });
    expect(rangeDisplay(target), 'restored externally').toEqual(['02/11/2026/09/11/2026']);
  });
});
