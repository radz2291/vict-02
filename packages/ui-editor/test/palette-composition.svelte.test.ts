import { expect, it } from 'vitest';
import { createRawSnippet, flushSync, mount, tick, unmount } from 'svelte';
import {
  UiEditSession,
  defaultSemanticElementCatalog,
  type UiDocument,
  type UiExtensionDescriptor,
} from '@victframework/ui';
import SelectionPalette from '../src/SelectionPalette.svelte';
import Composer from '../src/Composer.svelte';
import type { TransactionDraft } from '../src/commands.js';
const source: UiDocument = {
  schema: 'vict.ui-document@1',
  id: 'palette',
  revision: '1',
  root: 'root',
  nodes: {
    root: { id: 'root', kind: 'element', tag: 'main', children: ['title'] },
    title: { id: 'title', kind: 'element', tag: 'h1', children: ['copy'] },
    copy: { id: 'copy', kind: 'text', content: { type: 'literal', value: 'Title' } },
  },
  componentDefinitions: {},
  tokens: {},
  assets: {},
  localState: {},
  conditions: {},
  styleSources: {},
};
const recipes = [
  {
    id: 'text',
    label: 'Text',
    description: 'Insert text',
    create: (id: string) => [
      { id, kind: 'text' as const, content: { type: 'literal' as const, value: 'New copy' } },
    ],
  },
];
it('provides named tool pages with roving keyboard focus and stable selection context', async () => {
  const target = document.createElement('div');
  document.body.append(target);
  const snippet = (text: string) =>
    createRawSnippet(() => ({ render: () => `<span>${text}</span>` }));
  const palette = mount(SelectionPalette, {
    target,
    props: {
      name: 'Title',
      format: snippet('Formatting'),
      insert: snippet('Insertion'),
      arrange: snippet('Arrangement'),
    },
  });
  try {
    flushSync();
    const tabs = target.querySelectorAll<HTMLButtonElement>('[role=tab]');
    expect([...tabs].map((t) => t.textContent)).toEqual(['Format', 'Insert', 'Arrange']);
    tabs[0]!.focus();
    tabs[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await tick();
    expect(document.activeElement).toBe(tabs[1]);
    expect(target.querySelector('[role=tabpanel]')?.textContent).toBe('Insertion');
    tabs[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    await tick();
    expect(tabs[2]!.getAttribute('aria-selected')).toBe('true');
    expect(target.textContent).toContain('Title');
  } finally {
    await unmount(palette);
    target.remove();
  }
});
it('uses one explicit insertion destination and creates an undoable sibling after the selection', async () => {
  const target = document.createElement('div');
  document.body.append(target);
  const session = UiEditSession.open({ document: source, storedRevision: '1' });
  let inserted = '';
  const composer = mount(Composer, {
    target,
    props: {
      document: source,
      selectedNodeId: 'title',
      recipes,
      compact: true,
      showArrange: false,
      onApply: (draft: TransactionDraft) =>
        session.applyTransaction({ ...draft, expectedDocumentRevision: session.workingRevision })
          .ok,
      onInserted: (id: string) => (inserted = id),
    },
  });
  try {
    flushSync();
    expect(target.querySelectorAll('select')).toHaveLength(1);
    const destination = target.querySelector('select')!;
    expect(destination.selectedOptions[0]?.textContent).toBe('After Heading · Title');
    target.querySelector('button')!.click();
    flushSync();
    expect(session.document.nodes.root).toMatchObject({ children: ['title', inserted] });
    expect(session.undo().ok).toBe(true);
    expect(session.document.nodes).toEqual(source.nodes);
  } finally {
    await unmount(composer);
    target.remove();
  }
});
it('requires a choice for multi-slot owners and preserves declared slot ownership', async () => {
  const descriptor: UiExtensionDescriptor = {
    id: 'card',
    revision: '1',
    abi: 'vict.ui-component-abi@1',
    events: ['vict.ui-component-abi@1'],
    props: [],
    slots: ['header', 'body'],
    outputs: [],
    styleTargets: ['root'],
    rendererImplementationId: 'test.renderer',
  };
  const documentSource: UiDocument = {
    ...source,
    nodes: {
      ...source.nodes,
      root: { id: 'root', kind: 'element', tag: 'main', children: ['title', 'card'] },
      card: { id: 'card', kind: 'component', definitionId: 'card' },
    },
  };
  const session = UiEditSession.open({
    document: documentSource,
    storedRevision: '1',
    catalogs: {
      elements: defaultSemanticElementCatalog(),
      extensions: [descriptor],
      actionIds: [],
    },
  });
  const target = document.createElement('div');
  document.body.append(target);
  let inserted = '';
  const composer = mount(Composer, {
    target,
    props: {
      document: documentSource,
      selectedNodeId: 'card',
      recipes,
      compact: true,
      showArrange: false,
      descriptors: [descriptor],
      onApply: (draft: TransactionDraft) =>
        session.applyTransaction({ ...draft, expectedDocumentRevision: session.workingRevision })
          .ok,
      onInserted: (id: string) => (inserted = id),
    },
  });
  try {
    flushSync();
    const button = target.querySelector('button')!;
    expect(button.disabled).toBe(true);
    const select = target.querySelector('select')!;
    select.value = JSON.stringify(['card', 'body']);
    select.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();
    expect(button.disabled).toBe(false);
    button.click();
    flushSync();
    expect(session.document.nodes.card).toMatchObject({
      slots: { body: { children: [inserted] } },
    });
  } finally {
    await unmount(composer);
    target.remove();
  }
});

it('includes an optional Connect page in keyboard navigation without changing the three-page default', async () => {
  const target = document.createElement('div');
  document.body.append(target);
  const snippet = createRawSnippet(() => ({ render: () => '<span>Tools</span>' }));
  const palette = mount(SelectionPalette, {
    target,
    props: {
      name: 'Button',
      format: snippet,
      insert: snippet,
      arrange: snippet,
      connect: snippet,
    },
  });
  try {
    flushSync();
    const tabs = target.querySelectorAll<HTMLButtonElement>('[role=tab]');
    expect(tabs).toHaveLength(4);
    tabs[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    await tick();
    expect(document.activeElement).toBe(tabs[3]);
    expect(tabs[3]!.textContent).toBe('Connect');
    tabs[3]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await tick();
    expect(document.activeElement).toBe(tabs[0]);
  } finally {
    await unmount(palette);
    target.remove();
  }
});
