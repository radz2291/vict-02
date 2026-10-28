import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import {
  compileUiDocument,
  createUiAuthoringRegistry,
  defaultSemanticElementCatalog,
  type UiDocument,
  type UiAuthoringFragment,
} from '@victframework/ui';
import { patternAuthoringPackage } from '../src/authoring/knowledge.js';
import { patternAuthoringImplementations } from '../src/authoring/implementations.js';
import { patternAuthoringDescriptors } from '../src/authoring/descriptors.js';
import {
  mediaAuthoringPackage,
  mediaAuthoringDescriptors,
  mediaAuthoringImplementations,
} from '../../ui-media-svelte/src/authoring.js';
import {
  campaignKey,
  campaignSeen,
  dismissCampaign,
  resetCampaign,
  filterItems,
  slideIndex,
} from '../src/state.js';
import { lockViewport } from '../src/focus.js';
import {memoryAssetStore,importMediaAsset,type MediaAssetStore} from '../../ui-media-svelte/src/assets.js';
import Consumer from './Consumer.svelte';
import FirstVisit from '../src/FirstVisit.svelte';

let instances: ReturnType<typeof mount>[] = [];
afterEach(async () => {
  for (const instance of instances) await unmount(instance);
  vi.restoreAllMocks();
  instances = [];
  document.body.innerHTML = '';
  sessionStorage.clear();
  localStorage.clear();
});
function source(fragment: UiAuthoringFragment): UiDocument {
  return {
    schema: 'vict.ui-document@1',
    id: 'pattern-consumer',
    revision: '1',
    root: fragment.root,
    nodes: Object.fromEntries(fragment.nodes.map((node) => [node.id, node])),
    componentDefinitions: {},
    styleSources: {},
    tokens: {},
    conditions: {},
    assets: {},
    localState: fragment.localState ?? {},
  };
}
function seed(id: string, revision = '1') {
  return patternAuthoringPackage.registrations.find(
    (item) => item.descriptor.id === id && item.descriptor.revision === revision,
  )!.seed!;
}
async function render(id: string, documentSource = source(seed(id)), store?:MediaAssetStore) {
  const target = document.createElement('div');
  document.body.append(target);
  instances.push(mount(Consumer, { target, props: { source: documentSource, store } }));
  flushSync();
  await tick();
  return target;
}
async function click(button: HTMLElement) {
  button.click();
  flushSync();
  await tick();
  flushSync();
}

