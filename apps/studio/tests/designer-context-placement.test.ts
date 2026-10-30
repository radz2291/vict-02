import { describe, expect, it } from 'vitest';
import { applyUiEdit, type UiDocument, type UiNode } from '@victframework/ui';
import { EditorBridge, detachSlotContent, insertRecipe, moveRelative, type TransactionDraft } from '@victframework/ui-editor';
import { catalogDescriptors, compileScreen, designerCatalogs, newScreen, screenIssues } from '../src/lib/designer/application.js';
import { screenPlacementIssues } from '../src/lib/designer/placement.js';
import { screenRecipes } from '../src/lib/designer/recipes.js';
import { screenStore } from '../src/lib/designer/storage.js';

function fixture(): UiDocument {
  const document = newScreen('Context challenge', 'context-challenge');
  const draft = insertRecipe('seed', screenRecipes.find(recipe => recipe.id === 'select-multiple')!, document, 'select', { nodeId: document.root });
  const result = applyUiEdit({ document, revision: 'r1' }, { ...draft, expectedDocumentRevision: 'r1' }, designerCatalogs);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.document;
}
const item = 'select-items-1';
function bridgeFor(document = fixture()) {
  const bytes = new Map<string, string>();
  const store = screenStore({ getItem: key => bytes.get(key) ?? null, setItem: (key, value) => { bytes.set(key, value); } }, document.id);
  return new EditorBridge({ catalogs: designerCatalogs, validateDocument: screenPlacementIssues, store, initial: { document, storedRevision: 'r1' } });
}
function refused(bridge: EditorBridge, draft: TransactionDraft) {
  const before = bridge.document, snapshot = bridge.getSnapshot();
  expect(bridge.apply(draft)).toMatchObject({ ok: false, issues: [{ code: 'UI_EDIT_VALIDATION_FAILED', hostCode: 'STUDIO_COMPONENT_CONTEXT' }] });
  expect(bridge.document).toEqual(before);
  expect(bridge.getSnapshot()).toEqual(snapshot);
}
function escaped(document: UiDocument): UiDocument {
  const select = document.nodes.select;
  if (select?.kind !== 'component') throw new Error('fixture');
  return { ...document, nodes: { ...document.nodes,
    screen: { ...document.nodes.screen, children: ['select', item] } as UiNode,
    select: { ...select, slots: { items: { name: 'items', children: ['select-items-2'] } } },
  } };
}

