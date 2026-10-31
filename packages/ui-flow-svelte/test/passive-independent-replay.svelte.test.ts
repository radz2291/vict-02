// Builder replay of reviewer fixture1563585a; execution here is not an independent verdict.
import { expect, it } from 'vitest';
import {
  validateGraphV3,
  parseGraphOperationsV3,
  applyGraphOperationsV3,
  parseGraphV2,
  parseGraphV3,
  parseGraph,
  serializeGraphV3,
  resolveGraphEdgeAppearance,
  copyGraphSelectionV3,
  GraphSessionV3,
  type GraphDocumentV3,
} from '@victframework/ui-flow-svelte';
import { createUiAuthoringRegistry } from '@victframework/ui';
import {
  flowAuthoringPackage,
  flowAuthoringImplementations,
} from '@victframework/ui-flow-svelte/authoring';

function graph(): GraphDocumentV3 {
  return { schema: 'vict.flow-graph@3', revision: 0, nodeTypes: [], nodes: [], edges: [] };
}
export function connectedGraph(): GraphDocumentV3 {
  return {
    ...graph(),
    nodeTypes: [
      {
        id: 'cell',
        label: 'Cell',
        parameters: { title: { type: 'string', default: 'Unchanged title' } },
        ports: [
          { id: 'in', label: 'In', direction: 'input', type: 'text' },
          { id: 'out', label: 'Out', direction: 'output', type: 'text' },
        ],
      },
    ],
    nodes: ['a', 'b', 'c'].map((id, i) => ({
      id,
      type: 'cell',
      label: id,
      position: { x: i * 240, y: 20 },
      values: { title: id },
    })),
    edges: [
      { id: 'same-edge', source: 'a', sourcePort: 'out', target: 'b', targetPort: 'in' },
      { id: 'other-edge', source: 'a', sourcePort: 'out', target: 'c', targetPort: 'in' },
    ],
  };
}
function apply(value: GraphDocumentV3, operations: Parameters<typeof applyGraphOperationsV3>[1]) {
  const result = applyGraphOperationsV3(value, operations);
  expect(result.ok, JSON.stringify(result)).toBe(true);
  if (!result.ok) throw Error(JSON.stringify(result));
  return result.graph;
}

it('independent: JSON hooks cannot substitute appearance data after strict admission', () => {
  let hooks = 0;
  const substituted = new Proxy(graph(), {
    get(target, key, receiver) {
      if (key === 'toJSON')
        return () => {
          hooks++;
          return {
            ...graph(),
            edgeDefaults: { color: 'url(https://attacker.invalid/paint.svg#x)' },
          };
        };
      return Reflect.get(target, key, receiver);
    },
  });
  const admitted = validateGraphV3(substituted);
  expect(hooks).toBe(0);
  if (admitted.ok) expect(admitted.graph).toEqual(graph());
});

it('independent: operation JSON hooks cannot replace a finite admitted appearance', () => {
  let hooks = 0;
  const operation = new Proxy(
    { type: 'setEdgeDefaults', appearance: { width: 2 } },
    {
      get(target, key, receiver) {
        if (key === 'toJSON')
          return () => {
            hooks++;
            return {
              type: 'setEdgeDefaults',
              appearance: { color: 'url(https://attacker.invalid/paint)' },
            };
          };
        return Reflect.get(target, key, receiver);
      },
    },
  );
  const parsed = parseGraphOperationsV3([operation]);
  expect(hooks).toBe(0);
  if (parsed.ok)
    expect(parsed.operations).toEqual([{ type: 'setEdgeDefaults', appearance: { width: 2 } }]);
});

it('independent: clipboard copies only the admitted owned defaults, never a later caller property read', () => {
  const original = connectedGraph(); original.edgeDefaults = { width: 2 };
  let reads = 0;
  const substituted = new Proxy(original, { get(target, key, receiver) {
    if (key === 'edgeDefaults') { reads++; return { color: 'url(https://attacker.invalid/clipboard)' }; }
    return Reflect.get(target, key, receiver);
  } });
  let copied: string | undefined;
  try { copied = copyGraphSelectionV3(substituted, { nodes: ['a','b'], edges: [] }); } catch { /* Explicit passive refusal is also acceptable. */ }
  expect(reads).toBe(0);
  if (copied !== undefined) expect(JSON.parse(copied).edgeDefaults).toEqual({ width: 2 });
});

