import { describe, expect, it } from 'vitest';
import { EditorBridge } from '@victframework/ui-editor';
import { setStyle, setTextLiteral } from '@victframework/ui-editor';
import { canonicalUiDocument, type UiDocument } from '@victframework/ui';
import { inspectionDetailDocument } from '../src/lib/product/definitions.js';

function bridgeOverDocument() {
  let stored: UiDocument = structuredClone(inspectionDetailDocument);
  let storedRevision = '1';
  const bridge = new EditorBridge({
    initial: { document: stored, storedRevision },
    store: {
      load: () => ({ status: 'loaded' as const, document: stored, storedRevision }),
      save: (input) => {
        // Same authority discipline as the real store: check-then-write.
        if (input.expectedStoredRevision !== storedRevision) {
          return {
            ok: false as const,
            code: 'UI_DOC_STALE_REVISION' as const,
            reason: `stored revision is ${storedRevision}, expected ${input.expectedStoredRevision}`,
          };
        }
        stored = input.document;
        storedRevision = input.newStoredRevision;
        return { ok: true as const, storedRevision };
      },
    },
  });
  return { bridge, storedRef: () => stored, storedRevisionRef: () => storedRevision };
}

describe('U1-03/U1-04: source-aware editing and the round trip', () => {
  it('a stale transaction leaves the source unchanged', () => {
    const { bridge } = bridgeOverDocument();
    bridge.apply(setTextLiteral({ requestId: 'a', nodeId: 'n.approveLabel', value: 'first' }));
    const before = canonicalUiDocument(bridge.document).contentDigest;
    const stale = bridge.apply(
      setTextLiteral({ requestId: 'b', nodeId: 'n.approveLabel', value: 'second' }),
    );
    // apply() always targets the CURRENT revision; craft a genuine stale one:
    expect(stale.ok).toBe(true);
    const directStale = bridge.session.applyTransaction({
      requestId: 'stale',
      expectedDocumentRevision: '1#0',
      commands: [
        { op: 'setProperty', nodeId: 'n.approveLabel', property: 'textLiteral', value: 'nope' },
      ],
    });
    expect(directStale.ok).toBe(false);
    if (!directStale.ok) expect(directStale.issues[0]?.code).toBe('UI_DOC_STALE_REVISION');
    expect(canonicalUiDocument(bridge.document).contentDigest).not.toBe(before);
    expect(bridge.document.nodes['n.approveLabel']).toMatchObject({
      content: { type: 'literal', value: 'second' },
    });
  });

  it('undo/redo + expected-revision save + reopen preserve IDs, layout and bindings', () => {
    const { bridge, storedRef, storedRevisionRef } = bridgeOverDocument();
    // edit: text + style on the status node
    bridge.apply(
      setTextLiteral({ requestId: 't1', nodeId: 'n.approveLabel', value: 'Approve (edited)' }),
    );
    bridge.apply(
      setStyle({
        requestId: 's1',
        nodeId: 'n.status',
        property: 'letter-spacing',
        value: { type: 'text', value: '0.02em' },
      }),
    );
    expect(bridge.getSnapshot().dirty).toBe(true);
    // undo restores the previous content but the revision never rewinds
    const digestAfterEdits = canonicalUiDocument(bridge.document).contentDigest;
    expect(bridge.undo().ok).toBe(true);
    expect(canonicalUiDocument(bridge.document).contentDigest).not.toBe(digestAfterEdits);
    const revisionAfterUndo = bridge.getSnapshot().revision;
    expect(bridge.redo().ok).toBe(true);
    expect(bridge.getSnapshot().revision).not.toBe(revisionAfterUndo);
    // save with the expected stored revision
    const save = bridge.save();
    expect(save.ok).toBe(true);
    if (!save.ok) return;
    expect(save.storedRevision).toBe('2');
    expect(storedRevisionRef()).toBe('2');
    // reopen: fresh session over the stored bytes — IDs/layout/bindings preserved
    const reopenedOutcome = bridge.reopen();
    expect(reopenedOutcome.ok).toBe(true);
    const reopened = bridge.document;
    expect(reopened.nodes['n.approveLabel']).toMatchObject({
      content: { type: 'literal', value: 'Approve (edited)' },
    });
    expect(reopened.nodes['n.status']).toMatchObject({ id: 'n.status', tag: 'span' });
    expect(reopened.root).toBe(inspectionDetailDocument.root);
    // and the stored bytes are the saved ones
    expect(canonicalUiDocument(storedRef()).contentDigest).toBe(save.contentDigest);
  });

  it('an invalid transaction is rejected with visible diagnostics and no partial effect', () => {
    const { bridge } = bridgeOverDocument();
    const digest = canonicalUiDocument(bridge.document).contentDigest;
    const outcome = bridge.session.applyTransaction({
      requestId: 'bad',
      expectedDocumentRevision: bridge.getSnapshot().revision,
      commands: [
        { op: 'setProperty', nodeId: 'n.approveLabel', property: 'textLiteral', value: 'x' },
        { op: 'remove', nodeId: 'n.root' },
      ],
    });
    expect(outcome.ok).toBe(false);
    expect(canonicalUiDocument(bridge.document).contentDigest).toBe(digest);
  });
});