describe('Studio provider-context boundary (independent 17081 finding)', () => {
  it('refuses the Layers move command even though the neutral edit engine accepts its source structure', () => {
    const bridge = bridgeFor();
    const command = moveRelative(bridge.document, item, 'screen', 'inside', catalogDescriptors)!;
    expect(command).toBeDefined();
    const draft = { requestId: 'layer-drop', commands: [command] };
    const neutral = applyUiEdit({ document: bridge.document, revision: 'r1' }, { ...draft, expectedDocumentRevision: 'r1' }, designerCatalogs);
    expect(neutral.ok).toBe(true); // Retain the original finding; neutral schema remains unchanged.
    refused(bridge, draft);
  });

  it('allows Keep aside, refuses Composer reuse at root, and permits compatible reuse with history/save/reopen', () => {
    const bridge = bridgeFor(), original = bridge.document;
    const detach = detachSlotContent('keep-aside', original, item)!;
    expect(bridge.apply(detach).ok).toBe(true);
    expect(screenPlacementIssues(bridge.document)).toEqual([]);
    refused(bridge, { requestId: 'reuse-root', commands: [{ op: 'move', nodeId: item, newParentId: 'screen' }] });
    const valid: TransactionDraft = { requestId: 'reuse-slot', commands: [{ op: 'move', nodeId: item, newParentId: 'select', slotName: 'items' }] };
    expect(bridge.apply(valid).ok).toBe(true);
    const reused = bridge.document;
    // Bridge supplies the current revision; session identity rejects this old
    // request payload. Preserve that authority instead of returning duplicate-node errors.
    expect(bridge.apply(valid)).toMatchObject({ ok: false, issues: [{ code: 'UI_EDIT_REQUEST_CONFLICT' }] });
    expect(bridge.undo().ok).toBe(true);
    expect(bridge.document.nodes.select).not.toEqual(reused.nodes.select);
    expect(bridge.redo().ok).toBe(true);
    expect(bridge.document).toEqual(reused);
    expect(bridge.save().ok).toBe(true);
    const saved = bridge.document;
    expect(bridge.reopen().ok).toBe(true);
    expect(bridge.document).toEqual(saved);
  });

  it('rejects canonical-source replacement, initial intake, save and reopen without committing invalid source', () => {
    const bridge = bridgeFor(), bad = escaped(bridge.document);
    refused(bridge, { requestId: 'source', commands: [{ op: 'replaceDocument', document: bad }] });
    expect(screenIssues(bad).length).toBeGreaterThan(0);
    expect(compileScreen(bad).ok).toBe(false);
    expect(() => bridgeFor(bad)).toThrow('requires its declared component context');
    const bytes = new Map<string, string>();
    const store = screenStore({ getItem: key => bytes.get(key) ?? null, setItem: (key, value) => { bytes.set(key, value); } }, bad.id);
    expect(store.save({ document: bad, expectedStoredRevision: 'r1', newStoredRevision: 'r2' }).ok).toBe(false);
    expect(bytes.size).toBe(0);
    // A custom store cannot bypass the host intake check either.
    const external = new EditorBridge({ catalogs: designerCatalogs, validateDocument: screenPlacementIssues,
      initial: { document: fixture(), storedRevision: 'r1' },
      store: { load: () => ({ status: 'loaded', document: bad, storedRevision: 'r2' }), save: () => ({ ok: true, storedRevision: 'r2' }) } });
    const before = external.getSnapshot();
    expect(external.reopen()).toMatchObject({ ok: false, code: 'UI_STORE_INVALID' });
    expect(external.getSnapshot()).toEqual(before);
  });

  it('retains provider context through neutral wrappers and rejects a wrapper moved outside it atomically', () => {
    const document = fixture(), select = document.nodes.select;
    if (select?.kind !== 'component') throw new Error('fixture');
    const wrapped: UiDocument = { ...document, nodes: { ...document.nodes,
      select: { ...select, slots: { items: { name: 'items', children: ['wrapper', 'select-items-2'] } } },
      wrapper: { kind: 'element', id: 'wrapper', tag: 'div', children: [item] },
    } };
    expect(screenPlacementIssues(wrapped)).toEqual([]);
    expect(compileScreen(wrapped).ok).toBe(true);
    const bridge = bridgeFor(wrapped);
    refused(bridge, { requestId: 'escape-wrapper', commands: [{ op: 'move', nodeId: 'wrapper', newParentId: 'screen' }] });
    // Moving a complete provider with its parts preserves their context.
    expect(bridge.apply({ requestId: 'outer', commands: [{ op: 'insert', parentId: 'screen', node: { kind: 'element', id: 'outer', tag: 'section', children: [] } }, { op: 'move', nodeId: 'select', newParentId: 'outer' }] }).ok).toBe(true);
  });

  it('checks reusable definition occurrences separately and keeps detached templates available', () => {
    const document = fixture(), select = document.nodes.select;
    if (select?.kind !== 'component') throw new Error('fixture');
    const local: UiDocument = { ...document, nodes: { ...document.nodes,
      select: { ...select, slots: { items: { name: 'items', children: ['inside', 'select-items-2'] } } },
      inside: { kind: 'component', id: 'inside', definitionId: 'local.option' },
      outside: { kind: 'component', id: 'outside', definitionId: 'local.option' },
    }, componentDefinitions: { 'local.option': { id: 'local.option', revision: '1', root: item, props: [], slots: {} } } };
    expect(screenPlacementIssues(local)).toEqual([]); // outside is kept aside.
    const mixed: UiDocument = { ...local, nodes: { ...local.nodes, screen: { ...local.nodes.screen, children: ['select', 'outside'] } as UiNode } };
    expect(screenPlacementIssues(mixed)).toHaveLength(1);
    expect(screenPlacementIssues(mixed)[0]).toMatchObject({ nodeId: item, hostCode: 'STUDIO_COMPONENT_CONTEXT' });
  });

  it('substitutes local slot fills under the definition provider and checks unused conditional/repeat branches', () => {
    const document = fixture();
    const local: UiDocument = { ...document, nodes: { ...document.nodes,
      screen: { ...document.nodes.screen, children: ['instance'] } as UiNode,
      instance: { kind: 'component', id: 'instance', definitionId: 'local.select', slots: { options: { name: 'options', children: [item] } } },
      select: { kind: 'component', id: 'select', definitionId: 'vict.catalog.select-multiple', slots: { items: { name: 'items', children: ['slot'] } } },
      slot: { kind: 'slot', id: 'slot', name: 'options', fallback: ['select-items-2'] },
    }, componentDefinitions: { 'local.select': { id: 'local.select', revision: '1', root: 'select', props: [], slots: { options: {} } } } };
    expect(screenPlacementIssues(local)).toEqual([]);
    expect(compileScreen(local).ok).toBe(true);
    for (const wrapper of [
      { kind: 'conditional', id: 'wrapper', branches: [{ children: [item] }] },
      { kind: 'repeat', id: 'wrapper', templateRoot: item, itemName: 'item', collection: { type: 'ref', path: 'state.empty' }, key: { type: 'literal', value: 'one' } },
    ] as const) {
      const bad: UiDocument = { ...document, nodes: { ...document.nodes, screen: { ...document.nodes.screen, children: ['wrapper'] } as UiNode, wrapper } };
      expect(screenPlacementIssues(bad)).toHaveLength(1);
    }
  });
});
