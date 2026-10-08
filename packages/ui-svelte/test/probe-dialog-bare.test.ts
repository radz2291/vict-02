/**
 * VERIFICATION PROBE 2: same dialog controlled loop WITHOUT the appshell
 * wrapper — distinguishes portal cleanup from slot-composition interaction.
 */
import { describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { compileUiDocument, defaultSemanticElementCatalog, type UiDocument } from '@victframework/ui';
import DocumentHost from '../src/document/DocumentHost.svelte';
import { b1CatalogDescriptors } from '../src/catalog/components/descriptors.js';
import { b1CatalogImplementations } from '../src/catalog/components/implementations.js';

const doc: UiDocument = {
  schema: 'vict.ui-document@1',
  id: 'probe.bare',
  revision: 'r1',
  root: 'page',
  componentDefinitions: {},
  styleSources: {},
  tokens: {},
  conditions: {},
  assets: {},
  localState: {
    open: { key: 'open', type: 'boolean', initial: false },
  },
  nodes: {
    page: { kind: 'element', id: 'page', tag: 'section', children: ['trigger'] },
    trigger: {
      kind: 'component',
      id: 'trigger',
      definitionId: 'vict.catalog.dialog',
      props: {
        title: { type: 'literal', value: 'bare' },
        open: { type: 'ref', path: 'state.open' },
      },
      outputs: {
        openChange: { setState: { key: 'open', value: { type: 'ref', path: '$output' } } },
      },
      slots: { body: { name: 'body', children: ['bodyText'] } },
    },
  },
};
doc.nodes.bodyText = { kind: 'text', id: 'bodyText', content: { type: 'literal', value: 'body' } } as never;

describe('PROBE 2: bare dialog (no appshell)', () => {
  it('opens and closes', () => {
    const compiled = compileUiDocument(doc, defaultSemanticElementCatalog(), b1CatalogDescriptors, { actionIds: [] });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const target = document.createElement('div');
    document.body.appendChild(target);
    const instance = mount(DocumentHost, {
      target,
      props: {
        plan: compiled.plan,
        extensionDescriptors: b1CatalogDescriptors,
        extensionImplementations: b1CatalogImplementations,
        localState: doc.localState,
        view: {},
        dispatch: async () => ({ ok: true }),
        navigate: () => {},
      },
    });
    flushSync();
    const trigger = () => target.querySelector('[data-dialog-trigger]') as HTMLButtonElement;
    expect(trigger()).toBeTruthy();
    trigger().click();
    flushSync();
    const openCount = document.querySelectorAll('[role=dialog]').length;
    const close = document.querySelector('[role=dialog] [data-dialog-close]') as HTMLButtonElement | null;
    close?.click();
    flushSync();
    const after = document.querySelectorAll('[role=dialog]').length;
    const states = Array.from(document.querySelectorAll('[role=dialog]')).map((d) => d.getAttribute('data-state'));
    console.log('PROBE2 open:', openCount, 'afterClose:', after, 'states:', states);
    expect(after).toBe(0);
    unmount(instance);
    target.remove();
  });
});
