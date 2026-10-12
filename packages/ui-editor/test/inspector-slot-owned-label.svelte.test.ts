/**
 * VERIFICATION PROBE (round 5) — finding F15 truthfulness: when a
 * component's `label` prop is visually owned by a filled slot (renderers
 * prefer slot content over the label prop), the Inspector says so instead
 * of silently accepting edits with no visible effect. Slot precedence
 * itself is legitimate and unchanged.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import type { UiDocument, UiExtensionDescriptor } from '@victframework/ui';
import Inspector from '../src/Inspector.svelte';

const commandItemDescriptor: UiExtensionDescriptor = {
  id: 'vict.catalog.command.item',
  revision: '1',
  abi: 'vict.ui-component-abi@1',
  events: ['vict.ui-component-abi@1'],
  props: [
    { name: 'value', type: 'string', default: '' },
    { name: 'label', type: 'string', default: '' },
  ],
  outputs: [],
  slots: ['content'],
  rendererImplementationId: 'vict.svelte.catalog',
  styleTargets: ['root'],
};

function documentWithFilledSlot(filled: boolean): UiDocument {
  return {
    schema: 'vict.ui-document@1',
    id: 'slotnote',
    revision: '1',
    root: 'root',
    nodes: {
      root: { id: 'root', kind: 'element', tag: 'main', children: ['item'] },
      item: {
        id: 'item',
        kind: 'component',
        definitionId: 'vict.catalog.command.item',
        props: {
          value: { type: 'literal', value: 'assign' },
          label: { type: 'literal', value: 'Request reviewer assignment' },
        },
        ...(filled ? { slots: { content: { name: 'content', children: ['t1'] } } } : {}),
      },
      ...(filled
        ? { t1: { id: 't1', kind: 'text', content: { type: 'literal', value: 'Request reviewer assignment' } } }
        : {}),
    },
    componentDefinitions: {},
    styleSources: {},
    tokens: {},
    conditions: {},
    localState: {},
    assets: {},
  } as unknown as UiDocument;
}

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function mountInspector(doc: UiDocument): HTMLElement {
  const target = document.createElement('div');
  document.body.append(target);
  const instance = mount(Inspector, {
    target,
    props: {
      document: doc,
      selectedOccurrence: 'slotnote|item',
      componentDescriptors: [commandItemDescriptor],
      onApply: () => {},
    },
  });
  cleanups.push(() => {
    unmount(instance);
    target.remove();
  });
  flushSync();
  return target;
}

function componentPropsSection(target: HTMLElement): string | undefined {
  return [...target.querySelectorAll('section')].find(
    (s) => s.querySelector('h3')?.textContent === 'Component properties',
  )?.textContent;
}

describe('round 5: Inspector is truthful about slot-owned label props (F15)', () => {
  it('annotates a label prop whose visible text comes from a filled slot', () => {
    const target = mountInspector(documentWithFilledSlot(true));
    const text = componentPropsSection(target);
    expect(text, 'component properties section renders').toBeTruthy();
    expect(text).toContain('Shown from the');
    expect(text).toContain('slot content while that slot is filled');
    expect(text).toContain('fallback');
  });

  it('does not annotate when the owning slot is not filled', () => {
    const target = mountInspector(documentWithFilledSlot(false));
    const text = componentPropsSection(target);
    expect(text, 'component properties section renders').toBeTruthy();
    expect(text).not.toContain('Shown from the');
  });
});
