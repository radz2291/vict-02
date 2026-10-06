/**
 * U2 proof regression tests — persistence through the shared localStorage
 * store, service-document integrity, instance-override round trip, and the
 * contact adapter's honest outcomes.
 */
import { describe, expect, it } from 'vitest';
import { Window } from 'happy-dom';
import { compileUiDocument, UiEditSession, validateUiDocument } from '@victframework/ui';
import { classifyStored, createLocalStorageDocumentStore } from '@victframework/ui-editor';
import { designCatalogs, validateContact } from '../src/lib/design/adapter.js';
import {
  serviceDocument,
  SERVICE_STORE_KEY,
  DESIGN_STORE_FORMAT,
  SERVICE_SEED_REVISION,
} from '../src/lib/design/service-document.js';
import { fixtureDocument, FIXTURE_STORE_KEY } from '../src/lib/design/fixture-document.js';

function freshWindow(): Window {
  return new Window();
}

describe('shared localStorage store (U2-07 reusability + U1 policy)', () => {
  it('seeds on empty; a saved document loads on fresh init (reload semantics)', () => {
    const window = freshWindow();
    const store = createLocalStorageDocumentStore(window.localStorage, {
      key: SERVICE_STORE_KEY,
      format: DESIGN_STORE_FORMAT,
      seedStoredRevision: SERVICE_SEED_REVISION,
    });
    expect(store.rawLoad().status).toBe('empty');
    const outcome = store.save({
      document: serviceDocument,
      newStoredRevision: '2',
      expectedStoredRevision: SERVICE_SEED_REVISION,
    });
    expect(outcome.ok).toBe(true);
    const reopened = createLocalStorageDocumentStore(window.localStorage, {
      key: SERVICE_STORE_KEY,
      format: DESIGN_STORE_FORMAT,
      seedStoredRevision: SERVICE_SEED_REVISION,
    });
    const load = reopened.rawLoad();
    expect(load.status).toBe('loaded');
    if (load.status === 'loaded') expect(load.storedRevision).toBe('2');
    window.close();
  });

  it('preserved classes are refused in save at seed AND non-seed revisions; bytes intact', () => {
    for (const storedRevision of ['1', '7']) {
      const window = freshWindow();
      const stored = JSON.stringify({
        format: 'future.format',
        storedRevision,
        document: {},
      });
      window.localStorage.setItem(SERVICE_STORE_KEY, stored);
      const store = createLocalStorageDocumentStore(window.localStorage, {
        key: SERVICE_STORE_KEY,
        format: DESIGN_STORE_FORMAT,
        seedStoredRevision: SERVICE_SEED_REVISION,
      });
      const outcome = store.save({
        document: serviceDocument,
        newStoredRevision: '9',
        expectedStoredRevision: storedRevision,
      });
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) expect(outcome.code).toBe('UI_STORE_CORRUPT');
      expect(window.localStorage.getItem(SERVICE_STORE_KEY)).toBe(stored);
      window.close();
    }
  });

  it('readable-envelope corruption is overwritable at the recorded revision', () => {
    const window = freshWindow();
    window.localStorage.setItem(
      SERVICE_STORE_KEY,
      JSON.stringify({
        format: DESIGN_STORE_FORMAT,
        storedRevision: '3',
        document: { schema: 'vict.ui-document@9' },
      }),
    );
    const store = createLocalStorageDocumentStore(window.localStorage, {
      key: SERVICE_STORE_KEY,
      format: DESIGN_STORE_FORMAT,
      seedStoredRevision: SERVICE_SEED_REVISION,
      validateDocument: (document) =>
        validateUiDocument(document, designCatalogs).map((issue) => ({
          code: issue.code,
          severity: issue.severity,
          message: issue.message,
        })),
    });
    const load = store.rawLoad();
    expect(load.status).toBe('invalid');
    if (load.status !== 'invalid') return;
    expect(load.overwritable).toBe(true);
    expect(load.storedRevision).toBe('3');
    const outcome = store.save({
      document: serviceDocument,
      newStoredRevision: '4',
      expectedStoredRevision: '3',
    });
    expect(outcome.ok).toBe(true);
    window.close();
  });

  it('classifyStored rejects the documented unreadable shapes', () => {
    expect(classifyStored('{not json', DESIGN_STORE_FORMAT).kind).toBe('unreadable');
    expect(
      classifyStored(
        JSON.stringify({ format: 'other', storedRevision: '1', document: {} }),
        DESIGN_STORE_FORMAT,
      ).kind,
    ).toBe('unreadable');
    expect(
      classifyStored(
        JSON.stringify({ format: DESIGN_STORE_FORMAT, storedRevision: '1' }),
        DESIGN_STORE_FORMAT,
      ).kind,
    ).toBe('unreadable');
  });
});

