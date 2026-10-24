// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { mount, unmount, tick, flushSync } from 'svelte';
vi.mock('$app/navigation', () => ({ beforeNavigate: () => {} }));
import Designer from '../../src/lib/designer/Designer.svelte';
import { newScreen } from '../../src/lib/designer/application.js';
import { screenStore } from '../../src/lib/designer/storage.js';
import { structureId } from '../../src/lib/designer/structure.js';
import type { UiDocument } from '@victframework/ui';

let editor: ReturnType<typeof mount> | undefined;
afterEach(async () => { if (editor) await unmount(editor); editor = undefined; document.body.innerHTML = ''; localStorage.clear(); });
async function settle() { flushSync(); await tick(); await tick(); }
function button(name: string) {
  const candidates = [...document.querySelectorAll<HTMLElement>('[role=menu][data-state=open] [role=menuitem]'), ...document.querySelectorAll<HTMLElement>('button')];
  const node = candidates.find(node => node.getAttribute('aria-label') === name || node.textContent?.trim() === name);
  expect(node, name).toBeDefined(); return node!;
}
async function click(name: string) { button(name).click(); await settle(); }
async function setup() {
  const base = newScreen('Context inspection', 'context-inspection');
  const source: UiDocument = { ...base, revision: 'r1.r1', nodes: {
    screen: { id: 'screen', kind: 'element', tag: 'main', children: ['first', 'second'] },
    first: { id: 'first', kind: 'element', tag: 'h1', children: ['first-text'] },
    'first-text': { id: 'first-text', kind: 'text', content: { type: 'literal', value: 'First heading' } },
    second: { id: 'second', kind: 'element', tag: 'h2', children: ['second-text'] },
    'second-text': { id: 'second-text', kind: 'text', content: { type: 'literal', value: 'Second heading' } },
  } };
  expect(screenStore(localStorage, source.id).save({ document: source, expectedStoredRevision: 'r1', newStoredRevision: source.revision }).ok).toBe(true);
  editor = mount(Designer, { target: document.body }); await settle(); return source;
}
function canvas(id: string) { return document.querySelector<HTMLElement>(`.design-frame [data-ui-node="${id}"]`)!; }
async function context(target: Element) { target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 100, clientY: 100 })); await settle(); }

it('targets the right-clicked object and opens the same Inspector below Layers and Structure without source edits', async () => {
  const source = await setup(); const frame = document.querySelector('.design-frame');
  await context(canvas('second'));
  expect(canvas('second').hasAttribute('data-ui-selected')).toBe(true);
  await click('Inspect');
  const inspector = document.querySelector<HTMLElement>('[aria-label="Document Inspector"]')!;
  expect(inspector.hidden).toBe(false); expect(inspector.querySelector('header strong')?.textContent).toBe('Second heading');
  expect(document.querySelector('.uv-layers')).not.toBeNull();
  expect(document.querySelector('[aria-label="Floating selection tools"]')).toBeNull();
  const splitter = document.querySelector<HTMLElement>('[aria-label="Inspector height"]')!;
  splitter.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true })); await settle();
  expect(splitter.getAttribute('aria-valuenow')).toBe('296');
  await click('Structure');
  expect(document.querySelector('[aria-label="Document Inspector"]')).toBe(inspector);
  const graph = document.querySelector('.svelte-flow'); expect(graph).not.toBeNull();
  expect(document.querySelector('.structure-details')).toBeNull();
  const node = [...document.querySelectorAll<HTMLElement>('.svelte-flow__node')].find(node => node.dataset.id === structureId(source.id, 'node', 'first'))!;
  node.click(); await settle();
  expect(inspector.querySelector('header strong')?.textContent).toBe('First heading');
  await click('Collapse Inspector'); expect(document.querySelector('[aria-label="Inspector height"]')).toBeNull();
  await click('Layers'); await click('Expand Inspector');
  expect(document.querySelector('[aria-label="Inspector height"]')?.getAttribute('aria-valuenow')).toBe('296');
  await click('Structure'); expect(document.querySelector('.svelte-flow')).toBe(graph);
  expect(document.querySelector('.design-frame')).toBe(frame);
  expect(document.querySelector('.save-state')?.textContent).toContain('Saved');
});

it('duplicates the actual context target through canonical history and Undo restores exact source', async () => {
  const source = await setup();
  await context(canvas('second')); await click('Duplicate');
  expect(document.querySelector('.save-state')?.textContent).toContain('Unsaved');
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true })); await settle();
  expect(document.querySelector('.save-state')?.textContent).toContain('Saved');
  await click('Document'); await click('Source');
  expect(JSON.parse(document.querySelector<HTMLTextAreaElement>('#canonical-source')!.value)).toEqual(source);
});

it('keeps secondary pointer selection from opening competing floating tools before the context event', async () => {
  await setup();
  canvas('second').dispatchEvent(new PointerEvent('pointerdown', { button: 2, bubbles: true, cancelable: true })); await settle();
  expect(document.querySelector('[aria-label="Floating selection tools"]')).toBeNull();
  await context(canvas('second'));
  expect(document.querySelector('[role=menu][data-state=open]')).not.toBeNull();
  expect(canvas('second').hasAttribute('data-ui-selected')).toBe(true);
});

it('supports keyboard context invocation and leaves Interact and native text editing menus alone', async () => {
  await setup();
  const target = document.querySelector<HTMLElement>('[aria-label="Canvas context commands"]')!;
  target.focus(); target.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true })); await settle();
  expect(button('Phone · 390')).toBeDefined();
  document.querySelector('[role=menu]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await settle();
  await click('Interact');
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); canvas('second').dispatchEvent(event); await settle();
  expect(event.defaultPrevented).toBe(false); expect(document.querySelector('[role=menu][data-state=open]')).toBeNull();
  await click('Design'); await context(canvas('first')); await click('Inspect'); await click('Content');
  const text = document.querySelector<HTMLTextAreaElement>('[aria-label="Text content"]')!;
  const native = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); text.dispatchEvent(native); await settle();
  expect(native.defaultPrevented).toBe(false); expect(document.querySelector('[role=menu][data-state=open]')).toBeNull();
});

it('keeps an Inspector text draft while refusing close, selection, menu mutations and tab changes', async () => {
  await setup(); await context(canvas('first')); await click('Inspect'); await click('Content');
  const text = document.querySelector<HTMLTextAreaElement>('[aria-label="Text content"]')!;
  expect(text).not.toBeNull(); text.value = 'Unapplied draft'; text.dispatchEvent(new Event('input', { bubbles: true })); await settle();
  expect((button('Close Inspector') as HTMLButtonElement).disabled).toBe(true);
  await click('Structure');
  expect(document.querySelector('.sidebar-tabs button[aria-pressed=true]')?.textContent).toBe('Layers');
  await context(canvas('second'));
  expect(document.querySelector('[role=menu][data-state=open]')).toBeNull(); expect(text.value).toBe('Unapplied draft');
  expect(canvas('first').hasAttribute('data-ui-selected')).toBe(true);
  text.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true })); await settle();
  expect(canvas('first').textContent).toBe('Unapplied draft');
  await click('Structure'); expect(document.querySelector('[aria-label="Document Inspector"]')).not.toBeNull();
});
