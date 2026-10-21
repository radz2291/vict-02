import { expect, it, vi } from 'vitest';
import { mount, unmount, tick, flushSync } from 'svelte';
import {
  compileUiDocument,
  defaultSemanticElementCatalog,
  UiEditSession,
  type UiDocument,
  type UiRenderInstruction,
} from '@victframework/ui';
import { catalogDescriptors, catalogImplementations } from '@victframework/ui-svelte';
import {
  authoredOccurrence,
  compositionSlots,
  compositionMembers,
  compositionTrail,
  projectComposition,
} from '../src/composition-focus.js';
import EditorCanvas from '../src/EditorCanvas.svelte';
import Composer from '../src/Composer.svelte';
import Layers from '../src/Layers.svelte';
import type { TransactionDraft } from '../src/commands.js';

const source: UiDocument = {
  schema: 'vict.ui-document@1',
  id: 'focus',
  revision: '1',
  root: 'root',
  nodes: {
    root: {
      id: 'root',
      kind: 'element',
      tag: 'main',
      children: ['heading', 'dialog'],
      localStyle: [{ property: 'color', value: { type: 'text', value: '#123456' } }],
    },
    heading: {
      id: 'heading',
      kind: 'text',
      content: { type: 'literal', value: 'Outside the composition' },
    },
    dialog: {
      id: 'dialog',
      kind: 'component',
      definitionId: 'vict.catalog.dialog',
      props: {
        title: { type: 'literal', value: 'Details' },
        open: { type: 'literal', value: false },
      },
      slots: { body: { name: 'body', children: ['paragraph', 'nested', 'button'] } },
    },
    paragraph: { id: 'paragraph', kind: 'element', tag: 'p', children: ['copy'] },
    copy: {
      id: 'copy',
      kind: 'text',
      content: { type: 'literal', value: 'Editable hidden content' },
    },
    nested: {
      id: 'nested',
      kind: 'component',
      definitionId: 'vict.catalog.popover',
      props: { title: { type: 'literal', value: 'Nested preview' } },
      slots: { content: { name: 'content', children: ['nested-copy'] } },
    },
    'nested-copy': {
      id: 'nested-copy',
      kind: 'text',
      content: { type: 'literal', value: 'Deeper content' },
    },
    button: {
      id: 'button',
      kind: 'component',
      definitionId: 'vict.catalog.button',
      props: { label: { type: 'literal', value: 'Real adapter button' } },
    },
  },
  componentDefinitions: {},
  styleSources: {},
  tokens: {},
  assets: {},
  conditions: {},
  localState: {},
};
function plan(document = source) {
  const result = compileUiDocument(document, defaultSemanticElementCatalog(), catalogDescriptors);
  expect(result.ok).toBe(true);
  if (!result.ok) throw Error('Fixture did not compile');
  return result.plan;
}
function instructions(nodes: readonly UiRenderInstruction[]): UiRenderInstruction[] {
  return nodes.flatMap((node) => [
    node,
    ...(node.kind === 'element'
      ? instructions(node.children)
      : node.kind === 'extension'
        ? Object.values(node.slots ?? {}).flatMap(instructions)
        : []),
  ]);
}

it('projects the same canonical slot instructions without changing source, state, digest or full plan', () => {
  const full = plan();
  const before = JSON.stringify([source, full]);
  const focused = projectComposition(
    full,
    source,
    { nodeId: 'dialog', slotName: 'body' },
    catalogDescriptors,
  )!;
  const list = instructions(focused.structure);
  expect(list.some((node) => node.nodeId === 'heading')).toBe(false);
  expect(list.find((node) => node.nodeId === 'paragraph')).toEqual(
    instructions(full.structure).find((node) => node.nodeId === 'paragraph'),
  );
  expect(list.find((node) => node.nodeId === 'nested')?.kind).toBe('element');
  expect(list.some((node) => node.nodeId === 'nested-copy')).toBe(false);
  expect(list.find((node) => node.nodeId === 'button')?.kind).toBe('extension');
  expect(focused.sourceDigest).toBe(full.sourceDigest);
  expect(focused.style).toBe(full.style);
  expect(JSON.stringify([source, full])).toBe(before);
  expect(authoredOccurrence(source, 'nested-copy')).toBe(
    'focus|nested-copy|dialog@vict.catalog.dialog|nested@vict.catalog.popover',
  );
  expect(compositionTrail(source, { nodeId: 'nested', slotName: 'content' })).toEqual([
    { nodeId: 'dialog', slotName: 'body' },
    { nodeId: 'nested', slotName: 'content' },
  ]);
  expect(
    compositionMembers(source, { nodeId: 'dialog', slotName: 'body' }).has('nested-copy'),
  ).toBe(true);
  expect(
    projectComposition(full, source, { nodeId: 'dialog', slotName: 'missing' }, catalogDescriptors),
  ).toBeUndefined();
});

