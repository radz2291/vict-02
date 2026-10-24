import { describe, expect, it } from 'vitest';
import { compileUiDocument, defaultSemanticElementCatalog, type UiDocument, type UiExpression, type UiNode } from '../src/index.js';

function fixture(expression: UiExpression, attached = true): UiDocument {
  return { schema: 'vict.ui-document@1', id: 'shared-bindings', revision: '1', root: 'root', nodes: {
    root: { kind: 'element', id: 'root', tag: 'main', children: [], ...(attached ? { styleSources: ['shared'] } : {}) },
  }, componentDefinitions: {}, localState: { alpha: { key: 'alpha', type: 'number', initial: 0.75 } },
  styleSources: { shared: { id: 'shared', declarations: [{ property: 'opacity', value: { type: 'binding', expression } }] } }, tokens: {}, conditions: {}, assets: {} };
}
function definitionSource(expression: UiExpression, baseStyle: boolean): UiDocument {
  const initial = fixture(expression, false);
  return { ...initial, nodes: {
    root: { kind: 'element', id: 'root', tag: 'main', children: ['card'] },
    card: { kind: 'component', id: 'card', definitionId: 'card', props: { alpha: { type: 'literal', value: 0.4 } } },
    body: { kind: 'element', id: 'body', tag: 'article', children: [], ...(!baseStyle ? { styleSources: ['shared'] } : {}) },
  }, componentDefinitions: { card: { id: 'card', revision: '1', root: 'body', props: [{ name: 'alpha', type: 'number' }], slots: {}, ...(baseStyle ? { baseStyle: 'shared' } : {}) } } };
}
describe('shared style binding validation follows actual consumer scope (PV-05)', () => {
  it('refuses unknown attached state and reports the consuming node and source', () => {
    const result = compileUiDocument(fixture({ type: 'ref', path: 'state.missing' }), defaultSemanticElementCatalog());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'UI_EXPR_UNKNOWN_REFERENCE', nodeId: 'root', path: 'state.missing', styleSourceId: 'shared' })]));
  });
  it('preserves unattached forward source expressions until a consumer supplies a scope', () => {
    expect(compileUiDocument(fixture({ type: 'ref', path: 'prop.future' }, false), defaultSemanticElementCatalog()).ok).toBe(true);
    expect(compileUiDocument(fixture({ type: 'ref', path: 'state.future' }, false), defaultSemanticElementCatalog()).ok).toBe(true);
  });
  it('accepts document state and definition-local prop attachments, but rejects crossing their lexical boundaries', () => {
    expect(compileUiDocument(fixture({ type: 'ref', path: 'state.alpha' }), defaultSemanticElementCatalog()).ok).toBe(true);
    expect(compileUiDocument(definitionSource({ type: 'ref', path: 'prop.alpha' }, false), defaultSemanticElementCatalog()).ok).toBe(true);
    const rejected = compileUiDocument(definitionSource({ type: 'ref', path: 'state.alpha' }, false), defaultSemanticElementCatalog());
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'UI_EXPR_SCOPE_VIOLATION', nodeId: 'body', styleSourceId: 'shared' })]));
  });
  it('uses ordinary expression type diagnostics for attached shared bindings', () => {
    const source = fixture({ type: 'compare', op: 'lt', left: { type: 'ref', path: 'state.alpha' }, right: { type: 'literal', value: 'wrong type' } });
    const rejected = compileUiDocument(source, defaultSemanticElementCatalog());
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.issues.some(issue => issue.code === 'UI_EXPR_TYPE_MISMATCH' && issue.styleSourceId === 'shared')).toBe(true);
  });
  it('checks repeat references in the actual template scope rather than the source registry scope', () => {
    const initial = fixture({ type: 'ref', path: 'repeat.row.alpha' }, false);
    const source: UiDocument = { ...initial, nodes: {
      root: { kind: 'element', id: 'root', tag: 'main', children: ['rows'] },
      rows: { kind: 'repeat', id: 'rows', itemName: 'row', collection: { type: 'ref', path: 'view.rows' }, key: { type: 'ref', path: 'repeat.row.id' }, templateRoot: 'row' },
      row: { kind: 'element', id: 'row', tag: 'div', children: [], styleSources: ['shared'] },
    } };
    expect(compileUiDocument(source, defaultSemanticElementCatalog(), [], { viewFields: { rows: 'array', 'rows.id': 'string', 'rows.alpha': 'number' } }).ok).toBe(true);
    const outside: UiDocument = { ...source, nodes: { ...source.nodes, root: { ...source.nodes.root, styleSources: ['shared'] } as UiNode } };
    const rejected = compileUiDocument(outside, defaultSemanticElementCatalog(), [], { viewFields: { rows: 'array', 'rows.id': 'string', 'rows.alpha': 'number' } });
    expect(rejected.ok).toBe(false);
  });
  it('validates legacy baseStyle bindings in the actual component caller scope without granting inner-definition prop scope', () => {
    expect(compileUiDocument(definitionSource({ type: 'ref', path: 'state.alpha' }, true), defaultSemanticElementCatalog()).ok).toBe(true);
    const unknown = compileUiDocument(definitionSource({ type: 'ref', path: 'state.missing' }, true), defaultSemanticElementCatalog());
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'UI_EXPR_UNKNOWN_REFERENCE', nodeId: 'card', styleSourceId: 'shared' })]));
    const ownProp = compileUiDocument(definitionSource({ type: 'ref', path: 'prop.alpha' }, true), defaultSemanticElementCatalog());
    expect(ownProp.ok).toBe(false);
    if (!ownProp.ok) expect(ownProp.issues.some(issue => issue.code === 'UI_EXPR_SCOPE_VIOLATION' && issue.nodeId === 'card')).toBe(true);
  });
  it('checks direct component source attachments in their instance scope', () => {
    const initial = definitionSource({ type: 'ref', path: 'state.missing' }, false);
    const attached: UiDocument = { ...initial, nodes: { ...initial.nodes,
      card: { kind: 'component', id: 'card', definitionId: 'card', props: { alpha: { type: 'literal', value: 0.4 } }, styleSources: ['shared'] },
      body: { kind: 'element', id: 'body', tag: 'article', children: [] },
    } };
    const rejected = compileUiDocument(attached, defaultSemanticElementCatalog());
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'UI_EXPR_UNKNOWN_REFERENCE', nodeId: 'card', styleSourceId: 'shared' })]));
    const valid: UiDocument = { ...attached, styleSources: { shared: { id: 'shared', declarations: [{ property: 'opacity', value: { type: 'binding', expression: { type: 'ref', path: 'state.alpha' } } }] } } };
    expect(compileUiDocument(valid, defaultSemanticElementCatalog()).ok).toBe(true);
  });
  it('keeps valid outer caller prop baseStyle bindings and unused baseStyle forward definitions', () => {
    const initial = definitionSource({ type: 'ref', path: 'prop.alpha' }, true);
    const caller: UiDocument = { ...initial, root: 'outer', nodes: {
      ...initial.nodes, root: { kind: 'element', id: 'root', tag: 'main', children: [] },
      outer: { kind: 'component', id: 'outer', definitionId: 'outer', props: { alpha: { type: 'literal', value: 0.6 } } },
    }, componentDefinitions: { ...initial.componentDefinitions, outer: { id: 'outer', revision: '1', root: 'card', props: [{ name: 'alpha', type: 'number' }], slots: {} } } };
    expect(compileUiDocument(caller, defaultSemanticElementCatalog()).ok).toBe(true);
    const unused: UiDocument = { ...initial, nodes: {
      ...Object.fromEntries(Object.entries(initial.nodes).filter(([id]) => id !== 'card')),
      root: { kind: 'element', id: 'root', tag: 'main', children: [] },
    } };
    expect(compileUiDocument(unused, defaultSemanticElementCatalog()).ok).toBe(true);
  });
});
