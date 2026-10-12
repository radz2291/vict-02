/**
 * VERIFICATION PROBE (round 5) — finding F16 recheck: the accordion family
 * exposes a `label` prop that B2Accordion previously ignored entirely
 * (plan-only authoring). The repaired contract: a non-empty authored label
 * becomes the accessible group name (aria-label) on the accordion root; an
 * unset/empty label leaves the attribute off. Item-level labels (the
 * visible trigger text) are unaffected.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import AccordionLabelFixture from './AccordionLabelFixture.svelte';

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function mountAccordion(label?: string): HTMLElement {
  const target = document.createElement('div');
  document.body.append(target);
  const instance = mount(AccordionLabelFixture, { target, props: { label } });
  cleanups.push(() => unmount(instance));
  flushSync();
  return target;
}

describe('round 5: accordion label carries its intended effect (F16)', () => {
  it('authored label becomes the accessible group name on the root', () => {
    const target = mountAccordion('Evidence findings');
    const named = target.querySelector<HTMLElement>('[aria-label="Evidence findings"]');
    expect(named, 'root carries the authored accessible name').toBeTruthy();
    // It is the accordion root: it contains the item trigger.
    expect(named?.querySelector('button')?.textContent).toContain('Section A');
  });

  it('empty or unset label leaves no accessible-name attribute behind', () => {
    for (const label of [undefined, '']) {
      const target = mountAccordion(label);
      expect(
        target.querySelector('[aria-label]'),
        `no aria-label for label=${JSON.stringify(label)}`,
      ).toBeNull();
      // The accordion itself still renders with its item.
      expect(target.querySelector('button')?.textContent).toContain('Section A');
    }
  });
});