it('does not expose detached or definition/template-owned source as directly authored compositions', () => {
  const detached = {
    ...source,
    nodes: { ...source.nodes, root: { ...source.nodes.root, children: ['heading'] } },
  } as UiDocument;
  expect(compositionSlots(detached, 'dialog', catalogDescriptors)).toEqual([]);
  expect(authoredOccurrence(detached, 'dialog')).toBeUndefined();
});

it('renders editable closed contents using the real renderer and leaf adapters, without popup side effects', async () => {
  const target = document.createElement('div');
  document.body.append(target);
  const open = vi.fn();
  const dispatch = vi.fn(async () => ({ ok: true }));
  const editor = mount(EditorCanvas, {
    target,
    props: {
      document: source,
      extensions: catalogDescriptors,
      extensionImplementations: catalogImplementations,
      interactionMode: 'design',
      compositionFocus: { nodeId: 'dialog', slotName: 'body' },
      onOpenComposition: open,
      onSelect: () => {},
      dispatch,
      navigate: () => {},
    },
  });
  try {
    flushSync();
    await tick();
    expect(target.textContent).toContain('Editable hidden content');
    expect(target.textContent).not.toContain('Outside the composition');
    expect(target.querySelector('[data-testid=dialog-panel]')).toBeNull();
    expect(target.querySelector('[data-testid=catalog-button]')).not.toBeNull();
    const tile = target.querySelector<HTMLElement>('.uv-composition-tile')!;
    tile.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    expect(open).toHaveBeenCalledWith('focus|nested|dialog@vict.catalog.dialog');
    expect(dispatch).not.toHaveBeenCalled();
    expect(document.body.style.pointerEvents).not.toBe('none');
  } finally {
    await unmount(editor);
    target.remove();
  }
});

it('scopes insertion to the open composition and preserves one-step canonical undo', async () => {
  const session = UiEditSession.open({
    document: source,
    storedRevision: '1',
    catalogs: { elements: defaultSemanticElementCatalog(), extensions: catalogDescriptors },
  });
  const target = document.createElement('div');
  document.body.append(target);
  const editor = mount(Composer, {
    target,
    props: {
      document: source,
      selectedNodeId: 'dialog',
      compositionFocus: { nodeId: 'dialog', slotName: 'body' },
      descriptors: catalogDescriptors,
      compact: true,
      recipes: [
        {
          id: 'text',
          label: 'Text',
          description: 'Add',
          create: (id: string) => [
            { id, kind: 'text', content: { type: 'literal', value: 'Inserted here' } },
          ],
        },
      ],
      onApply: (draft: TransactionDraft) =>
        session.applyTransaction({ ...draft, expectedDocumentRevision: session.workingRevision })
          .ok,
    },
  });
  try {
    flushSync();
    const destination = target.querySelector<HTMLSelectElement>(
      '[aria-label="Insertion destination"]',
    )!;
    expect([...destination.options].some((option) => option.textContent === 'Inside Screen')).toBe(
      false,
    );
    expect(
      [...destination.options].some((option) => ['before', 'after'].includes(option.value)),
    ).toBe(false);
    target.querySelector<HTMLButtonElement>('button.recipe')!.click();
    flushSync();
    expect(session.document.nodes.dialog).toMatchObject({
      slots: { body: { children: expect.arrayContaining(['paragraph', 'nested', 'button']) } },
    });
    const node = session.document.nodes.dialog!;
    expect(node.kind === 'component' && node.slots?.body?.children).toHaveLength(4);
    expect(session.undo().ok).toBe(true);
    expect(session.document.nodes).toEqual(source.nodes);
  } finally {
    await unmount(editor);
    target.remove();
  }
});

it('lists declared empty and closed slots in Structure with a source-addressed editing action', async () => {
  const target = document.createElement('div');
  document.body.append(target);
  const open = vi.fn();
  const editor = mount(Layers, {
    target,
    props: {
      document: source,
      plan: plan(),
      componentDescriptors: catalogDescriptors,
      onOpenComposition: open,
    },
  });
  try {
    flushSync();
    const expand = [...target.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.getAttribute('aria-label') === 'Expand Details',
    )!;
    expand.click();
    flushSync();
    const body = [...target.querySelectorAll<HTMLButtonElement>('[role=treeitem]')].find((button) =>
      button.textContent?.includes('Body · composition'),
    )!;
    expect(body).toBeDefined();
    body.click();
    expect(open).toHaveBeenCalledWith({ nodeId: 'dialog', slotName: 'body' });
  } finally {
    await unmount(editor);
    target.remove();
  }
});
