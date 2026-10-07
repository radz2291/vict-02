import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  EditorBridge,
  connectInteraction,
  insertElement,
  setStyle,
  setTextLiteral,
} from '@victframework/ui-editor';
import { canonicalUiDocument, type UiDocument } from '@victframework/ui';
import { createAuthoringStore, SEED_STORED_REVISION } from '../src/lib/authoring/store.js';
import { studioDocumentCatalogs } from '../src/lib/product/compile.js';
import { inspectionDetailDocument } from '../src/lib/product/definitions.js';
const NEXT_STORED_REVISION = String(Number(SEED_STORED_REVISION) + 1);

/**
 * U1-04 reopen-round: authoring persistence through the REAL localStorage
 * adapter (happy-dom provides the Storage implementation). A fresh
 * EditorBridge initialized from the same storage simulates exactly what a
 * full page reload does (component init reads the store); the actual
 * browser reload journey is verified separately via CDP.
 */

function freshBridgeFromStorage() {
  // Component-init semantics: load persisted source; seed only when empty.
  const store = createAuthoringStore(window.localStorage, studioDocumentCatalogs);
  const load = store.rawLoad();
  const initial =
    load.status === 'loaded'
      ? { document: load.document, storedRevision: load.storedRevision }
      : {
          document: structuredClone(inspectionDetailDocument),
          storedRevision: SEED_STORED_REVISION,
        };
  return { store, load, bridge: new EditorBridge({ store, initial }) };
}

