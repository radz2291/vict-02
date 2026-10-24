import { describe, it, expect } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import {
  compileUiDocument,
  defaultSemanticElementCatalog,
  type UiDocument,
} from '@victframework/ui';
import DocumentHost from '../../ui-svelte/src/document/DocumentHost.svelte';
import { flowAuthoringDescriptors } from '../src/authoring/descriptors.js';
import { flowAuthoringImplementations } from '../src/authoring/implementations.js';
import {
  createFlowAuthoringContext,
  projectFlowDeclarations,
  type FlowDeclaration,
  type FlowProjection,
} from '../src/authoring/context.js';
import { flowAuthoringPackage } from '../src/authoring/knowledge.js';
import { createUiAuthoringRegistry } from '@victframework/ui';
import AuthoringHost from './AuthoringHost.svelte';

function declaration(id: string, occurrenceKey = id): FlowDeclaration {
  return {
    kind: 'node',
    id,
    nodeId: `source-${id}`,
    occurrenceKey,
    label: id,
    x: 0,
    y: 0,
    target: { class: '', 'data-ui-occ': occurrenceKey },
  };
}
function source(): UiDocument {
  return {
    schema: 'vict.ui-document@1',
    id: 'flow-proof',
    revision: '1',
    root: 'root',
    nodes: {
      root: { kind: 'element', id: 'root', tag: 'div', children: ['canvasA', 'canvasB'] },
      canvasA: {
        kind: 'component',
        id: 'canvasA',
        definitionId: 'vict.flow.canvas',
        revision: '1',
        slots: {
          nodes: { name: 'nodes', children: ['a', 'b'] },
          edges: { name: 'edges', children: ['ab'] },
        },
      },
      canvasB: {
        kind: 'component',
        id: 'canvasB',
        definitionId: 'vict.flow.canvas',
        revision: '1',
        slots: {
          nodes: { name: 'nodes', children: ['other'] },
          edges: { name: 'edges', children: [] },
        },
      },
      a: {
        kind: 'component',
        id: 'a',
        definitionId: 'vict.flow.node',
        revision: '1',
        props: {
          id: { type: 'literal', value: 'first' },
          label: { type: 'literal', value: 'Visible A' },
          x: { type: 'literal', value: 20 },
          y: { type: 'literal', value: 20 },
        },
      },
      b: {
        kind: 'component',
        id: 'b',
        definitionId: 'vict.flow.node',
        revision: '1',
        props: {
          id: { type: 'literal', value: 'second' },
          label: { type: 'literal', value: 'Visible B' },
          x: { type: 'literal', value: 240 },
          y: { type: 'literal', value: 20 },
        },
      },
      other: {
        kind: 'component',
        id: 'other',
        definitionId: 'vict.flow.node',
        revision: '1',
        props: {
          id: { type: 'literal', value: 'first' },
          label: { type: 'literal', value: 'Other canvas' },
        },
      },
      ab: {
        kind: 'component',
        id: 'ab',
        definitionId: 'vict.flow.edge',
        revision: '1',
        props: {
          id: { type: 'literal', value: 'ab' },
          source: { type: 'literal', value: 'first' },
          target: { type: 'literal', value: 'second' },
        },
      },
    },
    componentDefinitions: {},
    styleSources: {},
    tokens: {},
    conditions: {},
    assets: {},
    localState: {},
  };
}
async function settle() {
  flushSync();
  await new Promise((resolve) => setTimeout(resolve, 25));
  flushSync();
}
describe('authored Flow narrow feasibility', () => {
  it('owns exact implementation registrations and valid canonical composition examples', () => {
    expect(
      createUiAuthoringRegistry([flowAuthoringPackage], flowAuthoringImplementations, { requireCompatibility: true }).issues,
    ).toEqual([]);
    for (const registration of flowAuthoringPackage.registrations)
      for (const seed of registration.examples ?? []) {
        const doc = {
          ...source(),
          root: seed.root,
          nodes: Object.fromEntries(seed.nodes.map((node) => [node.id, node])),
        };
        expect(
          compileUiDocument(doc, defaultSemanticElementCatalog(), flowAuthoringDescriptors).ok,
        ).toBe(true);
      }
  });
  it('batches endpoints and refuses evaluated duplicates without choosing a winner', async () => {
    const values: FlowProjection[] = [];
    const context = createFlowAuthoringContext((value) => values.push(value));
    const removeOld = context.register(declaration('a', 'old'));
    context.register(declaration('a', 'replacement'));
    removeOld();
    removeOld();
    await Promise.resolve();
    expect(values.at(-1)?.nodes.map((entry) => entry.occurrenceKey)).toEqual(['replacement']);
    expect(
      projectFlowDeclarations([declaration('a'), declaration('a', 'repeat')]).diagnostics.map(
        (issue) => issue.code,
      ),
    ).toContain('UI_FLOW_DUPLICATE_ID');
    expect(
      projectFlowDeclarations([
        { ...declaration('edge'), kind: 'edge', source: 'missing', destination: 'a' },
        declaration('a'),
      ]).diagnostics.map((issue) => issue.code),
    ).toContain('UI_FLOW_ENDPOINT_UNAVAILABLE');
  });
  it('mounts real declaration slots with exact visible child targets and isolated canvases', async () => {
    const compiled = compileUiDocument(
      source(),
      defaultSemanticElementCatalog(),
      flowAuthoringDescriptors,
    );
    expect(compiled.ok, JSON.stringify(compiled)).toBe(true);
    if (!compiled.ok) return;
    const target = document.createElement('div');
    document.body.append(target);
    const selected: string[] = [];
    const instance = mount(DocumentHost, {
      target,
      props: {
        plan: compiled.plan,
        extensionDescriptors: flowAuthoringDescriptors,
        extensionImplementations: flowAuthoringImplementations,
        dispatch: async () => undefined,
        navigate: () => {},
        selectOccurrence: (occurrence: string) => selected.push(occurrence),
      },
    });
    await settle();
    expect(target.querySelectorAll('.svelte-flow')).toHaveLength(2);
    expect(target.querySelectorAll('[data-ui-flow-diagnostic]')).toHaveLength(0);
    const visible = target.querySelector('.vict-authored-flow-node[data-ui-node="a"]');
    expect(visible?.textContent).toContain('Visible A');
    expect(visible?.getAttribute('data-ui-occ')).toBeTruthy();
    visible?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(selected).toContain(visible?.getAttribute('data-ui-occ'));
    expect(
      target.querySelector('.vict-authored-flow-node[data-ui-node="other"]')?.textContent,
    ).toContain('Other canvas');
    await unmount(instance);
    target.remove();
  });
  it('rebuilds on prop updates, slot removal, undo/replacement and serialized reopen without leaking a prior canvas', async () => {
    const original = source(),
      target = document.createElement('div');
    document.body.append(target);
    const instance = mount(AuthoringHost, {
      target,
      props: {
        initial: original,
        descriptors: flowAuthoringDescriptors,
        implementations: flowAuthoringImplementations,
      },
    });
    await settle();
    const a = original.nodes.a!;
    if (a.kind !== 'component') throw new Error('node fixture');
    const changed: UiDocument = {
      ...original,
      nodes: {
        ...original.nodes,
        a: {
          ...a,
          props: {
            ...a.props,
            label: { type: 'literal', value: 'Updated A' },
            x: { type: 'literal', value: 90 },
          },
        },
      },
    };
    instance.replaceDocument(changed);
    await settle();
    expect(
      target.querySelector('.vict-authored-flow-node[data-ui-node="a"]')?.textContent,
    ).toContain('Updated A');
    const canvasA = original.nodes.canvasA!;
    if (canvasA.kind !== 'component') throw new Error('canvas fixture');
    const removed: UiDocument = {
      ...changed,
      nodes: {
        ...changed.nodes,
        canvasA: {
          ...canvasA,
          slots: {
            nodes: { name: 'nodes', children: ['a'] },
            edges: { name: 'edges', children: [] },
          },
        },
      },
    };
    instance.replaceDocument(removed);
    await settle();
    expect(target.querySelector('.vict-authored-flow-node[data-ui-node="b"]')).toBeNull();
    instance.replaceDocument(JSON.parse(JSON.stringify(original)));
    await settle();
    expect(target.querySelectorAll('.vict-authored-flow-node')).toHaveLength(3);
    expect(
      target.querySelector('.vict-authored-flow-node[data-ui-node="a"]')?.textContent,
    ).toContain('Visible A');
    expect(target.querySelectorAll('[data-ui-flow-diagnostic]')).toHaveLength(0);
    await unmount(instance);
    target.remove();
  });
  it('refuses evaluated duplicate ids and dangling endpoints visibly with exact source diagnostics', async () => {
    const original = source(),
      a = original.nodes.a!,
      b = original.nodes.b!;
    if (a.kind !== 'component' || b.kind !== 'component') throw new Error('fixture');
    const dynamic: UiDocument = {
      ...original,
      nodes: {
        ...original.nodes,
        a: { ...a, props: { ...a.props, id: { type: 'ref', path: 'state.duplicate' } } },
        b: { ...b, props: { ...b.props, id: { type: 'ref', path: 'state.duplicate' } } },
      },
      localState: { duplicate: { key: 'duplicate', type: 'string', initial: 'same' } },
    };
    const target = document.createElement('div');
    document.body.append(target);
    const instance = mount(AuthoringHost, {
      target,
      props: {
        initial: dynamic,
        descriptors: flowAuthoringDescriptors,
        implementations: flowAuthoringImplementations,
      },
    });
    await settle();
    expect(
      target.querySelector(
        '[data-ui-flow-diagnostic="UI_FLOW_DUPLICATE_ID"][data-ui-flow-source="a"]',
      )?.textContent,
    ).toContain('a (');
    expect(
      target.querySelector(
        '[data-ui-flow-diagnostic="UI_FLOW_ENDPOINT_UNAVAILABLE"][data-ui-flow-source="ab"]',
      ),
    ).toBeTruthy();
    expect(target.querySelector('.vict-authored-flow-node[data-ui-node="a"]')).toBeNull();
    // The independent canvas remains valid despite the first canvas refusal.
    expect(target.querySelector('.vict-authored-flow-node[data-ui-node="other"]')).toBeTruthy();
    instance.replaceDocument(original);
    await settle();
    expect(target.querySelectorAll('[data-ui-flow-diagnostic]')).toHaveLength(0);
    expect(target.querySelectorAll('.vict-authored-flow-node')).toHaveLength(3);
    await unmount(instance);
    target.remove();
  });
  it('explains missing canvas context instead of pretending a standalone declaration is a graph card', async () => {
    const original = source(),
      a = original.nodes.a!;
    const target = document.createElement('div');
    document.body.append(target);
    const instance = mount(AuthoringHost, {
      target,
      props: {
        initial: { ...original, root: 'a', nodes: { a } },
        descriptors: flowAuthoringDescriptors,
        implementations: flowAuthoringImplementations,
      },
    });
    await settle();
    expect(
      target.querySelector('[data-ui-flow-diagnostic="UI_FLOW_CONTEXT_REQUIRED"]')?.textContent,
    ).toContain('a (');
    expect(target.querySelector('.vict-authored-flow-node')).toBeNull();
    await unmount(instance);
    target.remove();
  });
  it('preserves exact repeated local-definition occurrences through wrappers and conditional cleanup', async () => {
    const original: UiDocument = {
      ...source(),
      root: 'canvas',
      nodes: {
        canvas: {
          kind: 'component',
          id: 'canvas',
          definitionId: 'vict.flow.canvas',
          revision: '1',
          slots: {
            nodes: { name: 'nodes', children: ['conditional'] },
            edges: { name: 'edges', children: [] },
          },
        },
        conditional: {
          kind: 'conditional',
          id: 'conditional',
          branches: [{ when: 'show', children: ['rows'] }],
        },
        rows: {
          kind: 'repeat',
          id: 'rows',
          collection: { type: 'ref', path: 'view.rows' },
          key: { type: 'ref', path: 'repeat.row.id' },
          itemName: 'row',
          templateRoot: 'instance',
        },
        instance: {
          kind: 'component',
          id: 'instance',
          definitionId: 'local.node',
          revision: '1',
          props: {
            graphId: { type: 'ref', path: 'repeat.row.id' },
            title: { type: 'ref', path: 'repeat.row.title' },
          },
        },
        body: { kind: 'element', id: 'body', tag: 'div', children: ['declaration'] },
        declaration: {
          kind: 'component',
          id: 'declaration',
          definitionId: 'vict.flow.node',
          revision: '1',
          props: {
            id: { type: 'ref', path: 'prop.graphId' },
            label: { type: 'ref', path: 'prop.title' },
          },
        },
      },
      componentDefinitions: {
        'local.node': {
          id: 'local.node',
          revision: '1',
          root: 'body',
          props: [
            { name: 'graphId', type: 'string' },
            { name: 'title', type: 'string' },
          ],
          slots: {},
        },
      },
      conditions: {
        show: { id: 'show', kind: 'localState', when: { type: 'literal', value: true } },
      },
    };
    const catalogs = {
      viewFields: {
        rows: 'array' as const,
        'rows.id': 'string' as const,
        'rows.title': 'string' as const,
      },
    };
    const compiled = compileUiDocument(
      original,
      defaultSemanticElementCatalog(),
      flowAuthoringDescriptors,
      catalogs,
    );
    expect(compiled.ok, JSON.stringify(compiled)).toBe(true);
    const target = document.createElement('div');
    document.body.append(target);
    const instance = mount(AuthoringHost, {
      target,
      props: {
        initial: original,
        descriptors: flowAuthoringDescriptors,
        implementations: flowAuthoringImplementations,
        catalogs,
        view: {
          rows: [
            { id: 'first', title: 'Repeated first' },
            { id: 'second', title: 'Repeated second' },
          ],
        },
      },
    });
    await settle();
    const cards = [
      ...target.querySelectorAll('.vict-authored-flow-node[data-ui-node="declaration"]'),
    ];
    expect(cards).toHaveLength(2);
    expect(new Set(cards.map((card) => card.getAttribute('data-ui-occ'))).size).toBe(2);
    expect(cards.map((card) => card.textContent?.trim())).toEqual(
      expect.arrayContaining(['Repeated first', 'Repeated second']),
    );
    instance.replaceDocument({
      ...original,
      conditions: {
        show: { id: 'show', kind: 'localState', when: { type: 'literal', value: false } },
      },
    });
    await settle();
    expect(target.querySelectorAll('.vict-authored-flow-node')).toHaveLength(0);
    instance.replaceDocument(original);
    await settle();
    expect(target.querySelectorAll('.vict-authored-flow-node')).toHaveLength(2);
    expect(target.querySelectorAll('[data-ui-flow-diagnostic]')).toHaveLength(0);
    await unmount(instance);
    target.remove();
  });
});
