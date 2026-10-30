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
import { parseGraph, serializeGraph } from '../src/editor/model.js';
import { graphFixture } from './editor-fixture.js';
import GraphSurface from '../src/editor/GraphSurface.svelte';
import CanonicalGraphHost from './CanonicalGraphHost.svelte';
function source(): UiDocument {
  return {
    schema: 'vict.ui-document@1',
    id: 'graph-consumer',
    revision: '1',
    root: 'editor',
    nodes: {
      editor: {
        kind: 'component',
        id: 'editor',
        definitionId: 'vict.flow.editor',
        revision: '1',
        props: {
          graph: { type: 'ref', path: 'state.graph' },
          height: { type: 'literal', value: 500 },
        },
        outputs: { graphChange: { setState: { key: 'graph' } } },
      },
    },
    componentDefinitions: {},
    styleSources: {},
    tokens: {},
    conditions: {},
    assets: {},
    localState: {
      graph: { key: 'graph', type: 'string', initial: serializeGraph(graphFixture()) },
    },
  };
}
async function settle() {
  flushSync();
  await new Promise((resolve) => setTimeout(resolve, 40));
  flushSync();
}
describe('registered agent-authored rich graph consumer', () => {
  it('commits keyboard node movement in the owned document and isolates simultaneous editors', async () => {
    const left = document.createElement('div'),
      right = document.createElement('div');
    document.body.append(left, right);
    const writes: string[] = [],
      otherWrites: string[] = [];
    const viewState = {
      get: () => ({ viewport: { x: 0, y: 0, zoom: 1 }, selection: { nodes: ['a'], edges: [] } }),
      set: () => {},
    };
    const one = mount(GraphSurface, {
        target: left,
        props: {
          graph: serializeGraph(graphFixture()),
          viewState,
          ongraphchange: (value) => writes.push(value),
        },
      }),
      two = mount(GraphSurface, {
        target: right,
        props: {
          graph: serializeGraph(graphFixture()),
          viewState,
          ongraphchange: (value) => otherWrites.push(value),
        },
      });
    await settle();
    left
      .querySelector('[data-id=a]')!
      .dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
      );
    await settle();
    expect(writes).toHaveLength(1);
    expect(otherWrites).toHaveLength(0);
    const graph = parseGraph(writes[0]!);
    expect(graph.ok && graph.graph.nodes[0]!.position.x).toBe(10);
    expect(graph.ok && graph.graph.nodes[1]!.position.x).toBe(400);
    await unmount(one);
    await unmount(two);
    left.remove();
    right.remove();
  });
  it('retains per-occurrence camera and selection across a real canonical-plan remount', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    const instance = mount(CanonicalGraphHost, {
      target,
      props: {
        initial: source(),
        presentation: {
          viewport: { x: 120, y: 80, zoom: 0.7 },
          selection: { nodes: ['a'], edges: ['ab'] },
        },
      },
    });
    await settle();
    expect(target.querySelector('.vict-graph-editor')?.getAttribute('data-graph-viewport')).toBe(
      '120,80,0.7',
    );
    expect(instance.presentationSnapshot()?.selection).toEqual({nodes:['a'],edges:['ab']});
    const field = target.querySelector<HTMLTextAreaElement>(
      '[data-graph-node=a] [data-field=prompt] textarea',
    )!;
    field.value = 'persist and remount';
    field.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    await settle();
    expect(
      target.querySelector('[data-source-revision]')?.getAttribute('data-source-revision'),
    ).toBe('2');
    expect(target.querySelector('.vict-graph-editor')?.getAttribute('data-graph-viewport')).toBe(
      '120,80,0.7',
    );
    expect(instance.presentationSnapshot()?.selection).toEqual({nodes:['a'],edges:['ab']});
    expect(
      target.querySelector<HTMLTextAreaElement>('[data-graph-node=a] [data-field=prompt] textarea')
        ?.value,
    ).toBe('persist and remount');
    const persisted = parseGraph(instance.snapshot().localState!.graph!.initial as string);
    expect(persisted.ok && persisted.graph.edges).toEqual(graphFixture().edges);
    expect(persisted.ok && persisted.graph.nodes[0]!.values.prompt).toBe('persist and remount');
    const next = instance.snapshot(),
      initial = next.localState.graph?.initial;
    if (typeof initial !== 'string') throw Error('fixture');
    const graph = parseGraph(initial);
    if (!graph.ok) throw Error('fixture');
    graph.graph.nodes = graph.graph.nodes.filter((node) => node.id !== 'a');
    graph.graph.edges = [];
    instance.replace({
      ...next,
      revision: '3',
      localState: { graph: { key: 'graph', type: 'string', initial: serializeGraph(graph.graph) } },
    });
    await settle();
    expect(instance.presentationSnapshot()?.selection).toEqual({nodes:[],edges:[]});
    await unmount(instance);
    target.remove();
  });
  it('composes registered media previews and repeated multicolour custom header vectors', async () => {
    const graph = graphFixture(),
      vector = JSON.stringify({
        schema: 'vict.vector@1',
        viewBox: '0 0 24 24',
        nodes: [
          {
            tag: 'defs',
            children: [
              {
                tag: 'linearGradient',
                attributes: { id: 'brand' },
                children: [
                  { tag: 'stop', attributes: { offset: '0%', 'stop-color': '#ef4444' } },
                  { tag: 'stop', attributes: { offset: '100%', 'stop-color': '#2563eb' } },
                ],
              },
            ],
          },
          { tag: 'rect', attributes: { x: 0, y: 0, width: 24, height: 24, fill: 'url(#brand)' } },
        ],
      });
    graph.nodeTypes[0]!.icon = { pack: 'brand', name: 'mark', revision: '1', data: vector };
    graph.nodeTypes[0]!.fields.push(
      { id: 'picture', label: 'Picture', kind: 'image', default: '' },
      { id: 'film', label: 'Film', kind: 'video', default: '' },
      { id: 'glyph', label: 'Favourite', kind: 'icon', default: 'star' },
      { id: 'brand', label: 'Brand', kind: 'vector', default: vector },
    );
    const target = document.createElement('div');
    document.body.append(target);
    const instance = mount(GraphSurface, { target, props: { graph: serializeGraph(graph) } });
    await settle();
    expect(target.querySelectorAll('[data-graph-node=a] .vict-media-image')).toHaveLength(1);
    expect(target.querySelectorAll('[data-graph-node=a] .vict-media-video')).toHaveLength(1);
    expect(
      target.querySelectorAll('[data-graph-node=a] .vict-media-icon svg').length,
    ).toBeGreaterThanOrEqual(2);
    const gradients = [...target.querySelectorAll('linearGradient')].map((element) => element.id);
    expect(gradients.length).toBeGreaterThanOrEqual(3);
    expect(new Set(gradients).size).toBe(gradients.length);
    expect(target.querySelector('stop[stop-color="#ef4444"]')).not.toBeNull();
    expect(target.querySelector('stop[stop-color="#2563eb"]')).not.toBeNull();
    await unmount(instance);
    target.remove();
  });
  it('delegates keyboard history to an explicit canonical host instead of using a competing stack', async () => {
    let undos = 0,
      redos = 0;
    const target = document.createElement('div');
    document.body.append(target);
    const instance = mount(GraphSurface, {
      target,
      props: {
        graph: serializeGraph(graphFixture()),
        history: {
          canUndo: () => true,
          canRedo: () => true,
          undo: () => {
            undos++;
          },
          redo: () => {
            redos++;
          },
        },
      },
    });
    await settle();
    const node = target.querySelector('[data-id=a]')!;
    node.dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true,cancelable:true}));
    node.dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,shiftKey:true,bubbles:true,cancelable:true}));
    expect(undos).toBe(1);
    expect(redos).toBe(1);
    await unmount(instance);
    target.remove();
  });
  it('renders actual rich controls and named ports; field edits emit validated graph without moving nodes', async () => {
    const doc = source(),
      compiled = compileUiDocument(doc, defaultSemanticElementCatalog(), flowAuthoringDescriptors);
    expect(compiled.ok, JSON.stringify(compiled)).toBe(true);
    if (!compiled.ok) return;
    const target = document.createElement('div');
    document.body.append(target);
    const writes: string[] = [];
    const instance = mount(DocumentHost, {
      target,
      props: {
        plan: compiled.plan,
        localState: doc.localState,
        extensionDescriptors: flowAuthoringDescriptors,
        extensionImplementations: flowAuthoringImplementations,
        dispatch: async () => undefined,
        navigate: () => {},
        onStateChange: (key, value) => {
          if (key === 'graph' && typeof value === 'string') writes.push(value);
        },
      },
    });
    await settle();
    expect(target.querySelectorAll('[data-graph-node]')).toHaveLength(3);
    expect(target.querySelector('[data-graph-node=a] textarea')).not.toBeNull();
    expect(target.querySelector('[data-graph-node=a] [role=slider]')).not.toBeNull();
    expect(target.querySelector('[data-graph-node=a] [data-port=in]')).not.toBeNull();
    expect(target.querySelector('.graph-toolbar,.graph-inspector,[aria-label="Graph tools"],[aria-label="Graph selection"]')).toBeNull();
    for(const label of ['Node family','Add node','Undo','Redo','Copy','Paste','Duplicate','Delete selected','Fit all','Focus selection','Arrange','Find nodes','Connect or reconnect','Graph clipboard']) {
      expect([...target.querySelectorAll('button,label,summary')].some(element=>element.textContent?.trim()===label),label).toBe(false);
    }
    const field = target.querySelector<HTMLTextAreaElement>(
      '[data-graph-node=a] [data-field=prompt] textarea',
    )!;
    expect(field.closest('.nodrag.nopan.nowheel')).not.toBeNull();
    field.value = 'manually changed';
    field.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    expect(writes.length).toBeGreaterThan(0);
    const parsed = parseGraph(writes.at(-1)!);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.graph.nodes[0]!.values.prompt).toBe('manually changed');
      expect(parsed.graph.nodes.map((node) => node.position)).toEqual(
        graphFixture().nodes.map((node) => node.position),
      );
      expect(parsed.graph.edges).toEqual(graphFixture().edges);
    }
    target.querySelector('[data-id=a]')!.dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true,cancelable:true}));
    await settle();
    const restored = parseGraph(writes.at(-1)!);
    expect(restored.ok && restored.graph.nodes[0]!.values.prompt).toBe('original');
    await unmount(instance);
    target.remove();
  });
  it('mounts the registered editor separately from the unchanged read-only descriptor', () => {
    const editor = flowAuthoringDescriptors.find((item) => item.id === 'vict.flow.editor')!,
      diagram = flowAuthoringDescriptors.find((item) => item.id === 'vict.flow.canvas')!;
    expect(editor.outputs?.map((output) => output.name)).toEqual([
      'graphChange',
      'selectionChange',
    ]);
    expect(diagram.outputs).toEqual([]);
    expect(diagram.revision).toBe('1');
    expect(
      flowAuthoringImplementations.find((item) => item.extensionId === editor.id)?.component,
    ).toBeTruthy();
  });
});
