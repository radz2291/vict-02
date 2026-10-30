// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { newScreen, screenApplication, screenIssues } from '../src/lib/designer/application.js';
import { prepareSourceImport, SOURCE_IMPORT_LIMITS } from '../src/lib/designer/source-import.js';
import {
  memoryAssetStore,
  importMediaAsset,
  exportMediaArchive,
  MAX_ASSET_BYTES,
} from '@victframework/ui-media-svelte/assets';
import type { UiDocument, UiExpression } from '@victframework/ui';
import { foundationExample } from '../src/lib/designer/foundation-examples.js';
import { validateGraph } from '@victframework/ui-flow-svelte';

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

/** Canonical body composition, with media independent of graph parameter kinds. */
function scopedMediaDocument(reference: string, controlled: boolean): UiDocument {
  const original=source();
  const graph={schema:'vict.flow-graph@2',revision:0,nodeTypes:[{id:'media',label:'Media',parameters:{picture:{type:'string',default:reference}},ports:[]}],nodes:[{id:'one',type:'media',label:'One',position:{x:0,y:0},values:{}}],edges:[]};
  return {...original,localState:{...original.localState,graph:{key:'graph',type:'string',initial:JSON.stringify(graph)},picture:{key:'picture',type:'string',initial:'asset:sha256:'+'a'.repeat(64)}},nodes:{
    ...original.nodes,screen:{...original.nodes.screen,children:['workspace']} as UiDocument['nodes'][string],
    workspace:{kind:'component',id:'workspace',definitionId:'vict.flow.workspace',revision:'2',props:{graph:{type:'ref',path:'state.graph'}},slots:{
      content:{name:'content',scope:{schema:'vict.ui-slot-scope@1',props:[]},children:['viewport']},
      body:{name:'body',scope:{schema:'vict.ui-slot-scope@1',props:[{name:'nodeId',type:'string'}],state:{picture:{key:'picture',type:'string',initial:reference,controlled}},conditions:{showMedia:{type:'literal',value:false}}},children:['media-branch']},
    }},
    viewport:{kind:'component',id:'viewport',definitionId:'vict.flow.viewport',revision:'2'},
    'media-branch':{kind:'conditional',id:'media-branch',branches:[{when:'showMedia',children:['media']},{children:['placeholder']}]},
    placeholder:{kind:'text',id:'placeholder',content:{type:'literal',value:'Media branch is inactive'}},
    media:{kind:'component',id:'media',definitionId:'vict.media.image',revision:'1',props:{source:{type:'ref',path:'state.picture'},alt:{type:'literal',value:'Scoped source'}}},
  }};
}