describe('registered application patterns', () => {
  it('uses shared catalog button roots while preserving declared carousel slide styling',async()=>{
    const doc=source(seed('vict.pattern.carousel'));
    const root=doc.nodes[doc.root]!;
    if(root.kind!=='component')throw Error('Expected carousel');
    const documentSource:UiDocument={...doc,nodes:{...doc.nodes,[root.id]:{...root,partStyles:{slide:{localStyle:[{property:'background-color',value:{type:'text',value:'rgb(7, 61, 47)'}}]}}}}};
    const target=await render('vict.pattern.carousel',documentSource);
    const slide=target.querySelector<HTMLElement>('.vict-carousel-slide')!;
    expect(getComputedStyle(slide).backgroundColor).toBe('rgb(7, 61, 47)');
    expect(target.querySelector('[aria-label="Next slide"]')?.hasAttribute('data-button-root')).toBe(true);
    expect(target.querySelector('[aria-label="Next slide"]')?.classList.contains('vict-btn')).toBe(true);
  });
  it('resolves managed carousel image bytes through the application asset host',async()=>{
    const asset=await importMediaAsset(new File([new Uint8Array([137,80,78,71,13,10,26,10])],'slide.png',{type:'image/png'}));
    const store=memoryAssetStore();await store.put(asset);
    const lookup=vi.spyOn(store,'get');
    vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:verified-carousel-image');
    const doc=source(seed('vict.pattern.carousel'));
    const root=doc.nodes[doc.root]!;
    if(root.kind!=='component')throw Error('Expected carousel');
    const documentSource:UiDocument={...doc,nodes:{...doc.nodes,[root.id]:{...root,props:{...root.props,images:{type:'literal',value:true}}}},localState:{...doc.localState,slides:{key:'slides',type:'stringList',initial:[asset.reference]}}};
    const target=await render('vict.pattern.carousel',documentSource,store);
    await vi.waitFor(()=>expect(target.querySelector('img')?.getAttribute('src')).toBe('blob:verified-carousel-image'));
    expect(lookup).toHaveBeenCalledWith(asset.reference);
    expect(target.querySelector('[data-media-state]')).not.toBeNull();
    expect(target.querySelector('[role=alert]')).toBeNull();
  });
  it('keeps non-dismissible sheets open on Escape and styles the actual shared backdrop part',async()=>{
    const doc=source(seed('vict.pattern.drawer')),root=doc.nodes[doc.root]!;
    if(root.kind!=='component')throw Error('Expected drawer');
    const documentSource:UiDocument={...doc,nodes:{...doc.nodes,[root.id]:{...root,props:{...root.props,dismissible:{type:'literal',value:false}},partStyles:{backdrop:{localStyle:[{property:'background-color',value:{type:'text',value:'rgb(8, 25, 43)'}}]}}}}};
    const target=await render('vict.pattern.drawer',documentSource);
    await click(target.querySelector('button')!);
    const dialog=target.querySelector<HTMLElement>('[role=dialog]')!;
    expect(target.querySelector('[data-dialog-content]')).toBe(dialog);
    expect(getComputedStyle(target.querySelector('[data-dialog-overlay]')!).backgroundColor).toBe('rgb(8, 25, 43)');
    dialog.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    flushSync();await tick();expect(target.querySelector('[role=dialog]')).toBe(dialog);
    await click(dialog.querySelector('[aria-label="Close drawer"]')!);
    expect(target.querySelector('[role=dialog]')).toBeNull();
  });
  it('preserves an external focus target when a controlled sheet deliberately has no trigger',async()=>{
    const external=document.createElement('button');external.textContent='External opener';document.body.append(external);external.focus();
    const doc=source(seed('vict.pattern.drawer')),root=doc.nodes[doc.root]!;
    if(root.kind!=='component')throw Error('Expected drawer');
    const documentSource:UiDocument={...doc,nodes:{...doc.nodes,[root.id]:{...root,props:{...root.props,showTrigger:{type:'literal',value:false}}}},localState:{...doc.localState,drawerOpen:{key:'drawerOpen',type:'boolean',initial:true}}};
    const target=await render('vict.pattern.drawer',documentSource);
    expect(target.querySelector('[data-dialog-trigger]')).toBeNull();
    const dialog=target.querySelector<HTMLElement>('[role=dialog]')!;
    expect(document.activeElement).toBe(dialog);
    await click(dialog.querySelector('[aria-label="Close drawer"]')!);
    expect(target.querySelector('[role=dialog]')).toBeNull();expect(document.activeElement).toBe(external);
  });
  it('discovers exact contracts and compiles every real authoring seed', () => {
    const registry = createUiAuthoringRegistry(
      [patternAuthoringPackage, mediaAuthoringPackage],
      [...patternAuthoringImplementations, ...mediaAuthoringImplementations],
      { requireCompatibility: true },
    );
    expect(registry.issues).toEqual([]);
    expect(
      registry.contracts.filter((item) => item.family === 'application-patterns'),
    ).toHaveLength(10);
    for (const registration of patternAuthoringPackage.registrations) {
      const result = compileUiDocument(
        source(registration.seed!),
        defaultSemanticElementCatalog(),
        [...patternAuthoringDescriptors, ...mediaAuthoringDescriptors],
      );
      expect(result.ok, JSON.stringify(result)).toBe(true);
    }
  });
  it('opens the actual drawer, contains focus, closes with Escape and restores focus', async () => {
    const target = await render('vict.pattern.drawer');
    const button = target.querySelector('button')!;
    button.focus();
    await click(button);
    const dialog = target.querySelector<HTMLElement>('[role=dialog]')!;
    expect(dialog).not.toBeNull();
    expect(dialog.closest('[data-ui-application-viewport]')).not.toBeNull();
    expect(document.activeElement).toBe(dialog);
    const close = dialog.querySelector<HTMLButtonElement>('button')!;
    close.focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    close.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(close);
    dialog.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    flushSync();
    await tick();
    expect(target.querySelector('[role=dialog]')).toBeNull();
    expect(document.activeElement).toBe(button);
  });
  it('drawer backdrop closes without a body portal or Studio scroll mutation', async () => {
    const target = await render('vict.pattern.drawer');
    const original = document.body.style.overflow;
    await click(target.querySelector('button')!);
    expect(document.body.style.overflow).toBe(original);
    await click(target.querySelector<HTMLElement>('[data-ui-pattern-overlay]')!);
    expect(target.querySelector('[role=dialog]')).toBeNull();
  });
  it('carousel changes real visible slides through next, previous and horizontal swipe', async () => {
    const target = await render('vict.pattern.carousel');
    const visible = () =>
      Array.from(target.querySelectorAll<HTMLElement>('[aria-roledescription=slide]'))
        .filter((item) => !item.hidden)
        .map((item) => item.textContent);
    expect(visible()).toEqual(['First slide']);
    await click(target.querySelector('[aria-label="Next slide"]')!);
    expect(visible()).toEqual(['Second slide']);
    await click(target.querySelector('[aria-label="Previous slide"]')!);
    expect(visible()).toEqual(['First slide']);
    const viewport = target.querySelector<HTMLElement>('[aria-label=Slides]')!;
    const imageDrag = new Event('dragstart', {bubbles:true,cancelable:true});
    viewport.dispatchEvent(imageDrag);
    expect(imageDrag.defaultPrevented).toBe(true);
    viewport.dispatchEvent(new MouseEvent('pointerdown',{clientX:200,clientY:30,bubbles:true}));
    viewport.dispatchEvent(new Event('pointercancel',{bubbles:true}));
    viewport.dispatchEvent(new MouseEvent('pointerup',{clientX:80,clientY:34,bubbles:true}));
    flushSync();await tick();expect(visible()).toEqual(['First slide']);
    viewport.dispatchEvent(
      new MouseEvent('pointerdown', { clientX: 200, clientY: 30, bubbles: true }),
    );
    viewport.dispatchEvent(
      new MouseEvent('pointerup', { clientX: 80, clientY: 34, bubbles: true }),
    );
    flushSync();
    await tick();
    expect(visible()).toEqual(['Second slide']);
  });
  it('navigation activation updates the real authored selection state', async () => {
    const target = await render('vict.pattern.navigation');
    const settings = Array.from(target.querySelectorAll('li button')).find(
      (button) => button.textContent?.trim() === 'Settings',
    )!;
    await click(settings);
    expect(settings.getAttribute('aria-current')).toBe('page');
    expect(target.querySelectorAll('[aria-current=page]')).toHaveLength(1);
  });
  it('search changes the actual rendered list rather than only an input value', async () => {
    const target = await render('vict.pattern.filtered-list');
    const input = target.querySelector<HTMLInputElement>('input')!;
    input.value = 'grace';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    await tick();
    expect(
      Array.from(target.querySelectorAll('li button')).map((item) => item.textContent),
    ).toEqual(['Grace Hopper']);
    input.value = 'no match';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    await tick();
    expect(target.querySelectorAll('li')).toHaveLength(0);
    expect(target.textContent).toContain('No matching items');
  });
  it('first-visit dismissal survives actual unmount/reopen and campaign reset is explicit', async () => {
    let target = await render('vict.pattern.first-visit');
    expect(target.textContent).toContain('Welcome');
    await click(target.querySelector('button')!);
    expect(target.textContent).not.toContain('Welcome');
    await unmount(instances.pop()!);
    target.remove();
    target = await render('vict.pattern.first-visit');
    expect(target.textContent).not.toContain('Welcome');
    expect(campaignSeen(localStorage, campaignKey('my-application', 'welcome-v1', ''))).toBe(true);
    expect(campaignSeen(localStorage, campaignKey('my-application', 'welcome-v1', 'next'))).toBe(
      false,
    );
  });
  it('first-visit revision 2 resets the same campaign repeatedly across real remounts without clearing other memory', async () => {
    const currentKey = campaignKey('my-application', 'welcome-v1', '');
    const foreignKeys = [campaignKey('other-application', 'welcome-v1', ''), campaignKey('my-application', 'other-campaign', ''), campaignKey('my-application', 'welcome-v1', 'other-reset')];
    for (const key of foreignKeys) dismissCampaign(localStorage, key);
    const doc = source(seed('vict.pattern.first-visit', '2'));
    let target = await render('vict.pattern.first-visit', doc);
    for (let cycle = 0; cycle < 3; cycle++) {
      expect(target.textContent).toContain('Welcome');
      await click([...target.querySelectorAll('button')].find(button => button.textContent === 'Dismiss')!);
      expect(target.textContent).not.toContain('Welcome');
      expect(campaignSeen(localStorage, currentKey)).toBe(true);
      await unmount(instances.pop()!);target.remove();
      target = await render('vict.pattern.first-visit', doc);
      expect(target.textContent).not.toContain('Welcome');
      const reset = [...target.querySelectorAll('button')].find(button => button.textContent === 'Reset welcome')!;
      expect(reset.hasAttribute('data-button-root')).toBe(true);
      expect(reset.classList.contains('vict-btn')).toBe(true);
      await click(reset);
      expect(target.textContent).toContain('Welcome');
      expect(localStorage.getItem(currentKey)).toBeNull();
      for (const key of foreignKeys) expect(campaignSeen(localStorage, key)).toBe(true);
      await unmount(instances.pop()!);target.remove();
      target = await render('vict.pattern.first-visit', doc);
      expect(target.textContent).toContain('Welcome');
    }
  });
  it('first-visit reset respects session scope and reports failed removal honestly', async () => {
    const doc = source(seed('vict.pattern.first-visit', '2'));
    const root = doc.nodes[doc.root]!;
    if (root.kind !== 'component') throw Error('Expected first-visit');
    const key = campaignKey('my-application', 'welcome-v1', '');
    dismissCampaign(localStorage, key);dismissCampaign(sessionStorage, key);
    const target = await render('vict.pattern.first-visit', {...doc, nodes: {...doc.nodes, [root.id]: {...root, props: {...root.props, scope: {type: 'literal', value: 'session'}}}}});
    const reset = [...target.querySelectorAll('button')].find(button => button.textContent === 'Reset welcome')!;
    await click(reset);
    expect(sessionStorage.getItem(key)).toBeNull();
    expect(campaignSeen(localStorage, key)).toBe(true);
    await click([...target.querySelectorAll('button')].find(button => button.textContent === 'Dismiss')!);
    vi.spyOn(sessionStorage, 'removeItem').mockImplementation(() => {throw Error('Storage refused');});
    await click(reset);
    expect(target.textContent).not.toContain('Welcome');
    expect(target.querySelector('[data-memory-status]')?.getAttribute('data-memory-status')).toBe('unavailable');
    expect(target.querySelector('[role="alert"]')?.textContent).toContain('could not be reset');
    expect(reset.disabled).toBe(true);
    expect(campaignSeen(sessionStorage, key)).toBe(true);
  });
  it('first-visit revision 1 keeps reset absent and revision 2 remains opt-in', async () => {
    const legacy = await render('vict.pattern.first-visit');
    expect(legacy.querySelectorAll('button')).toHaveLength(1);
    const doc = source(seed('vict.pattern.first-visit', '2'));
    const root = doc.nodes[doc.root]!;
    if(root.kind !== 'component') throw Error('Expected first-visit');
    const target = await render('vict.pattern.first-visit', {...doc, nodes:{...doc.nodes,[root.id]:{...root,props:{...root.props,allowReset:{type:'literal',value:false}}}}});
    expect(target.querySelectorAll('button')).toHaveLength(1);
  });
  it('first-visit reset emits acknowledgement and visibility only after successful scoped removal', async () => {
    const target=document.createElement('div');document.body.append(target);
    const emit=vi.fn();
    instances.push(mount(FirstVisit,{target,props:{props:{applicationId:'reset-emissions',campaignId:'welcome',allowReset:true},occurrenceKey:'reset-test',nodeId:'reset-test',io:{emit}}}));
    flushSync();await tick();
    const button=(label:string)=>[...target.querySelectorAll('button')].find(item=>item.textContent===label)!;
    await click(button('Dismiss'));emit.mockClear();
    await click(button('Reset welcome'));
    expect(emit.mock.calls).toEqual([['dismissedChange',false],['showChange',true]]);
    await click(button('Dismiss'));emit.mockClear();
    vi.spyOn(localStorage,'removeItem').mockImplementation(()=>{throw Error('Denied');});
    await click(button('Reset welcome'));
    expect(emit.mock.calls).toEqual([['memoryStatus','unavailable']]);
  });
  it('an explicitly composed popup can acknowledge first-visit memory through its dismissed prop', async () => {
    const documentSource = source(seed('vict.pattern.first-visit'));
    const original = documentSource.nodes[documentSource.root]!;
    if (original.kind !== 'component') throw Error('Expected first-visit component');
    const target = await render('vict.pattern.first-visit', {
      ...documentSource,
      nodes: {
        ...documentSource.nodes,
        [original.id]: {
          ...original,
          props: { ...original.props, dismissed: { type: 'literal', value: true } },
        },
      },
    });
    expect(target.textContent).not.toContain('Welcome');
    expect(campaignSeen(localStorage, campaignKey('my-application', 'welcome-v1', ''))).toBe(true);
  });
  it('storage refusal remains visibly unavailable while dismissal works for this mount only', async () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw Error('Storage unavailable');
    });
    const target = await render('vict.pattern.first-visit');
    expect(target.querySelector('[data-memory-status]')?.getAttribute('data-memory-status')).toBe(
      'unavailable',
    );
    expect(target.textContent).toContain('Welcome');
    await click(target.querySelector('button')!);
    expect(target.textContent).not.toContain('Welcome');
  });
  it('invalid campaign identity is reported separately from unavailable storage', async () => {
    const documentSource = source(seed('vict.pattern.first-visit'));
    const original = documentSource.nodes[documentSource.root]!;
    if (original.kind !== 'component') throw Error('Expected first-visit component');
    const target = await render('vict.pattern.first-visit', {
      ...documentSource,
      nodes: {
        ...documentSource.nodes,
        [original.id]: {
          ...original,
          props: { ...original.props, applicationId: { type: 'literal', value: '' } },
        },
      },
    });
    expect(target.querySelector('[data-memory-status]')?.getAttribute('data-memory-status')).toBe(
      'invalid',
    );
    expect(target.querySelector('[role=alert]')).not.toBeNull();
  });
  it('authored root styling reaches the pattern without removing its reusable layout class', async () => {
    const documentSource = source(seed('vict.pattern.carousel'));
    const original = documentSource.nodes[documentSource.root]!;
    const target = await render('vict.pattern.carousel', {
      ...documentSource,
      nodes: {
        ...documentSource.nodes,
        [original.id]: {
          ...original,
          localStyle: [
            { property: 'background-color', value: { type: 'text', value: 'rgb(21, 31, 41)' } },
          ],
        },
      },
    });
    const carousel = target.querySelector<HTMLElement>('.vict-carousel')!;
    expect(carousel).not.toBeNull();
    expect(getComputedStyle(carousel).backgroundColor).toBe('rgb(21, 31, 41)');
  });
  it('campaign identity/scope/reset are independent and bounded', () => {
    const first = campaignKey('one', 'welcome', ''),
      second = campaignKey('two', 'welcome', '');
    dismissCampaign(localStorage, first);
    expect(campaignSeen(localStorage, first)).toBe(true);
    expect(campaignSeen(localStorage, second)).toBe(false);
    expect(campaignSeen(sessionStorage, first)).toBe(false);
    resetCampaign(localStorage, first);
    expect(campaignSeen(localStorage, first)).toBe(false);
    expect(() => campaignKey('', 'welcome', '')).toThrow();
  });
  it('nested drawer locks retain their app scroll boundary until the last release', () => {
    const viewport = document.createElement('div');
    viewport.setAttribute('data-ui-application-viewport', '');
    viewport.style.overflow = 'auto';
    const panel = document.createElement('section');
    viewport.append(panel);
    document.body.append(viewport);
    const first = lockViewport(panel),
      second = lockViewport(panel);
    first();
    expect(viewport.style.overflow).toBe('hidden');
    second();
    expect(viewport.style.overflow).toBe('auto');
    second();
    expect(viewport.style.overflow).toBe('auto');
  });
  it('handles empty/bounded navigation and deterministic search/slide boundaries', () => {
    expect(filterItems(['Alpha Beta', 'beta Gamma'], 'beta alpha')).toEqual(['Alpha Beta']);
    expect(slideIndex(-1, 3, false)).toBe(0);
    expect(slideIndex(-1, 3, true)).toBe(2);
    expect(slideIndex(5, 0, true)).toBe(0);
  });
  it('names an icon-only authored drawer trigger and retains real open behavior', async () => {
    const documentSource = source(seed('vict.pattern.drawer'));
    const drawer = documentSource.nodes[documentSource.root]!;
    if (drawer.kind !== 'component') throw Error('Expected drawer');
    const target = await render('vict.pattern.drawer', {
      ...documentSource,
      nodes: {
        ...documentSource.nodes,
        [drawer.id]: {
          ...drawer,
          props: { ...drawer.props, triggerLabel: { type: 'literal', value: 'Open navigation' } },
          slots: { ...drawer.slots, trigger: { name: 'trigger', children: ['drawerIcon'] } },
        },
        drawerIcon: {
          kind: 'component',
          id: 'drawerIcon',
          definitionId: 'vict.media.icon',
          revision: '1',
          props: {
            name: { type: 'literal', value: 'menu' },
            decorative: { type: 'literal', value: true },
          },
        },
      },
    });
    const button = target.querySelector('button')!;
    expect(button.getAttribute('aria-label')).toBe('Open navigation');
    expect(button.querySelector('svg')).not.toBeNull();
    await click(button);
    expect(target.querySelector('[role=dialog]')).not.toBeNull();
  });
  it('revision-2 navigation uses supplied icons while selection stays typed and useful', async () => {
    const target = await render(
      'vict.pattern.navigation',
      source(seed('vict.pattern.navigation', '2')),
    );
    expect(target.querySelectorAll('svg')).toHaveLength(4);
    const settings = Array.from(target.querySelectorAll('li button')).find(
      (button) => button.textContent?.trim() === 'Settings',
    )!;
    expect(settings.querySelector('[aria-hidden=true]')).not.toBeNull();
    await click(settings);
    expect(settings.getAttribute('aria-current')).toBe('page');
  });
  it('revision-2 search and carousel icons preserve labels and existing control outcomes', async () => {
    const list = await render(
      'vict.pattern.filtered-list',
      source(seed('vict.pattern.filtered-list', '2')),
    );
    expect(list.querySelector('svg')).not.toBeNull();
    const input = list.querySelector<HTMLInputElement>('input')!;
    expect(list.querySelector('label')?.htmlFor).toBe(input.id);
    input.value = 'grace';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    await tick();
    expect(list.querySelectorAll('li')).toHaveLength(1);
    const carousel = await render(
      'vict.pattern.carousel',
      source(seed('vict.pattern.carousel', '2')),
    );
    expect(carousel.querySelectorAll('svg')).toHaveLength(2);
    const next = carousel.querySelector<HTMLButtonElement>('[aria-label="Next slide"]')!;
    await click(next);
    expect(
      Array.from(carousel.querySelectorAll<HTMLElement>('[aria-roledescription=slide]'))
        .filter((item) => !item.hidden)
        .map((item) => item.textContent),
    ).toEqual(['Second slide']);
  });
  it('icon action-button delivers its string payload through canonical state and honors disabled', async () => {
    const original = source(seed('vict.pattern.action-button'));
    const button = original.nodes[original.root]!;
    if (button.kind !== 'component') throw Error('Expected action button');
    const documentSource: UiDocument = {
      ...original,
      root: 'actions',
      nodes: {
        ...original.nodes,
        actions: { kind: 'element', id: 'actions', tag: 'div', children: [button.id, 'status'] },
        status: { kind: 'element', id: 'status', tag: 'p', children: ['lastAction'] },
        lastAction: {
          kind: 'text',
          id: 'lastAction',
          content: { type: 'expression', expression: { type: 'ref', path: 'state.lastAction' } },
        },
        [button.id]: {
          ...button,
          props: { ...button.props, iconOnly: { type: 'literal', value: true } },
        },
      },
    };
    const target = await render('vict.pattern.action-button', documentSource);
    const action = target.querySelector('button')!;
    expect(action.getAttribute('aria-label')).toBe('Send message');
    expect(action.querySelector('svg')).not.toBeNull();
    expect(target.querySelector('p')?.textContent).toBe('');
    await click(action);
    expect(target.querySelector('p')?.textContent).toBe('send');
    const disabled = await render('vict.pattern.action-button', {
      ...documentSource,
      id: 'disabled-actions',
      nodes: {
        ...documentSource.nodes,
        [button.id]: {
          ...button,
          props: { ...button.props, disabled: { type: 'literal', value: true } },
        },
      },
    });
    expect(disabled.querySelector('button')?.disabled).toBe(true);
    await click(disabled.querySelector('button')!);
    expect(disabled.querySelector('p')?.textContent).toBe('');
  });
  it('custom carousel icon slots replace defaults without renaming controls and empty menu labels recover', async () => {
    const original = source(seed('vict.pattern.carousel', '2'));
    const carousel = original.nodes[original.root]!;
    if (carousel.kind !== 'component') throw Error('Expected carousel');
    const target = await render('vict.pattern.carousel', {
      ...original,
      nodes: {
        ...original.nodes,
        [carousel.id]: {
          ...carousel,
          slots: { nextIcon: { name: 'nextIcon', children: ['customNext'] } },
        },
        customNext: {
          kind: 'component',
          id: 'customNext',
          definitionId: 'vict.media.icon',
          revision: '1',
          props: {
            name: { type: 'literal', value: 'arrow-right' },
            decorative: { type: 'literal', value: false },
            label: { type: 'literal', value: 'Custom advance graphic' },
          },
        },
      },
    });
    const next = target.querySelector('[aria-label="Next slide"]')!;
    expect(next.querySelectorAll('svg')).toHaveLength(1);
    expect(next.querySelector('[aria-label="Custom advance graphic"]')).not.toBeNull();
    expect(next.getAttribute('aria-label')).toBe('Next slide');
    const navigation = source(seed('vict.pattern.navigation', '2'));
    const root = navigation.nodes[navigation.root]!;
    if (root.kind !== 'component') throw Error('Expected navigation');
    const menu = await render('vict.pattern.navigation', {
      ...navigation,
      nodes: {
        ...navigation.nodes,
        [root.id]: { ...root, props: { ...root.props, menuLabel: { type: 'literal', value: '' } } },
      },
    });
    expect(menu.querySelector('[aria-expanded]')?.getAttribute('aria-label')).toBe('Menu');
  });
});