it('independent: strict legacy parsers retain old schemas and refuse appearance extension', () => {
  const value = graph();
  expect(parseGraphV2(JSON.stringify(value)).ok).toBe(false);
  expect(parseGraph(JSON.stringify(value)).ok).toBe(false);
  expect(
    parseGraphV2(JSON.stringify({ ...value, schema: 'vict.flow-graph@2', edgeDefaults: {} })).ok,
  ).toBe(false);
  expect(parseGraphV2(JSON.stringify({ ...value, schema: 'vict.flow-graph@2' })).ok).toBe(true);
});

it('independent: failed appearance batches preserve the original source and finite width grammar', () => {
  const value = graph(),
    before = serializeGraphV3(value);
  expect(
    applyGraphOperationsV3(value, [
      { type: 'setEdgeDefaults', appearance: { width: 2 } },
      { type: 'setEdgeAppearance', edgeId: 'missing', appearance: {} },
    ]).ok,
  ).toBe(false);
  expect(serializeGraphV3(value)).toBe(before);
  for (const width of [0, -1, Number.NaN, Infinity, -Infinity])
    expect(parseGraphOperationsV3([{ type: 'setEdgeDefaults', appearance: { width } }]).ok).toBe(
      false,
    );
  for (const width of [Number.MIN_VALUE, Number.MAX_VALUE])
    expect(parseGraphOperationsV3([{ type: 'setEdgeDefaults', appearance: { width } }]).ok).toBe(
      true,
    );
});

it('independent: public registry installs new identities without changing retained graph grammar', () => {
  const registry = createUiAuthoringRegistry([flowAuthoringPackage], flowAuthoringImplementations, {
    requireCompatibility: true,
  });
  expect(registry.ok, JSON.stringify(registry)).toBe(true);
  for (const [id, revision] of [
    ['vict.flow.workspace', '3'],
    ['vict.flow.viewport', '3'],
    ['vict.flow.port', '3'],
    ['vict.flow.edge-settings', '1'],
  ])
    expect(
      registry.descriptors.some((entry) => entry.id === id && entry.revision === revision),
    ).toBe(true);
});

it('independent: replacement overrides, changed defaults and resets preserve values and source history', () => {
  const original = connectedGraph(),
    session = new GraphSessionV3(original);
  expect(
    session.apply([
      { type: 'setEdgeDefaults', appearance: { color: '#abc', width: 3, pattern: 'dash' } },
      { type: 'setEdgeAppearance', edgeId: 'same-edge', appearance: { color: 'token:accent' } },
    ]).ok,
  ).toBe(true);
  let current = session.graph;
  expect(resolveGraphEdgeAppearance(current, current.edges[0])).toMatchObject({
    color: 'token:accent',
    width: 3,
    pattern: 'dash',
  });
  expect(
    session.apply([
      { type: 'setEdgeAppearance', edgeId: 'same-edge', appearance: { width: 5 } },
      { type: 'setEdgeDefaults', appearance: { color: '#123456', width: 2 } },
    ]).ok,
  ).toBe(true);
  current = session.graph;
  expect(current.edges[0].appearance).toEqual({ width: 5 });
  expect(resolveGraphEdgeAppearance(current, current.edges[0])).toMatchObject({
    color: '#123456',
    width: 5,
    pattern: 'solid',
  });
  expect(
    session.apply([
      { type: 'setEdgeDefaults', appearance: {} },
      { type: 'clearEdgeAppearance', edgeId: 'same-edge' },
    ]).ok,
  ).toBe(true);
  expect(resolveGraphEdgeAppearance(session.graph, session.graph.edges[0])).toMatchObject({
    color: 'token:border',
    width: 1.5,
  });
  expect(session.undo().ok).toBe(true);
  expect(session.graph.edges[0].appearance).toEqual({ width: 5 });
  expect(session.redo().ok).toBe(true);
  expect(session.graph.edges[0].appearance).toBeUndefined();
  expect(session.graph.nodes).toEqual(original.nodes);
  expect(session.graph.nodeTypes).toEqual(original.nodeTypes);
});

