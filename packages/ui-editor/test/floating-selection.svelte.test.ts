import { expect, it, vi } from 'vitest';
import { mount, unmount, tick, flushSync, createRawSnippet } from 'svelte';
import type { UiDocument } from '@victframework/ui';
import { catalogDescriptors, catalogImplementations } from '@victframework/ui-svelte';
import EditorCanvas from '../src/EditorCanvas.svelte';
import FloatingSelection from '../src/FloatingSelection.svelte';

it('anchors tools to selection, dismisses outside, and restores keyboard focus without authoring', async () => {
  const source: UiDocument = {
    schema: 'vict.ui-document@1',
    id: 'floating',
    revision: '1',
    root: 'root',
    nodes: {
      root: { id: 'root', kind: 'element', tag: 'main', children: ['title'] },
      title: { id: 'title', kind: 'element', tag: 'h1', children: ['text'] },
      text: { id: 'text', kind: 'text', content: { type: 'literal', value: 'Title' } },
    },
    componentDefinitions: {},
    styleSources: {},
    tokens: {},
    assets: {},
    localState: {},
    conditions: {},
  };
  const bounds = vi
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockImplementation(function (this: HTMLElement) {
      const palette = this.classList.contains('floating-selection');
      return {
        left: 100,
        top: 200,
        right: palette ? 580 : 400,
        bottom: palette ? 240 : 230,
        width: palette ? 480 : 300,
        height: palette ? 40 : 30,
        x: 100,
        y: 200,
        toJSON: () => ({}),
      };
    });
  const target = document.createElement('div');
  document.body.append(target);
  const canvas = mount(EditorCanvas, {
    target,
    props: {
      document: source,
      selectedOccurrence: 'floating|title',
      interactionMode: 'design',
      onSelect: () => {},
      dispatch: async () => {},
      navigate: () => {},
      selectionTools: createRawSnippet(() => ({
        render: () => '<button type="button">Format selection</button>',
      })),
    },
  });
  try {
    flushSync();
    await tick();
    await vi.waitFor(() =>
      expect(document.querySelector<HTMLElement>('.floating-selection')?.style.visibility).toBe(
        'visible',
      ),
    );
    const palette = document.querySelector<HTMLElement>('.floating-selection')!;
    expect(palette.style.top).toBe('150px');
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    flushSync();
    expect(palette.style.visibility).toBe('hidden');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', cancelable: true }));
    await tick();
    expect(document.activeElement?.textContent).toBe('Format selection');
    expect(palette.style.visibility).toBe('visible');
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    flushSync();
    expect(palette.style.visibility).toBe('hidden');
    expect(document.activeElement).toBe(target.querySelector('.uv-canvas'));
    expect(source.nodes.text).toEqual({
      id: 'text',
      kind: 'text',
      content: { type: 'literal', value: 'Title' },
    });
  } finally {
    await unmount(canvas);
    target.remove();
    bounds.mockRestore();
  }
});
it('keeps tools available for closed slot content by anchoring to its visible owner', async () => {
  const canvas = document.createElement('div');
  const owner = document.createElement('div');
  owner.dataset.uiOwnerRoot = 'slot-owner';
  const trigger = document.createElement('button');
  trigger.dataset.uiOwner = 'slot-owner';
  trigger.dataset.uiOcc = 'doc|dialog';
  owner.append(trigger);
  canvas.append(owner);
  document.body.append(canvas);
  const bounds = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 100,
    right: 400,
    top: 250,
    bottom: 290,
    width: 300,
    height: 40,
    x: 100,
    y: 250,
    toJSON: () => ({}),
  });
  const tools = mount(FloatingSelection, {
    target: canvas,
    props: {
      canvas,
      occurrence: 'doc|body-text',
      fallbackOccurrences: ['doc|dialog'],
      children: createRawSnippet(() => ({ render: () => '<button>Body text tools</button>' })),
    },
  });
  try {
    flushSync();
    await tick();
    await vi.waitFor(() =>
      expect(document.querySelector<HTMLElement>('.floating-selection')?.style.visibility).toBe(
        'visible',
      ),
    );
    expect(document.querySelector('.floating-selection')?.textContent).toContain('Body text tools');
    expect(document.querySelector('[aria-label="Hide tools"]')).not.toBeNull();
  } finally {
    await unmount(tools);
    canvas.remove();
    bounds.mockRestore();
  }
});

it('anchors a closed catalog slot occurrence selected through Layers to its visible owner', async () => {
  const source: UiDocument = {
    schema: 'vict.ui-document@1',
    id: 'closed',
    revision: '1',
    root: 'root',
    nodes: {
      root: { id: 'root', kind: 'element', tag: 'main', children: ['dialog'] },
      dialog: {
        id: 'dialog',
        kind: 'component',
        definitionId: 'vict.catalog.dialog',
        props: {
          title: { type: 'literal', value: 'Details' },
          open: { type: 'literal', value: false },
        },
        slots: { body: { name: 'body', children: ['copy'] } },
      },
      copy: { id: 'copy', kind: 'text', content: { type: 'literal', value: 'Hidden content' } },
    },
    componentDefinitions: {},
    styleSources: {},
    tokens: {},
    assets: {},
    localState: {},
    conditions: {},
  };
  const bounds = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 100,
    right: 400,
    top: 250,
    bottom: 290,
    width: 300,
    height: 40,
    x: 100,
    y: 250,
    toJSON: () => ({}),
  });
  const target = document.createElement('div');
  document.body.append(target);
  const canvas = mount(EditorCanvas, {
    target,
    props: {
      document: source,
      selectedOccurrence: 'closed|copy|dialog@vict.catalog.dialog',
      interactionMode: 'design',
      extensions: catalogDescriptors,
      extensionImplementations: catalogImplementations,
      onSelect: () => {},
      dispatch: async () => {},
      navigate: () => {},
      selectionTools: createRawSnippet(() => ({
        render: () => '<button>Hidden slot tools</button>',
      })),
    },
  });
  try {
    flushSync();
    await tick();
    await vi.waitFor(() =>
      expect(document.querySelector<HTMLElement>('.floating-selection')?.style.visibility).toBe(
        'visible',
      ),
    );
    expect(target.textContent).not.toContain('Hidden content');
  } finally {
    await unmount(canvas);
    target.remove();
    bounds.mockRestore();
  }
});
