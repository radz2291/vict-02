/**
 * VERIFICATION PROBE (round 4) — numeric-list editor recheck (builder repair
 * "preserve numeric list drafts as text"): the StateValuesPanel list editor
 * must keep the operator's in-progress draft verbatim, surface validation
 * failures without losing the draft or silently seeding, apply valid
 * members through the one shared guard, and never touch document source
 * (the panel's only outbound channel is the onChange callback).
 *
 * Environment note: happy-dom does not reproduce Chrome's number-input
 * behavior of reporting '' for partial drafts ('1.', '-'), so the
 * engine-level reset the builder fixed is browser-covered (authoring
 * journey evidence); this probe pins the CONTRACT at the component level.
 *
 * Round 5 (finding F17): real Chrome goes further — an unparsable partial
 * draft reports value="" WITH validity.badInput set, which the unrepaired
 * panel treated as a DELIBERATE empty value and silently cleared the stored
 * number. The tests below simulate that browser behavior by stubbing
 * `validity.badInput` (labelled simulation; the real-Chrome path is also
 * exercised manually in the round-5 browser evidence): invalid input must
 * produce truthful feedback and never seed or clear a value, while a
 * deliberate empty entry (badInput false) still clears.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import StateValuesPanel from '../src/StateValuesPanel.svelte';
import type { UiLocalStateDecl, UiValue } from '@victframework/ui';

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

const localState: Record<string, UiLocalStateDecl> = {
  weights: { key: 'weights', type: 'numberList', initial: [] } as UiLocalStateDecl,
  budget: { key: 'budget', type: 'number', initial: 0 } as UiLocalStateDecl,
};

function mountPanel(stateValues: Record<string, UiValue>) {
  const target = document.createElement('div');
  document.body.append(target);
  const changes: { key: string; value: UiValue | undefined }[] = [];
  const instance = mount(StateValuesPanel, {
    target,
    props: {
      localState,
      stateValues,
      onChange: (key: string, value: UiValue | undefined) => changes.push({ key, value }),
    },
  });
  cleanups.push(() => unmount(instance));
  flushSync();
  return { target, changes };
}

function addInput(target: HTMLElement, key: string): HTMLInputElement {
  const input = target.querySelector<HTMLInputElement>(`input[aria-label="Add ${key} member"]`);
  expect(input, `add-member input for ${key}`).toBeTruthy();
  return input!;
}

function type(input: HTMLInputElement, text: string): void {
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
}

describe('round 4 recheck: numeric-list editor drafts, validation, application', () => {
  it('applies a valid draft through the shared guard and clears the input', () => {
    const { target, changes } = mountPanel({ weights: [1, 2], budget: 0 });
    const input = addInput(target, 'weights');
    type(input, '4');
    const add = [...target.querySelectorAll('button')].find(
      (b) => (b.textContent ?? '').trim() === 'Add',
    );
    expect(add, 'Add button rendered').toBeTruthy();
    add!.click();
    flushSync();
    expect(changes, 'valid member applied to the list').toEqual([
      { key: 'weights', value: [1, 2, 4] },
    ]);
    expect(input.value, 'input cleared after application').toBe('');
  });

  it('an invalid draft surfaces truthful validation, never seeds, and cannot be committed (round-5 F17 contract)', () => {
    // ROUND-5 CORRECTION (finding F17): this engine (like real Chrome) reports
    // validity.badInput for '1e999', so the truthful feedback is the badInput
    // message and the draft is not committed by Add. The round-4 expectation
    // (raw '1e999' preserved verbatim + 'List members must be finite
    // numbers.') described the engine's raw-text path and is preserved
    // verbatim in test/historical/state-values-panel-numeric-list-v1.historical.ts.
    // The finiteness guard remains in the component as defense-in-depth for
    // engines that report raw text.
    const { target, changes } = mountPanel({ weights: [1, 2], budget: 0 });
    const input = addInput(target, 'weights');
    type(input, '1e999');
    expect(target.querySelector('.state-error')?.textContent, 'truthful feedback for the overflow draft').toContain('Enter a valid number');
    const add = [...target.querySelectorAll('button')].find(
      (b) => (b.textContent ?? '').trim() === 'Add',
    );
    add!.click();
    flushSync();
    expect(changes, 'no silent seed on invalid draft').toEqual([]);
    // correcting the draft applies without a stale error
    Object.defineProperty(input, 'validity', { value: { badInput: false }, configurable: true });
    type(input, '5');
    add!.click();
    flushSync();
    expect(changes, 'corrected draft applied').toEqual([{ key: 'weights', value: [1, 2, 5] }]);
    expect(target.textContent ?? '').not.toContain('List members must be finite numbers.');
  });

  it('removal applies the filtered list and the panel only ever calls onChange', () => {
    const { target, changes } = mountPanel({ weights: [1, 2], budget: 0 });
    const remove = target.querySelector<HTMLButtonElement>('button[aria-label="Remove 1"]');
    expect(remove, 'remove button rendered').toBeTruthy();
    remove!.click();
    flushSync();
    expect(changes, 'list member removed through the guard').toEqual([
      { key: 'weights', value: [2] },
    ]);
  });

  it('scalar number edits validate finite numbers before applying', () => {
    const { target, changes } = mountPanel({ weights: [], budget: 0 });
    const scalar = target.querySelector<HTMLInputElement>('input[aria-label="budget value"]');
    expect(scalar, 'scalar number input rendered').toBeTruthy();
    type(scalar!, '7');
    expect(changes, 'valid scalar applied as a number').toEqual([{ key: 'budget', value: 7 }]);
    type(scalar!, '');
    expect(changes.at(-1), 'clearing the scalar clears the seeded value').toEqual({
      key: 'budget',
      value: undefined,
    });
  });

  it('round 5 / simulated real-Chrome badInput: invalid scalar entry is truthful and never clears or seeds', () => {
    const { target, changes } = mountPanel({ weights: [], budget: 42 });
    const scalar = target.querySelector<HTMLInputElement>('input[aria-label="budget value"]');
    expect(scalar, 'scalar number input').toBeTruthy();
    // Chrome sanitizes an unparsable draft to '' and flags badInput.
    Object.defineProperty(scalar!, 'validity', { value: { badInput: true }, configurable: true });
    type(scalar!, '');
    expect(target.querySelector('.state-error')?.textContent).toContain('Enter a valid number');
    expect(changes.some((c) => c.key === 'budget'), 'no onChange while invalid').toBe(false);
    expect(target.querySelector('.state-error')?.textContent).toBeTruthy();
    // Recovery: a valid entry applies and the truthful error clears.
    Object.defineProperty(scalar!, 'validity', { value: { badInput: false }, configurable: true });
    type(scalar!, '7');
    expect(changes.at(-1)).toEqual({ key: 'budget', value: 7 });
    expect(target.querySelector('.state-error')).toBeNull();
  });

  it('round 5: deliberate empty still clears; invalid list draft never seeds a member', () => {
    const { target, changes } = mountPanel({ weights: [1], budget: 3 });
    const scalar = target.querySelector<HTMLInputElement>('input[aria-label="budget value"]')!;
    Object.defineProperty(scalar, 'validity', { value: { badInput: false }, configurable: true });
    type(scalar, '');
    expect(changes.at(-1), 'deliberate empty clears the stored number').toEqual({ key: 'budget', value: undefined });

    const add = addInput(target, 'weights');
    // a valid keystroke first, then invalid text: the stale valid prefix must
    // NOT be committed by Add while the visible draft is invalid (round-5)
    Object.defineProperty(add, 'validity', { value: { badInput: false }, configurable: true });
    type(add, '1');
    Object.defineProperty(add, 'validity', { value: { badInput: true }, configurable: true });
    type(add, '');
    expect(target.querySelector('.state-error')?.textContent).toContain('Enter a valid number');
    target.querySelector<HTMLButtonElement>('.list-add button')?.click();
    flushSync();
    expect(changes.filter((c) => c.key === 'weights'), 'Add refuses while the visible draft is invalid').toHaveLength(0);
    // The truthful error stays until valid text arrives; then Add applies.
    Object.defineProperty(add, 'validity', { value: { badInput: false }, configurable: true });
    type(add, '5');
    expect(target.querySelector('.state-error')).toBeNull();
    target.querySelector<HTMLButtonElement>('.list-add button')?.click();
    flushSync();
    expect(changes.filter((c) => c.key === 'weights')).toHaveLength(1);
    expect(changes.find((c) => c.key === 'weights')?.value).toEqual([1, 5]);
  });

});