it('independent: reconnect preserves appearance, rejects cycles and cannot smuggle appearance through old connection shape', () => {
  const original = connectedGraph();
  original.edges[0].appearance = { route: 'orthogonal', startArrow: 'arrow', endArrow: 'closed' };
  const next = apply(original, [
    {
      type: 'reconnect',
      edgeId: 'same-edge',
      connection: { source: 'c', sourcePort: 'out', target: 'b', targetPort: 'in' },
    },
  ]);
  expect(next.edges[0].appearance).toEqual(original.edges[0].appearance);
  const before = serializeGraphV3(next);
  expect(
    applyGraphOperationsV3(next, [
      {
        type: 'reconnect',
        edgeId: 'same-edge',
        connection: { source: 'c', sourcePort: 'out', target: 'a', targetPort: 'in' },
      },
    ]).ok,
  ).toBe(false);
  expect(serializeGraphV3(next)).toBe(before);
  expect(
    parseGraphOperationsV3([
      {
        type: 'reconnect',
        edgeId: 'same-edge',
        connection: {
          source: 'a',
          sourcePort: 'out',
          target: 'b',
          targetPort: 'in',
          appearance: { width: 9 },
        },
      },
    ]).ok,
  ).toBe(false);
});

it('independent: cross-canvas paste preserves effective appearance; same-canvas duplicate retains inheritance', () => {
  const original = connectedGraph();
  original.edgeDefaults = { color: 'token:accent', width: 3, pattern: 'dash' };
  original.edges[0].appearance = { endArrow: 'closed' };
  const clipboard = copyGraphSelectionV3(original, { nodes: ['a', 'b'], edges: [] });
  const destination = connectedGraph();
  destination.edgeDefaults = { color: '#fff', width: 9 };
  const pasted = apply(destination, [{ type: 'paste', clipboard, offset: 10 }]);
  expect(pasted.edges.at(-1)!.appearance).toEqual(
    resolveGraphEdgeAppearance(original, original.edges[0]),
  );
  const changed = apply(pasted, [{ type: 'setEdgeDefaults', appearance: { width: 99 } }]);
  expect(resolveGraphEdgeAppearance(changed, changed.edges.at(-1)!).width).toBe(3);
  const duplicated = apply(original, [
    { type: 'duplicate', selection: { nodes: ['a', 'b'], edges: [] } },
  ]);
  expect(duplicated.edges.at(-1)!.appearance).toEqual({ endArrow: 'closed' });
  const defaultsChanged = apply(duplicated, [
    { type: 'setEdgeDefaults', appearance: { width: 11 } },
  ]);
  expect(resolveGraphEdgeAppearance(defaultsChanged, defaultsChanged.edges.at(-1)!).width).toBe(11);
});

it('independent: JSON guards reject accessors, sparse/cyclic/nonfinite payloads without coercion', () => {
  let calls = 0;
  const accessor = Object.defineProperty({}, 'width', {
    enumerable: true,
    get() {
      calls++;
      return 2;
    },
  });
  expect(validateGraphV3({ ...graph(), edgeDefaults: accessor }).ok).toBe(false);
  expect(calls).toBe(0);
  const cyclic: Record<string, unknown> = {};
  cyclic.width = cyclic;
  for (const appearance of [
    cyclic,
    { width: undefined },
    { width: NaN },
    { width: Infinity },
    { width: 2n },
    new Date(),
  ])
    expect(validateGraphV3({ ...graph(), edgeDefaults: appearance }).ok).toBe(false);
  const sparse: unknown[] = [];
  sparse.length = 1;
  expect(parseGraphOperationsV3(sparse).ok).toBe(false);
  for (const color of [
    'url(https://example.invalid/a)',
    'var(--x)',
    '#12345',
    'token:bad/name',
    'token:Accent',
    'red',
    'javascript:alert(1)',
  ])
    expect(parseGraphOperationsV3([{ type: 'setEdgeDefaults', appearance: { color } }]).ok).toBe(
      false,
    );
  expect(
    parseGraphV3(
      '{"schema":"vict.flow-graph@3","revision":0,"nodeTypes":[],"nodes":[],"edges":[],"edgeDefaults":{"width":1e400}}',
    ).ok,
  ).toBe(false);
});
