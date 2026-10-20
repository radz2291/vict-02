import { expect, it } from 'vitest';
import { UiEditSession, type UiDocument } from '@victframework/ui';
import { duplicateSubtree, editLiteralText, literalTextTarget } from '../src/selection-tools.js';
import { setBaseStyle } from '../src/commands.js';
const source: UiDocument = {
  schema: 'vict.ui-document@1',
  id: 'tools',
  revision: '1',
  root: 'root',
  nodes: {
    root: { id: 'root', kind: 'element', tag: 'main', children: ['box'] },
    box: { id: 'box', kind: 'element', tag: 'section', children: ['title'] },
    title: { id: 'title', kind: 'text', content: { type: 'literal', value: 'Original' } },
  },
  componentDefinitions: {},
  tokens: {},
  assets: {},
  localState: {},
  conditions: {},
  styleSources: {},
};
it('edits a single nested literal as one undoable transaction and refuses bound text', () => {
  const session = UiEditSession.open({ document: source, storedRevision: '1' });
  const draft = editLiteralText(source, 'box', 'Edited')!;
  expect(
    session.applyTransaction({ ...draft, expectedDocumentRevision: session.workingRevision }).ok,
  ).toBe(true);
  expect(literalTextTarget(session.document, 'box')?.value).toBe('Edited');
  expect(session.undo().ok).toBe(true);
  expect(literalTextTarget(session.document, 'box')?.value).toBe('Original');
  const bound = {
    ...source,
    nodes: {
      ...source.nodes,
      title: {
        id: 'title',
        kind: 'text' as const,
        content: {
          type: 'expression' as const,
          expression: { type: 'ref' as const, path: 'state.message' },
        },
      },
    },
  };
  expect(editLiteralText(bound, 'box', 'Do not overwrite binding')).toBeUndefined();
});
it('duplicates a subtree adjacent to its source with fresh ownership and atomic undo', () => {
  const session = UiEditSession.open({ document: source, storedRevision: '1' });
  const copy = duplicateSubtree(source, 'box')!;
  expect(
    session.applyTransaction({ ...copy.draft, expectedDocumentRevision: session.workingRevision })
      .ok,
  ).toBe(true);
  const root = session.document.nodes.root;
  expect(root?.kind === 'element' && root.children).toEqual(['box', copy.nodeId]);
  expect(literalTextTarget(session.document, copy.nodeId)?.value).toBe('Original');
  expect(Object.keys(session.document.nodes)).toHaveLength(5);
  expect(session.undo().ok).toBe(true);
  expect(session.document.nodes).toEqual(source.nodes);
  expect(duplicateSubtree(source, source.root)).toBeUndefined();
});
it('does not guess between multiple text children', () => {
  expect(
    literalTextTarget(
      {
        ...source,
        nodes: {
          ...source.nodes,
          box: { id: 'box', kind: 'element', tag: 'section', children: ['title', 'other'] },
        },
      },
      'box',
    ),
  ).toBeUndefined();
});
it('keeps toolbar formatting in the promoted base source without masking responsive presentation', () => {
  const promoted: UiDocument = {
    ...source,
    nodes: {
      ...source.nodes,
      box: { ...source.nodes.box!, styleSources: ['src.box.always.plain'] },
    },
    styleSources: {
      'src.box.always.plain': {
        id: 'src.box.always.plain',
        declarations: [{ property: 'font-size', value: { type: 'text', value: '32px' } }],
      },
    },
  };
  const session = UiEditSession.open({ document: promoted, storedRevision: '1' });
  const draft = setBaseStyle(promoted, {
    requestId: 'format',
    nodeId: 'box',
    property: 'font-size',
    value: { type: 'text', value: '40px' },
  });
  expect(
    session.applyTransaction({ ...draft, expectedDocumentRevision: session.workingRevision }).ok,
  ).toBe(true);
  expect(session.document.nodes.box?.localStyle).toBeUndefined();
  expect(session.document.styleSources['src.box.always.plain']?.declarations[0]?.value).toEqual({
    type: 'text',
    value: '40px',
  });
});
