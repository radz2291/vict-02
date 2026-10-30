import { expect, it } from 'vitest';
import { UiEditSession, compileUiDocument, defaultSemanticElementCatalog, type UiDocument } from '@victframework/ui';
import { wireNativeInput } from '../src/commands.js';
import { nativeSource } from './native-wiring-fixture.js';

for (const [nodeId, initial] of [['note', 'Starting note'], ['choice', 'second']] as const) {
  it(`wires native ${nodeId} through canonical typing, history and compilation`, () => {
    const session = UiEditSession.open({ document: nativeSource(), storedRevision: '1' });
    const draft = wireNativeInput({ requestId: nodeId, document: session.document, nodeId, key: nodeId, initial });
    const result = session.applyTransaction({ ...draft, expectedDocumentRevision: session.workingRevision });
    expect(result.ok, JSON.stringify(result)).toBe(true);
    expect(session.document.localState[nodeId]).toEqual({ key: nodeId, type: 'string', initial });
    expect(compileUiDocument(session.document, defaultSemanticElementCatalog()).ok).toBe(true);
    expect(session.undo().ok).toBe(true); expect(session.document.localState[nodeId]).toBeUndefined();
    expect(session.redo().ok).toBe(true);
    const connected = session.document.nodes[nodeId]!;
    if (connected.kind !== 'element') throw new Error('Expected native field.');
    expect(connected.attributes?.value).toEqual({ type: 'ref', path: `state.${nodeId}` });
    const saved = session.save({ expectedStoredRevision: '1' });
    expect(saved.ok).toBe(true);
    if (saved.ok) {
      const reopened = UiEditSession.open({ document: saved.document, storedRevision: saved.storedRevision });
      const reopenedNode = reopened.document.nodes[nodeId]!;
      if (reopenedNode.kind !== 'element') throw new Error('Expected reopened native field.');
      expect(reopenedNode.attributes?.value).toEqual({ type: 'ref', path: `state.${nodeId}` });
      expect(reopened.document.localState[nodeId]!.initial).toBe(initial);
    }
    expect(() => wireNativeInput({ requestId: 'wrong-type', document: session.document, nodeId, key: 'wrong', type: 'number', initial: 3 })).toThrow('emits string');
    const invalid: UiDocument = { ...session.document, nodes: { ...session.document.nodes, [nodeId]: { ...connected, attributes: { unsupported: 'still refused' } } } };
    const rejected = compileUiDocument(invalid, defaultSemanticElementCatalog());
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.issues.some(issue => issue.code === 'UI_DOC_UNKNOWN_ATTRIBUTE')).toBe(true);
    const badBinding: UiDocument = { ...session.document, nodes: { ...session.document.nodes, [nodeId]: { ...connected, attributes: { value: { type: 'ref', path: 'state.missing' } } } } };
    const missing = compileUiDocument(badBinding, defaultSemanticElementCatalog());
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.issues.some(issue => issue.code === 'UI_EXPR_UNKNOWN_REFERENCE')).toBe(true);
  });
}