describe('one-screen local source import preparation', () => {
  it.each([false,true])('resolves lexical body state and graph parameters without falling back to document state (controlled=%s)',async controlled=>{
    const asset=await supplied(),document=scopedMediaDocument(asset.reference,controlled),before=JSON.stringify(document);
    expect(screenIssues(document)).toEqual([]);
    expect(await prepareSourceImport(bundle(document))).toMatchObject({ok:false,code:'STUDIO_IMPORT_MEDIA_MISSING'});
    const store=memoryAssetStore();await store.put(asset);
    const prepared=await prepareSourceImport(bundle(document,{mediaArchive:JSON.parse(await exportMediaArchive(store))}));
    expect(prepared.ok,JSON.stringify(prepared)).toBe(true);if(!prepared.ok)return;
    expect(prepared.assets.map(item=>item.reference)).toEqual([asset.reference]);
    expect(JSON.stringify(document)).toBe(before);
    expect(prepared.document).toEqual(document);
  });
  it('inventories graph2 parameter defaults and overrides across all source families and inactive body branches',async()=>{
    const asset=await supplied();let document=scopedMediaDocument('/fallback.png',true);
    const graph=JSON.parse(String(document.localState.graph.initial));
    graph.nodeTypes.push({id:'unused',label:'Unused source family',parameters:{picture:{type:'string',default:asset.reference}},ports:[]});
    document={...document,localState:{...document.localState,graph:{...document.localState.graph,initial:JSON.stringify(graph)}}};
    const media=document.nodes.media;if(media.kind!=='component')throw Error('Fixture');
    document={...document,nodes:{...document.nodes,media:{...media,props:{...media.props,source:{type:'conditionalValue',when:{type:'literal',value:true},then:{type:'literal',value:'/fallback.png'},otherwise:{type:'ref',path:'state.picture'}}}}}};
    expect(screenIssues(document)).toEqual([]);
    expect(await prepareSourceImport(bundle(document))).toMatchObject({ok:false,code:'STUDIO_IMPORT_MEDIA_MISSING'});
    // The same dependency remains required as a saved node override, with no
    // image/video/widget annotation on the project parameter declaration.
    graph.nodeTypes.pop();graph.nodes[0].values.picture=asset.reference;
    document={...document,localState:{...document.localState,graph:{...document.localState.graph,initial:JSON.stringify(graph)}}};
    expect(await prepareSourceImport(bundle(document))).toMatchObject({ok:false,code:'STUDIO_IMPORT_MEDIA_MISSING'});
    const store=memoryAssetStore();await store.put(asset);
    expect(await prepareSourceImport(bundle(document,{mediaArchive:JSON.parse(await exportMediaArchive(store))}))).toMatchObject({ok:true});
  });
  it('still refuses unknown renderer frame media even when a same-named document state and valid archive exist',async()=>{
    const asset=await supplied();let document=scopedMediaDocument(asset.reference,true);
    const media=document.nodes.media;if(media.kind!=='component')throw Error('Fixture');
    document={...document,nodes:{...document.nodes,media:{...media,props:{...media.props,source:{type:'ref',path:'prop.nodeId'}}}},localState:{...document.localState,nodeId:{key:'nodeId',type:'string',initial:asset.reference}}};
    expect(screenIssues(document)).toEqual([]);
    const store=memoryAssetStore();await store.put(asset);
    expect(await prepareSourceImport(bundle(document,{mediaArchive:JSON.parse(await exportMediaArchive(store))}))).toMatchObject({ok:false,code:'STUDIO_IMPORT_MEDIA_DYNAMIC'});
  });
  it('carries managed carousel image bytes through the same portable dependency closure', async () => {
    const asset=await supplied(),store=memoryAssetStore();await store.put(asset);
    const original=source();
    const document:UiDocument={...original,localState:{...original.localState,slides:{key:'slides',type:'stringList',initial:[asset.reference]},slideIndex:{key:'slideIndex',type:'number',initial:0}},nodes:{...original.nodes,
      screen:{...original.nodes.screen,children:['gallery']} as UiDocument['nodes'][string],
      gallery:{kind:'component',id:'gallery',definitionId:'vict.pattern.carousel',revision:'1',props:{images:{type:'literal',value:true},slides:{type:'ref',path:'state.slides'},index:{type:'ref',path:'state.slideIndex'}},outputs:{indexChange:{setState:{key:'slideIndex'}}}}}};
    const missing=await prepareSourceImport(bundle(document));
    expect(missing,JSON.stringify(missing)).toMatchObject({ok:false,code:'STUDIO_IMPORT_MEDIA_MISSING'});
    const prepared=await prepareSourceImport(bundle(document,{mediaArchive:JSON.parse(await exportMediaArchive(store))}));
    expect(prepared.ok).toBe(true);if(!prepared.ok)throw Error(prepared.message);
    expect(prepared.assets.map(item=>item.reference)).toEqual([asset.reference]);
    const gallery=document.nodes.gallery;if(!gallery||gallery.kind!=='component')throw Error('Fixture gallery must be a component.');
    const textOnly={...document,nodes:{...document.nodes,gallery:{...gallery,props:{...gallery.props,images:{type:'literal',value:false}}}}} as UiDocument;
    expect(await prepareSourceImport(bundle(textOnly))).toMatchObject({ok:true,assets:[]});
  });
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
  it.each(['family', 'instance'] as const)(
    'requires and round-trips managed bytes for a custom graph %s icon source',
    async (location) => {
      const svg = new TextEncoder().encode(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2 2h20v20H2z" fill="#14b8a6"/></svg>',
      );
      const iconAsset = await importMediaAsset(
        {
          name: 'custom-graph-mark.svg',
          type: 'image/svg+xml',
          async arrayBuffer() {
            return svg.slice().buffer;
          },
        },
        'Offline custom graph icon portability fixture',
      );
      const original = foundationExample('graph');
      const graph = JSON.parse(String(original.localState.graph.initial));
      const icon = {
        pack: 'custom',
        name: 'portable-mark',
        revision: '1',
        source: iconAsset.reference,
      };
      if (location === 'family') graph.nodeTypes[0].icon = icon;
      else graph.nodes[0].icon = icon;
      expect(validateGraph(graph).ok).toBe(true);
      const document: UiDocument = {
        ...original,
        localState: {
          ...original.localState,
          graph: { ...original.localState.graph, initial: JSON.stringify(graph) },
        },
      };
      expect(document.assets).toEqual({});
      expect(await prepareSourceImport(bundle(document))).toMatchObject({
        ok: false,
        code: 'STUDIO_IMPORT_MEDIA_MISSING',
      });
      const stored = memoryAssetStore();
      await stored.put(iconAsset);
      const prepared = await prepareSourceImport(
        bundle(document, { mediaArchive: JSON.parse(await exportMediaArchive(stored)) }),
      );
      expect(prepared.ok).toBe(true);
      if (!prepared.ok) throw Error(prepared.message);
      expect(prepared.document).toEqual(document);
      expect(prepared.assets).toHaveLength(1);
      expect(prepared.assets[0]?.reference).toBe(iconAsset.reference);
      expect(prepared.assets[0]?.bytes).toEqual(svg);
      const fresh = memoryAssetStore();
      for (const asset of prepared.assets) await fresh.put(asset);
      expect((await fresh.get(iconAsset.reference))?.bytes).toEqual(svg);
    },
  );
  it.each(['literal', 'state'] as const)(
    'requires archived bytes from an inactive conditional media branch using a %s value',
    async (mode) => {
      const asset = await supplied(),
        original = source();
      const document: UiDocument = {
        ...original,
        localState: {
          ...original.localState,
          portrait: { key: 'portrait', type: 'string', initial: asset.reference },
        },
        nodes: {
          ...original.nodes,
          screen: {
            ...original.nodes.screen,
            children: ['portrait-image'],
          } as UiDocument['nodes'][string],
          'portrait-image': {
            kind: 'component',
            id: 'portrait-image',
            definitionId: 'vict.media.image',
            revision: '1',
            props: {
              source: {
                type: 'conditionalValue',
                when: { type: 'literal', value: true },
                then: { type: 'literal', value: '/fallback.png' },
                otherwise:
                  mode === 'state'
                    ? { type: 'ref', path: 'state.portrait' }
                    : { type: 'literal', value: asset.reference },
              },
              alt: { type: 'literal', value: 'Portrait' },
            },
          },
        },
      };
      expect(screenIssues(document)).toEqual([]);
      expect(await prepareSourceImport(bundle(document))).toMatchObject({
        ok: false,
        code: 'STUDIO_IMPORT_MEDIA_MISSING',
      });
      const store = memoryAssetStore();
      await store.put(asset);
      const prepared = await prepareSourceImport(
        bundle(document, { mediaArchive: JSON.parse(await exportMediaArchive(store)) }),
      );
      expect(prepared.ok).toBe(true);
      if (!prepared.ok) throw Error(prepared.message);
      expect(prepared.assets[0]?.bytes).toEqual(png);
    },
  );
  it('inventories exact managed literals inside computed media without executing or promising computed output', async () => {
    const asset = await supplied(),
      original = source();
    const document: UiDocument = {
      ...original,
      nodes: {
        ...original.nodes,
        screen: {
          ...original.nodes.screen,
          children: ['computed-image'],
        } as UiDocument['nodes'][string],
        'computed-image': {
          kind: 'component',
          id: 'computed-image',
          definitionId: 'vict.media.image',
          revision: '1',
          props: {
            source: {
              type: 'op',
              name: 'concat',
              args: [{ type: 'literal', value: asset.reference }],
            },
          },
        },
      },
    };
    expect(screenIssues(document)).toEqual([]);
    expect(await prepareSourceImport(bundle(document))).toMatchObject({
      ok: false,
      code: 'STUDIO_IMPORT_MEDIA_MISSING',
    });
    const store = memoryAssetStore();
    await store.put(asset);
    expect(
      await prepareSourceImport(
        bundle(document, { mediaArchive: JSON.parse(await exportMediaArchive(store)) }),
      ),
    ).toMatchObject({ ok: false, code: 'STUDIO_IMPORT_MEDIA_DYNAMIC' });
  });
  it('refuses unprovable reference construction rather than treating fragments as malformed full references', async () => {
    const original = source();
    const expression: UiExpression = {
      type: 'op',
      name: 'concat',
      args: [
        { type: 'literal', value: 'asset:sha256:' },
        { type: 'ref', path: 'state.digest' },
      ],
    };
    const document: UiDocument = {
      ...original,
      localState: {
        ...original.localState,
        digest: { key: 'digest', type: 'string', initial: 'a'.repeat(64) },
      },
      nodes: {
        ...original.nodes,
        screen: {
          ...original.nodes.screen,
          children: ['constructed-image'],
        } as UiDocument['nodes'][string],
        'constructed-image': {
          kind: 'component',
          id: 'constructed-image',
          definitionId: 'vict.media.image',
          revision: '1',
          props: { source: expression },
        },
      },
    };
    expect(screenIssues(document)).toEqual([]);
    expect(await prepareSourceImport(bundle(document))).toMatchObject({
      ok: false,
      code: 'STUDIO_IMPORT_MEDIA_DYNAMIC',
    });
  });
  it('inventories every statically supplied graph branch rather than only the active graph', async () => {
    const asset = await supplied(),
      original = foundationExample('graph');
    const graph = JSON.parse(String(original.localState.graph.initial));
    graph.nodeTypes[0].fields.push({
      id: 'conditional-preview',
      label: 'Image',
      kind: 'image',
      default: asset.reference,
    });
    expect(validateGraph(graph).ok).toBe(true);
    const graphNode = Object.values(original.nodes).find(
      (node) => node.kind === 'component' && node.definitionId === 'vict.flow.editor',
    );
    if (!graphNode || graphNode.kind !== 'component') throw Error('Graph fixture missing editor.');
    const document: UiDocument = {
      ...original,
      nodes: {
        ...original.nodes,
        [graphNode.id]: {
          ...graphNode,
          props: {
            ...graphNode.props,
            graph: {
              type: 'conditionalValue',
              when: { type: 'literal', value: true },
              then: { type: 'ref', path: 'state.graph' },
              otherwise: { type: 'literal', value: JSON.stringify(graph) },
            },
          },
        },
      },
    };
    expect(screenIssues(document)).toEqual([]);
    expect(await prepareSourceImport(bundle(document))).toMatchObject({
      ok: false,
      code: 'STUDIO_IMPORT_MEDIA_MISSING',
    });
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
