import { describe, expect, it } from 'vitest';
import type { UiDocument, UiExtensionDescriptor } from '@victframework/ui';
import { canonicalUiDocument } from '@victframework/ui';
import { EditorBridge } from '@victframework/ui-editor';
import { newScreen, designerCatalogs, compileScreen } from '../src/lib/designer/application.js';
import { screenRecipes } from '../src/lib/designer/recipes.js';
import { screenStore } from '../src/lib/designer/storage.js';
import { projectStructure, structureId, parseStructureId, structureMove, structureOccurrence } from '../src/lib/designer/structure.js';

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
  it('encodes graph ids for upstream attribute selectors while preserving exact source tuples', () => {
    const documentId = 'document"/%[one]\\';
    const sourceId = 'child"/%[two]\\';
    const targetId = 'target"/%[three]\\';
    const base = fixture();
    const document: UiDocument = { ...base, id: documentId, nodes: {
      screen: { kind: 'element', id: 'screen', tag: 'main', children: [sourceId, targetId] },
      [sourceId]: { kind: 'element', id: sourceId, tag: 'p', children: [] },
      [targetId]: { kind: 'element', id: targetId, tag: 'section', children: [] },
    } };
    const graph = projectStructure(document);
    for (const node of graph.nodes) {
      expect(node.id).not.toMatch(/["\\\[\]]/);
      expect(parseStructureId(node.id)).toEqual([documentId, node.data.kind, node.data.sourceId ?? parseStructureId(node.id)?.[2]]);
    }
    for (const edge of graph.edges) {
      expect(edge.id).not.toMatch(/["\\\[\]]/);
      expect(JSON.parse(decodeURIComponent(edge.id))).toEqual([edge.source, edge.target, edge.data?.role, expect.any(String)]);
    }
    expect(parseStructureId(structureId(documentId, 'node', sourceId))).toEqual([documentId, 'node', sourceId]);
    for (const malformed of ['%', '%E0%A4', 'null', '%5B1%2C2%2C3%5D', '%5B%22one%22%5D', '%7B%7D']) expect(parseStructureId(malformed)).toBeUndefined();
    const attempt = { documentId, revision: 'r1', source: structureId(documentId, 'node', sourceId), target: structureId(documentId, 'node', targetId) };
    const moved = structureMove(document, 'r1', attempt, false, []);
    expect(moved.ok).toBe(true);
    if (moved.ok) expect(moved.draft.commands).toEqual([{ op: 'move', nodeId: sourceId, newParentId: targetId, slotName: undefined }]);
    expect(structureMove(document, 'r2', attempt, false, []).ok).toBe(false);
    expect(structureMove(document, 'r1', { ...attempt, source: '%' }, false, []).ok).toBe(false);
    expect(structureOccurrence(document, sourceId)).toBe(`${documentId}|${sourceId}`);
  });
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
    const document: UiDocument = { ...base, localState: { value: { key: 'value', type: 'string', initial: '' } }, componentDefinitions: {
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
    expect(graph.edges.map(edge => edge.label)).toEqual(expect.arrayContaining(['Defines', 'Uses', 'Slot', 'Template', 'Otherwise', 'Value', 'Updates', 'Invokes']));
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
