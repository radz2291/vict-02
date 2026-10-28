import { afterEach, expect, it } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import Fixture from './viewport-host-fixture.svelte';

let component: ReturnType<typeof mount> | undefined;
afterEach(async () => { if (component) await unmount(component); component = undefined; document.body.innerHTML = ''; });

it('establishes and updates a query host inside the iframe without replacing authored children', async () => {
  component = mount(Fixture, { target: document.body });
  flushSync(); await tick();
  const frame = document.querySelector('iframe')!;
  const doc = frame.contentDocument!;
  const host = doc.querySelector<HTMLElement>('[data-application-content]')!;
  expect(host).not.toBeNull();
  const child = doc.querySelector('main')!;
  expect(child.textContent).toBe('Retained authored content');
  expect(host.classList.contains('vict-controls')).toBe(true);
  expect(host.style.containerName).toBe('');
  const click = async (text: string) => {
    [...document.querySelectorAll('button')].find(button => button.textContent === text)!.click();
    flushSync(); await tick();
  };
  await click('Establish query host');
  expect(host.style.containerName).toBe('studio-screen');
  expect(host.style.containerType).toBe('inline-size');
  expect(child.closest('[data-application-content]')).toBe(host);
  expect(host.ownerDocument).toBe(doc);
  expect(host.ownerDocument).not.toBe(document);
  await click('Rename query host');
  expect(host.style.containerName).toBe('alternate-screen');
  expect(doc.querySelector('main')).toBe(child);
  await click('Clear query host');
  expect(host.style.containerName).toBe('');
  expect(host.style.containerType).toBe('');
  expect(doc.querySelector('main')).toBe(child);
});
