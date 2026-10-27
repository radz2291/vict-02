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
import Consumer from './Consumer.svelte';

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
async function render(id: string, documentSource = source(seed(id))) {
  const target = document.createElement('div');
  document.body.append(target);
  instances.push(mount(Consumer, { target, props: { source: documentSource } }));
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
  it('discovers exact contracts and compiles every real authoring seed', () => {
    const registry = createUiAuthoringRegistry(
      [patternAuthoringPackage, mediaAuthoringPackage],
      [...patternAuthoringImplementations, ...mediaAuthoringImplementations],
      { requireCompatibility: true },
    );
    expect(registry.issues).toEqual([]);
    expect(
      registry.contracts.filter((item) => item.family === 'application-patterns'),
    ).toHaveLength(9);
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