describe('U1-04: authoring persistence (localStorage store)', () => {
  it('an empty store seeds; a saved document loads on fresh init (reload semantics)', () => {
    window.localStorage.clear();
    const first = freshBridgeFromStorage();
    expect(first.load.status).toBe('empty');
    expect(first.bridge.getSnapshot().storedRevision).toBe(SEED_STORED_REVISION);
    expect(SEED_STORED_REVISION).toBe(inspectionDetailDocument.revision);

    // edit + save (persisted)
    const t1 = setTextLiteral({
      requestId: 'r1',
      nodeId: 'n.approveLabel',
      value: 'Approve (edited)',
    });
    expect(first.bridge.apply(t1).ok).toBe(true);
    const save = first.bridge.save();
    expect(save.ok).toBe(true);
    if (!save.ok) return;
    expect(save.storedRevision).toBe(NEXT_STORED_REVISION);
    expect(first.bridge.document.revision).toBe(NEXT_STORED_REVISION);

    // "full page reload": a brand-new bridge reads the same storage
    const second = freshBridgeFromStorage();
    expect(second.load.status).toBe('loaded');
    if (second.load.status !== 'loaded') return;
    expect(second.load.storedRevision).toBe(save.storedRevision);
    expect(canonicalUiDocument(second.bridge.document).contentDigest).toBe(save.contentDigest);
    expect(second.bridge.document.nodes['n.approveLabel']).toMatchObject({
      content: { type: 'literal', value: 'Approve (edited)' },
    });
    expect(second.bridge.getSnapshot().dirty).toBe(false);
  });

  it('saved source fidelity: inserted IDs, styles, bindings and interactions survive reload', () => {
    window.localStorage.clear();
    const first = freshBridgeFromStorage();
    const inserted = first.bridge.apply(
      insertElement({
        requestId: 'i1',
        parentId: 'n.root',
        index: 0,
        node: { kind: 'element', id: 'n.insertedNote', tag: 'p', children: [] },
      }),
    );
    if (!inserted.ok)
      fs.writeFileSync('insert-issues.txt', JSON.stringify(inserted.issues, null, 1));
    expect(inserted.ok).toBe(true);
    const insertedText = first.bridge.apply(
      insertElement({
        requestId: 'i2',
        parentId: 'n.insertedNote',
        node: {
          kind: 'text',
          id: 'n.insertedNoteText',
          content: { type: 'literal', value: 'Inserted note' },
        },
      }),
    );
    if (!insertedText.ok)
      fs.writeFileSync('insert-issues.txt', JSON.stringify(insertedText.issues, null, 1));
    expect(insertedText.ok).toBe(true);
    expect(
      first.bridge.apply(
        setStyle({
          requestId: 's1',
          nodeId: 'n.status',
          property: 'letter-spacing',
          value: { type: 'text', value: '0.02em' },
        }),
      ).ok,
    ).toBe(true);
    expect(
      first.bridge.apply(
        connectInteraction({
          requestId: 'c1',
          nodeId: 'n.approveButton',
          interaction: { on: 'click', action: 'invokeAction', actionId: 'inspection.approve' },
        }),
      ).ok,
    ).toBe(true);
    const save = first.bridge.save();
    expect(save.ok).toBe(true);

    const second = freshBridgeFromStorage();
    expect(second.load.status).toBe('loaded');
    const reopened = second.bridge.document;
    // inserted node id + content preserved
    expect(reopened.nodes['n.insertedNote']).toMatchObject({
      kind: 'element',
      tag: 'p',
    });
    expect(reopened.nodes['n.insertedNoteText']).toMatchObject({
      kind: 'text',
      content: { type: 'literal', value: 'Inserted note' },
    });
    // styles preserved (instance-local declarations, innermost cascade layer)
    const statusAfter = reopened.nodes['n.status'] as {
      localStyle?: readonly { property: string; value: unknown }[];
    };
    expect(
      statusAfter.localStyle?.some(
        (decl) =>
          decl.property === 'letter-spacing' &&
          (decl.value as { type: string; value?: string }).type === 'text' &&
          (decl.value as { type: string; value?: string }).value === '0.02em',
      ),
    ).toBe(true);
    // interactions preserved
    const button = reopened.nodes['n.approveButton'] as {
      interactions?: readonly { on: string; action: string; actionId?: string }[];
    };
    expect(
      button.interactions?.some(
        (entry) =>
          entry.on === 'click' &&
          entry.action === 'invokeAction' &&
          entry.actionId === 'inspection.approve',
      ),
    ).toBe(true);
    // exact digest match with the saved bytes
    expect(canonicalUiDocument(reopened).contentDigest).toBe(save.ok ? save.contentDigest : '');
  });

  it('corrupt or incompatible stored content is reported, never a fake reopen', () => {
    window.localStorage.clear();
    window.localStorage.setItem('vict.u1.authoring.doc', '{not json');
    const corrupt = createAuthoringStore(window.localStorage, studioDocumentCatalogs).rawLoad();
    expect(corrupt.status).toBe('invalid');

    window.localStorage.setItem(
      'vict.u1.authoring.doc',
      JSON.stringify({ format: 'some.other.format@9', document: {}, storedRevision: '3' }),
    );
    const incompatible = createAuthoringStore(
      window.localStorage,
      studioDocumentCatalogs,
    ).rawLoad();
    expect(incompatible.status).toBe('invalid');

    window.localStorage.setItem(
      'vict.u1.authoring.doc',
      JSON.stringify({
        format: 'vict.authoring-store@1',
        document: {
          ...inspectionDetailDocument,
          nodes: {
            ...inspectionDetailDocument.nodes,
            'n.ghost': { kind: 'text', id: 'n.ghost', content: { type: 'literal', value: 'x' } },
          },
        },
        storedRevision: '4',
      }),
    );
    const broken = createAuthoringStore(window.localStorage, studioDocumentCatalogs).rawLoad();
    expect(broken.status).toBe('invalid');
    if (broken.status === 'invalid') {
      expect(broken.message).toMatch(/invalid|UNREACHABLE|GHOST|STRUCTURAL/i);
    }
  });

  it('a stale second editor is rejected by the real store without overwriting', () => {
    window.localStorage.clear();
    const a = freshBridgeFromStorage();
    expect(
      a.bridge.apply(setTextLiteral({ requestId: 'a1', nodeId: 'n.approveLabel', value: 'from A' }))
        .ok,
    ).toBe(true);
    expect(a.bridge.save().ok).toBe(true); // store now at the next seed revision

    // editor B was opened from the SAME pre-save storage state (seed revision)
    const bDocument: UiDocument = structuredClone(inspectionDetailDocument);
    const storeB = createAuthoringStore(window.localStorage, studioDocumentCatalogs);
    const bridgeB = new EditorBridge({
      store: storeB,
      initial: { document: bDocument, storedRevision: SEED_STORED_REVISION },
    });
    expect(
      bridgeB.apply(setTextLiteral({ requestId: 'b1', nodeId: 'n.approveLabel', value: 'from B' }))
        .ok,
    ).toBe(true);
    const saveB = bridgeB.save();
    expect(saveB.ok).toBe(false);
    if (!saveB.ok) expect(saveB.issues[0]?.code).toBe('UI_DOC_STALE_REVISION');
    // A's bytes survived; B keeps its unsaved working edits (dirty)
    const after = createAuthoringStore(window.localStorage, studioDocumentCatalogs).rawLoad();
    expect(after.status).toBe('loaded');
    if (after.status === 'loaded') {
      expect(after.storedRevision).toBe(NEXT_STORED_REVISION);
      expect(after.document.nodes['n.approveLabel']).toMatchObject({
        content: { type: 'literal', value: 'from A' },
      });
    }
    expect(bridgeB.getSnapshot().dirty).toBe(true);
  });

  it('a throwing storage write preserves state; retry persists at the correct revision', () => {
    window.localStorage.clear();
    const store = createAuthoringStore(window.localStorage, studioDocumentCatalogs);
    const initial = {
      document: structuredClone(inspectionDetailDocument),
      storedRevision: SEED_STORED_REVISION,
    };
    const bridge = new EditorBridge({ store, initial });
    expect(
      bridge.apply(setTextLiteral({ requestId: 'e1', nodeId: 'n.approveLabel', value: 'kept' })).ok,
    ).toBe(true);
    const digestBefore = bridge.getSnapshot().contentDigest;

    const spy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    const failed = bridge.save();
    spy.mockRestore();
    expect(failed.ok).toBe(false);
    if (!failed.ok) expect(failed.issues[0]?.code).toBe('UI_STORE_WRITE_FAILED');

    // exact preservation
    expect(bridge.getSnapshot().storedRevision).toBe(SEED_STORED_REVISION);
    expect(bridge.getSnapshot().dirty).toBe(true);
    expect(bridge.getSnapshot().contentDigest).toBe(digestBefore);
    // retry succeeds at the correct next revision
    const retry = bridge.save();
    expect(retry.ok).toBe(true);
    if (retry.ok) expect(retry.storedRevision).toBe(NEXT_STORED_REVISION);
    const reloaded = freshBridgeFromStorage();
    expect(reloaded.load.status).toBe('loaded');
    if (reloaded.load.status === 'loaded') {
      expect(reloaded.load.document.nodes['n.approveLabel']).toMatchObject({
        content: { type: 'literal', value: 'kept' },
      });
    }
  });

  it('previous revision1 envelopes remain readable and save against their recorded revision', () => {
    window.localStorage.clear();
    const legacy: UiDocument = {
      ...inspectionDetailDocument,
      revision: '1',
      root: 'legacy.root',
      nodes: {
        'legacy.root': { kind: 'element', id: 'legacy.root', tag: 'p', children: ['legacy.text'] },
        'legacy.text': {
          kind: 'text',
          id: 'legacy.text',
          content: { type: 'literal', value: 'Saved presentation' },
        },
      },
      componentDefinitions: {},
      styleSources: {},
      tokens: {},
      conditions: {},
      localState: {},
    };
    window.localStorage.setItem(
      'vict.u1.authoring.doc',
      JSON.stringify({ format: 'vict.authoring-store@1', storedRevision: '1', document: legacy }),
    );
    const loaded = freshBridgeFromStorage();
    expect(loaded.load.status).toBe('loaded');
    expect(loaded.bridge.getSnapshot().storedRevision).toBe('1');
    expect(
      loaded.bridge.apply(
        setTextLiteral({
          requestId: 'legacy-edit',
          nodeId: 'legacy.text',
          value: 'Preserved and edited',
        }),
      ).ok,
    ).toBe(true);
    const saved = loaded.bridge.save();
    expect(saved.ok).toBe(true);
    if (saved.ok) expect(saved.storedRevision).toBe('2');
    expect(createAuthoringStore(window.localStorage, studioDocumentCatalogs).rawLoad().status).toBe(
      'loaded',
    );
  });
});

