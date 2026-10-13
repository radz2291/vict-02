import { describe, expect, it } from 'vitest';
import {
  UiEditSession,
  defaultSemanticElementCatalog,
  type UiDocument,
  type UiEditCommand,
} from '../src/index.js';

function fixture(): UiDocument {
  return {
    schema: 'vict.ui-document@1',
    id: 'compose',
    revision: 'r1',
    root: 'root',
    nodes: {
      root: { kind: 'element', id: 'root', tag: 'main', children: ['a', 'b', 'dialog'] },
      a: { kind: 'element', id: 'a', tag: 'section', children: ['text'] },
      text: { kind: 'text', id: 'text', content: { type: 'literal', value: 'Owned content' } },
      b: { kind: 'element', id: 'b', tag: 'section', children: [] },
      dialog: { kind: 'component', id: 'dialog', definitionId: 'dialog', slots: {} },
    },
    componentDefinitions: {
      dialog: { id: 'dialog', revision: '1', root: 'body', props: [], slots: { content: {} } },
    },
    styleSources: {},
    tokens: {},
    conditions: {},
    assets: {},
    localState: {},
  } as UiDocument;
}
function session() {
  const document = fixture();
  return UiEditSession.open({
    document: {
      ...document,
      nodes: {
        ...document.nodes,
        body: { kind: 'element', id: 'body', tag: 'section', children: ['slot'] },
        slot: { kind: 'slot', id: 'slot', name: 'content' },
      },
    },
    storedRevision: 'r1',
    catalogs: { elements: defaultSemanticElementCatalog() },
  });
}
function apply(editor: UiEditSession, commands: readonly UiEditCommand[]) {
  return editor.applyTransaction({
    requestId: crypto.randomUUID(),
    expectedDocumentRevision: editor.workingRevision,
    commands,
  });
}
describe('composition ownership transactions', () => {
  it('retains registered slots and action authority after reopening stored source', () => {
    const initial = fixture();
    const document: UiDocument = {
      ...initial,
      componentDefinitions: {},
      nodes: {
        ...initial.nodes,
        dialog: { id: 'dialog', kind: 'component', definitionId: 'test.dialog' },
      },
    };
    const editor = UiEditSession.open({
      document,
      storedRevision: 'r1',
      catalogs: {
        elements: defaultSemanticElementCatalog(),
        actionIds: ['allowed'],
        extensions: [
          {
            id: 'test.dialog',
            revision: '1',
            props: [],
            abi: 'vict.ui-component-abi@1',
            events: ['vict.ui-component-abi@1'],
            slots: ['body'],
            outputs: [],
            styleTargets: ['root'],
            rendererImplementationId: 'test.renderer',
          },
        ],
      },
    }).reopen({ document, storedRevision: 'r1' });
    expect(
      apply(editor, [
        {
          op: 'insert',
          parentId: 'dialog',
          slotName: 'missing',
          node: { id: 'bad', kind: 'text', content: { type: 'literal', value: 'Bad' } },
        },
      ]).ok,
    ).toBe(false);
    expect(
      apply(editor, [
        {
          op: 'insert',
          parentId: 'dialog',
          slotName: 'body',
          node: { id: 'new', kind: 'text', content: { type: 'literal', value: 'New' } },
        },
      ]).ok,
    ).toBe(true);
    expect(editor.document.nodes.dialog).toMatchObject({ slots: { body: { children: ['new'] } } });
    expect(editor.undo().ok).toBe(true);
    expect(
      apply(editor, [
        {
          op: 'connectInteraction',
          nodeId: 'a',
          interaction: { on: 'click', action: 'invokeAction', actionId: 'undeclared' },
        },
      ]).ok,
    ).toBe(false);
  });
  it('applies agent source with the same history and refuses identity/schema changes and broken structure', () => {
    const editor = session();
    const before = editor.document;
    const next = {
      ...before,
      localState: {
        agentValue: { key: 'agentValue', type: 'string' as const, initial: 'Shared source' },
      },
    };
    expect(apply(editor, [{ op: 'replaceDocument', document: next }]).ok).toBe(true);
    expect(editor.document.localState.agentValue?.initial).toBe('Shared source');
    expect(editor.undo().ok).toBe(true);
    expect(editor.document).toEqual(before);
    expect(editor.redo().ok).toBe(true);
    for (const document of [
      { ...next, id: 'another' },
      { ...next, revision: 'rewound' },
      { ...next, root: 'missing' },
      { ...next, nodes: undefined },
    ]) {
      const current = editor.document;
      expect(
        apply(editor, [{ op: 'replaceDocument', document: document as unknown as UiDocument }]).ok,
      ).toBe(false);
      expect(editor.document).toEqual(current);
    }
  });
  it('reorders within one parent without duplicating ownership and preserves undo/redo', () => {
    const editor = session();
    expect(apply(editor, [{ op: 'move', nodeId: 'a', newParentId: 'root', index: 1 }]).ok).toBe(
      true,
    );
    expect(editor.document.nodes.root).toMatchObject({ children: ['b', 'a', 'dialog'] });
    expect(editor.undo().ok).toBe(true);
    expect(editor.document.nodes.root).toMatchObject({ children: ['a', 'b', 'dialog'] });
    expect(editor.redo().ok).toBe(true);
    expect(editor.document.nodes.root).toMatchObject({ children: ['b', 'a', 'dialog'] });
  });
  it('moves an existing subtree into a slot and back, and inserts a new slot child atomically', () => {
    const editor = session();
    expect(
      apply(editor, [{ op: 'move', nodeId: 'a', newParentId: 'dialog', slotName: 'content' }]).ok,
    ).toBe(true);
    expect(editor.document.nodes.root).toMatchObject({ children: ['b', 'dialog'] });
    expect(editor.document.nodes.dialog).toMatchObject({ slots: { content: { children: ['a'] } } });
    expect(
      apply(editor, [
        {
          op: 'insert',
          parentId: 'dialog',
          slotName: 'content',
          node: { kind: 'text', id: 'new', content: { type: 'literal', value: 'New' } },
        },
      ]).ok,
    ).toBe(true);
    expect(apply(editor, [{ op: 'move', nodeId: 'a', newParentId: 'root' }]).ok).toBe(true);
    expect(editor.document.nodes.dialog).toMatchObject({
      slots: { content: { children: ['new'] } },
    });
  });
  it('rejects cycles, root moves and undeclared slots without partial changes', () => {
    for (const command of [
      { op: 'move', nodeId: 'root', newParentId: 'a' },
      { op: 'move', nodeId: 'dialog', newParentId: 'dialog', slotName: 'content' },
      { op: 'move', nodeId: 'a', newParentId: 'dialog', slotName: 'unknown' },
    ] as const) {
      const editor = session();
      const before = editor.document;
      expect(apply(editor, [command]).ok).toBe(false);
      expect(editor.document).toEqual(before);
    }
  });
  it('removes an attached subtree with no orphan descendants, and restores it in one undo', () => {
    const editor = session();
    const before = editor.document;
    expect(apply(editor, [{ op: 'remove', nodeId: 'a' }]).ok).toBe(false); // Legacy reference-checking behavior retained.
    expect(apply(editor, [{ op: 'remove', nodeId: 'a', detachFromParent: true }]).ok).toBe(true);
    expect(editor.document.nodes.a).toBeUndefined();
    expect(editor.document.nodes.text).toBeUndefined();
    expect(editor.undo().ok).toBe(true);
    expect(editor.document).toEqual(before);
  });
});
