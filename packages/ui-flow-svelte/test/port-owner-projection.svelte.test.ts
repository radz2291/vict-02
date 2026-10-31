import { expect, test, vi } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import { compileUiDocument, defaultSemanticElementCatalog } from '@victframework/ui';
import { getHandleBounds, getHandlePosition, Position } from '@xyflow/system';
import { compile } from 'svelte/compiler';
import portRowSource from '../src/composition/GraphPortRow.svelte?raw';
import DocumentHost from '../../ui-svelte/src/document/DocumentHost.svelte';
import {
  catalogDescriptors,
  catalogImplementations,
} from '../../ui-svelte/src/catalog/components/catalog.js';
import { flowAuthoringDescriptors } from '../src/authoring/descriptors.js';
import { flowAuthoringImplementations } from '../src/authoring/implementations.js';
import { nestedCompositionDocument } from './composition-nested-fixture.js';
import { migrateGraphV2ToV3 } from '../src/editor/model-v3.js';
import { compositionGraph } from './composition-fixtures.js';

const settle = async () => {
  flushSync();
  await new Promise((resolve) => setTimeout(resolve, 60));
  flushSync();
};
function source(
  row: boolean,
  version: 1 | 2 | 3,
  mode: 'workspace' | 'editor' | 'canvas' = 'workspace',
) {
  const source = nestedCompositionDocument(),
    graph = JSON.parse(String(source.localState.graph.initial)),
    inner =
      mode === 'editor'
        ? compositionGraph('research')
        : JSON.parse(graph.nodeTypes[0].parameters.innerGraph.default);
  for (const type of inner.nodeTypes)
    for (const port of type.ports) port.id = port.id === 'source' ? 'i' : 'o';
  for (const edge of inner.edges) {
    edge.sourcePort = 'o';
    edge.targetPort = 'i';
  }
  graph.nodeTypes[0].parameters.innerGraph.default = JSON.stringify(inner);
  graph.nodeTypes[0].ports = [
    { id: 'i', label: 'Outer input', direction: 'input', type: 'evidence' },
    { id: 'o', label: 'Outer output', direction: 'output', type: 'evidence' },
  ];
  graph.nodes = ['outer-a', 'outer-b', 'outer-c'].map((id, index) => ({
    ...graph.nodes[0],
    id,
    position: { x: index * 800, y: 0 },
  }));
  graph.edges = [
    { id: 'ab', source: 'outer-a', sourcePort: 'o', target: 'outer-b', targetPort: 'i' },
    { id: 'bc', source: 'outer-b', sourcePort: 'o', target: 'outer-c', targetPort: 'i' },
  ];
  if (version === 1) {
    graph.schema = 'vict.flow-graph@1';
    graph.nodeTypes[0].fields = [
      {
        id: 'innerGraph',
        label: 'Inner graph',
        kind: 'textarea',
        default: graph.nodeTypes[0].parameters.innerGraph.default,
      },
    ];
    delete graph.nodeTypes[0].parameters;
  }
  const converted = version === 3 ? migrateGraphV2ToV3(graph) : undefined;
  if (converted && !converted.ok) throw Error(JSON.stringify(converted));
  source.localState.graph.initial = JSON.stringify(converted?.ok ? converted.graph : graph);
  for (const id of ['outer-workspace', 'outer-viewport']) {
    const node = source.nodes[id];
    if (node.kind === 'component') node.revision = String(version);
  }
  for (const node of Object.values(source.nodes))
    if (node.kind === 'component' && node.definitionId === 'vict.flow.port') {
      node.props!.id = {
        type: 'literal',
        value: node.props!.id.type === 'literal' && node.props!.id.value === 'source' ? 'i' : 'o',
      };
      if (row) {
        node.definitionId = 'vict.flow.port-row';
        node.revision = '1';
      }
    }
  const card = source.nodes['outer-card'];
  if (card.kind !== 'element') throw Error('Fixture');
  card.children.push('outer-in', 'outer-out');
  for (const [id, port] of [
    ['outer-in', 'i'],
    ['outer-out', 'o'],
  ])
    source.nodes[id] = {
      kind: 'component',
      id,
      definitionId: row ? 'vict.flow.port-row' : 'vict.flow.port',
      revision: row ? '1' : String(version),
      props: { id: { type: 'literal', value: port } },
    };
  if (mode !== 'workspace') {
    const component = source.nodes['inner-workspace'];
    if (component.kind !== 'component') throw Error('Fixture');
    if (mode === 'editor') {
      component.definitionId = 'vict.flow.editor';
      component.revision = '2';
      component.slots = {};
    } else {
      component.definitionId = 'vict.flow.canvas';
      component.revision = '1';
      component.props = {
        controls: { type: 'literal', value: false },
        height: { type: 'literal', value: 380 },
      };
      component.outputs = {};
      component.slots = {
        nodes: { name: 'nodes', children: ['visible-a', 'visible-b'] },
        edges: { name: 'edges', children: [] },
      };
      for (const [id, index] of [
        ['visible-a', 0],
        ['visible-b', 1],
      ] as const)
        source.nodes[id] = {
          kind: 'component',
          id,
          definitionId: 'vict.flow.node',
          revision: '1',
          props: {
            id: { type: 'literal', value: id },
            label: { type: 'literal', value: id },
            x: { type: 'literal', value: index * 220 },
            y: { type: 'literal', value: 0 },
          },
        };
    }
  }
  return source;
}
const cases = [
  ...([1, 2, 3] as const).flatMap((version) =>
    [false, true].map((row) => ({ version, row, mode: 'workspace' as const })),
  ),
  { version: 2 as const, row: false, mode: 'editor' as const },
  { version: 2 as const, row: true, mode: 'canvas' as const },
];
test.each(cases)(
  'real registered nested same i/o IDs measure only the owning socket (graph=$version,row=$row,inner=$mode)',
  async ({ version, row, mode }) => {
    const documentSource = source(row, version, mode),
      before = JSON.stringify(documentSource),
      descriptors = [...catalogDescriptors, ...flowAuthoringDescriptors],
      compiled = compileUiDocument(documentSource, defaultSemanticElementCatalog(), descriptors);
    if (!compiled.ok) throw Error(JSON.stringify(compiled));
    const target = document.createElement('div');
    document.body.append(target);
    const writes: unknown[] = [];
    const app = mount(DocumentHost, {
      target,
      props: {
        plan: compiled.plan,
        localState: documentSource.localState,
        extensionDescriptors: descriptors,
        extensionImplementations: [...catalogImplementations, ...flowAuthoringImplementations],
        dispatch: async () => undefined,
        navigate: () => {},
        onStateChange: (...args: unknown[]) => writes.push(args),
      },
    });
    let style: HTMLStyleElement | undefined;
    try {
      await settle();
      // The test Vite transform omits component CSS. Compile that exact authored
      // stylesheet with its mounted scope, then supply it to HappyDOM explicitly.
      if (row) {
        const scope = [...target.querySelector('.graph-port-row')!.classList].find((name) =>
          name.startsWith('svelte-'),
        )!;
        style = document.createElement('style');
        style.textContent = compile(portRowSource, { cssHash: () => scope }).css!.code;
        document.head.append(style);
      }
      const owners = [...target.querySelectorAll<HTMLElement>('.svelte-flow__node')].filter(
        (node) => node.dataset.id?.startsWith('outer-'),
      );
      expect(owners).toHaveLength(3);
      for (const owner of owners) {
        const own = owner.querySelector<HTMLElement>(
          `[data-node-port="${owner.dataset.id}/i"] .svelte-flow__handle`,
        )!;
        if (row) {
          expect(window.getComputedStyle(own).width).toBe('10px');
          expect(window.getComputedStyle(own.querySelector('.port-row-dot')!).width).toBe('10px');
          const halo = [...style!.sheet!.cssRules].find((rule) =>
            rule.cssText.includes('::before'),
          ) as CSSStyleRule;
          expect(halo.style.width).toBe('28px');
          expect(halo.style.height).toBe('28px');
          expect(halo.style.pointerEvents).toBe('inherit');
        }
        const nested = [...owner.querySelectorAll<HTMLElement>('.target')].filter(
          (handle) => handle !== own,
        );
        expect(nested.length).toBeGreaterThan(0);
        const spies = [
          vi.spyOn(own, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 160, 10, 10)),
          ...nested.map((handle) =>
            vi
              .spyOn(handle, 'getBoundingClientRect')
              .mockReturnValue(new DOMRect(800, 300, 10, 10)),
          ),
        ];
        const measured = getHandleBounds(
          'target',
          owner,
          new DOMRect(0, 0, 760, 700),
          1,
          owner.dataset.id!,
        )!;
        const resolved = measured.filter((handle) => handle.id === own.dataset.handleid);
        expect(resolved).toHaveLength(1);
        expect(resolved[0].x).toBe(100);
        spies.forEach((spy) => spy.mockRestore());
      }
      const ids = [...target.querySelectorAll<HTMLElement>('.svelte-flow__handle')].map(
        (handle) => handle.dataset.handleid,
      );
      expect(new Set(ids).size).toBe(ids.length);
      expect(JSON.stringify(documentSource)).toBe(before);
      expect(writes).toEqual([]);
    } finally {
      await unmount(app);
      target.remove();
      style?.remove();
      vi.restoreAllMocks();
    }
  },
);

test('pinned edge endpoints touch the 10px dot instead of the former transparent28px box', () => {
  const node = { internals: { positionAbsolute: { x: 0, y: 0 } } } as Parameters<
    typeof getHandlePosition
  >[0];
  for (const position of [Position.Left, Position.Right]) {
    const endpoint = (width: number) =>
      getHandlePosition(
        node,
        {
          id: 'i',
          type: 'target',
          nodeId: 'n',
          position,
          x: 100 - width / 2,
          y: 40 - width / 2,
          width,
          height: width,
        },
        position,
      );
    expect(Math.abs(endpoint(28).x - 100) - 5).toBe(9);
    expect(Math.abs(endpoint(10).x - 100) - 5).toBe(0);
  }
});
