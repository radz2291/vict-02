import { describe, expect, it } from 'vitest';
import { applyUiEdit, type UiDocument } from '@victframework/ui';
import {
  compileScreen,
  designerCatalogs,
  newScreen,
  screenIssues,
} from '../src/lib/designer/application.js';
import { SCREEN_PREFIX, screenStore } from '../src/lib/designer/storage.js';

function dialogSource(fill: 'missing' | 'empty' | 'filled' | 'nested'): UiDocument {
  const seed = newScreen('Required slots', 'required-slots');
  return {
    ...seed,
    nodes: {
      ...seed.nodes,
      screen: { ...seed.nodes.screen!, children: ['dialog'] } as UiDocument['nodes'][string],
      dialog: {
        kind: 'component',
        id: 'dialog',
        definitionId: 'vict.catalog.dialog',
        props: {
          title: { type: 'literal', value: 'Details' },
          open: { type: 'literal', value: false },
        },
        ...(fill === 'missing'
          ? {}
          : {
              slots: {
                body: {
                  name: 'body',
                  children: fill === 'empty' ? [] : [fill === 'nested' ? 'nested' : 'paragraph'],
                },
              },
            }),
      },
      ...(fill === 'nested'
        ? {
            nested: {
              kind: 'component' as const,
              id: 'nested',
              definitionId: 'vict.catalog.dialog',
              props: {
                title: { type: 'literal' as const, value: 'Nested' },
                open: { type: 'literal' as const, value: false },
              },
              slots: { body: { name: 'body', children: [] } },
            },
          }
        : {}),
      ...(fill === 'filled'
        ? {
            paragraph: { kind: 'element' as const, id: 'paragraph', tag: 'p', children: ['copy'] },
            copy: {
              kind: 'text' as const,
              id: 'copy',
              content: { type: 'literal' as const, value: 'Valid body' },
            },
          }
        : {}),
    },
  };
}
function memory() {
  const bytes = new Map<string, string>();
  return {
    bytes,
    storage: {
      getItem: (key: string) => bytes.get(key) ?? null,
      setItem: (key: string, value: string) => {
        bytes.set(key, value);
      },
    },
  };
}

describe('required catalog slots at the saved application boundary', () => {
  it.each(['missing', 'empty', 'nested'] as const)(
    'refuses %s bodies in source compilation and direct persistence',
    (fill) => {
      const source = dialogSource(fill);
      expect(screenIssues(source)).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'UI_COMPONENT_SLOT_REQUIRED' })]),
      );
      expect(compileScreen(source).ok).toBe(false);
      const { bytes, storage } = memory();
      expect(
        screenStore(storage, source.id).save({
          document: source,
          expectedStoredRevision: 'r1',
          newStoredRevision: 'r2',
        }).ok,
      ).toBe(false);
      expect(bytes.size).toBe(0);
    },
  );
  it('refuses previously saved invalid source without erasing its bytes', () => {
    const source = dialogSource('empty');
    const { bytes, storage } = memory();
    const raw = JSON.stringify({
      format: 'vict.studio-screen@1',
      document: source,
      storedRevision: source.revision,
    });
    bytes.set(SCREEN_PREFIX + source.id, raw);
    expect(screenStore(storage, source.id).rawLoad()).toMatchObject({
      status: 'invalid',
      message: expect.stringContaining('UI_COMPONENT_SLOT_REQUIRED'),
    });
    expect(bytes.get(SCREEN_PREFIX + source.id)).toBe(raw);
  });
  it('retains repairable authoring and rejects final-child removal until refilled', () => {
    const source = dialogSource('filled');
    expect(compileScreen(source).ok).toBe(true);
    const edited = applyUiEdit(
      { document: source, revision: source.revision },
      {
        requestId: 'remove-body',
        expectedDocumentRevision: source.revision,
        commands: [{ op: 'remove', nodeId: 'paragraph', detachFromParent: true }],
      },
      designerCatalogs,
    );
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(screenIssues(edited.document)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'UI_COMPONENT_SLOT_REQUIRED' })]),
    );
    const { bytes, storage } = memory();
    const store = screenStore(storage, source.id);
    expect(
      store.save({ document: source, expectedStoredRevision: 'r1', newStoredRevision: 'r2' }).ok,
    ).toBe(true);
    const saved = bytes.get(SCREEN_PREFIX + source.id);
    expect(
      store.save({
        document: edited.document,
        expectedStoredRevision: 'r2',
        newStoredRevision: 'r3',
      }).ok,
    ).toBe(false);
    expect(bytes.get(SCREEN_PREFIX + source.id)).toBe(saved);
    // Refill using the original canonical source; persistence and replay compile the exact same bytes.
    expect(
      store.save({
        document: { ...source, revision: 'r3' },
        expectedStoredRevision: 'r2',
        newStoredRevision: 'r3',
      }).ok,
    ).toBe(true);
    const loaded = store.rawLoad();
    expect(loaded.status).toBe('loaded');
    if (loaded.status === 'loaded') expect(compileScreen(loaded.document).ok).toBe(true);
  });
});
