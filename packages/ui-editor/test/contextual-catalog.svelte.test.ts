import { expect, it } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import { catalogDescriptors } from '@victframework/ui-svelte';
import type { UiDocument } from '@victframework/ui';
import Inspector from '../src/Inspector.svelte';

it('exposes every registered catalog property and output in bounded contextual pages without disclosures', async () => {
  for (const descriptor of catalogDescriptors) {
    const source: UiDocument = {
      schema: 'vict.ui-document@1',
      id: 'audit',
      revision: '1',
      root: 'root',
      nodes: {
        root: { id: 'root', kind: 'element', tag: 'main', children: ['component'] },
        component: {
          id: 'component',
          kind: 'component',
          definitionId: descriptor.id,
          revision: descriptor.revision,
        },
      },
      componentDefinitions: {},
      tokens: {},
      assets: {},
      conditions: {},
      styleSources: {},
      localState: {},
    };
    const target = document.createElement('div');
    document.body.append(target);
    const editor = mount(Inspector, {
      target,
      props: {
        document: source,
        selectedOccurrence: 'audit|component',
        componentDescriptors: catalogDescriptors,
        contextual: true,
        editTextSignal: Symbol('stale text request'),
        onApply: () => true,
      },
    });
    try {
      flushSync();
      const properties = target.querySelector('[aria-label="Component property pages"]')!;
      expect(properties, descriptor.id).not.toBeNull();
      const tabs = [...properties.querySelectorAll<HTMLButtonElement>('[role=tab]')];
      expect(tabs.length, descriptor.id).toBe(descriptor.props.length);
      for (const [index, tab] of tabs.entries()) {
        tab.click();
        flushSync();
        expect(
          target.querySelector(`[aria-label="${descriptor.props[index]!.name} source"]`),
          descriptor.id,
        ).not.toBeNull();
        expect(target.querySelectorAll('.expression-editor'), descriptor.id).toHaveLength(1);
        expect(target.querySelector('details'), descriptor.id).toBeNull();
      }
      const text = [
        ...target.querySelectorAll<HTMLButtonElement>(
          '[aria-label="Format categories"] [role=tab]',
        ),
      ].find((button) => button.textContent === 'Text');
      if (text) {
        text.click();
        flushSync();
        expect(target.querySelector('[aria-label="Text content"]'), descriptor.id).toBeNull();
        expect(target.querySelector('[aria-label="Font family"]'), descriptor.id).not.toBeNull();
      }
    } finally {
      await unmount(editor);
      target.remove();
    }
    const outputs = document.createElement('div');
    document.body.append(outputs);
    const connection = mount(Inspector, {
      target: outputs,
      props: {
        document: source,
        selectedOccurrence: 'audit|component',
        componentDescriptors: catalogDescriptors,
        contextual: true,
        section: 'Behavior',
        onApply: () => true,
      },
    });
    try {
      flushSync();
      const tabs = [
        ...outputs.querySelectorAll<HTMLButtonElement>(
          '[aria-label="Component connection pages"] [role=tab]',
        ),
      ];
      expect(tabs.length, descriptor.id).toBe(descriptor.outputs?.length ?? 0);
      for (const [index, tab] of tabs.entries()) {
        tab.click();
        flushSync();
        expect(
          outputs.querySelector(`[aria-label="${descriptor.outputs![index]!.name} action"]`),
          descriptor.id,
        ).not.toBeNull();
        expect(outputs.querySelector('details'), descriptor.id).toBeNull();
      }
    } finally {
      await unmount(connection);
      outputs.remove();
    }
  }
});
