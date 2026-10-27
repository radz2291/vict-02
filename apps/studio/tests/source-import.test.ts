// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { newScreen, screenApplication } from '../src/lib/designer/application.js';
import { prepareSourceImport, SOURCE_IMPORT_LIMITS } from '../src/lib/designer/source-import.js';
import {
  memoryAssetStore,
  importMediaAsset,
  exportMediaArchive,
  MAX_ASSET_BYTES,
} from '@victframework/ui-media-svelte/assets';
import type { UiDocument } from '@victframework/ui';
import { foundationExample } from '../src/lib/designer/foundation-examples.js';

const png = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/nxoAAAAASUVORK5CYII=',
  ),
  (character) => character.charCodeAt(0),
);
const source = () => newScreen('Portable screen', 'portable-original');
const bundle = (document: UiDocument, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    application: screenApplication(document),
    uiDocuments: [{ document }],
    ...extra,
  });
async function supplied() {
  return importMediaAsset(
    {
      name: 'owner-supplied.png',
      type: 'image/png',
      async arrayBuffer() {
        return png.slice().buffer;
      },
    },
    'Offline portability fixture',
  );
}

describe('one-screen local source import preparation', () => {
  it('returns an explicit refusal for deeply nested input instead of throwing through the UI', async () => {
    const deeplyNested = '['.repeat(10000) + '0' + ']'.repeat(10000);
    const json = JSON.stringify(source());
    const document = json.slice(0, -1) + ',"unsupported":' + deeplyNested + '}';
    expect(
      await prepareSourceImport('{"uiDocuments":[{"document":' + document + '}]}'),
    ).toMatchObject({ ok: false, code: 'STUDIO_IMPORT_SOURCE_LIMIT' });
    expect(
      await prepareSourceImport(
        '{"application":' + deeplyNested + ',"uiDocuments":[{"document":' + json + '}]}',
      ),
    ).toMatchObject({ ok: false, code: 'STUDIO_IMPORT_APPLICATION' });
  });
  it('accepts a source-only export without changing the original document or browser storage', async () => {
    const document = source(),
      before = JSON.stringify(document);
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    const prepared = await prepareSourceImport(bundle(document));
    expect(prepared).toMatchObject({ ok: true, originalDocumentId: document.id, assets: [] });
    if (!prepared.ok) throw Error(prepared.message);
    expect(prepared.document).toEqual(document);
    expect(prepared.document).not.toBe(document);
    expect(JSON.stringify(document)).toBe(before);
    expect(storage).not.toHaveBeenCalled();
    storage.mockRestore();
  });
  it('reuses validated media archive decoding and stages complete byte-identical assets for a fresh namespace', async () => {
    const imported = await supplied(),
      store = memoryAssetStore();
    await store.put(imported);
    const original = source();
    const document: UiDocument = {
      ...original,
      assets: { portrait: { id: 'portrait', kind: 'digest', digest: imported.digest } },
    };
    const prepared = await prepareSourceImport(
      bundle(document, { mediaArchive: JSON.parse(await exportMediaArchive(store)) }),
    );
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw Error(prepared.message);
    expect(prepared.assets).toHaveLength(1);
    expect(prepared.assets[0]?.bytes).toEqual(png);
    expect(prepared.assets[0]?.reference).toBe(imported.reference);
    expect(prepared.assets[0]?.createdAt).toBe(imported.createdAt);
    expect(await store.list()).toHaveLength(1);
    const fresh = memoryAssetStore();
    for (const asset of prepared.assets) await fresh.put(asset);
    expect((await fresh.get(imported.reference))?.bytes).toEqual(png);
  });
  it('rejects missing archive bytes for both declared assets and directly authored managed source props', async () => {
    const imported = await supplied(),
      original = source();
    const declared: UiDocument = {
      ...original,
      assets: { portrait: { id: 'portrait', kind: 'digest', digest: imported.digest } },
    };
    expect(await prepareSourceImport(bundle(declared))).toMatchObject({
      ok: false,
      code: 'STUDIO_IMPORT_MEDIA_MISSING',
    });
    const direct: UiDocument = {
      ...original,
      nodes: {
        ...original.nodes,
        screen: { ...original.nodes.screen, children: ['image'] } as UiDocument['nodes'][string],
        image: {
          kind: 'component',
          id: 'image',
          definitionId: 'vict.media.image',
          revision: '1',
          props: {
            source: { type: 'literal', value: imported.reference },
            alt: { type: 'literal', value: 'Portrait' },
          },
        },
      },
    };
    expect(await prepareSourceImport(bundle(direct))).toMatchObject({
      ok: false,
      code: 'STUDIO_IMPORT_MEDIA_MISSING',
    });
  });
  it('rejects corrupt media before returning any staged member and never writes caller storage', async () => {
    const imported = await supplied(),
      store = memoryAssetStore();
    await store.put(imported);
    const archive = JSON.parse(await exportMediaArchive(store));
    archive.assets.push({ ...archive.assets[0], digest: '0'.repeat(64) });
    const prepared = await prepareSourceImport(bundle(source(), { mediaArchive: archive }));
    expect(prepared).toMatchObject({ ok: false, code: 'STUDIO_IMPORT_MEDIA_INVALID' });
    expect('assets' in prepared).toBe(false);
    expect(await store.list()).toHaveLength(1);
  });
  it('checks media references inside serialized graph models and refuses malformed managed identities', async () => {
    const imported = await supplied(),
      original = foundationExample('graph');
    const graph = JSON.parse(String(original.localState.graph.initial));
    graph.nodeTypes[0].fields.push({
      id: 'preview',
      label: 'Evidence image',
      kind: 'image',
      default: imported.reference,
    });
    const document: UiDocument = {
      ...original,
      localState: {
        ...original.localState,
        graph: { ...original.localState.graph, initial: JSON.stringify(graph) },
      },
    };
    expect(await prepareSourceImport(bundle(document))).toMatchObject({
      ok: false,
      code: 'STUDIO_IMPORT_MEDIA_MISSING',
    });
    const invalid: UiDocument = {
      ...source(),
      assets: { invalid: { id: 'invalid', kind: 'digest', digest: 'malformed' } },
    };
    expect(await prepareSourceImport(bundle(invalid))).toMatchObject({
      ok: false,
      code: 'STUDIO_IMPORT_ASSET_REFERENCE',
    });
  });
  it('preserves ordinary source text and unused state that merely discuss a managed reference', async () => {
    const original = source(),
      reference = 'asset:sha256:' + 'a'.repeat(64);
    const document: UiDocument = {
      ...original,
      nodes: {
        ...original.nodes,
        screen: {
          ...original.nodes.screen,
          children: ['explanation'],
        } as UiDocument['nodes'][string],
        explanation: {
          kind: 'text',
          id: 'explanation',
          content: { type: 'literal', value: reference },
        },
      },
      localState: {
        ...original.localState,
        example: { key: 'example', type: 'string', initial: reference },
      },
    };
    expect(await prepareSourceImport(bundle(document))).toMatchObject({ ok: true, assets: [] });
  });
  it('refuses multi-document, unsupported envelope, malformed JSON and invalid canonical source', async () => {
    const document = source();
    expect(await prepareSourceImport('{')).toMatchObject({ ok: false, code: 'STUDIO_IMPORT_JSON' });
    expect(
      await prepareSourceImport(JSON.stringify({ uiDocuments: [{ document }, { document }] })),
    ).toMatchObject({ ok: false, code: 'STUDIO_IMPORT_DOCUMENT_COUNT' });
    expect(await prepareSourceImport(bundle(document, { unknown: true }))).toMatchObject({
      ok: false,
      code: 'STUDIO_IMPORT_SHAPE',
    });
    expect(
      await prepareSourceImport(
        JSON.stringify({ uiDocuments: [{ document: { ...document, root: 'missing' } }] }),
      ),
    ).toMatchObject({ ok: false, code: 'STUDIO_IMPORT_SOURCE_INVALID' });
    expect(
      await prepareSourceImport(JSON.stringify({ uiDocuments: [{ document, extra: 'ignored' }] })),
    ).toMatchObject({ ok: false, code: 'STUDIO_IMPORT_SHAPE' });
  });
  it('compares exported application semantics independent of object key order, refusing silently changed product contracts', async () => {
    const document = source(),
      application = screenApplication(document);
    const reordered = Object.fromEntries(Object.entries(application).reverse());
    expect(
      await prepareSourceImport(
        JSON.stringify({ application: reordered, uiDocuments: [{ document }] }),
      ),
    ).toMatchObject({ ok: true });
    expect(
      await prepareSourceImport(
        JSON.stringify({
          application: { ...application, routes: [] },
          uiDocuments: [{ document }],
        }),
      ),
    ).toMatchObject({ ok: false, code: 'STUDIO_IMPORT_APPLICATION' });
  });
  it('caps canonical source size and declared decoded aggregate before allocating media payloads', async () => {
    const document = source();
    expect(
      await prepareSourceImport(
        bundle({
          ...document,
          metadata: { oversized: 'x'.repeat(SOURCE_IMPORT_LIMITS.documentCharacters) },
        } as UiDocument),
      ),
    ).toMatchObject({ ok: false, code: 'STUDIO_IMPORT_SOURCE_LIMIT' });
    const archive = {
      schema: 'vict.media-archive@1',
      assets: [{ size: MAX_ASSET_BYTES }, { size: 1 }],
    };
    expect(await prepareSourceImport(bundle(document, { mediaArchive: archive }))).toMatchObject({
      ok: false,
      code: 'STUDIO_IMPORT_MEDIA_LIMIT',
    });
    expect(await prepareSourceImport(bundle(document, { mediaArchive: null }))).toMatchObject({
      ok: false,
      code: 'STUDIO_IMPORT_MEDIA_INVALID',
    });
  });
});