describe('service document (U2-01/U2-05)', () => {
  it('compiles cleanly with the design catalogs', () => {
    const compiled = compileUiDocument(serviceDocument, designCatalogs.elements, [], {
      actionIds: designCatalogs.actionIds,
      routeIds: designCatalogs.routeIds,
      viewFields: designCatalogs.viewFields,
    });
    expect(compiled.ok).toBe(true);
  });

  it('instantiates the shared card five times with every required slot filled', () => {
    const issues = validateUiDocument(serviceDocument, designCatalogs);
    expect(issues.some((issue) => issue.code === 'UI_DOC_REQUIRED_SLOT_MISSING')).toBe(false);
    expect(issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    const instances = Object.values(serviceDocument.nodes).filter(
      (node) => node.kind === 'component' && node.definitionId === 'def.serviceCard',
    );
    expect(instances).toHaveLength(5);
    for (const instance of instances) {
      if (instance.kind !== 'component') continue;
      expect(instance.slots?.['title']?.children.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('keeps the intentional instance override instance-local through a session round trip', () => {
    const session = UiEditSession.open({
      document: serviceDocument,
      storedRevision: SERVICE_SEED_REVISION,
    });
    const node = session.state().working.document.nodes['svc.cardAdaptations'] as
      { kind: string; styleSources?: readonly string[] } | undefined;
    expect(node?.kind === 'component' && node.styleSources?.includes('src.accent-override')).toBe(
      true,
    );
    // the sibling instances do NOT carry the override
    for (const siblingId of ['svc.cardKitchens', 'svc.cardBathrooms']) {
      const sibling = session.state().working.document.nodes[siblingId] as
        { kind: string; styleSources?: readonly string[] } | undefined;
      expect(sibling?.kind === 'component' && sibling.styleSources).toBeUndefined();
    }
  });
});

describe('workbench fixture (U2-06 presentation-only)', () => {
  it('compiles and declares no interactions, actions or routes (no workflow semantics)', () => {
    const compiled = compileUiDocument(fixtureDocument, designCatalogs.elements, [], {
      actionIds: designCatalogs.actionIds,
      routeIds: designCatalogs.routeIds,
      viewFields: designCatalogs.viewFields,
    });
    expect(compiled.ok).toBe(true);
    for (const node of Object.values(fixtureDocument.nodes)) {
      expect(node.interactions ?? []).toEqual([]);
    }
    expect(fixtureDocument.componentDefinitions ?? {}).toEqual({});
  });

  it('persists through the same store under its own key', () => {
    const window = freshWindow();
    const store = createLocalStorageDocumentStore(window.localStorage, {
      key: FIXTURE_STORE_KEY,
      format: DESIGN_STORE_FORMAT,
      seedStoredRevision: SERVICE_SEED_REVISION,
    });
    const outcome = store.save({
      document: fixtureDocument,
      newStoredRevision: '2',
      expectedStoredRevision: SERVICE_SEED_REVISION,
    });
    expect(outcome.ok).toBe(true);
    const load = store.rawLoad();
    expect(load.status).toBe('loaded');
    window.close();
  });
});

describe('contact adapter (U2-05 honest validation)', () => {
  it('denies empty submissions with per-field issues', () => {
    const outcome = validateContact({ name: '', email: '', message: '' });
    expect(outcome.status).toBe('denied');
    if (outcome.status !== 'denied') return;
    expect(outcome.issues.map((issue) => issue.field)).toEqual([
      'svc.fieldName',
      'svc.fieldEmail',
      'svc.fieldMessage',
    ]);
  });

  it('denies malformed emails and short messages', () => {
    const outcome = validateContact({ name: 'Ada', email: 'not-an-email', message: 'hi' });
    expect(outcome.status).toBe('denied');
  });

  it('acknowledges valid submissions honestly (simulated, nothing stored)', () => {
    const outcome = validateContact({
      name: 'Ada Reviewer',
      email: 'ada@example.org',
      message: 'Two rooms, hoping for an autumn start.',
    });
    expect(outcome.status).toBe('ok');
    if (outcome.status !== 'ok') return;
    expect(outcome.detail).toContain('does not store anything');
  });
});
