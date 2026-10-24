// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { mount, unmount, tick } from 'svelte';
import { canonicalUiDocument } from '@victframework/ui';
import StructureView from '../../src/lib/designer/StructureView.svelte';
import { newScreen } from '../../src/lib/designer/application.js';
import { structureId } from '../../src/lib/designer/structure.js';

let mounted: ReturnType<typeof mount> | undefined;
afterEach(async () => { if (mounted) await unmount(mounted); mounted = undefined; document.body.innerHTML = ''; });
const button = (name: string) => {
  const found = [...document.querySelectorAll<HTMLElement>('button,[role="menuitem"]')].find(item => item.getAttribute('aria-label') === name || item.textContent?.trim() === name);
  expect(found, name).toBeDefined(); return found!;
};
async function menu(name: string) {
  const trigger = [...document.querySelectorAll<HTMLElement>('.structure-tools [role="menubar"] > button')].find(item => item.textContent === name)!;
  expect(trigger).toBeDefined();
  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await tick(); await tick();
}
async function find(id: string) {
  await menu('View'); button('Find source item').click(); await tick();
  const field = document.querySelector<HTMLSelectElement>('[aria-label="Structure source selection"]')!;
  field.value = id; field.dispatchEvent(new Event('change', { bubbles: true })); await tick();
}

it('keeps inspection closed and the camera/search stable during ordinary source selection', async () => {
  const source = newScreen('Flow render', 'flow-render');
  const digest = canonicalUiDocument(source).contentDigest;
  const onSelect = vi.fn(); const onMove = vi.fn(() => false);
  mounted = mount(StructureView, { target: document.body, props: { document: source, revision: 'working', onSelect, onMove, onNotice: vi.fn() } });
  await tick(); await tick();
  expect(document.querySelector('.svelte-flow')).not.toBeNull();
  expect(document.querySelectorAll('.svelte-flow__controls-fitview')).toHaveLength(1);
  expect(document.querySelector('.structure-details')).toBeNull();
  const search = document.querySelector<HTMLInputElement>('[aria-label="Search structure"]')!;
  search.value = 'screen'; search.dispatchEvent(new Event('input', { bubbles: true })); await tick();
  const viewport = document.querySelector<HTMLElement>('.svelte-flow__viewport')!;
  const transform = viewport.style.transform;
  document.querySelector<HTMLElement>('.svelte-flow__node')!.click(); await tick(); await tick();
  expect(onSelect).toHaveBeenCalledWith(`${source.id}|${source.root}`);
  expect(viewport.style.transform).toBe(transform);
  expect(search.value).toBe('screen');
  expect(document.querySelector('.structure-details')).toBeNull();
  expect(onMove).not.toHaveBeenCalled();
  expect(canonicalUiDocument(source).contentDigest).toBe(digest);
});

it('opens inspection deliberately and Escape closes it with focus restored, preserving shared selection', async () => {
  const source = newScreen('Disclosure', 'disclosure'); const onSelect = vi.fn();
  mounted = mount(StructureView, { target: document.body, props: { document: source, revision: 'working', onSelect, onMove: vi.fn(() => false), onNotice: vi.fn() } });
  await tick(); await tick();
  button('Inspect structure').click(); await tick();
  expect(document.querySelector('.structure-details')).not.toBeNull();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await tick();
  expect(document.querySelector('.structure-details')).toBeNull();
  expect(document.activeElement).toBe(button('Inspect structure'));
  expect(onSelect).not.toHaveBeenCalled();
});

it('refuses source navigation and contextual moves while the host has an unapplied draft', async () => {
  const source = newScreen('Draft refusal', 'draft-refusal');
  const onSelect = vi.fn(); const onMove = vi.fn(() => false); const onNotice = vi.fn();
  mounted = mount(StructureView, { target: document.body, props: { document: source, revision: 'working', blocked: true, onSelect, onMove, onNotice } });
  await tick(); await tick();
  await find(structureId(source.id, 'node', source.root));
  expect(onSelect).not.toHaveBeenCalled(); expect(onMove).not.toHaveBeenCalled();
  expect(onNotice).toHaveBeenCalledWith('Apply or cancel your draft before changing selection.');
  await menu('Object');
  expect(button('Move inside…').getAttribute('aria-disabled')).toBe('true');
});

it('hands declared state to Data and shows source facts without inventing runtime values', async () => {
  const source = newScreen('State navigation', 'state-navigation'); const onSelect = vi.fn(); const onNavigate = vi.fn();
  mounted = mount(StructureView, { target: document.body, props: { document: source, revision: 'working', onSelect, onMove: vi.fn(() => false), onNotice: vi.fn(), onNavigate } });
  await tick(); await tick();
  await find(structureId(source.id, 'state', 'accepted'));
  button('Properties').click(); await tick(); button('Edit in Data').click(); await tick();
  expect(onSelect).not.toHaveBeenCalled();
  expect(onNavigate).toHaveBeenCalledWith({ destination: 'data', sourceId: undefined, occurrence: undefined, key: 'accepted' });
  expect(document.querySelector('.structure-facts')?.textContent).toContain('initial');
});

it('offers guarded contextual moves through named keyboard controls and exits move mode on acknowledgement', async () => {
  const base = newScreen('Keyboard move', 'keyboard-move');
  const source = { ...base, nodes: {
    screen: { id: 'screen', kind: 'element' as const, tag: 'main', children: ['left', 'right'] },
    left: { id: 'left', kind: 'element' as const, tag: 'section', children: ['item'] },
    right: { id: 'right', kind: 'element' as const, tag: 'section', children: [] },
    item: { id: 'item', kind: 'text' as const, content: { type: 'literal' as const, value: 'Move this' } },
  } };
  const onMove = vi.fn(() => true);
  mounted = mount(StructureView, { target: document.body, props: { document: source, revision: 'working', onSelect: vi.fn(), onMove, onNotice: vi.fn() } });
  await tick(); await tick(); await find(structureId(source.id, 'node', 'item'));
  await menu('Object'); button('Move inside…').click(); await tick();
  const content = document.querySelector<HTMLSelectElement>('[aria-label="Content to move"]')!;
  expect(content.value).toBe(structureId(source.id, 'node', 'item'));
  const target = document.querySelector<HTMLSelectElement>('[aria-label="Move destination"]')!;
  expect([...target.options].some(option => option.value === structureId(source.id, 'node', 'item'))).toBe(false);
  expect([...target.options].map(option => option.value)).toContain(structureId(source.id, 'node', 'right'));
  target.value = structureId(source.id, 'node', 'right'); target.dispatchEvent(new Event('change', { bubbles: true })); await tick();
  expect((button('Move') as HTMLButtonElement).disabled).toBe(false);
  button('Move').click(); await tick();
  expect(onMove).toHaveBeenCalledWith({ documentId: source.id, revision: 'working', source: structureId(source.id, 'node', 'item'), target: structureId(source.id, 'node', 'right') });
  expect(document.querySelector('[aria-label="Move destination"]')).toBeNull();
});
