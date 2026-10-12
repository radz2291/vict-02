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

  it('an invalid draft surfaces the validation error, keeps the draft, and never seeds', () => {
    const { target, changes } = mountPanel({ weights: [1, 2], budget: 0 });
    // '1e999' survives the number-input sanitizer (unlike 'abc') and is
    // non-finite for Number() — the genuine invalid-draft path in this engine
    const input = addInput(target, 'weights');
    type(input, '1e999');
    const add = [...target.querySelectorAll('button')].find(
      (b) => (b.textContent ?? '').trim() === 'Add',
    );
    add!.click();
    flushSync();
    expect(target.textContent ?? '', 'validation error surfaced').toContain(
      'List members must be finite numbers.',
    );
    expect(changes, 'no silent seed on invalid draft').toEqual([]);
    expect(input.value, 'invalid draft preserved for correction').toBe('1e999');
    // correcting the draft applies without a stale error
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
});
