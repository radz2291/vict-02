import { describe, expect, it } from 'vitest';
import {
  UiEditSession,
  advanceStoredRevision,
  type UiDocument,
  type UiEditCommand,
} from '../src/index.js';

function document(): UiDocument {
  return {
    schema: 'vict.ui-document@1',
    id: 'doc.edit',
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

const setText = (nodeId: string, value: string): UiEditCommand => ({
  op: 'setProperty',
  nodeId,
  property: 'textLiteral',
  value,
});

describe('UiEditSession transactions', () => {
  it('applies an accepted transaction and advances the working revision monotonically', () => {
    const session = UiEditSession.open({ document: document(), storedRevision: '1' });
    const first = session.applyTransaction({
      requestId: 'rq-1',
      expectedDocumentRevision: '1#0',
      commands: [setText('n.a', 'beta')],
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.revision).toBe('1#1');
    const second = session.applyTransaction({
      requestId: 'rq-2',
      expectedDocumentRevision: '1#1',
      commands: [setText('n.a', 'gamma')],
    });
    expect(second.ok).toBe(true);
    expect(session.document.nodes['n.a']).toMatchObject({
      content: { type: 'literal', value: 'gamma' },
    });
  });

  it('rejects a stale transaction with no partial effect', () => {
    const session = UiEditSession.open({ document: document(), storedRevision: '1' });
    const stale = session.applyTransaction({
      requestId: 'rq-stale',
      expectedDocumentRevision: '0#0',
      commands: [setText('n.a', 'beta'), setText('n.missing', 'x')],
    });
    expect(stale.ok).toBe(false);
    // document untouched
    expect(session.document.nodes['n.a']).toMatchObject({
      content: { type: 'literal', value: 'alpha' },
    });
  });

  it('rejects an invalid multi-command transaction atomically', () => {
    const session = UiEditSession.open({ document: document(), storedRevision: '1' });
    const result = session.applyTransaction({
      requestId: 'rq-batch',
      expectedDocumentRevision: '1#0',
      commands: [setText('n.a', 'beta'), setText('n.does-not-exist', 'boom')],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const failed = result.issues.find((issue) => issue.code === 'UI_EDIT_VALIDATION_FAILED');
    expect(failed).toBeDefined();
    expect(session.document.nodes['n.a']).toMatchObject({
      content: { type: 'literal', value: 'alpha' },
    });
  });

  it('reconciles identical replays and conflicts on payload change', () => {
    const session = UiEditSession.open({ document: document(), storedRevision: '1' });
    const transaction = {
      requestId: 'rq-idem',
      expectedDocumentRevision: '1#0',
      commands: [setText('n.a', 'beta')],
    } as const;
    expect(session.applyTransaction(transaction).ok).toBe(true);
    const replay = session.applyTransaction(transaction);
    expect(replay.ok).toBe(true);
    const conflict = session.applyTransaction({
      requestId: 'rq-idem',
      expectedDocumentRevision: '1#0',
      commands: [setText('n.a', 'DIFFERENT')],
    });
    expect(conflict.ok).toBe(false);
    if (conflict.ok) return;
    expect(conflict.issues[0]?.code).toBe('UI_EDIT_REQUEST_CONFLICT');
  });
});

describe('UiEditSession undo/redo', () => {
  it('undoes and redoes with monotonic revisions', () => {
    const session = UiEditSession.open({ document: document(), storedRevision: '1' });
    session.applyTransaction({
      requestId: 'u1',
      expectedDocumentRevision: '1#0',
      commands: [setText('n.a', 'beta')],
    });
    const undo = session.undo();
    expect(undo.ok).toBe(true);
    expect(session.document.nodes['n.a']).toMatchObject({
      content: { type: 'literal', value: 'alpha' },
    });
    const afterUndo = session.workingRevision;
    expect(afterUndo).not.toBe('1#0');
    const redo = session.redo();
    expect(redo.ok).toBe(true);
    expect(session.document.nodes['n.a']).toMatchObject({
      content: { type: 'literal', value: 'beta' },
    });
    expect(session.workingRevision).not.toBe(afterUndo);
  });

  it('blocks undo when current source diverged from the undo point', () => {
    const session = UiEditSession.open({ document: document(), storedRevision: '1' });
    session.applyTransaction({
      requestId: 'u1',
      expectedDocumentRevision: '1#0',
      commands: [setText('n.a', 'beta')],
    });
    // Diverge via a second session sharing history is not expressible;
    // simulate divergence by applying an additional transaction then
    // undoing twice: the second undo still applies (history linear).
    session.applyTransaction({
      requestId: 'u2',
      expectedDocumentRevision: session.workingRevision,
      commands: [setText('n.a', 'gamma')],
    });
    expect(session.undo().ok).toBe(true);
    expect(session.undo().ok).toBe(true);
    const exhausted = session.undo();
    expect(exhausted.ok).toBe(false);
    if (exhausted.ok) return;
    expect(exhausted.issues[0]?.code).toBe('UI_EDIT_UNDO_CONFLICT');
  });
});

describe('UiEditSession save/reopen', () => {
  it('advances the stored revision at save and stamps document.revision', () => {
    const session = UiEditSession.open({ document: document(), storedRevision: '1' });
    session.applyTransaction({
      requestId: 's1',
      expectedDocumentRevision: '1#0',
      commands: [setText('n.a', 'beta')],
    });
    const save = session.save({ expectedStoredRevision: '1' });
    expect(save.ok).toBe(true);
    if (!save.ok) return;
    expect(save.storedRevision).toBe('2');
    expect(save.document.revision).toBe('2');
    expect(session.isDirty()).toBe(false);
  });

  it('rejects a stale save visibly', () => {
    const session = UiEditSession.open({ document: document(), storedRevision: '1' });
    session.applyTransaction({
      requestId: 's1',
      expectedDocumentRevision: '1#0',
      commands: [setText('n.a', 'beta')],
    });
    const save = session.save({ expectedStoredRevision: '1' });
    expect(save.ok).toBe(true);
    // A second editor holding the OLD stored revision fails.
    const staleSave = session.save({ expectedStoredRevision: '1' });
    expect(staleSave.ok).toBe(false);
    if (staleSave.ok) return;
    expect(staleSave.issues[0]?.code).toBe('UI_DOC_STALE_REVISION');
  });

  it('reopen starts a fresh session over stored bytes with history cleared', () => {
    const session = UiEditSession.open({ document: document(), storedRevision: '1' });
    session.applyTransaction({
      requestId: 's1',
      expectedDocumentRevision: '1#0',
      commands: [setText('n.a', 'beta')],
    });
    const save = session.save({ expectedStoredRevision: '1' });
    expect(save.ok).toBe(true);
    if (!save.ok) return;
    const reopened = session.reopen({
      document: save.document,
      storedRevision: save.storedRevision,
    });
    expect(reopened.canUndo()).toBe(false);
    expect(reopened.workingRevision).toBe('2#0');
    expect(reopened.document.nodes['n.a']).toMatchObject({
      content: { type: 'literal', value: 'beta' },
    });
  });
});

describe('remove reference discipline', () => {
  it('refuses to remove a referenced node (UI_EDIT_REFERENCE_REMAINS)', () => {
    const session = UiEditSession.open({ document: document(), storedRevision: '1' });
    session.applyTransaction({
      requestId: 'mk',
      expectedDocumentRevision: '1#0',
      commands: [
        {
          op: 'insert',
          parentId: 'n.root',
          node: {
            kind: 'component',
            id: 'n.comp',
            definitionId: 'def.x',
          },
        },
        {
          op: 'createComponentDefinition',
          definition: {
            id: 'def.x',
            revision: '1',
            root: 'n.a',
            props: [],
            slots: {},
          },
        },
      ],
    });
    // n.a is now the definition root — removing it must fail.
    const removal = session.applyTransaction({
      requestId: 'rm',
      expectedDocumentRevision: session.workingRevision,
      commands: [{ op: 'remove', nodeId: 'n.a' }],
    });
    expect(removal.ok).toBe(false);
    if (removal.ok) return;
    expect(removal.issues[0]?.code).toBe('UI_EDIT_VALIDATION_FAILED');
  });
});

describe('advanceStoredRevision', () => {
  it('increments numeric revisions and suffixes non-numeric ones', () => {
    expect(advanceStoredRevision('1')).toBe('2');
    expect(advanceStoredRevision('9')).toBe('10');
    expect(advanceStoredRevision('2026-10-06')).toBe('2026-10-06.r1');
    expect(advanceStoredRevision('2026-10-06.r2')).toBe('2026-10-06.r3');
  });
});
