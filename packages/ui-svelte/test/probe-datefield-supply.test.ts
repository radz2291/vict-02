/**
 * VERIFICATION PROBE (round 3) — disclosed defect A, isolation probe: the
 * host supply channel for a SINGLE DateField. Even a non-empty external
 * change must reach the display. Locates the defect in the host supply /
 * props-reactivity path, not the range adapters.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import DateSupplyFixture from './DateSupplyFixture.svelte';

const cleanups: (() => void | Promise<void>)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) void cleanup();
});
describe('disclosed defect A isolation: single DateField external supply', () => {
  it('tracks non-empty external changes, clears and restores', () => {
    const target = document.createElement('div');
    document.body.append(target);
    const instance = mount(DateSupplyFixture, { target });
    cleanups.push(() => unmount(instance));
    flushSync();
    const disp = () =>
      [...target.querySelectorAll('[role="spinbutton"]')]
        .map((s) => (s.textContent ?? '').trim())
        .join('/');
    expect(disp()).toBe('12/10/2026');
    (instance as unknown as { setValue(next: unknown): void }).setValue('2026-10-09');
    expect(disp(), 'non-empty external change').toBe('09/10/2026');
    (instance as unknown as { setValue(next: unknown): void }).setValue('');
    expect(disp(), 'cleared externally').toBe('dd/mm/yyyy');
    (instance as unknown as { setValue(next: unknown): void }).setValue('2026-11-02');
    expect(disp(), 'restored externally').toBe('02/11/2026');
  });
});
