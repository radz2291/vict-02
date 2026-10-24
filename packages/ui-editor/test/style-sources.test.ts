import { describe, expect, it } from 'vitest';
import { compileUiDocument, defaultSemanticElementCatalog, type DocumentStorePort, type UiDocument, type UiStyleSource } from '@victframework/ui';
import { EditorBridge } from '../src/bridge.js';
import { defineStyleSource, attachStyleSource, detachStyleSource, removeStyleSource, StyleSourceEditError } from '../src/style-sources.js';

const source = (id: string, color = '#112233'): UiStyleSource => ({ id, declarations: [{ property: 'color', value: { type: 'text', value: color } }] });
function fixture(): UiDocument {
  return { schema: 'vict.ui-document@1', id: 'shared-styles', revision: 'r1', root: 'root', nodes: {
    root: { kind: 'element', id: 'root', tag: 'main', children: ['first', 'second', 'card'] },
    first: { kind: 'element', id: 'first', tag: 'section', children: [], localStyle: [{ property: 'color', value: { type: 'text', value: 'purple' } }] },
    second: { kind: 'element', id: 'second', tag: 'section', children: [] },
    card: { kind: 'component', id: 'card', definitionId: 'local.card' },
    body: { kind: 'element', id: 'body', tag: 'article', children: [] },
    copy: { kind: 'text', id: 'copy', content: { type: 'literal', value: 'Detached text' } },
  }, componentDefinitions: { 'local.card': { id: 'local.card', revision: '1', root: 'body', props: [], slots: {} } },
  localState: { alpha: { key: 'alpha', type: 'number', initial: 0.75 } }, tokens: { accent: { id: 'accent', value: '#123456' } },
  conditions: { compact: { id: 'compact', kind: 'media', query: '(max-width: 600px)' } }, styleSources: {}, assets: {} };
}
function bridge() {
  let stored = fixture(), storedRevision = 'r1';
  const store: DocumentStorePort = {
    load: () => ({ status: 'loaded', document: structuredClone(stored), storedRevision }),
    save: input => {
      if (input.expectedStoredRevision !== storedRevision) return { ok: false, code: 'UI_DOC_STALE_REVISION', reason: 'Stale save.' };
      stored = structuredClone(input.document); storedRevision = input.newStoredRevision;
      return { ok: true, storedRevision };
    },
  };
  return new EditorBridge({ store, initial: { document: stored, storedRevision }, catalogs: { elements: defaultSemanticElementCatalog() } });
}

