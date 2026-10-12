/**
 * VERIFICATION PROBE (round 3, corrected round 4) — disclosed defect A,
 * isolation probe: the host supply channel for a SINGLE DateField. Even a
 * non-empty external change must reach the display.
 *
 * ROUND-4 TIMING CORRECTION (recorded, evidence preserved at
 * historical/probe-datefield-supply-v1.historical.ts): the round-3 version
 * asserted immediately after the fixture's `setValue` — before Svelte 5's
 * update boundary. Fixture state changes batch a reactive update; the
 * supported boundaries are `flushSync()` (synchronous flush of pending
 * work) and `await tick()`. This probe reads the display through
 * `flushSync()` — completing the pending update — and asserts the SAME
 * expectations as round 3, unchanged. Verified empirically at candidate
 * 32d8465a: both boundaries pass; the pre-boundary read shows the stale
 * display. The companion range probe already observed the boundary and
 * failed for a genuine reason (fixed by the builder's range unification).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import DateSupplyFixture from './DateSupplyFixture.svelte';

const cleanups: (() => void | Promise<void>)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) void cleanup();
});
function display(target: HTMLElement): string {
  flushSync();
  return [...target.querySelectorAll('[role="spinbutton"]')]
    .map((s) => (s.textContent ?? '').trim())
    .join('/');
}
describe('disclosed defect A isolation: single DateField external supply', () => {
  it('tracks non-empty external changes, clears and restores', () => {
    const target = document.createElement('div');
    document.body.append(target);
    const instance = mount(DateSupplyFixture, { target });
    cleanups.push(() => unmount(instance));
    expect(display(target)).toBe('12/10/2026');
    (instance as unknown as { setValue(next: unknown): void }).setValue('2026-10-09');
    expect(display(target), 'non-empty external change').toBe('09/10/2026');
    (instance as unknown as { setValue(next: unknown): void }).setValue('');
    expect(display(target), 'cleared externally').toBe('dd/mm/yyyy');
    (instance as unknown as { setValue(next: unknown): void }).setValue('2026-11-02');
    expect(display(target), 'restored externally').toBe('02/11/2026');
  });
});
