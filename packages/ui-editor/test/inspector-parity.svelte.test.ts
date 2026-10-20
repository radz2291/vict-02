import { expect, it } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import { fromStore, writable } from 'svelte/store';
import {
  UiEditSession,
  defaultSemanticElementCatalog,
  type UiDocument,
  type UiExtensionDescriptor,
} from '@victframework/ui';
import Inspector from '../src/Inspector.svelte';
import Composer from '../src/Composer.svelte';
import { detachedContent, detachSlotContent } from '../src/composition.js';
import type { TransactionDraft } from '../src/commands.js';
const source: UiDocument = {
  schema: 'vict.ui-document@1',
  id: 'parity',
  revision: '1',
  root: 'root',
  nodes: {
    root: { id: 'root', kind: 'element', tag: 'main', children: ['title'] },
    title: {
      id: 'title',
      kind: 'element',
      tag: 'h1',
      children: ['copy'],
      localStyle: [
        { property: 'padding', value: { type: 'text', value: '10px' } },
        { property: 'padding-top', value: { type: 'text', value: '12px' } },
        { property: 'margin-left', value: { type: 'text', value: '5px' } },
      ],
    },
    copy: { id: 'copy', kind: 'text', content: { type: 'literal', value: 'Title' } },
  },
  componentDefinitions: {},
  styleSources: {},
  tokens: { brand: { id: 'brand', value: '#2468ac' } },
  assets: {},
  conditions: {},
  localState: {},
};
function tab(target: HTMLElement, name: string) {
  const button = [...target.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(
    (button) => button.textContent === name,
  )!;
  if (button.getAttribute('aria-selected') !== 'true') button.click();
  flushSync();
}
function input(target: HTMLElement, label: string, value: string) {
  const field = target.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
  flushSync();
  return field;
}
function button(target: HTMLElement, name: string) {
  const found = [...target.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.textContent?.trim() === name,
  );
  expect(
    found,
    [...target.querySelectorAll('button')].map((button) => button.textContent).join('|'),
  ).toBeDefined();
  expect(found!.disabled).toBe(false);
  found!.click();
  flushSync();
}
function select(target: HTMLElement, label: string, value: string) {
  const field = target.querySelector<HTMLSelectElement>(`[aria-label="${label}"]`)!;
  field.value = value;
  field.dispatchEvent(new Event('change', { bubbles: true }));
  flushSync();
}
function mountInspector() {
  const target = document.createElement('div');
  document.body.append(target);
  const session = UiEditSession.open({ document: source, storedRevision: '1' });
  const editor = mount(Inspector, {
    target,
    props: {
      contextual: true,
      document: source,
      selectedOccurrence: 'parity|title',
      onApply: (draft: TransactionDraft) =>
        session.applyTransaction({ ...draft, expectedDocumentRevision: session.workingRevision })
          .ok,
    },
  });
  flushSync();
  return { target, session, editor };
}
it('resets a spacing group atomically while keeping unrelated styles and supports named values', async () => {
  const { target, session, editor } = mountInspector();
  try {
    tab(target, 'Rules');
    tab(target, 'Values & reset');
    select(target, 'Setting details', 'padding');
    button(target, 'Reset all padding');
    expect(session.document.nodes.title?.localStyle).toEqual([
      { property: 'margin-left', value: { type: 'text', value: '5px' } },
    ]);
    expect(session.undo().ok).toBe(true);
    expect(session.document.nodes).toEqual(source.nodes);
    select(target, 'Setting details', 'color');
    select(target, 'Named style value', 'brand');
    expect(session.document.nodes.title?.localStyle).toContainEqual({
      property: 'color',
      value: { type: 'token', id: 'brand' },
    });
    expect(session.undo().ok).toBe(true);
    expect(session.document.nodes).toEqual(source.nodes);
  } finally {
    await unmount(editor);
    target.remove();
  }
});
it('authors custom CSS and attributes through canonical commands and cancels attribute drafts', async () => {
  const { target, session, editor } = mountInspector();
  try {
    tab(target, 'Rules');
    tab(target, 'Custom');
    input(target, 'Custom CSS property', 'box-shadow');
    input(target, 'Custom CSS value', '0 1px 4px #0003');
    button(target, 'Apply CSS');
    expect(session.document.nodes.title?.localStyle).toContainEqual({
      property: 'box-shadow',
      value: { type: 'text', value: '0 1px 4px #0003' },
    });
    expect(session.undo().ok).toBe(true);
    input(target, 'Custom CSS property', 'text-decoration-color');
    select(target, 'Custom CSS source', 'token');
    select(target, 'Custom CSS token', 'brand');
    button(target, 'Apply CSS');
    expect(session.document.nodes.title?.localStyle).toContainEqual({
      property: 'text-decoration-color',
      value: { type: 'token', id: 'brand' },
    });
    expect(session.undo().ok).toBe(true);
    input(target, 'Custom CSS property', 'font-size');
    expect(target.textContent).toContain('already has a Format control');
    expect(target.querySelector('[aria-label="Custom CSS value"]')).toBeNull();
    tab(target, 'Attributes');
    input(target, 'Custom attribute name', 'aria-describedby');
    select(target, 'Custom attribute source', 'literal');
    const value = input(target, 'Custom attribute value', 'discard');
    value.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    flushSync();
    expect(
      session.document.nodes.title?.kind === 'element' && session.document.nodes.title.attributes,
    ).toBeUndefined();
    select(target, 'Custom attribute source', 'literal');
    input(target, 'Custom attribute value', 'help-text');
    button(target, 'Apply value');
    expect(session.document.nodes.title).toMatchObject({
      attributes: { 'aria-describedby': { type: 'literal', value: 'help-text' } },
    });
    expect(session.undo().ok).toBe(true);
    expect(session.document.nodes).toEqual(source.nodes);
  } finally {
    await unmount(editor);
    target.remove();
  }
});
const descriptor: UiExtensionDescriptor = {
  id: 'card',
  revision: '1',
  abi: 'vict.ui-component-abi@1',
  events: ['vict.ui-component-abi@1'],
  props: [],
  slots: ['body'],
  outputs: [],
  styleTargets: ['root'],
  rendererImplementationId: 'test.card',
};
const slotted: UiDocument = {
  ...source,
  nodes: {
    ...source.nodes,
    root: { id: 'root', kind: 'element', tag: 'main', children: ['card'] },
    card: {
      id: 'card',
      kind: 'component',
      definitionId: 'card',
      slots: { body: { name: 'body', children: ['title'] } },
    },
  },
};
it('detaches slot source without deletion and reuses the same subtree with independent undo steps', async () => {
  const session = UiEditSession.open({
    document: slotted,
    storedRevision: '1',
    catalogs: {
      elements: defaultSemanticElementCatalog(),
      extensions: [descriptor],
      actionIds: [],
    },
  });
  const draft = detachSlotContent('detach', session.document, 'title')!;
  expect(
    session.applyTransaction({ ...draft, expectedDocumentRevision: session.workingRevision }).ok,
  ).toBe(true);
  expect(session.document.nodes.title).toEqual(slotted.nodes.title);
  expect(detachedContent(session.document).map((node) => node.id)).toEqual(['title']);
  const target = document.createElement('div');
  document.body.append(target);
  let placed = '';
  const editor = mount(Composer, {
    target,
    props: {
      document: session.document,
      selectedNodeId: 'card',
      recipes: [],
      descriptors: [descriptor],
      compact: true,
      showArrange: false,
      onApply: (next: TransactionDraft) => {
        const result = session.applyTransaction({
          ...next,
          expectedDocumentRevision: session.workingRevision,
        });
        expect(result).toMatchObject({ ok: true });
        return result.ok;
      },
      onInserted: (id: string) => (placed = id),
    },
  });
  try {
    flushSync();
    tab(target, 'Reuse (1)');
    select(target, 'Kept content', 'title');
    button(target, 'Place content');
    expect(placed).toBe('title');
    expect(session.document.nodes.card).toMatchObject({ slots: { body: { children: ['title'] } } });
    expect(Object.keys(session.document.nodes)).toHaveLength(Object.keys(slotted.nodes).length);
    expect(session.undo().ok).toBe(true);
    expect(detachedContent(session.document).map((node) => node.id)).toEqual(['title']);
    expect(session.undo().ok).toBe(true);
    expect(session.document.nodes).toEqual(slotted.nodes);
  } finally {
    await unmount(editor);
    target.remove();
  }
});
it('excludes stored definition and template ownership from the reusable source list', () => {
  const owned: UiDocument = {
    ...source,
    nodes: {
      ...source.nodes,
      detached: { id: 'detached', kind: 'text', content: { type: 'literal', value: 'Kept' } },
      definition: { id: 'definition', kind: 'element', tag: 'div', children: [] },
      template: { id: 'template', kind: 'element', tag: 'div', children: [] },
      repeat: {
        id: 'repeat',
        kind: 'repeat',
        collection: { type: 'ref', path: 'view.rows' },
        itemName: 'row',
        key: { type: 'ref', path: 'repeat.row.id' },
        templateRoot: 'template',
      },
    },
    componentDefinitions: {
      definition: { id: 'definition', revision: '1', root: 'definition', props: [], slots: {} },
    },
  };
  expect(detachedContent(owned).map((node) => node.id)).toEqual(['detached']);
  expect(detachSlotContent('no', owned, 'title')).toBeUndefined();
});
it('selects the former slot parent when a live host updates source synchronously', async () => {
  const session = UiEditSession.open({
    document: slotted,
    storedRevision: '1',
    catalogs: {
      elements: defaultSemanticElementCatalog(),
      extensions: [descriptor],
      actionIds: [],
    },
  });
  const sourceStore = writable(session.document);
  const live = fromStore(sourceStore);
  const target = document.createElement('div');
  document.body.append(target);
  let selected = '';
  const editor = mount(Composer, {
    target,
    props: {
      get document() {
        return live.current;
      },
      selectedNodeId: 'title',
      recipes: [],
      descriptors: [descriptor],
      showInsert: false,
      onApply: (draft: TransactionDraft) => {
        const result = session.applyTransaction({
          ...draft,
          expectedDocumentRevision: session.workingRevision,
        });
        if (result.ok) sourceStore.set(session.document);
        return result.ok;
      },
      onDetached: (id: string) => (selected = id),
    },
  });
  try {
    flushSync();
    button(target, 'Keep aside');
    expect(selected).toBe('card');
    expect(detachedContent(session.document).map((node) => node.id)).toEqual(['title']);
  } finally {
    await unmount(editor);
    target.remove();
  }
});
it('shows parsed occurrence ownership and exact declared output payloads', async () => {
  const events = {
    ...descriptor,
    outputs: [
      { name: 'press', payload: 'void' as const, description: 'Activated' },
      { name: 'checkedChange', payload: 'boolean' as const, description: 'Toggled' },
    ],
  };
  const target = document.createElement('div');
  document.body.append(target);
  const editor = mount(Inspector, {
    target,
    props: {
      contextual: true,
      document: slotted,
      selectedOccurrence: 'parity|card|instance@definition|item-7|portal:portal-1:overlay-1',
      componentDescriptors: [events],
      onApply: () => true,
    },
  });
  try {
    flushSync();
    tab(target, 'Rules');
    tab(target, 'Details');
    for (const text of [
      'card',
      'instance@definition',
      'item-7',
      'portal-1',
      'overlay-1',
      'press',
      'void',
      'checkedChange',
      'boolean',
    ])
      expect(target.textContent).toContain(text);
    expect(target.querySelector('details')).toBeNull();
  } finally {
    await unmount(editor);
    target.remove();
  }
});
