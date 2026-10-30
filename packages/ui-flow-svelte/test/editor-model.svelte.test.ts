import { describe, it, expect } from 'vitest';
import {
  GraphSession,
  applyGraphOperations,
  copyGraphSelection,
  parseGraph,
  serializeGraph,
  validateGraph,
  parseGraphOperations,
  applyGraphPatch,
  type GraphDocument,
} from '../src/editor/model.js';

export const graphFixture = (): GraphDocument => ({
  schema: 'vict.flow-graph@1',
  revision: 3,
  nodeTypes: [
    {
      id: 'processor',
      label: 'Processor',
      fields: [
        { id: 'prompt', label: 'Prompt', kind: 'textarea', default: '' },
        { id: 'items', label: 'Items', kind: 'list', default: [] },
        { id: 'amount', label: 'Amount', kind: 'slider', default: 1, min: 0, max: 10 },
        { id: 'enabled', label: 'Enabled', kind: 'toggle', default: true },
      ],
      ports: [
        { id: 'in', label: 'Input', direction: 'input', type: 'text', maxConnections: 1 },
        { id: 'out', label: 'Output', direction: 'output', type: 'text' },
      ],
    },
  ],
  nodes: [
    {
      id: 'a',
      type: 'processor',
      label: 'First',
      position: { x: 0, y: 0 },
      values: { prompt: 'original', items: ['one'] },
    },
    {
      id: 'b',
      type: 'processor',
      label: 'Second',
      position: { x: 400, y: 0 },
      values: { amount: 2 },
    },
    { id: 'c', type: 'processor', label: 'Third', position: { x: 800, y: 0 }, values: {} },
  ],
  edges: [{ id: 'ab', source: 'a', sourcePort: 'out', target: 'b', targetPort: 'in' }],
});
describe('rich graph transaction and persistence contract', () => {
  it('requires explicit reconciliation of dynamic fields and cycle policy',()=>{const graph=graphFixture(),definition={...graph.nodeTypes[0]!,fields:graph.nodeTypes[0]!.fields.filter(field=>field.id!=='prompt')};expect(applyGraphOperations(graph,[{type:'defineNodeType',definition,replace:true}]).ok).toBe(false);const accepted=applyGraphOperations(graph,[{type:'unsetField',nodeId:'a',fieldId:'prompt'},{type:'defineNodeType',definition,replace:true}]);expect(accepted.ok).toBe(true);const cyclic=applyGraphOperations(graph,[{type:'setCyclePolicy',allowCycles:true},{type:'connect',edge:{source:'b',sourcePort:'out',target:'a',targetPort:'in'}}]);expect(cyclic.ok).toBe(true);if(cyclic.ok)expect(applyGraphOperations(cyclic.graph,[{type:'setCyclePolicy',allowCycles:false}]).ok).toBe(false);});
  it('refuses non-JSON or oversized snapshots before returning a graph that cannot reopen', () => {
    const graph = graphFixture();
    graph.nodes = Array.from({ length: 200 }, (_, index) => ({
      ...graph.nodes[0]!,
      id: `n${index}`,
      values: { prompt: 'x'.repeat(6000) },
    }));
    graph.edges = [];
    expect(validateGraph(graph)).toMatchObject({ ok: false, issues: [{ code: 'GRAPH_BOUND' }] });
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(validateGraph(cyclic).ok).toBe(false);
  });
  it('retains stable node icons and media metadata while refusing executable options', () => {
    const graph = graphFixture();
    graph.nodeTypes[0]!.icon = { pack: 'lucide', name: 'star', revision: '1.27.0' };
    graph.nodeTypes[0]!.fields.push({
      id: 'film',
      label: 'Film',
      kind: 'video',
      media: { captions: 'asset:sha256:captions', poster: 'asset:sha256:poster', language: 'en' },
    });
    graph.nodes[0]!.values.film = 'asset:sha256:video';
    expect(parseGraph(serializeGraph(graph)).ok).toBe(true);
    const changed = applyGraphOperations(graph, [
      {
        type: 'setIcon',
        nodeId: 'a',
        icon: { pack: 'brand', name: 'mark', revision: '1', source: 'asset:sha256:logo' },
      },
    ]);
    expect(changed.ok && changed.graph.nodes[0]!.icon?.source).toBe('asset:sha256:logo');
    expect(
      parseGraphOperations([
        {
          type: 'setIcon',
          nodeId: 'a',
          icon: { pack: 'x', name: 'x', revision: '1', script: 'no' },
        },
      ]).ok,
    ).toBe(false);
  });
  it('validates unknown agent patches and can incrementally define a family in an empty graph', () => {
    expect(
      parseGraphOperations([
        { type: 'setField', nodeId: 'a', fieldId: 'prompt', value: 'valid', script: 'no' },
      ]).ok,
    ).toBe(false);
    expect(parseGraphOperations([{ type: 'execute', code: 'no' }]).ok).toBe(false);
    expect(
      parseGraphOperations([{ type: 'moveNodes', positions: { a: { x: NaN, y: 0 } } }]).ok,
    ).toBe(false);
    const source = JSON.stringify({
      schema: 'vict.flow-graph@1',
      revision: 0,
      nodeTypes: [],
      nodes: [],
      edges: [],
    });
    const result = applyGraphPatch(
      source,
      [
        { type: 'defineNodeType', definition: graphFixture().nodeTypes[0] },
        { type: 'addNode', nodeType: 'processor', id: 'first' },
      ],
      0,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.graph.nodes[0]!.id).toBe('first');
    expect(result.source && parseGraph(result.source).ok).toBe(true);
  });
  it('moves only requested nodes and retains parameter/edge identity through serialization', () => {
    const source = graphFixture();
    const result = applyGraphOperations(source, [
      { type: 'moveNodes', positions: { a: { x: 60, y: 40 } } },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.graph.nodes[0]!.position).toEqual({ x: 60, y: 40 });
    expect(result.graph.nodes[1]).toEqual(source.nodes[1]);
    expect(result.graph.edges).toEqual(source.edges);
    expect(parseGraph(serializeGraph(result.graph))).toEqual(result);
    expect(source.nodes[0]!.position).toEqual({ x: 0, y: 0 });
  });
  it('refuses an entire batch when a field type or bound is invalid', () => {
    const source = graphFixture();
    const result = applyGraphOperations(source, [
      { type: 'setField', nodeId: 'a', fieldId: 'prompt', value: 'changed' },
      { type: 'setField', nodeId: 'b', fieldId: 'amount', value: 11 },
    ]);
    expect(result.ok).toBe(false);
    expect(source.nodes[0]!.values.prompt).toBe('original');
  });
  it('guards stale graph changes before any mutation', () => {
    const result = applyGraphOperations(
      graphFixture(),
      [{ type: 'remove', selection: { nodes: ['a'], edges: [] } }],
      2,
    );
    expect(result).toMatchObject({ ok: false, issues: [{ code: 'GRAPH_STALE' }] });
  });
  it('rejects incompatible, saturated, missing and cyclic connections', () => {
    const source = graphFixture();
    for (const edge of [
      { source: 'c', sourcePort: 'out', target: 'b', targetPort: 'in' },
      { source: 'x', sourcePort: 'out', target: 'c', targetPort: 'in' },
      { source: 'b', sourcePort: 'out', target: 'a', targetPort: 'in' },
    ])
      expect(applyGraphOperations(source, [{ type: 'connect', edge }]).ok).toBe(false);
    const typed = graphFixture();
    typed.nodes[2]!.ports = [{ id: 'in', label: 'Number', direction: 'input', type: 'number' }];
    expect(
      applyGraphOperations(typed, [
        {
          type: 'connect',
          edge: { source: 'a', sourcePort: 'out', target: 'c', targetPort: 'in' },
        },
      ]),
    ).toMatchObject({ ok: false, issues: [{ code: 'GRAPH_PORT_TYPE' }] });
  });
  it('reconnects one edge with stable identity then removes its incident edges with a node', () => {
    const first = applyGraphOperations(graphFixture(), [
      {
        type: 'reconnect',
        edgeId: 'ab',
        connection: { source: 'a', sourcePort: 'out', target: 'c', targetPort: 'in' },
      },
    ]);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.graph.edges[0]).toMatchObject({ id: 'ab', target: 'c' });
    const removed = applyGraphOperations(first.graph, [
      { type: 'remove', selection: { nodes: ['c'], edges: [] } },
    ]);
    expect(removed.ok && removed.graph.edges).toEqual([]);
  });
  it('requires explicit invalid-edge reconciliation when dynamic ports change', () => {
    const source = graphFixture();
    const op = { type: 'replacePorts' as const, nodeId: 'b', ports: [] };
    expect(applyGraphOperations(source, [op]).ok).toBe(false);
    const accepted = applyGraphOperations(source, [{ ...op, removeInvalidConnections: true }]);
    expect(accepted.ok && accepted.graph.edges).toEqual([]);
  });
  it('copies a subgraph with parameters and internal edges using fresh IDs', () => {
    const source = graphFixture(),
      clipboard = copyGraphSelection(source, { nodes: ['a', 'b'], edges: ['ab'] });
    const pasted = applyGraphOperations(source, [{ type: 'paste', clipboard }]);
    expect(pasted.ok).toBe(true);
    if (!pasted.ok) return;
    expect(pasted.graph.nodes).toHaveLength(5);
    expect(pasted.graph.edges).toHaveLength(2);
    const copy = pasted.graph.nodes[3]!;
    expect(copy.id).not.toBe('a');
    expect(copy.values).toEqual(source.nodes[0]!.values);
    expect(copy.position).toEqual({ x: 32, y: 32 });
    expect(pasted.graph.edges[1]!.source).toBe(copy.id);
  });
  it('keeps history bounded, revisions monotonic and external replacement a new history boundary', () => {
    const session = new GraphSession(graphFixture(), { maxHistory: 2 });
    session.apply([{ type: 'setField', nodeId: 'a', fieldId: 'prompt', value: 'first' }]);
    session.apply([{ type: 'setField', nodeId: 'a', fieldId: 'prompt', value: 'second' }]);
    session.apply([{ type: 'setField', nodeId: 'a', fieldId: 'prompt', value: 'third' }]);
    const prior = session.graph.revision;
    expect(session.undo().ok).toBe(true);
    expect(session.graph.nodes[0]!.values.prompt).toBe('second');
    expect(session.graph.revision).toBe(prior + 1);
    expect(session.redo().ok).toBe(true);
    expect(session.graph.nodes[0]!.values.prompt).toBe('third');
    session.replace(graphFixture());
    expect(session.canUndo).toBe(false);
    expect(session.canRedo).toBe(false);
  });
  it('keeps manual and agent operation paths coherent and independently isolated', () => {
    const one = new GraphSession(graphFixture()),
      two = new GraphSession(graphFixture());
    one.apply([{ type: 'setField', nodeId: 'a', fieldId: 'prompt', value: 'manual' }]);
    const agent = applyGraphOperations(one.graph, [
      { type: 'setField', nodeId: 'a', fieldId: 'items', value: ['agent', 'manual'] },
    ]);
    expect(agent.ok).toBe(true);
    if (!agent.ok) return;
    one.replace(agent.graph);
    expect(one.graph.nodes[0]!.values).toMatchObject({
      prompt: 'manual',
      items: ['agent', 'manual'],
    });
    expect(two.graph.nodes[0]!.values.prompt).toBe('original');
  });
  it('prevents read-only changes and host domain refusals from entering history', () => {
    const readOnly = new GraphSession(graphFixture(), { readOnly: true });
    expect(readOnly.apply([{ type: 'remove', selection: { nodes: ['a'], edges: [] } }]).ok).toBe(
      false,
    );
    const host = new GraphSession(graphFixture(), {
      validate: () => [
        { code: 'DOMAIN_DENIED', path: 'graph', message: 'Declared domain policy.' },
      ],
    });
    expect(host.apply([{ type: 'setLabel', nodeId: 'a', label: 'Denied' }]).ok).toBe(false);
    expect(host.canUndo).toBe(false);
    expect(host.graph).toEqual(graphFixture());
  });
  it('rejects unknown schema/fields, duplicate IDs and prototype keys', () => {
    expect(parseGraph('{"schema":"other"}').ok).toBe(false);
    expect(validateGraph({ ...graphFixture(), script: 'no' }).ok).toBe(false);
    const duplicate = graphFixture();
    duplicate.nodes.push(duplicate.nodes[0]!);
    expect(validateGraph(duplicate).ok).toBe(false);
    const malicious = serializeGraph(graphFixture()).replace(
      '"prompt":"original"',
      '"__proto__":"no"',
    );
    expect(parseGraph(malicious).ok).toBe(false);
  });
});
