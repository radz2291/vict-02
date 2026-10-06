import { describe, expect, it } from 'vitest';
// Import the bridge module directly: the unit project has no Svelte toolchain
// (the barrel re-exports .svelte components; the bridge itself is neutral).
import { EditorBridge, type DocumentStorePort } from '../src/bridge.js';
import { UiEditSession } from '@victframework/ui';
import type { UiDocument } from '@victframework/ui';

function document(): UiDocument {
  return {
    schema: 'vict.ui-document@1',
    id: 'doc.bridge',
    revision: '1',
    root: 'n.root',
    nodes: {
      'n.root': { kind: 'element', id: 'n.root', tag: 'section', children: ['n.a'] },
      'n.a': { kind: 'text', id: 'n.a', content: { type: 'literal', value: 'alpha' } },
    },
    componentDefinitions: {},
    styleSources: {},
    tokens: {},
    conditions: {},
    assets: {},
    localState: {},
  };
}

const setText = (requestId: string, nodeId: string, value: string) => ({
  requestId,
  expectedDocumentRevision: '',
  commands: [{ op: 'setProperty' as const, nodeId, property: 'textLiteral' as const, value }],
});

type StoreState = { document: UiDocument; storedRevision: string };

function memoryStore(initial: StoreState): {
  readonly port: DocumentStorePort;
  readonly state: () => StoreState;
  readonly failNext: (mode: 'fail' | 'throw' | undefined) => void;
} {
  const state: { current: StoreState } = { current: { ...initial } };
  let failure: 'fail' | 'throw' | undefined;
  return {
    port: {
      load: () => ({ status: 'loaded' as const, ...state.current }),
      save: (input) => {
        if (failure === 'throw') {
          throw new Error('storage medium exploded');
        }
        if (failure === 'fail') {
          return {
            ok: false as const,
            code: 'UI_STORE_WRITE_FAILED' as const,
            reason: 'write refused',
          };
        }
        if (input.expectedStoredRevision !== state.current.storedRevision) {
          return {
            ok: false as const,
            code: 'UI_DOC_STALE_REVISION' as const,
            reason: `stored revision is ${state.current.storedRevision}, expected ${input.expectedStoredRevision}`,
          };
        }
        state.current = { document: input.document, storedRevision: input.newStoredRevision };
        return { ok: true as const, storedRevision: input.newStoredRevision };
      },
    },
    state: () => ({ ...state.current }),
    failNext: (mode) => {
      failure = mode;
    },
  };
}

function bridgeOver(store: DocumentStorePort, seed: StoreState): EditorBridge {
  return new EditorBridge({ store, initial: seed });
}

