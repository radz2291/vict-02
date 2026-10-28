import { describe, it, expect, vi } from 'vitest';
import {
  importMediaAsset,
  memoryAssetStore,
  resolveMediaAsset,
  readManagedMediaAsset,
  exportMediaArchive,
  importMediaArchive,
} from '../src/assets.js';
import { validateVector, scopeVector, importSvg } from '../src/vectors.js';
const png = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/nxoAAAAASUVORK5CYII=',
  ),
  (c) => c.charCodeAt(0),
);
const file = (name: string, type: string, bytes = png) => ({
  name,
  type,
  async arrayBuffer() {
    return bytes.slice().buffer;
  },
});
describe('managed assets and portable bytes', () => {
  it('retains digest identity and isolated cloned bytes across explicit portable archive import', async () => {
    const store = memoryAssetStore();
    const imported = await importMediaAsset(file('one.png', 'image/png'), 'owner fixture');
    await store.put(imported);
    imported.bytes[0] = 0;
    expect((await store.get(imported.reference))?.bytes[0]).toBe(137);
    const archive = await exportMediaArchive(store);
    const reopened = memoryAssetStore();
    await importMediaArchive(reopened, archive);
    expect(await reopened.list()).toEqual(await store.list());
    expect((await reopened.get(imported.reference))?.bytes).toEqual(png);
  });
  it('rejects corrupt archive before writing any member', async () => {
    const first = await importMediaAsset(file('one.png', 'image/png'));
    const source = memoryAssetStore();
    await source.put(first);
    const bad = JSON.parse(await exportMediaArchive(source));
    bad.assets.push({ ...bad.assets[0], digest: 'wrong' });
    const target = memoryAssetStore();
    await expect(importMediaArchive(target, JSON.stringify(bad))).rejects.toThrow('digest/size');
    expect(await target.list()).toEqual([]);
  });
  it('reports missing bytes and refuses non-media/executable URL input', async () => {
    await expect(importMediaAsset(file('a.html', 'text/html'))).rejects.toThrow('Unsupported');
    await expect(resolveMediaAsset('javascript:alert(1)')).rejects.toThrow('Use a managed');
    await expect(
      resolveMediaAsset('asset:sha256:' + 'a'.repeat(64), memoryAssetStore()),
    ).rejects.toThrow('unavailable');
  });
  it('refuses forged file types and store identities rather than minting false asset references', async () => {
    await expect(importMediaAsset(file('fake.mp4', 'video/mp4'))).rejects.toThrow('do not match');
    const asset = await importMediaAsset(file('real.png', 'image/png'));
    await expect(
      memoryAssetStore().put({ ...asset, reference: 'asset:sha256:' + '0'.repeat(64) }),
    ).rejects.toThrow('digest/size');
  });
  it('resolves one managed blob and explicitly releases it without persisting its transient URL', async () => {
    const asset = await importMediaAsset(file('one.png', 'image/png')),
      store = memoryAssetStore();
    await store.put(asset);
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:resolved'),
      revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const result = await resolveMediaAsset(asset.reference, store);
    expect(result.url).toBe('blob:resolved');
    expect((await store.list())[0]?.reference).toBe(asset.reference);
    result.release();
    expect(revoke).toHaveBeenCalledWith('blob:resolved');
    create.mockRestore();
    revoke.mockRestore();
  });
});
describe('verified managed reads shared by media renderers', () => {
  it('refuses unverifiable or substituted store bytes before exporting a portable archive', async () => {
    const asset = await importMediaAsset(file('one.png', 'image/png'));
    const changed = asset.bytes.slice(); changed[changed.length - 1] = changed[changed.length - 1]! ^ 1;
    const corrupt = {...memoryAssetStore(), get: async () => ({...asset, bytes:changed})};
    await expect(exportMediaArchive(corrupt, [asset.reference])).rejects.toThrow('digest/size');
    const substituted = {...memoryAssetStore(), get: async () => asset};
    await expect(exportMediaArchive(substituted, ['asset:sha256:'+'0'.repeat(64)]))
      .rejects.toThrow('requested reference');
  });

  it('rejects a custom store returning another valid asset for the requested reference', async () => {
    const asset = await importMediaAsset(file('one.png', 'image/png'));
    const store = {...memoryAssetStore(), get: async () => asset};
    await expect(readManagedMediaAsset('asset:sha256:'+'0'.repeat(64), store)).rejects.toThrow('requested reference');
  });
  it('checks returned bytes even when a custom store bypasses verified put', async () => {
    const asset = await importMediaAsset(file('one.png', 'image/png'));
    const changed = asset.bytes.slice(); changed[changed.length - 1] = changed[changed.length - 1]! ^ 1;
    const store = {...memoryAssetStore(), get: async () => ({...asset, bytes:changed})};
    await expect(readManagedMediaAsset(asset.reference, store)).rejects.toThrow('digest/size');
  });
});

describe('inert editable vector grammar', () => {
  const graphic = {
    schema: 'vict.vector@1',
    viewBox: '0 0 24 24',
    nodes: [
      {
        tag: 'defs',
        children: [
          {
            tag: 'linearGradient',
            attributes: { id: 'brand' },
            children: [
              { tag: 'stop', attributes: { offset: '0%', 'stop-color': '#ff00ff' } },
              { tag: 'stop', attributes: { offset: '100%', 'stop-color': '#00ff00' } },
            ],
          },
        ],
      },
      { tag: 'rect', attributes: { x: 0, y: 0, width: 24, height: 24, fill: 'url(#brand)' } },
    ],
  };
  it('preserves multicolour geometry and namespaces repeated local paint definitions', () => {
    const a = scopeVector(validateVector(graphic), 'first'),
      b = scopeVector(validateVector(graphic), 'second');
    const firstId=a.nodes[0]?.children?.[0]?.attributes?.id,secondId=b.nodes[0]?.children?.[0]?.attributes?.id;
    expect(a.nodes[1]?.attributes?.fill).toBe(`url(#${firstId})`);
    expect(b.nodes[1]?.attributes?.fill).toBe(`url(#${secondId})`);
    expect(firstId).not.toBe(secondId);
    expect(JSON.stringify(a)).toContain('#ff00ff');
  });
  it('keeps punctuation-distinct occurrence identities from colliding',()=>{
    const a=scopeVector(validateVector(graphic),'node:a'),b=scopeVector(validateVector(graphic),'node-a');
    expect(a.nodes[0]?.children?.[0]?.attributes?.id).not.toBe(b.nodes[0]?.children?.[0]?.attributes?.id);
  });
  it.each([
    { tag: 'script' },
    { tag: 'foreignObject' },
    { tag: 'path', attributes: { onclick: 'run()' } },
    { tag: 'path', attributes: { fill: 'url(https://example.test/x)' } },
    { tag: 'path', attributes: { fill: 'url(#missing)' } },
  ])('rejects executable/foreign/unresolved geometry %j', (node) => {
    expect(() =>
      validateVector({ schema: 'vict.vector@1', viewBox: '0 0 24 24', nodes: [node] }),
    ).toThrow();
  });
  it('imports a supplied SVG subset and refuses script/DTD/event-bearing source', () => {
    expect(
      importSvg(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#ff00ff" d="M2 2L22 22"/></svg>',
      ).nodes[0]?.tag,
    ).toBe('path');
    for (const svg of [
      '<!DOCTYPE svg><svg/>',
      '<svg viewBox="0 0 24 24"><script/></svg>',
      '<svg viewBox="0 0 24 24" onload="run()"/>',
    ])
      expect(() => importSvg(svg)).toThrow();
  });
});