describe('round 3: malformed stored documents diagnose reliably', () => {
  const baseDocument = () => structuredClone(inspectionDetailDocument);

  function seedEnvelope(document: unknown, storedRevision = '4'): string {
    return JSON.stringify({ format: 'vict.authoring-store@1', document, storedRevision });
  }

  const cases: readonly [string, (doc: Record<string, unknown>) => Record<string, unknown>][] = [
    ['unsupported document schema', (doc) => ({ ...doc, schema: 'vict.ui-document@9' })],
    ['missing node registry', (doc) => ({ ...doc, nodes: undefined })],
    [
      'null node',
      (doc) => ({
        ...doc,
        nodes: { ...(doc['nodes'] as Record<string, unknown>), 'n.status': null },
      }),
    ],
    [
      'malformed child structure (non-string child)',
      (doc) => ({
        ...doc,
        nodes: {
          ...(doc['nodes'] as Record<string, unknown>),
          'n.root': {
            ...(doc['root'] as Record<string, unknown>),
            children: ['n.approveButton', 42],
          },
        },
      }),
    ],
    [
      'malformed branch structure',
      (doc) => ({
        ...doc,
        nodes: {
          ...(doc['nodes'] as Record<string, unknown>),
          'n.root': {
            ...((doc['nodes'] as Record<string, unknown>)['n.root'] as Record<string, unknown>),
            kind: 'conditional',
            branches: 'not-an-array',
          },
        },
      }),
    ],
  ];

  for (const [name, mutate] of cases) {
    it(`diagnoses: ${name} (visible-invalid, no exception, bytes preserved)`, () => {
      window.localStorage.clear();
      const raw = seedEnvelope(mutate(baseDocument() as unknown as Record<string, unknown>));
      window.localStorage.setItem('vict.u1.authoring.doc', raw);
      const store = createAuthoringStore(window.localStorage, studioDocumentCatalogs);
      const load = store.rawLoad();
      expect(load.status).toBe('invalid');
      if (load.status === 'invalid') {
        expect(load.message.length).toBeGreaterThan(0);
        expect(load.overwritable).toBe(true);
      }
      // the unreadable-by-the-app bytes are PRESERVED verbatim
      expect(window.localStorage.getItem('vict.u1.authoring.doc')).toBe(raw);
    });
  }

  it('an EMPTY document (no nodes) is diagnosed, not loaded', () => {
    window.localStorage.clear();
    window.localStorage.setItem(
      'vict.u1.authoring.doc',
      seedEnvelope({
        schema: 'vict.ui-document@1',
        id: 'doc.x',
        revision: '1',
        root: 'n.root',
        nodes: {},
      }),
    );
    const store = createAuthoringStore(window.localStorage, studioDocumentCatalogs);
    const load = store.rawLoad();
    expect(load.status).toBe('invalid');
    if (load.status === 'invalid') expect(load.message).toMatch(/empty|node/i);
  });

  it('an unreadable payload is refused on save (bytes preserved) and reported not-overwritable', () => {
    window.localStorage.clear();
    const garbage = '{totally not json';
    window.localStorage.setItem('vict.u1.authoring.doc', garbage);
    const store = createAuthoringStore(window.localStorage, studioDocumentCatalogs);
    const load = store.rawLoad();
    expect(load.status).toBe('invalid');
    if (load.status === 'invalid') expect(load.overwritable).toBe(false);
    // save must REFUSE (never silently replace unreadable bytes)
    const save = store.save({
      document: baseDocument(),
      newStoredRevision: '2',
      expectedStoredRevision: '1',
    });
    expect(save.ok).toBe(false);
    if (!save.ok) expect(save.code).toBe('UI_STORE_CORRUPT');
    expect(window.localStorage.getItem('vict.u1.authoring.doc')).toBe(garbage);
  });

  it('a READABLE envelope with an invalid document is overwritable (save replaces it)', () => {
    window.localStorage.clear();
    const broken = baseDocument() as unknown as Record<string, unknown>;
    window.localStorage.setItem(
      'vict.u1.authoring.doc',
      seedEnvelope({ ...broken, schema: 'vict.ui-document@9' }),
    );
    const store = createAuthoringStore(window.localStorage, studioDocumentCatalogs);
    const load = store.rawLoad();
    expect(load.status).toBe('invalid');
    if (load.status === 'invalid') expect(load.overwritable).toBe(true);
    const save = store.save({
      document: baseDocument(),
      newStoredRevision: '5',
      expectedStoredRevision: '4',
    });
    expect(save.ok).toBe(true);
    const reloaded = store.rawLoad();
    expect(reloaded.status).toBe('loaded');
  });

  describe('round 4: preservation policy enforced in save (same as load)', () => {
    it('wrong-format envelope (readable storedRevision) is refused at legacy revision1; bytes intact', () => {
      const window = new Window();
      const stored = JSON.stringify({ format: 'future.format', storedRevision: '1', document: {} });
      window.localStorage.setItem('vict.u1.authoring.doc', stored);
      const store = createAuthoringStore(window.localStorage, studioDocumentCatalogs);
      const load = store.rawLoad();
      expect(load.status).toBe('invalid');
      if (load.status !== 'invalid') throw new Error('expected invalid load');
      expect(load.overwritable).toBe(false);
      const outcome = store.save({
        document: inspectionDetailDocument,
        newStoredRevision: '2',
        expectedStoredRevision: '1',
      });
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) expect(outcome.code).toBe('UI_STORE_CORRUPT');
      expect(window.localStorage.getItem('vict.u1.authoring.doc')).toBe(stored);
      window.close();
    });

    it('envelope with missing document is refused at legacy revision1; bytes intact', () => {
      const window = new Window();
      const stored = JSON.stringify({ format: 'vict.authoring-store@1', storedRevision: '1' });
      window.localStorage.setItem('vict.u1.authoring.doc', stored);
      const store = createAuthoringStore(window.localStorage, studioDocumentCatalogs);
      const load = store.rawLoad();
      expect(load.status).toBe('invalid');
      if (load.status !== 'invalid') throw new Error('expected invalid load');
      expect(load.overwritable).toBe(false);
      const outcome = store.save({
        document: inspectionDetailDocument,
        newStoredRevision: '2',
        expectedStoredRevision: '1',
      });
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) expect(outcome.code).toBe('UI_STORE_CORRUPT');
      expect(window.localStorage.getItem('vict.u1.authoring.doc')).toBe(stored);
      window.close();
    });

    it('preserved classes are also refused at NON-seed revisions (preservation dominates staleness)', () => {
      const window = new Window();
      const storedA = JSON.stringify({
        format: 'future.format',
        storedRevision: '7',
        document: {},
      });
      const storedB = JSON.stringify({ format: 'vict.authoring-store@1', storedRevision: '7' });
      for (const stored of [storedA, storedB]) {
        window.localStorage.setItem('vict.u1.authoring.doc', stored);
        const store = createAuthoringStore(window.localStorage, studioDocumentCatalogs);
        const outcome = store.save({
          document: inspectionDetailDocument,
          newStoredRevision: '8',
          expectedStoredRevision: '7',
        });
        expect(outcome.ok).toBe(false);
        if (!outcome.ok) expect(outcome.code).toBe('UI_STORE_CORRUPT');
        expect(window.localStorage.getItem('vict.u1.authoring.doc')).toBe(stored);
      }
      window.close();
    });

    it('preserved class with MISMATCHED expectation is refused (not misreported as stale); bytes intact', () => {
      const window = new Window();
      const stored = JSON.stringify({ format: 'future.format', storedRevision: '1', document: {} });
      window.localStorage.setItem('vict.u1.authoring.doc', stored);
      const store = createAuthoringStore(window.localStorage, studioDocumentCatalogs);
      const outcome = store.save({
        document: inspectionDetailDocument,
        newStoredRevision: '2',
        expectedStoredRevision: '999',
      });
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) expect(outcome.code).toBe('UI_STORE_CORRUPT');
      expect(window.localStorage.getItem('vict.u1.authoring.doc')).toBe(stored);
      window.close();
    });

    it('explicitly overwritable documents STILL replace successfully (policy retained)', () => {
      const window = new Window();
      const corrupt = JSON.stringify({
        format: 'vict.authoring-store@1',
        storedRevision: '3',
        document: { schema: 'vict.ui-document@9' },
      });
      window.localStorage.setItem('vict.u1.authoring.doc', corrupt);
      const store = createAuthoringStore(window.localStorage, studioDocumentCatalogs);
      const load = store.rawLoad();
      expect(load.status).toBe('invalid');
      if (load.status !== 'invalid') throw new Error('expected invalid load');
      expect(load.overwritable).toBe(true);
      const outcome = store.save({
        document: inspectionDetailDocument,
        newStoredRevision: '4',
        expectedStoredRevision: '3',
      });
      expect(outcome.ok).toBe(true);
      const reloaded = store.rawLoad();
      expect(reloaded.status).toBe('loaded');
      if (reloaded.status === 'loaded') expect(reloaded.storedRevision).toBe('4');
      window.close();
    });
  });
});