describe('EditorBridge two-phase save (store is the revision authority)', () => {
  it('a FAILED store write preserves working doc, dirty state, stored revision and undo/redo', () => {
    const store = memoryStore({ document: document(), storedRevision: '1' });
    const bridge = bridgeOver(store.port, { document: document(), storedRevision: '1' });
    const t1 = {
      ...setText('r1', 'n.a', 'beta'),
      expectedDocumentRevision: bridge.getSnapshot().revision,
    };
    expect(bridge.apply(t1).ok).toBe(true);
    const t2 = {
      ...setText('r2', 'n.a', 'gamma'),
      expectedDocumentRevision: bridge.getSnapshot().revision,
    };
    expect(bridge.apply(t2).ok).toBe(true);
    const workingDigestBefore = bridge.getSnapshot().contentDigest;
    const storedBefore = store.state();

    store.failNext('fail');
    const outcome = bridge.save();
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.issues[0]?.code).toBe('UI_STORE_WRITE_FAILED');
    }
    // EXACT state preservation: revision, dirty, working source, undo/redo.
    expect(bridge.getSnapshot().storedRevision).toBe('1');
    expect(bridge.getSnapshot().dirty).toBe(true);
    expect(bridge.getSnapshot().contentDigest).toBe(workingDigestBefore);
    expect(store.state()).toEqual(storedBefore);
    expect(bridge.getSnapshot().canUndo).toBe(true);
    expect(bridge.undo().ok).toBe(true);
    expect(bridge.redo().ok).toBe(true);

    // Retry after the failed write: correct next revision, no skips.
    store.failNext(undefined);
    const retry = bridge.save();
    expect(retry.ok).toBe(true);
    if (retry.ok) expect(retry.storedRevision).toBe('2');
    expect(store.state().storedRevision).toBe('2');
  });

  it('a THROWN storage write reports truthfully and preserves everything', () => {
    const store = memoryStore({ document: document(), storedRevision: '1' });
    const bridge = bridgeOver(store.port, { document: document(), storedRevision: '1' });
    const t1 = {
      ...setText('rt', 'n.a', 'beta'),
      expectedDocumentRevision: bridge.getSnapshot().revision,
    };
    expect(bridge.apply(t1).ok).toBe(true);
    const workingDigestBefore = bridge.getSnapshot().contentDigest;

    store.failNext('throw');
    const outcome = bridge.save();
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.issues[0]?.code).toBe('UI_STORE_WRITE_FAILED');
      expect(outcome.issues[0]?.message).toContain('storage medium exploded');
    }
    expect(bridge.getSnapshot().storedRevision).toBe('1');
    expect(bridge.getSnapshot().dirty).toBe(true);
    expect(bridge.getSnapshot().contentDigest).toBe(workingDigestBefore);
    expect(store.state().storedRevision).toBe('1');
  });

  it('a stale editor cannot overwrite a newer saved document (authoritative check)', () => {
    const store = memoryStore({ document: document(), storedRevision: '1' });
    const seed = { document: structuredClone(document()), storedRevision: '1' };
    const editorA = bridgeOver(store.port, seed);
    const editorB = bridgeOver(store.port, seed);

    const ta = {
      ...setText('ra', 'n.a', 'from A'),
      expectedDocumentRevision: editorA.getSnapshot().revision,
    };
    expect(editorA.apply(ta).ok).toBe(true);
    const saveA = editorA.save();
    expect(saveA.ok).toBe(true);
    if (saveA.ok) expect(saveA.storedRevision).toBe('2');

    // B never saw A's save: its session still sits at stored revision 1.
    expect(editorB.getSnapshot().storedRevision).toBe('1');
    const tb = {
      ...setText('rb', 'n.a', 'from B'),
      expectedDocumentRevision: editorB.getSnapshot().revision,
    };
    expect(editorB.apply(tb).ok).toBe(true);
    const saveB = editorB.save();
    expect(saveB.ok).toBe(false);
    if (!saveB.ok) expect(saveB.issues[0]?.code).toBe('UI_DOC_STALE_REVISION');
    // The store still holds A's bytes — B did NOT overwrite.
    expect(store.state().storedRevision).toBe('2');
    expect(store.state().document.nodes['n.a']).toMatchObject({
      content: { type: 'literal', value: 'from A' },
    });
    // B's working state is preserved (unsaved edits kept, still dirty).
    expect(editorB.getSnapshot().dirty).toBe(true);
    expect(editorB.document.nodes['n.a']).toMatchObject({
      content: { type: 'literal', value: 'from B' },
    });
  });

  it('an edit accepted between stage and commit is PRESERVED and the commit is refused', () => {
    const store = memoryStore({ document: document(), storedRevision: '1' });
    const seed = { document: document(), storedRevision: '1' };
    const bridge = bridgeOver(store.port, seed);
    // direct two-phase drive: stage, then sneak an edit in, then commit
    const session = bridge.session;
    const staged = session.stageSave({ expectedStoredRevision: session.storedRevision });
    expect(staged.ok).toBe(true);
    if (!staged.ok) return;
    const sneak = {
      ...setText('rs', 'n.a', 'sneaky edit'),
      expectedDocumentRevision: bridge.getSnapshot().revision,
    };
    expect(bridge.apply(sneak).ok).toBe(true);
    const committed = session.commitSave(staged.staged);
    expect(committed.ok).toBe(false);
    // the intervening edit is preserved, truthful: still dirty, old baseline
    expect(bridge.getSnapshot().dirty).toBe(true);
    expect(bridge.document.nodes['n.a']).toMatchObject({
      content: { type: 'literal', value: 'sneaky edit' },
    });
    expect(bridge.getSnapshot().storedRevision).toBe('1');
    expect(store.state().storedRevision).toBe('1');
  });

  it('a synchronous re-entrant store callback cannot accept edits inside the save window', () => {
    const seed = { document: document(), storedRevision: '1' };
    const reentrantAttempts: string[] = [];
    const state = { current: { ...seed } };
    const bridgeRefCapture: { current: EditorBridge } = {
      current: undefined as unknown as EditorBridge,
    };
    const port: DocumentStorePort = {
      load: () => ({ status: 'loaded' as const, ...state.current }),
      save: (input) => {
        // re-entrancy: try to edit DURING the save acknowledgment
        const bridgeRef = bridgeRefCapture.current;
        const attempt = {
          ...setText('re', 'n.a', 'during save'),
          expectedDocumentRevision: bridgeRef.getSnapshot().revision,
        };
        const outcome = bridgeRef.apply(attempt);
        reentrantAttempts.push(outcome.ok ? 'ACCEPTED' : 'REFUSED');
        state.current = { document: input.document, storedRevision: input.newStoredRevision };
        return { ok: true as const, storedRevision: input.newStoredRevision };
      },
    };
    const bridge = new EditorBridge({ store: port, initial: seed });
    bridgeRefCapture.current = bridge;
    const edit = {
      ...setText('r1', 'n.a', 'before save'),
      expectedDocumentRevision: bridge.getSnapshot().revision,
    };
    expect(bridge.apply(edit).ok).toBe(true);
    const save = bridge.save();
    expect(save.ok).toBe(true);
    expect(reentrantAttempts).toEqual(['REFUSED']);
    // nothing was lost: the saved content is the pre-save edit; the refused edit can now be applied
    expect(bridge.document.nodes['n.a']).toMatchObject({
      content: { type: 'literal', value: 'before save' },
    });
    const afterSave = {
      ...setText('r2', 'n.a', 'after save'),
      expectedDocumentRevision: bridge.getSnapshot().revision,
    };
    expect(bridge.apply(afterSave).ok).toBe(true);
  });

  it('a stage from another session is rejected by commitSave', () => {
    const sessionA = UiEditSession.open({ document: document(), storedRevision: '1' });
    const sessionB = UiEditSession.open({
      document: structuredClone(document()),
      storedRevision: '1',
    });
    const stagedA = sessionA.stageSave({ expectedStoredRevision: '1' });
    expect(stagedA.ok).toBe(true);
    if (!stagedA.ok) return;
    const foreign = sessionB.commitSave(stagedA.staged);
    expect(foreign.ok).toBe(false);
    expect(sessionB.storedRevision).toBe('1');
  });
  it('reopen reports empty and invalid stores instead of faking success', () => {
    const emptyPort: DocumentStorePort = {
      load: () => ({ status: 'empty' }),
      save: () => ({ ok: false, reason: 'unused' }),
    };
    const emptyBridge = bridgeOver(emptyPort, { document: document(), storedRevision: '1' });
    const emptyResult = emptyBridge.reopen();
    expect(emptyResult.ok).toBe(false);
    if (!emptyResult.ok) expect(emptyResult.code).toBe('UI_STORE_EMPTY');

    const invalidPort: DocumentStorePort = {
      load: () => ({ status: 'invalid', message: 'stored payload is not valid JSON' }),
      save: () => ({ ok: false, reason: 'unused' }),
    };
    const invalidBridge = bridgeOver(invalidPort, { document: document(), storedRevision: '1' });
    const invalidResult = invalidBridge.reopen();
    expect(invalidResult.ok).toBe(false);
    if (!invalidResult.ok) {
      expect(invalidResult.code).toBe('UI_STORE_INVALID');
      expect(invalidResult.message).toContain('not valid JSON');
    }
    // The failed reopen did not disturb the session.
    expect(invalidBridge.getSnapshot().storedRevision).toBe('1');
  });
});
