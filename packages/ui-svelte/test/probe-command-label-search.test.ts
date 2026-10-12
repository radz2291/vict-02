/**
 * VERIFICATION PROBE (round 4) — N1 recheck: command search must match the
 * AUTHORED LABEL, not only the item value. Round 3 pinned the defect in the
 * browser ("Prepare inspection summary" was unfindable while its value
 * 'export' stayed searchable); the repair adds the authored label to the
 * item keywords. Pins, through real input paths (input events on the
 * rendered search input, Enter on the selected option — no cmdk internals):
 * - a full authored label matches its item and hides non-matching items;
 * - a mid-word label fragment matches;
 * - searching by value keeps working;
 * - a non-matching query empties the list and shows the authored empty slot;
 * - activating a label-matched item still emits the authored VALUE
 *   (action identity stable), observed through the rendered state binding.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { flushSync } from 'svelte';
import { mountDoc, teardownAll } from './probe-kit.js';

afterEach(teardownAll);

const lit = (value: string | number | boolean) => ({ type: 'literal', value }) as never;
const ref = (path: string) => ({ type: 'ref', path }) as never;

function typeSearch(input: HTMLInputElement, text: string): void {
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
}

function visibleItems(): string[] {
  return [...document.querySelectorAll('[data-command-item]')]
    .filter((el) => el.getAttribute('data-hidden') !== 'true')
    .map((el) => (el.textContent ?? '').trim());
}

function mountCommandDoc(): ReturnType<typeof mountDoc> {
  return mountDoc(
    {
      root: 'root',
      nodes: {
        root: { kind: 'element', id: 'root', tag: 'div', children: ['cmd', 'marker'] } as never,
        cmd: {
          kind: 'component',
          id: 'cmd',
          definitionId: 'vict.catalog.command',
          props: {
            label: lit('Find an inspection operation'),
            placeholder: lit('Search operations…'),
            value: ref('state.cmdValue'),
            search: ref('state.cmdSearch'),
          },
          outputs: {
            valueChange: { setState: { key: 'cmdValue', value: ref('$output') } },
            searchChange: { setState: { key: 'cmdSearch', value: ref('$output') } },
            itemActivate: { setState: { key: 'lastItem', value: ref('$output') } },
          },
          slots: {
            items: { name: 'items', children: ['ci1', 'ci2'] },
            empty: { name: 'empty', children: ['cempty'] },
          },
        } as never,
        marker: {
          kind: 'component',
          id: 'marker',
          definitionId: 'vict.catalog.label',
          props: { label: { type: 'ref', path: 'state.lastItem' } as never },
        } as never,
        cempty: {
          kind: 'text',
          id: 'cempty',
          content: { type: 'literal', value: 'No matching operation.' },
        } as never,
        ci1: {
          kind: 'component',
          id: 'ci1',
          definitionId: 'vict.catalog.command.item',
          props: { value: lit('assign'), label: lit('Request reviewer assignment') },
          outputs: { itemActivate: { setState: { key: 'lastItem', value: ref('$output') } } },
          slots: { content: { name: 'content', children: ['ci1t'] } },
        } as never,
        ci1t: {
          kind: 'text',
          id: 'ci1t',
          content: { type: 'literal', value: 'Request reviewer assignment' },
        } as never,
        ci2: {
          kind: 'component',
          id: 'ci2',
          definitionId: 'vict.catalog.command.item',
          props: { value: lit('export'), label: lit('Prepare inspection summary') },
          outputs: { itemActivate: { setState: { key: 'lastItem', value: ref('$output') } } },
          slots: { content: { name: 'content', children: ['ci2t'] } },
        } as never,
        ci2t: {
          kind: 'text',
          id: 'ci2t',
          content: { type: 'literal', value: 'Prepare inspection summary' },
        } as never,
      },
    },
    {
      cmdValue: { key: 'cmdValue', type: 'string', initial: '' } as never,
      cmdSearch: { key: 'cmdSearch', type: 'string', initial: '' } as never,
      lastItem: { key: 'lastItem', type: 'string', initial: '' } as never,
    },
  );
}

describe('round 4 N1 recheck: command searches by authored label', () => {
  it('a label fragment finds the item whose value differs; non-matching items hide', async () => {
    const target = mountCommandDoc();
    const input = target.querySelector<HTMLInputElement>('input[data-command-input]');
    expect(input, 'command input rendered').toBeTruthy();
    typeSearch(input!, 'Prepare inspection summary');
    await new Promise((r) => setTimeout(r, 80));
    flushSync();
    const byLabel = visibleItems();
    expect(byLabel.join('|'), 'full authored label matches its item').toContain(
      'Prepare inspection summary',
    );
    expect(byLabel.join('|'), 'non-matching item hidden').not.toContain(
      'Request reviewer assignment',
    );
    typeSearch(input!, 'inspection');
    await new Promise((r) => setTimeout(r, 80));
    flushSync();
    expect(visibleItems().join('|'), 'mid-word label fragment matches').toContain(
      'Prepare inspection summary',
    );
    expect(visibleItems().join('|')).not.toContain('Request reviewer assignment');
  });

  it('value search keeps working; a non-match shows the authored empty slot', async () => {
    const target = mountCommandDoc();
    const input = target.querySelector<HTMLInputElement>('input[data-command-input]');
    expect(input).toBeTruthy();
    typeSearch(input!, 'export');
    await new Promise((r) => setTimeout(r, 80));
    flushSync();
    expect(visibleItems().join('|'), 'value search still finds the item').toContain(
      'Prepare inspection summary',
    );
    typeSearch(input!, 'zzz-no-such-operation');
    await new Promise((r) => setTimeout(r, 80));
    flushSync();
    expect(visibleItems().length, 'no items match a non-existent query').toBe(0);
    expect(target.textContent ?? '', 'authored empty message displayed').toContain(
      'No matching operation.',
    );
  });

  it('activating a label-matched item emits the authored VALUE, not the label', async () => {
    const target = mountCommandDoc();
    const input = target.querySelector<HTMLInputElement>('input[data-command-input]');
    expect(input).toBeTruthy();
    typeSearch(input!, 'inspection');
    await new Promise((r) => setTimeout(r, 80));
    flushSync();
    expect(visibleItems().join('|')).toContain('Prepare inspection summary');
    // Enter on the selected option (cmdk's keyboard activation path)
    input!.focus();
    input!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    await new Promise((r) => setTimeout(r, 80));
    flushSync();
    const marker = [...target.querySelectorAll('[data-ui-node=marker]')].at(-1);
    expect(
      (marker?.textContent ?? '').trim(),
      'activation applied the authored VALUE to the bound state',
    ).toBe('export');
  });
});
