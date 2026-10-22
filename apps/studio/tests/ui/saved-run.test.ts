// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import SavedRun from '../../src/routes/run-screen/+page.svelte';
import { newScreen } from '../../src/lib/designer/application.js';
import { screenStore } from '../../src/lib/designer/storage.js';

let instance: ReturnType<typeof mount> | undefined;
afterEach(async () => {
  if (instance) await unmount(instance);
  document.body.innerHTML = '';
  localStorage.clear();
  history.replaceState({}, '', '/');
});

it.each([
  { requested: '390', expected: 'match', maxWidth: '390px' },
  { requested: 'invalid', expected: 'fluid', maxWidth: 'none' },
  { requested: '-10', expected: 'fluid', maxWidth: 'none' },
])('keeps saved source unchanged when running with width=$requested', async ({ requested, expected, maxWidth }) => {
  const source = { ...newScreen('Saved replay', 'saved-replay'), revision: 'r1.r1' };
  const store = screenStore(localStorage, source.id);
  expect(store.save({ document: source, expectedStoredRevision: 'r1', newStoredRevision: 'r1.r1' }).ok).toBe(true);
  history.replaceState({}, '', `/run-screen?screen=${source.id}&width=${requested}`);
  instance = mount(SavedRun, { target: document.body });
  await tick();
  await tick();
  const size = document.querySelector<HTMLSelectElement>('[aria-label="Canvas width"]')!;
  expect(size.value).toBe(expected);
  expect(document.querySelector<HTMLElement>('.finished-frame')!.style.maxWidth).toBe(maxWidth);
  expect(document.querySelector('.workspace-simulation')!.hasAttribute('open')).toBe(false);
  // Size switching is checked with real browser input; Happy DOM's select
  // binding does not reliably model native selection changes.
  expect(store.rawLoad()).toMatchObject({ status: 'loaded', document: source });
});
