import { afterEach, beforeEach, expect, vi } from 'vitest';
import { tick } from 'svelte';

// Happy DOM does not implement the native Popover API. Browser checks cover
// top-layer positioning and light dismissal; this shim lets existing journeys
// reach commands through their real menu triggers.
const matches = Element.prototype.matches;
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'showPopover', {
    configurable: true,
    value(this: HTMLElement) { this.setAttribute('data-test-popover', ''); },
  });
  Object.defineProperty(HTMLElement.prototype, 'hidePopover', {
    configurable: true,
    value(this: HTMLElement) { this.removeAttribute('data-test-popover'); },
  });
  vi.spyOn(Element.prototype, 'matches').mockImplementation(function (this: Element, selector) {
    return selector === ':popover-open' ? this.hasAttribute('data-test-popover') : matches.call(this, selector);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLElement.prototype, 'showPopover');
  Reflect.deleteProperty(HTMLElement.prototype, 'hidePopover');
});

export async function openStudioMenu(name: string) {
  const trigger = [...document.querySelectorAll<HTMLButtonElement>('.studio-menus > button')]
    .find(button => button.textContent === name);
  expect(trigger).toBeDefined();
  trigger!.click();
  await tick();
  await tick();
}
