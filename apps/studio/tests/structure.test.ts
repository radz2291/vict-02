import { describe, expect, it } from 'vitest';
import type { UiDocument, UiExtensionDescriptor } from '@victframework/ui';
import { canonicalUiDocument } from '@victframework/ui';
import { EditorBridge } from '@victframework/ui-editor';
import { newScreen, designerCatalogs, compileScreen } from '../src/lib/designer/application.js';
import { screenRecipes } from '../src/lib/designer/recipes.js';
import { screenStore } from '../src/lib/designer/storage.js';
import { projectStructure, structureId, structureMove, structureOccurrence } from '../src/lib/designer/structure.js';

function fixture(): UiDocument {
  const base = newScreen('Structure', 'structure');
  return { ...base, nodes: {
    screen: { kind: 'element', id: 'screen', tag: 'main', children: ['left', 'right'] },
    left: { kind: 'element', id: 'left', tag: 'section', children: ['text'] },
    right: { kind: 'element', id: 'right', tag: 'section', children: [] },
    text: { kind: 'text', id: 'text', content: { type: 'literal', value: 'Keep my identity' } },
  } };
}
const request = (source: string, target: string, revision = 'r1') => ({ documentId: 'structure', revision, source: structureId('structure', 'node', source), target: structureId('structure', 'node', target) });

describe('source structure projection and canonical edits', () => {
  it('preserves source identity across reorders, layout changes and selection without changing application identity', () => {
    const document = fixture();
    const before = canonicalUiDocument(document).contentDigest;
    const graph = projectStructure(document);
    expect(graph.nodes.map(node => node.id)).toContain(structureId(document.id, 'node', 'text'));
    expect(graph.nodes.find(node => node.data.sourceId === 'text')?.data.occurrence).toBe('structure|text');
    graph.nodes[0]!.position = { x: 900, y: 1 };
    graph.nodes[0]!.selected = true;
    expect(canonicalUiDocument(document).contentDigest).toBe(before);
    const reordered = { ...document, nodes: Object.fromEntries(Object.entries(document.nodes).reverse()) };
    expect(projectStructure(reordered).nodes.map(node => node.id).sort()).toEqual(graph.nodes.map(node => node.id).sort());
    expect(compileScreen(document).ok).toBe(true);
  });

  it('projects actual definitions, slots, templates, conditions and bindings without invented workflow edges', () => {
    const base = fixture();
    const document: UiDocument = { ...base, localState: { value: { type: 'string', initial: '' } }, componentDefinitions: {
      Custom: { id: 'Custom', revision: '1', root: 'definition-text', props: [], slots: {} },
    }, nodes: { ...base.nodes,
      widget: { kind: 'component', id: 'widget', definitionId: 'Custom', slots: { body: { name: 'body', children: ['slot-text'] } }, props: { value: { type: 'ref', path: 'state.value' } }, outputs: { change: { setState: { key: 'value' } }, submit: { invokeAction: { actionId: 'demo.submit' } } } },
      'definition-text': { kind: 'text', id: 'definition-text', content: { type: 'literal', value: 'Definition' } },
      'slot-text': { kind: 'text', id: 'slot-text', content: { type: 'literal', value: 'Slot content' } },
      repeat: { kind: 'repeat', id: 'repeat', collection: { type: 'ref', path: 'data.rows' }, itemName: 'row', key: { type: 'ref', path: 'row.id' }, templateRoot: 'template' },
      template: { kind: 'element', id: 'template', tag: 'div', children: [] },
      conditional: { kind: 'conditional', id: 'conditional', branches: [{ children: ['conditional-text'] }] },
      'conditional-text': { kind: 'text', id: 'conditional-text', content: { type: 'literal', value: 'Conditional' } },
    } };
    const graph = projectStructure(document);
    expect(graph.edges.map(edge => edge.label)).toEqual(expect.arrayContaining(['definition root', 'uses definition', 'slot: body', 'repeat template', 'branch: else 1', 'reads: state.value', 'writes state', 'invokes action']));
    expect(graph.edges.every(edge => graph.nodes.some(node => node.id === edge.source) && graph.nodes.some(node => node.id === edge.target))).toBe(true);
    expect(structureOccurrence(document, 'definition-text')).toBeUndefined();
    expect(structureOccurrence(document, 'template')).toBeUndefined();
  });

  it('uses one atomic command and shared Undo, Redo, Save and reopen history', () => {
    const document = fixture();
    const memory = new Map<string, string>();
    const store = screenStore({ getItem: key => memory.get(key) ?? null, setItem: (key, value) => { memory.set(key, value); } }, document.id);
    const bridge = new EditorBridge({ catalogs: designerCatalogs, store, initial: { document, storedRevision: 'r1' } });
    const prepared = structureMove(bridge.document, bridge.getSnapshot().revision, request('text', 'right', bridge.getSnapshot().revision), false, []);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.draft.commands).toEqual([{ op: 'move', nodeId: 'text', newParentId: 'right', slotName: undefined }]);
    expect(bridge.apply(prepared.draft).ok).toBe(true);
    expect(bridge.document.nodes.right).toMatchObject({ children: ['text'] });
    expect(bridge.undo().ok).toBe(true);
    expect(bridge.document.nodes.left).toMatchObject({ children: ['text'] });
    expect(bridge.redo().ok).toBe(true);
    expect(bridge.save().ok).toBe(true);
    expect(bridge.reopen().ok).toBe(true);
    expect(bridge.document.nodes.right).toMatchObject({ children: ['text'] });
    expect(structureOccurrence(bridge.document, 'text')).toBe('structure|text');
    expect(compileScreen(bridge.document).ok).toBe(true);
  });

  it('refuses stale, cross-document, draft, root, cycle, unknown and non-container connections', () => {
    const document = fixture();
    for (const [attempt, blocked] of [
      [request('text', 'right', 'stale'), false],
      [{ ...request('text', 'right'), documentId: 'other' }, false],
      [request('text', 'right'), true], [request('screen', 'right'), false],
      [request('left', 'text'), false], [request('left', 'left'), false],
      [request('missing', 'right'), false], [request('right', 'text'), false],
    ] as const) expect(structureMove(document, 'r1', attempt, blocked, []).ok).toBe(false);
  });

  it('refuses a context-owned catalog part moved outside its declared parent slot', () => {
    const base = fixture();
    const document: UiDocument = { ...base, nodes: { ...base.nodes, text: { kind: 'component', id: 'text', definitionId: 'vict.catalog.tabs-panel', props: { value: { type: 'literal', value: 'one' } }, slots: {} } } };
    const result = structureMove(document, 'r1', request('text', 'right'), false, [], screenRecipes);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('declared parent and slot');
  });

  it('refuses ambiguous source ownership and multi-slot container targets', () => {
    const base = fixture();
    const ambiguous: UiDocument = { ...base, nodes: { ...base.nodes, right: { kind: 'element', id: 'right', tag: 'section', children: ['text'] } } };
    expect(structureOccurrence(ambiguous, 'text')).toBeUndefined();
    expect(structureMove(ambiguous, 'r1', request('text', 'right'), false, []).ok).toBe(false);
    const multiple: UiDocument = { ...base, nodes: { ...base.nodes, right: { kind: 'component', id: 'right', definitionId: 'multi', slots: {} } } };
    const descriptors = [{ id: 'multi', revision: '1', slots: ['header', 'body'] }] as unknown as UiExtensionDescriptor[];
    expect(structureMove(multiple, 'r1', request('text', 'right'), false, descriptors).ok).toBe(false);
  });
});
