// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { mount, unmount, tick } from 'svelte';
import { canonicalUiDocument } from '@victframework/ui';
import StructureView from '../../src/lib/designer/StructureView.svelte';
import { newScreen } from '../../src/lib/designer/application.js';
import { structureId } from '../../src/lib/designer/structure.js';

let mounted: ReturnType<typeof mount> | undefined;
afterEach(async () => { if (mounted) await unmount(mounted); document.body.innerHTML = ''; });

it('mounts the real Flow canvas with navigation, shared source selection and no document mutation', async () => {
  const source = newScreen('Flow render', 'flow-render');
  const digest = canonicalUiDocument(source).contentDigest;
  const onSelect = vi.fn();
  const onMove = vi.fn(() => false);
  mounted = mount(StructureView, { target: document.body, props: { document: source, revision: 'working', onSelect, onMove, onNotice: vi.fn() } });
  await tick(); await tick();
  expect(document.querySelector('.svelte-flow')).not.toBeNull();
  expect(document.querySelector('.svelte-flow__controls')).not.toBeNull();
  // Small graphs reserve canvas area for readable cards; minimap appears above 12 items.
  expect(document.querySelector('.svelte-flow__minimap')).toBeNull();
  const selection = document.querySelector<HTMLSelectElement>('[aria-label="Structure source selection"]')!;
  selection.value = structureId(source.id, 'node', source.root);
  selection.dispatchEvent(new Event('change', { bubbles: true }));
  await tick();
  expect(onSelect).toHaveBeenCalledWith(`${source.id}|${source.root}`);
  expect(onMove).not.toHaveBeenCalled();
  expect(canonicalUiDocument(source).contentDigest).toBe(digest);
});

it('refuses selection and move enablement while the host has an unapplied draft', async () => {
  const source = newScreen('Draft refusal', 'draft-refusal');
  const onSelect = vi.fn();
  const onMove = vi.fn(() => false);
  const onNotice = vi.fn();
  mounted = mount(StructureView, { target: document.body, props: { document: source, revision: 'working', blocked: true, onSelect, onMove, onNotice } });
  await tick(); await tick();
  expect(document.querySelector<HTMLInputElement>('input[type="checkbox"]')?.disabled).toBe(true);
  const selection = document.querySelector<HTMLSelectElement>('[aria-label="Structure source selection"]')!;
  selection.value = structureId(source.id, 'node', source.root);
  selection.dispatchEvent(new Event('change', { bubbles: true }));
  await tick();
  expect(onSelect).not.toHaveBeenCalled();
  expect(onMove).not.toHaveBeenCalled();
  expect(onNotice).toHaveBeenCalledWith('Apply or cancel your draft before changing selection.');
});

it('hands declared state to Data without inventing a rendered selection or runtime value', async () => {
  const source = newScreen('State navigation', 'state-navigation');
  const onSelect = vi.fn(); const onNavigate = vi.fn();
  mounted = mount(StructureView, { target: document.body, props: { document: source, revision: 'working', onSelect, onMove: vi.fn(() => false), onNotice: vi.fn(), onNavigate } });
  await tick(); await tick();
  const selection = document.querySelector<HTMLSelectElement>('[aria-label="Structure source selection"]')!;
  selection.value = structureId(source.id, 'state', 'accepted');
  selection.dispatchEvent(new Event('change', { bubbles: true }));
  await tick();
  const button = [...document.querySelectorAll('button')].find(entry => entry.textContent === 'Open Data')!;
  button.click(); await tick();
  expect(onSelect).not.toHaveBeenCalled();
  expect(onNavigate).toHaveBeenCalledWith({ destination: 'data', sourceId: undefined, occurrence: undefined, key: 'accepted' });
  expect(document.querySelector('.structure-heading')?.textContent).toContain('Declared source relationships');
  expect(document.querySelector('.structure-facts')?.textContent).toContain('initial');
});

it('offers guarded containment moves through named keyboard controls, separate from relationship layers', async () => {
  const base = newScreen('Keyboard move', 'keyboard-move');
  const source = { ...base, nodes: {
    screen: { id: 'screen', kind: 'element' as const, tag: 'main', children: ['left', 'right'] },
    left: { id: 'left', kind: 'element' as const, tag: 'section', children: ['item'] },
    right: { id: 'right', kind: 'element' as const, tag: 'section', children: [] },
    item: { id: 'item', kind: 'text' as const, content: { type: 'literal' as const, value: 'Move this' } },
  } };
  const onMove = vi.fn(() => true);
  mounted = mount(StructureView, { target: document.body, props: { document: source, revision: 'working', onSelect: vi.fn(), onMove, onNotice: vi.fn() } });
  await tick(); await tick();
  const checkbox = [...document.querySelectorAll<HTMLInputElement>('input[type=checkbox]')].find(entry => entry.parentElement?.textContent?.includes('Move containment'))!;
  checkbox.click(); await tick();
  const content = document.querySelector<HTMLSelectElement>('[aria-label="Content to move"]')!;
  content.value = structureId(source.id, 'node', 'item'); content.dispatchEvent(new Event('change', { bubbles: true })); await tick();
  expect(content.value).toBe(structureId(source.id, 'node', 'item'));
  const target = document.querySelector<HTMLSelectElement>('[aria-label="Move destination"]')!;
  expect([...target.options].some(option => option.value === structureId(source.id, 'node', 'item'))).toBe(false);
  expect([...target.options].map(option => option.value)).toContain(structureId(source.id, 'node', 'right'));
  target.value = structureId(source.id, 'node', 'right'); target.dispatchEvent(new Event('change', { bubbles: true })); await tick();
  expect(target.value).toBe(structureId(source.id, 'node', 'right'));
  const moveButton = [...document.querySelectorAll<HTMLButtonElement>('button')].find(entry => entry.textContent === 'Move inside')!;
  expect(moveButton.disabled).toBe(false);
  moveButton.click(); await tick();
  expect(onMove).toHaveBeenCalledWith({ documentId: source.id, revision: 'working', source: structureId(source.id, 'node', 'item'), target: structureId(source.id, 'node', 'right') });
});
