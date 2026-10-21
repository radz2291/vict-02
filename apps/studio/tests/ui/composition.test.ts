// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { mount, unmount, tick, flushSync } from 'svelte';
vi.mock('$app/navigation', () => ({ beforeNavigate: () => {} }));
import Designer from '../../src/lib/designer/Designer.svelte';
import { newScreen, compileScreen } from '../../src/lib/designer/application.js';
import { screenStore } from '../../src/lib/designer/storage.js';
import type { UiDocument } from '@victframework/ui';
let editor: ReturnType<typeof mount> | undefined;
afterEach(async () => {
  if (editor) await unmount(editor);
  document.body.innerHTML = '';
  localStorage.clear();
});
const button = (name: string) => {
  const item = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (item) => item.textContent?.trim() === name,
  );
  expect(item, name).toBeDefined();
  item!.click();
  flushSync();
  return item!;
};

it('opens a closed composition without authored or runtime changes, guards drafts, and saves the same edited source for replay', async () => {
  const seed = newScreen('Composition trial', 'composition-trial');
  const source: UiDocument = {
    ...seed,
    revision: 'r1.r1',
    nodes: {
      ...seed.nodes,
      screen: { ...seed.nodes.screen!, children: ['dialog'] } as UiDocument['nodes'][string],
      dialog: {
        id: 'dialog',
        kind: 'component',
        definitionId: 'vict.catalog.dialog',
        props: {
          title: { type: 'literal', value: 'Details' },
          open: { type: 'literal', value: false },
        },
        slots: { body: { name: 'body', children: ['paragraph'] } },
      },
      paragraph: { id: 'paragraph', kind: 'element', tag: 'p', children: ['copy'] },
      copy: { id: 'copy', kind: 'text', content: { type: 'literal', value: 'Original body' } },
    },
  };
  const store = screenStore(localStorage, source.id);
  expect(
    store.save({ document: source, expectedStoredRevision: 'r1', newStoredRevision: 'r1.r1' }).ok,
  ).toBe(true);
  editor = mount(Designer, { target: document.body });
  await tick();
  await tick();
  const scroll = document.querySelector<HTMLElement>('.canvas-scroll')!;
  scroll.scrollTop = 100;
  const trigger = document.querySelector<HTMLElement>('[data-testid=dialog-trigger]')!;
  trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
  trigger.click();
  await tick();
  const entry = document.querySelector<HTMLButtonElement>('[aria-label="Open Details composition"]');
  expect(entry?.closest('.palette-header')).not.toBeNull();
  expect(document.querySelector('.composition-entry')).toBeNull();
  entry!.click();
  await tick();
  expect(document.querySelector('[aria-label="Composition navigation"]')).not.toBeNull();
  await tick();
  expect(scroll.scrollTop).toBe(0);
  expect(document.querySelector('.design-frame')?.textContent).toContain('Original body');
  expect(
    document.querySelector('[data-testid=dialog-panel][data-ui-composition-surface=body]'),
  ).not.toBeNull();
  expect(document.querySelector('.save-state')?.textContent).toContain('Saved');
  expect(document.querySelector<HTMLButtonElement>('[title="Undo · Ctrl+Z"]')?.disabled).toBe(true);
  const paragraph = document.querySelector<HTMLElement>('[data-ui-node=paragraph]')!;
  paragraph.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
  await tick();
  const field = document.querySelector<HTMLTextAreaElement>('[aria-label="Text content"]')!;
  expect(field).not.toBeNull();
  field.value = 'Edited composition body';
  field.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
  expect(
    [
      ...document.querySelectorAll<HTMLButtonElement>(
        '[aria-label="Composition navigation"] button',
      ),
    ].every((item) => item.disabled),
  ).toBe(true);
  field.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }),
  );
  await tick();
  expect(document.querySelector('.design-frame')?.textContent).toContain('Edited composition body');
  button('← Screen');
  await tick();
  expect(document.querySelector('[aria-label="Composition navigation"]')).toBeNull();
  expect(document.querySelector('.design-frame')?.textContent).not.toContain(
    'Edited composition body',
  );
  button('Save');
  await tick();
  const loaded = store.rawLoad();
  expect(loaded.status).toBe('loaded');
  if (loaded.status !== 'loaded') throw Error('Save failed');
  expect(loaded.document.nodes.copy).toMatchObject({
    content: { value: 'Edited composition body' },
  });
  expect(loaded.document.nodes.dialog).toEqual(source.nodes.dialog);
  const original = compileScreen(source),
    saved = compileScreen(loaded.document);
  expect(
    original.ok && saved.ok && original.plan.applicationVersion !== saved.plan.applicationVersion,
  ).toBe(true);
  button('Reopen');
  await tick();
  expect(document.querySelector('[aria-label="Composition navigation"]')).toBeNull();
});