describe('shared reusable style-source transactions (PV-05)', () => {
  it('reuses one source on multiple elements and a component; explicit replacement preserves local overrides and history/save/reopen', () => {
    const editor = bridge(), localBefore = editor.document.nodes.first!.localStyle;
    expect(editor.apply(defineStyleSource({ requestId: 'define', document: editor.document, source: source('shared') })).ok).toBe(true);
    for (const nodeId of ['first', 'second', 'card']) expect(editor.apply(attachStyleSource({ requestId: `attach-${nodeId}`, document: editor.document, nodeId, sourceId: 'shared' })).ok).toBe(true);
    expect(editor.apply(defineStyleSource({ requestId: 'replace', document: editor.document, source: source('shared', '#aabbcc'), replace: true })).ok).toBe(true);
    expect(editor.document.nodes.first!.localStyle).toEqual(localBefore);
    for (const nodeId of ['first', 'second', 'card']) expect(editor.document.nodes[nodeId]!.styleSources).toEqual(['shared']);
    expect(editor.document.styleSources.shared!.declarations[0]!.value).toEqual({ type: 'text', value: '#aabbcc' });
    const compiled = compileUiDocument(editor.document, defaultSemanticElementCatalog());
    expect(compiled.ok).toBe(true);
    if (compiled.ok) {
      expect(compiled.plan.style.rules.filter(rule => rule.layer === 'source' && rule.declarations.some(declaration => declaration.property === 'color' && declaration.value.type === 'literal' && declaration.value.value === '#aabbcc'))).toHaveLength(3);
      expect(compiled.plan.style.rules.some(rule => rule.layer === 'local' && rule.declarations.some(declaration => declaration.value.type === 'literal' && declaration.value.value === 'purple'))).toBe(true);
    }
    expect(editor.undo().ok).toBe(true); expect(editor.document.styleSources.shared!.declarations[0]!.value).toEqual({ type: 'text', value: '#112233' });
    expect(editor.redo().ok).toBe(true); expect(editor.save().ok).toBe(true);
    const saved = editor.document; expect(editor.reopen().ok).toBe(true); expect(editor.document).toEqual(saved);
  });

  it('preserves attachment order, supports insertion at an explicit index and detaches without deleting the source', () => {
    const editor = bridge();
    for (const id of ['a', 'b', 'c']) expect(editor.apply(defineStyleSource({ requestId: `define-${id}`, document: editor.document, source: source(id) })).ok).toBe(true);
    expect(editor.apply(attachStyleSource({ requestId: 'a', document: editor.document, nodeId: 'second', sourceId: 'a' })).ok).toBe(true);
    expect(editor.apply(attachStyleSource({ requestId: 'c', document: editor.document, nodeId: 'second', sourceId: 'c' })).ok).toBe(true);
    expect(editor.apply(attachStyleSource({ requestId: 'b', document: editor.document, nodeId: 'second', sourceId: 'b', index: 1 })).ok).toBe(true);
    expect(editor.document.nodes.second!.styleSources).toEqual(['a', 'b', 'c']);
    expect(editor.apply(detachStyleSource({ requestId: 'detach-b', document: editor.document, nodeId: 'second', sourceId: 'b' })).ok).toBe(true);
    expect(editor.document.nodes.second!.styleSources).toEqual(['a', 'c']); expect(editor.document.styleSources.b).toBeDefined();
    expect(editor.apply(removeStyleSource({ requestId: 'remove-b', document: editor.document, sourceId: 'b' })).ok).toBe(true); expect(editor.document.styleSources.b).toBeUndefined();
    expect(editor.undo().ok).toBe(true); expect(editor.document.styleSources.b).toBeDefined();
  });

  it('preserves typed condition, pseudo, token and binding declarations for canonical compilation', () => {
    const editor = bridge();
    const shared: UiStyleSource = { id: 'interactive', conditionId: 'compact', pseudo: 'hover', declarations: [
      { property: 'color', value: { type: 'token', id: 'accent' } },
      { property: 'opacity', value: { type: 'binding', expression: { type: 'ref', path: 'state.alpha' } } },
    ] };
    expect(editor.apply(defineStyleSource({ requestId: 'typed', document: editor.document, source: shared })).ok).toBe(true);
    expect(editor.apply(attachStyleSource({ requestId: 'typed-attach', document: editor.document, nodeId: 'second', sourceId: shared.id })).ok).toBe(true);
    expect(editor.document.styleSources.interactive).toEqual(shared);
    const compiled = compileUiDocument(editor.document, defaultSemanticElementCatalog()); expect(compiled.ok).toBe(true);
    if (compiled.ok) expect(compiled.plan.style.rules).toEqual(expect.arrayContaining([expect.objectContaining({ mediaConditionId: 'compact', pseudo: 'hover', layer: 'source', declarations: expect.arrayContaining([
      { property: 'color', value: { type: 'token', id: 'accent' } },
      { property: 'opacity', value: { type: 'expression', expression: { type: 'ref', path: 'state.alpha' } } },
    ]) })]));
  });

  it('leaves invalid token/reference admission to the canonical compiler and never partially commits a refusal', () => {
    const editor = bridge(), before = editor.document, snapshot = editor.getSnapshot();
    const draft = defineStyleSource({ requestId: 'bad-token', document: editor.document, source: { id: 'bad', declarations: [{ property: 'color', value: { type: 'token', id: 'missing' } }] } });
    expect(editor.apply(draft)).toMatchObject({ ok: false, issues: expect.arrayContaining([expect.objectContaining({ code: 'UI_EDIT_VALIDATION_FAILED', diagnostics: expect.arrayContaining([expect.objectContaining({ code: 'UI_EXPR_UNKNOWN_REFERENCE', path: 'token.missing' })]) })]) });
    expect(editor.document).toEqual(before); expect(editor.getSnapshot()).toEqual(snapshot);
  });

  it('refuses implicit overwrite, replacement of absent sources, duplicate attachment and invalid target/index with structured fields', () => {
    const document = { ...fixture(), styleSources: { existing: source('existing') } };
    expect(() => defineStyleSource({ requestId: 'overwrite', document, source: source('existing') })).toThrow(StyleSourceEditError);
    expect(() => defineStyleSource({ requestId: 'absent', document, source: source('absent'), replace: true })).toThrow('existing identity');
    expect(() => defineStyleSource({ requestId: 'empty', document, source: source('') })).toThrow('safe identity');
    expect(() => attachStyleSource({ requestId: 'missing', document, nodeId: 'second', sourceId: 'missing' })).toThrow('does not exist');
    for (const nodeId of ['missing', 'copy']) expect(() => attachStyleSource({ requestId: nodeId, document, nodeId, sourceId: 'existing' })).toThrow('element or component');
    for (const index of [-1, 0.5, 1, NaN, Infinity]) {
      try { attachStyleSource({ requestId: 'index', document, nodeId: 'second', sourceId: 'existing', index }); throw new Error('Expected refusal.'); }
      catch (error) { expect(error).toBeInstanceOf(StyleSourceEditError); expect(error).toMatchObject({ code: 'UI_STYLE_SOURCE_EDIT', field: 'index', sourceId: 'existing', nodeId: 'second' }); }
    }
    const attached = { ...document, nodes: { ...document.nodes, second: { ...document.nodes.second!, styleSources: ['existing'] } } };
    expect(() => attachStyleSource({ requestId: 'duplicate', document: attached, nodeId: 'second', sourceId: 'existing' })).toThrow('already attached');
    expect(() => detachStyleSource({ requestId: 'not-attached', document, nodeId: 'second', sourceId: 'existing' })).toThrow('not attached');
  });

  it('refuses deletion referenced by detached nodes or component base styles, and keeps helper snapshots independent of input mutation', () => {
    const initial = fixture(), shared = source('shared');
    const draft = defineStyleSource({ requestId: 'copy', document: initial, source: shared });
    Object.assign(shared.declarations[0]!, { property: 'background' });
    expect(draft.commands[0]).toMatchObject({ op: 'replaceDocument', document: { styleSources: { shared: { declarations: [{ property: 'color' }] } } } });
    expect(initial.styleSources).toEqual({});
    const document = { ...initial, styleSources: { shared: source('shared') }, nodes: { ...initial.nodes, detached: { kind: 'element' as const, id: 'detached', tag: 'div', children: [], styleSources: ['shared'] } } };
    expect(() => removeStyleSource({ requestId: 'detached-ref', document, sourceId: 'shared' })).toThrow('node:detached');
    const base = { ...initial, styleSources: document.styleSources, componentDefinitions: { 'local.card': { ...initial.componentDefinitions['local.card']!, baseStyle: 'shared' } } };
    expect(() => removeStyleSource({ requestId: 'base-ref', document: base, sourceId: 'shared' })).toThrow('definition:local.card.baseStyle');
  });
});
