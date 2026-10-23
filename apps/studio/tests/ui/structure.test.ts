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
  expect(document.querySelector('.svelte-flow__minimap')).not.toBeNull();
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
