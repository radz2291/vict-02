import { describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import {
  compileUiDocument,
  defaultSemanticElementCatalog,
  type UiDocument,
  type UiExtensionDescriptor,
} from '@victframework/ui';
import DocumentHost from '../src/document/DocumentHost.svelte';
import Extension from './DocumentExtension.svelte';
import {
  resolveSvelteExtension,
  type UiExtensionRenderDiagnostic,
  type UiSvelteExtensionImplementation,
} from '../src/document/extensions.js';

const descriptor: UiExtensionDescriptor = {
  id: 'test.button',
  revision: '1',
  props: [{ name: 'label', type: 'string' }],
  rendererImplementationId: 'test.button.svelte',
};
const implementation: UiSvelteExtensionImplementation = {
  extensionId: descriptor.id,
  revision: descriptor.revision,
  rendererImplementationId: descriptor.rendererImplementationId,
  component: Extension,
};
const doc: UiDocument = {
  schema: 'vict.ui-document@1',
  id: 'test.extensions',
  revision: '1',
  root: 'form',
  nodes: {
    form: {
      kind: 'element',
      id: 'form',
      tag: 'form',
      children: ['repeat'],
      interactions: [{ on: 'submit', action: 'invokeAction', actionId: 'test.save' }],
    },
    repeat: {
      kind: 'repeat',
      id: 'repeat',
      collection: { type: 'ref', path: 'view.rows' },
      key: { type: 'ref', path: 'repeat.row.id' },
      itemName: 'row',
      templateRoot: 'button',
    },
    button: {
      kind: 'component',
      id: 'button',
      definitionId: descriptor.id,
      props: { label: { type: 'ref', path: 'repeat.row.label' } },
    },
  },
  componentDefinitions: {},
  styleSources: {},
  tokens: {},
  conditions: {},
  assets: {},
  localState: {},
};
const result = compileUiDocument(doc, defaultSemanticElementCatalog(), [descriptor], {
  viewFields: { rows: 'array', 'rows.id': 'string', 'rows.label': 'string' },
  actionIds: ['test.save'],
});
if (!result.ok) throw new Error(JSON.stringify(result.issues));
const plan = result.plan;

describe('explicit document extension registration', () => {
  it('forwards registration through visual components, conditional branches and slot fills', () => {
    const nested: UiDocument = {
      ...doc,
      root: 'instance',
      nodes: {
        instance: {
          kind: 'component',
          id: 'instance',
          definitionId: 'test.frame',
          slots: { body: { name: 'body', children: ['button'] } },
        },
        branch: { kind: 'conditional', id: 'branch', branches: [{ children: ['slot'] }] },
        slot: { kind: 'slot', id: 'slot', name: 'body' },
        button: {
          kind: 'component',
          id: 'button',
          definitionId: descriptor.id,
          props: { label: { type: 'literal', value: 'Nested save' } },
        },
      },
      componentDefinitions: {
        'test.frame': {
          id: 'test.frame',
          revision: '1',
          root: 'branch',
          props: [],
          slots: { body: { required: true } },
        },
      },
    };
    const compiled = compileUiDocument(nested, defaultSemanticElementCatalog(), [descriptor]);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const target = document.createElement('div');
    const instance = mount(DocumentHost, {
      target,
      props: {
        plan: compiled.plan,
        extensionDescriptors: [descriptor],
        extensionImplementations: [implementation],
        dispatch: async () => {},
        navigate: () => {},
      },
    });
    flushSync();
    try {
      expect(target.querySelector('button')?.textContent).toBe('Nested save');
      const occurrence = target.querySelector('[data-extension-id]')?.getAttribute('data-ui-occ');
      expect(
        compiled.plan.sourceMap.some(
          (entry) => entry.occurrenceKey === occurrence && entry.sourceNodeId === 'button',
        ),
      ).toBe(true);
    } finally {
      unmount(instance);
    }
  });

  it('renders bound props and repeated source occurrences; native submit reaches the canonical action in product and selection hosts', async () => {
    for (const editor of [false, true]) {
      const target = document.createElement('div');
      document.body.appendChild(target);
      const actions: string[] = [];
      const selected: string[] = [];
      const instance = mount(DocumentHost, {
        target,
        props: {
          plan,
          extensionDescriptors: [descriptor],
          extensionImplementations: [implementation],
          view: {
            rows: [
              { id: 'a', label: 'Save A' },
              { id: 'b', label: 'Save B' },
            ],
          },
          dispatch: async (id: string) => {
            actions.push(id);
          },
          navigate: () => {},
          ...(editor ? { selectOccurrence: (key: string) => selected.push(key) } : {}),
        },
      });
      flushSync();
      try {
        const buttons = [...target.querySelectorAll('button')];
        expect(buttons.map((button) => button.textContent)).toEqual(['Save A', 'Save B']);
        const occurrences = [...target.querySelectorAll('[data-extension-id]')].map((element) =>
          element.getAttribute('data-ui-occ'),
        );
        expect(occurrences[0]).toContain('|a');
        expect(occurrences[1]).toContain('|b');
        buttons[0]!.click();
        await Promise.resolve();
        flushSync();
        expect(actions).toEqual(['test.save']);
        if (editor) expect(selected).toContain(occurrences[0]);
      } finally {
        unmount(instance);
        target.remove();
      }
    }
  });

  it('fails closed for missing/mismatched/duplicate implementation and unsupported declared interfaces', () => {
    const instruction = plan.structure[0];
    if (
      instruction?.kind !== 'element' ||
      instruction.children[0]?.kind !== 'repeat' ||
      instruction.children[0].template.kind !== 'extension'
    )
      throw new Error('fixture');
    const extension = instruction.children[0].template;
    expect(resolveSvelteExtension(extension, [descriptor], [implementation]).ok).toBe(true);
    for (const implementations of [
      [],
      [{ ...implementation, revision: '2' }],
      [{ ...implementation, rendererImplementationId: 'other' }],
      [implementation, implementation],
    ]) {
      expect(resolveSvelteExtension(extension, [descriptor], implementations).ok).toBe(false);
    }
    expect(resolveSvelteExtension(extension, [], [implementation]).ok).toBe(false);
    expect(resolveSvelteExtension(extension, [descriptor, descriptor], [implementation]).ok).toBe(
      false,
    );
    for (const declared of [
      { ...descriptor, slots: ['body'] },
      { ...descriptor, events: ['click'] },
    ]) {
      expect(resolveSvelteExtension(extension, [declared], [implementation])).toMatchObject({
        ok: false,
        // A slots-declaring descriptor is component-ABI (frozen §3.2) — a
        // consistent marker/abi pair is mandatory → ABI gate code. A
        // non-marker EVENT on an otherwise props-only descriptor keeps the
        // exact legacy interface code (§4.3 "props-only extensions
        // unchanged"). U3-era expectation updated per the frozen amendment;
        // recorded in the B1 records.
        diagnostic: {
          code:
            declared.slots !== undefined
              ? 'UI_COMPONENT_ABI_UNSUPPORTED'
              : 'UI_RENDER_EXTENSION_INTERFACE_UNSUPPORTED',
        },
      });
    }
  });

  it('reports unavailable implementations without exposing bound data as JSON', () => {
    const target = document.createElement('div');
    const diagnostics: { code: string }[] = [];
    const instance = mount(DocumentHost, {
      target,
      props: {
        plan,
        extensionDescriptors: [descriptor],
        view: { rows: [{ id: 'a', label: 'Private label' }] },
        dispatch: async () => {},
        navigate: () => {},
        onRenderDiagnostic: (diagnostic: UiExtensionRenderDiagnostic) =>
          diagnostics.push(diagnostic),
      },
    });
    flushSync();
    try {
      expect(target.textContent).toContain('This component is unavailable.');
      expect(target.textContent).not.toContain('Private label');
      expect(target.querySelector('pre')).toBeNull();
      expect(
        diagnostics.some((diagnostic) => diagnostic.code === 'UI_RENDER_EXTENSION_UNAVAILABLE'),
      ).toBe(true);
    } finally {
      unmount(instance);
    }
  });
});
