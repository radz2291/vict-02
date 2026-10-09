/**
 * Round-3 B4 interaction probes: dropdown-menu (item + checkbox item),
 * menubar (menu → items), command (searchable items), navigation-menu.
 * Slot names/required gates follow the registered implementations.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { flushSync } from 'svelte';
import { click, mountDoc, teardownAll } from './probe-kit.js';

afterEach(teardownAll);

const lit = (value: string | number | boolean) => ({ type: 'literal', value }) as never;
const ref = (path: string) => ({ type: 'ref', path }) as never;
const tick = async () => { await new Promise((r) => setTimeout(r, 60)); flushSync(); };

describe('B4: dropdown-menu with item + checkbox item', () => {
  it('opens on trigger; the checkbox item loops boolean state', async () => {
    const target = mountDoc({
      root: 'root',
      nodes: {
        root: { kind: 'element', id: 'root', tag: 'div', children: ['menu'] } as never,
        menu: {
          kind: 'component', id: 'menu', definitionId: 'vict.catalog.dropdown-menu',
          props: { label: lit('Queue actions'), open: ref('state.menuOpen') },
          outputs: { openChange: { setState: { key: 'menuOpen', value: ref('$output') } }, itemActivate: { setState: { key: 'lastItem', value: ref('$output') } } },
          slots: {
            trigger: { name: 'trigger', children: ['trig'] },
            items: { name: 'items', children: ['mi1', 'mi2'] },
          },
        } as never,
        trig: { kind: 'text', id: 'trig', content: { type: 'literal', value: 'Queue actions' } } as never,
        mi1: {
          kind: 'component', id: 'mi1', definitionId: 'vict.catalog.dropdown-menu.item',
          props: { value: lit('escalate'), label: lit('Escalate') },
          slots: { content: { name: 'content', children: ['mi1t'] } },
        } as never,
        mi1t: { kind: 'text', id: 'mi1t', content: { type: 'literal', value: 'Escalate' } } as never,
        mi2: {
          kind: 'component', id: 'mi2', definitionId: 'vict.catalog.dropdown-menu.checkbox-item',
          props: { value: lit('notify'), label: lit('Notify team'), checked: ref('state.notify') },
          outputs: { checkedChange: { setState: { key: 'notify', value: ref('$output') } } },
          slots: { content: { name: 'content', children: ['mi2t'] } },
        } as never,
        mi2t: { kind: 'text', id: 'mi2t', content: { type: 'literal', value: 'Notify team' } } as never,
      },
    }, {
      menuOpen: { key: 'menuOpen', type: 'boolean', initial: false } as never,
      notify: { key: 'notify', type: 'boolean', initial: false } as never,
      lastItem: { key: 'lastItem', type: 'string', initial: '' } as never,
    });
    const trigger = [...target.querySelectorAll('button')].find(b => (b.textContent ?? '').includes('Queue actions'));
    expect(trigger, 'menu trigger rendered').toBeTruthy();
    trigger!.click();
    await tick();
    const checkbox = document.querySelector('[role="menuitemcheckbox"]') as HTMLElement;
    expect(checkbox, 'checkbox item rendered').toBeTruthy();
    expect(checkbox.getAttribute('aria-checked')).toBe('false');
    click(checkbox);
    await tick();
    const after = (document.querySelector('[role="menuitemcheckbox"]') as HTMLElement)?.getAttribute('aria-checked');
    expect(after, 'checkbox item toggled through the state loop').toBe('true');
  });
});

describe('B4: menubar (menu → items)', () => {
  it('opens a menu from the bar', async () => {
    const target = mountDoc({
      root: 'root',
      nodes: {
        root: { kind: 'element', id: 'root', tag: 'div', children: ['bar'] } as never,
        bar: {
          kind: 'component', id: 'bar', definitionId: 'vict.catalog.menubar',
          props: { value: ref('state.openMenu') },
          slots: { menus: { name: 'menus', children: ['mbm'] } },
        } as never,
        mbm: {
          kind: 'component', id: 'mbm', definitionId: 'vict.catalog.menubar.menu',
          props: { value: lit('inspection'), label: lit('Inspection') },
          slots: { trigger: { name: 'trigger', children: ['mbmt'] }, items: { name: 'items', children: ['mbi1'] } },
        } as never,
        mbmt: { kind: 'text', id: 'mbmt', content: { type: 'literal', value: 'Inspection' } } as never,
        mbi1: {
          kind: 'component', id: 'mbi1', definitionId: 'vict.catalog.menubar.item',
          props: { value: lit('export'), label: lit('Prepare summary') },
          slots: { content: { name: 'content', children: ['mbi1t'] } },
        } as never,
        mbi1t: { kind: 'text', id: 'mbi1t', content: { type: 'literal', value: 'Prepare summary' } } as never,
      },
    }, { openMenu: { key: 'openMenu', type: 'string', initial: '' } as never });
    const barTrigger = [...target.querySelectorAll('button')].find(b => (b.textContent ?? '').includes('Inspection'));
    expect(barTrigger, 'menubar menu trigger rendered').toBeTruthy();
    barTrigger!.click();
    await tick();
    const items = [...document.querySelectorAll('[role="menuitem"]')];
    expect(items.some(i => (i.textContent ?? '').includes('Prepare summary')), 'menu content opened').toBe(true);
  });
});

describe('B4: command (searchable items)', () => {
  it('renders the input and lists items; itemActivate loops', async () => {
    const target = mountDoc({
      root: 'root',
      nodes: {
        root: { kind: 'element', id: 'root', tag: 'div', children: ['cmd'] } as never,
        cmd: {
          kind: 'component', id: 'cmd', definitionId: 'vict.catalog.command',
          props: { label: lit('Find an inspection operation'), placeholder: lit('Search operations…'), value: ref('state.cmdValue'), search: ref('state.cmdSearch') },
          outputs: { valueChange: { setState: { key: 'cmdValue', value: ref('$output') } } },
          slots: {
            items: { name: 'items', children: ['ci1', 'ci2'] },
            empty: { name: 'empty', children: ['cempty'] },
          },
        } as never,
        cempty: { kind: 'text', id: 'cempty', content: { type: 'literal', value: 'No matching operation.' } } as never,
        ci1: {
          kind: 'component', id: 'ci1', definitionId: 'vict.catalog.command.item',
          props: { value: lit('assign'), label: lit('Request reviewer assignment') },
          slots: { content: { name: 'content', children: ['ci1t'] } },
        } as never,
        ci1t: { kind: 'text', id: 'ci1t', content: { type: 'literal', value: 'Request reviewer assignment' } } as never,
        ci2: {
          kind: 'component', id: 'ci2', definitionId: 'vict.catalog.command.item',
          props: { value: lit('export'), label: lit('Prepare inspection summary') },
          slots: { content: { name: 'content', children: ['ci2t'] } },
        } as never,
        ci2t: { kind: 'text', id: 'ci2t', content: { type: 'literal', value: 'Prepare inspection summary' } } as never,
      },
    }, {
      cmdValue: { key: 'cmdValue', type: 'string', initial: '' } as never,
      cmdSearch: { key: 'cmdSearch', type: 'string', initial: '' } as never,
    });
    const input = target.querySelector('input');
    expect(input, 'command input rendered').toBeTruthy();
    expect((input as HTMLInputElement).getAttribute('placeholder')).toBe('Search operations…');
    // items render in the listbox region
    const items = [...document.querySelectorAll('[cmdk-item], [role="option"]')];
    expect(items.length).toBeGreaterThanOrEqual(2);
  });
});

describe('B4: navigation-menu (items with trigger+content)', () => {
  it('renders the item structure', () => {
    const target = mountDoc({
      root: 'root',
      nodes: {
        root: { kind: 'element', id: 'root', tag: 'div', children: ['nav'] } as never,
        nav: {
          kind: 'component', id: 'nav', definitionId: 'vict.catalog.navigation-menu',
          props: { value: ref('state.navValue') },
          slots: { items: { name: 'items', children: ['ni1'] } },
        } as never,
        ni1: {
          kind: 'component', id: 'ni1', definitionId: 'vict.catalog.navigation-menu.item',
          props: { value: lit('inspections'), label: lit('Inspections') },
          slots: { trigger: { name: 'trigger', children: ['ni1t'] }, content: { name: 'content', children: ['nl1'] } },
        } as never,
        ni1t: { kind: 'text', id: 'ni1t', content: { type: 'literal', value: 'Inspections' } } as never,
        nl1: {
          kind: 'component', id: 'nl1', definitionId: 'vict.catalog.navigation-menu.link',
          props: { value: lit('queue'), label: lit('Queue'), href: lit('#queue') },
          slots: { content: { name: 'content', children: ['nl1t'] } },
        } as never,
        nl1t: { kind: 'text', id: 'nl1t', content: { type: 'literal', value: 'Queue' } } as never,
      },
    }, { navValue: { key: 'navValue', type: 'string', initial: '' } as never });
    expect(target.textContent).toContain('Inspections');
    const links = [...target.querySelectorAll('a')];
    expect(links.some(a => a.getAttribute('href') === '#queue'), 'link rendered with href').toBe(true);
  });
});
