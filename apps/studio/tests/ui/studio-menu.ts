import { expect } from 'vitest';
import { tick } from 'svelte';

export async function openStudioMenu(name: string) {
  const trigger = [...document.querySelectorAll<HTMLButtonElement>('.studio-menus > button')]
    .find(button => button.textContent === name);
  expect(trigger).toBeDefined();
  trigger!.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowDown',bubbles:true,cancelable:true}));
  await tick();
  await tick();
}
