import { describe, it, expect } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import {
  createUiAuthoringRegistry,
  compileUiDocument,
  defaultSemanticElementCatalog,
  type UiDocument,
  type UiNode,
} from '@victframework/ui';
import { mediaAuthoringPackage } from '../src/authoring.js';
import { mediaAuthoringDescriptors } from '../src/descriptors.js';
import { mediaAuthoringImplementations } from '../src/implementations.js';
import { createIconRegistry, importCustomIconPack } from '../src/icons.js';
import { memoryAssetStore, importMediaAsset } from '../src/assets.js';
import { embedUrl } from '../src/context.js';
import Consumer from './Consumer.svelte';
const node = (
  id: string,
  definitionId: string,
  props: Record<string, string | boolean | number>,
): UiNode => ({
  id,
  kind: 'component',
  definitionId,
  revision: '1',
  props: Object.fromEntries(
    Object.entries(props).map(([k, value]) => [k, { type: 'literal', value }]),
  ),
});
const doc = (nodes: UiNode[]): UiDocument => ({
  schema: 'vict.ui-document@1',
  id: 'media-proof',
  revision: '1',
  root: 'root',
  nodes: {
    root: { id: 'root', kind: 'element', tag: 'div', children: nodes.map((n) => n.id) },
    ...Object.fromEntries(nodes.map((n) => [n.id, n])),
  },
  componentDefinitions: {},
  styleSources: {},
  tokens: {},
  conditions: {},
  assets: {},
  localState: {},
});
const settle = async () => {
  flushSync();
  await new Promise((resolve) => setTimeout(resolve, 25));
  flushSync();
};
describe('registered media consumer', () => {
  it('retains canonical toolbar part paint and uses the public VICT action control', async () => {
    const library={...node('library','vict.media.asset-library',{label:'Supplied assets'}),partStyles:{toolbar:{localStyle:[{property:'padding-top',value:{type:'text' as const,value:'17px'}}]}}};
    const target=document.createElement('div');document.body.append(target);
    const instance=mount(Consumer,{target,props:{source:doc([library]),store:memoryAssetStore()}});await settle();
    const toolbar=target.querySelector<HTMLElement>('[data-ui-part="toolbar"]');
    expect(toolbar).not.toBeNull();expect(getComputedStyle(toolbar!).paddingTop).toBe('17px');
    expect(Array.from(toolbar!.querySelectorAll('button.vict-btn'),button=>button.textContent)).toEqual(['Supply media','Import media archive','Export media archive']);
    await unmount(instance);target.remove();
  });
  it('renders a verified managed SVG and refuses substituted bytes from a custom store', async () => {
    const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#ff00ff"/></svg>';
    const asset=await importMediaAsset(new File([svg],'brand.svg',{type:'image/svg+xml'}));
    for (const tampered of [false,true]) {
      const bytes=new TextEncoder().encode(svg.replace('#ff00ff','#00ff00'));
      const store={...memoryAssetStore(),get:async()=>tampered?{...asset,bytes}:asset};
      const target=document.createElement('div');document.body.append(target);
      const instance=mount(Consumer,{target,props:{source:doc([node('brand','vict.media.vector',{source:asset.reference,label:'Managed brand'})]),store}});
      await settle();
      if(tampered){expect(target.querySelector('[role=alert]')?.textContent).toContain('digest/size');expect(target.querySelector('svg')).toBeNull();}
      else{expect(target.querySelector('svg')?.getAttribute('aria-label')).toBe('Managed brand');expect(target.querySelector('circle')?.getAttribute('fill')).toBe('#ff00ff');}
      await unmount(instance);target.remove();
    }
  });
  it('pins actual descriptors/capabilities and compiles every agent-facing seed', () => {
    expect(
      createUiAuthoringRegistry([mediaAuthoringPackage], mediaAuthoringImplementations, {
        requireCompatibility: true,
      }).issues,
    ).toEqual([]);
    for (const registration of mediaAuthoringPackage.registrations) {
      expect(registration.seed).toBeTruthy();
      const seed = registration.seed!;
      const source = {
        ...doc([]),
        root: seed.root,
        nodes: Object.fromEntries(seed.nodes.map((n) => [n.id, n])),
      };
      expect(
        compileUiDocument(source, defaultSemanticElementCatalog(), mediaAuthoringDescriptors).ok,
      ).toBe(true);
    }
  });
  it('searches exact versioned supplied identities and validates custom provenance/vector packs', () => {
    const icons = createIconRegistry();
    expect(icons.search('hamburger').items[0]?.name).toBe('menu');
    expect(icons.search('', 0, 3).nextOffset).toBe(3);
    expect(icons.resolve('lucide', 'invented', '1.27.0')).toBeUndefined();
    const custom = importCustomIconPack({
      schema: 'vict.icon-pack@1',
      icons: [
        {
          pack: 'brand',
          name: 'mark',
          revision: '1',
          label: 'Brand',
          tags: ['logo'],
          license: 'owner',
          provenance: 'supplied',
          vector: {
            schema: 'vict.vector@1',
            viewBox: '0 0 24 24',
            nodes: [{ tag: 'circle', attributes: { cx: 12, cy: 12, r: 10, fill: '#ff00ff' } }],
          },
        },
      ],
    });
    custom.forEach(icons.register);
    expect(icons.search('logo').items[0]?.pack).toBe('brand');
    expect(icons.exportCustom()).toHaveLength(1);
  });
  it('renders accessible icon and repeated multicolour SVG with distinct occurrence IDs', async () => {
    const graphic = JSON.stringify({
      schema: 'vict.vector@1',
      viewBox: '0 0 24 24',
      nodes: [
        {
          tag: 'defs',
          children: [
            {
              tag: 'linearGradient',
              attributes: { id: 'brand' },
              children: [{ tag: 'stop', attributes: { offset: '0%', 'stop-color': '#ff00ff' } }],
            },
          ],
        },
        { tag: 'rect', attributes: { width: 24, height: 24, fill: 'url(#brand)' } },
      ],
    });
    const source = doc([
      node('search', 'vict.media.icon', { name: 'search', decorative: false, label: 'Find items' }),
      node('a', 'vict.media.vector', { data: graphic, label: 'Brand one' }),
      node('b', 'vict.media.vector', { data: graphic, label: 'Brand two' }),
    ]);
    const target = document.createElement('div');
    document.body.append(target);
    const instance = mount(Consumer, { target, props: { source, store: memoryAssetStore() } });
    await settle();
    expect(target.querySelector('[aria-label="Find items"] svg')).toBeTruthy();
    expect(target.querySelector('[data-compile-errors]')).toBeNull();
    const ids = Array.from(target.querySelectorAll('linearGradient')).map((n) => n.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(target.querySelectorAll('stop[stop-color="#ff00ff"]')).toHaveLength(2);
    expect(target.querySelector('linearGradient')?.namespaceURI).toBe('http://www.w3.org/2000/svg');
    await unmount(instance);
    target.remove();
  });
  it('renders native media attributes and refuses an embed until the host enables its provider', async () => {
    const source = doc([
      node('photo', 'vict.media.image', {
        source: '/supplied/photo.png',
        alt: 'A supplied photograph',
      }),
      node('video', 'vict.media.video', {
        source: '/supplied/video.webm',
        captions: '/supplied/captions.vtt',
        poster: '/supplied/poster.png',
        label: 'Demonstration',
      }),
      node('embed', 'vict.media.embed', {
        provider: 'youtube',
        videoId: 'abcdefghijk',
        title: 'Interview',
      }),
    ]);
    const target = document.createElement('div');
    let instance = mount(Consumer, { target, props: { source, store: memoryAssetStore() } });
    await settle();
    expect(target.querySelector('img')?.getAttribute('alt')).toBe('A supplied photograph');
    expect(target.querySelector('video')?.hasAttribute('controls')).toBe(true);
    expect(target.querySelector('track')?.getAttribute('src')).toBe('/supplied/captions.vtt');
    expect(target.querySelector('iframe')).toBeNull();
    expect(target.textContent).toContain('not enabled');
    await unmount(instance);
    target.replaceChildren();
    instance = mount(Consumer, {
      target,
      props: {
        source: JSON.parse(JSON.stringify(source)),
        store: memoryAssetStore(),
        providers: ['youtube'],
      },
    });
    await settle();
    expect(target.querySelector('iframe')?.getAttribute('src')).toBe(
      embedUrl('youtube', 'abcdefghijk'),
    );
    await unmount(instance);
    target.remove();
  });
});
