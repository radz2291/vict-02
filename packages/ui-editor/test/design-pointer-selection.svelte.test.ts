import { mount, unmount, flushSync, tick } from 'svelte';
import { expect, it, vi } from 'vitest';
import type { UiDocument } from '@victframework/ui';
import EditorCanvas from '../src/EditorCanvas.svelte';
import { flowAuthoringPackage, flowAuthoringImplementations } from '../../ui-flow-svelte/src/authoring/index.js';

function source(): UiDocument {
  const seed = flowAuthoringPackage.registrations.find(entry => entry.descriptor.id === 'vict.flow.canvas')!.seed!;
  return { schema: 'vict.ui-document@1', id: 'pointer-selection', revision: '1', root: seed.root,
    nodes: Object.fromEntries(seed.nodes.map(node => [node.id, node])), componentDefinitions: {},
    localState: {}, styleSources: {}, conditions: {}, tokens: {}, assets: {} };
}

it('keeps the exact Flow declaration selected when layout retargets the same gesture click to its canvas', async () => {
  const target = document.createElement('div');
  document.body.append(target);
  const selected = vi.fn();
  const dispatch = vi.fn(async () => undefined);
  const instance = mount(EditorCanvas, { target, props: {
    document: source(), interactionMode: 'design', onSelect: selected, dispatch, navigate: () => undefined,
    extensions: flowAuthoringPackage.registrations.map(entry => entry.descriptor), extensionImplementations: flowAuthoringImplementations,
  } });
  try {
    flushSync(); await tick(); flushSync(); await tick();
    await vi.waitFor(() => expect(target.querySelector('.vict-authored-flow-node strong')).not.toBeNull());
    const label = target.querySelector('.vict-authored-flow-node strong')!;
    const canvas = target.querySelector('section[data-ui-node="canvas"]')!;
    const childOccurrence = 'pointer-selection|start|canvas@vict.flow.canvas';
    expect(label.closest<HTMLElement>('[data-ui-occ]')?.dataset.uiOcc).toBe(childOccurrence);
    label.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1 }));
    canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
    expect(selected.mock.calls.map(([occurrence]) => occurrence)).toEqual([childOccurrence]);
    expect(dispatch).not.toHaveBeenCalled();
    // A subsequent pointer gesture on the canvas must still select it.
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1 }));
    canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
    expect(selected.mock.calls.at(-1)?.[0]).toBe('pointer-selection|canvas');
    // Accessibility/programmatic click without a pointerdown retains selection.
    label.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(selected.mock.calls.at(-1)?.[0]).toBe(childOccurrence);
  } finally { await unmount(instance); target.remove(); }
});
