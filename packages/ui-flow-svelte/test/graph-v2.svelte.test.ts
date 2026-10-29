import { describe, expect, it } from 'vitest';
import { copyUiValue, type UiValue } from '@victframework/ui';
import { graphFixture } from './editor-fixture.js';
import { validateGraph, parseGraph, parseGraphOperations, serializeGraph } from '../src/editor/model.js';
import { graphDocumentSchemaV1, graphDocumentSchemaV2, graphOperationsSchemaV1, graphOperationsSchemaV2, graphOperationSchemasV1, graphOperationSchemasV2, graphDataExamples, graphStructuralProblems } from '../src/editor/graph-schemas.js';
import { emptyGraphV2, validateGraphV2, parseGraphV2, serializeGraphV2, graphParameterValueV2, graphPortsV2, applyGraphOperationsV2, parseGraphOperationsV2, applyGraphPatchV2, copyGraphSelectionV2, GraphSessionV2, migrateGraphV1ToV2, type GraphDocumentV2, type GraphOperationV2 } from '../src/editor/model-v2.js';

const fixture = (): GraphDocumentV2 => ({
  schema: 'vict.flow-graph@2', revision: 3,
  nodeTypes: [{ id: 'project', label: 'Project-defined data', parameters: {
    title: { type: 'string', default: 'Untitled' }, enabled: { type: 'boolean', default: false }, count: { type: 'number', default: 1 },
    weights: { type: 'numberList', default: [1, 2] }, tags: { type: 'stringList', default: [] }, due: { type: 'isoDate', default: '' }, time: { type: 'isoTime', default: '' },
  }, ports: [{ id: 'in', label: 'Input', direction: 'input', type: 'data', maxConnections: 1 }, { id: 'out', label: 'Output', direction: 'output', type: 'data' }] }],
  nodes: [{ id: 'a', type: 'project', label: 'First', position: { x: 0, y: 0 }, values: { title: 'Original', weights: [0.1, 0.9] } }, { id: 'b', type: 'project', label: 'Second', position: { x: 400, y: 0 }, values: {} }, { id: 'c', type: 'project', label: 'Third', position: { x: 800, y: 0 }, values: {} }],
  edges: [{ id: 'ab', source: 'a', sourcePort: 'out', target: 'b', targetPort: 'in' }],
});

describe('typed graph@2 model independent of UI field kinds', () => {
  it('accepts every canonical UiValueType with scalar/list identity and roundtrips without a widget adapter', () => {
    let graph = fixture();
    const changes: Record<string, UiValue> = { title: 'A title', enabled: true, count: 7, weights: [0.2, 0.8], tags: ['urgent', 'draft'], due: '2028-02-29', time: '23:59:59' };
    for (const [key, value] of Object.entries(changes)) {
      const result = applyGraphOperationsV2(graph, [{ type: 'setParameter', nodeId: 'a', key, value }]);
      expect(result.ok, JSON.stringify(result)).toBe(true); if (!result.ok) return; graph = result.graph;
    }
    expect(graph.nodes[0]!.values).toEqual(changes);
    const parsed = parseGraphV2(serializeGraphV2(graph));
    expect(parsed.ok && parsed.graph).toEqual(graph);
    expect(graphParameterValueV2(graph, graph.nodes[1]!, 'count')).toBe(1);
    expect(graphParameterValueV2(graph, graph.nodes[0]!, 'unknown')).toBeUndefined();
    expect(graphPortsV2(graph, graph.nodes[0]!)).toEqual(graph.nodeTypes[0]!.ports);
  });

  it('rejects wrong types, invalid calendar/clock data, undeclared parameters and legacy UI declarations atomically', () => {
    const graph = fixture(), before = serializeGraphV2(graph);
    for (const [key, value] of [['count', [2]], ['weights', 2], ['weights', [1, 'two']], ['due', '2026-02-29'], ['time', '24:00'], ['missing', 'value']] as [string, unknown][]) {
      const result = applyGraphOperationsV2(graph, [{ type: 'setLabel', nodeId: 'a', label: 'Must be rolled back' }, { type: 'setParameter', nodeId: 'a', key, value: value as UiValue }]);
      expect(result.ok, `${key}:${JSON.stringify(value)}`).toBe(false);
      expect(serializeGraphV2(graph)).toBe(before);
    }
    expect(validateGraphV2({ ...graph, nodeTypes: [{ ...graph.nodeTypes[0], fields: [] }] }).ok).toBe(false);
    expect(validateGraphV2({ ...graph, nodeTypes: [{ ...graph.nodeTypes[0], parameters: { title: { type: 'string', default: '', kind: 'textarea' } } }] }).ok).toBe(false);
    expect(validateGraphV2({ ...graph, nodes: [{ ...graph.nodes[0], values: { weights: [NaN] } }] }).ok).toBe(false);
    const cyclic: Record<string, unknown> = { ...graph }; cyclic.self = cyclic;
    expect(validateGraphV2(cyclic).ok).toBe(false);
  });

  it('requires atomic parameter reconciliation when replacing project schemas', () => {
    const graph = fixture(), family = { ...graph.nodeTypes[0]!, parameters: { count: { type: 'number' as const, default: 0 } } };
    expect(applyGraphOperationsV2(graph, [{ type: 'defineNodeType', definition: family, replace: true }]).ok).toBe(false);
    const result = applyGraphOperationsV2(graph, [{ type: 'unsetParameter', nodeId: 'a', key: 'title' }, { type: 'unsetParameter', nodeId: 'a', key: 'weights' }, { type: 'defineNodeType', definition: family, replace: true }]);
    expect(result.ok).toBe(true);
    expect(result.ok && result.graph.nodes[0]!.values).toEqual({});
    expect(graph.nodes[0]!.values.title).toBe('Original');
  });

  it('preserves shared type/capacity/cycle validation and explicit dynamic-port reconciliation', () => {
    const graph = fixture();
    for (const operation of [
      { type: 'connect', edge: { source: 'c', sourcePort: 'out', target: 'b', targetPort: 'in' } },
      { type: 'connect', edge: { source: 'b', sourcePort: 'out', target: 'a', targetPort: 'in' } },
      { type: 'connect', edge: { source: 'a', sourcePort: 'in', target: 'c', targetPort: 'in' } },
    ] as GraphOperationV2[]) expect(applyGraphOperationsV2(graph, [operation]).ok).toBe(false);
    const incompatible = fixture(); incompatible.nodes[2]!.ports = [{ id: 'in', label: 'Image', direction: 'input', type: 'image' }];
    expect(applyGraphOperationsV2(incompatible, [{ type: 'connect', edge: { source: 'a', sourcePort: 'out', target: 'c', targetPort: 'in' } }]).ok).toBe(false);
    expect(applyGraphOperationsV2(graph, [{ type: 'replacePorts', nodeId: 'b', ports: [] }]).ok).toBe(false);
    const reconciled = applyGraphOperationsV2(graph, [{ type: 'replacePorts', nodeId: 'b', ports: [], removeInvalidConnections: true }]);
    expect(reconciled.ok && reconciled.graph.edges).toEqual([]);
    const cyclic = applyGraphOperationsV2(graph, [{ type: 'setCyclePolicy', allowCycles: true }, { type: 'connect', edge: { source: 'b', sourcePort: 'out', target: 'a', targetPort: 'in' } }]);
    expect(cyclic.ok).toBe(true);
    if (cyclic.ok) expect(applyGraphOperationsV2(cyclic.graph, [{ type: 'setCyclePolicy', allowCycles: false }]).ok).toBe(false);
  });

  it('supports typed portable copy/paste, independent IDs and immutable source', () => {
    const graph = fixture(), before = serializeGraphV2(graph), clipboard = copyGraphSelectionV2(graph, { nodes: ['a', 'b'], edges: [] });
    const result = applyGraphOperationsV2(graph, [{ type: 'paste', clipboard, offset: 48 }]);
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.graph.nodes).toHaveLength(5); expect(result.graph.edges).toHaveLength(2);
    expect(new Set(result.graph.nodes.map(node => node.id)).size).toBe(5);
    expect(result.graph.nodes[3]!.values.weights).toEqual([0.1, 0.9]);
    expect(result.graph.nodes[3]!.position.x).toBe(48);
    expect(serializeGraphV2(graph)).toBe(before);
    expect(applyGraphOperationsV2(graph, [{ type: 'paste', clipboard: clipboard.replace('vict.flow-clipboard@2', 'vict.flow-clipboard@1') }]).ok).toBe(false);
  });

  it('maintains read-only/domain policy and monotonic atomic history', () => {
    const session = new GraphSessionV2(fixture(), { validate: graph => graph.nodes.some(node => node.values.title === 'Forbidden') ? [{ code: 'PROJECT', path: 'values', message: 'Project refused' }] : [] });
    expect(session.apply([{ type: 'setParameter', nodeId: 'a', key: 'title', value: 'Forbidden' }]).ok).toBe(false);
    expect(session.canUndo).toBe(false);
    expect(session.apply([{ type: 'setParameter', nodeId: 'a', key: 'title', value: 'Accepted' }], 2).ok).toBe(false);
    expect(session.apply([{ type: 'setParameter', nodeId: 'a', key: 'title', value: 'Accepted' }], 3).ok).toBe(true);
    expect(session.undo().ok).toBe(true); expect(session.graph.revision).toBe(5); expect(session.graph.nodes[0]!.values.title).toBe('Original');
    expect(session.redo().ok).toBe(true); expect(session.graph.revision).toBe(6); expect(session.graph.nodes[0]!.values.title).toBe('Accepted');
    session.setReadOnly(true);
    expect(session.undo().ok).toBe(false); expect(session.apply([{ type: 'setLabel', nodeId: 'a', label: 'Denied' }]).ok).toBe(false);
    expect(session.graph.revision).toBe(6);
    const patch = applyGraphPatchV2(serializeGraphV2(fixture()), [{ type: 'setParameter', nodeId: 'a', key: 'weights', value: [4, 5] }], 3);
    expect(patch.ok && parseGraphV2(patch.source).ok).toBe(true);
  });

  it('keeps versions strict and migrates only explicitly with disclosure of unmapped constraints', () => {
    const legacy = graphFixture(), before = serializeGraph(legacy);
    expect(validateGraph(legacy).ok).toBe(true);
    expect(parseGraphV2(before).ok).toBe(false); expect(parseGraph(serializeGraphV2(fixture())).ok).toBe(false);
    expect(parseGraphOperationsV2([{ type: 'setField', nodeId: 'a', fieldId: 'prompt', value: 'No' }]).ok).toBe(false);
    expect(parseGraphOperations([{ type: 'setParameter', nodeId: 'a', key: 'prompt', value: 'No' }]).ok).toBe(false);
    const refused = migrateGraphV1ToV2(legacy); expect(refused.ok).toBe(false); expect(refused.notes.length).toBeGreaterThan(0);
    const migration = migrateGraphV1ToV2(legacy, { acknowledgeUnmappedConstraints: true });
    expect(migration.ok, JSON.stringify(migration)).toBe(true); if (!migration.ok) return;
    expect(migration.graph.nodes.map(node => node.values)).toEqual(legacy.nodes.map(node => node.values));
    expect(migration.graph.edges).toEqual(legacy.edges); expect(migration.graph.nodes.map(node => node.position)).toEqual(legacy.nodes.map(node => node.position));
    expect(migration.graph.nodeTypes[0]!.parameters.amount!.type).toBe('number');
    expect(migration.graph.nodeTypes[0]!.parameters.amount!.default).toBe(1);
    expect(migration.graph.nodeTypes[0]!.parameters.items!.type).toBe('stringList');
    expect(serializeGraph(legacy)).toBe(before);
  });

  it('uses exported structural schemas for v2 parsing and retains discoverable v1 contracts without a fixed UI seed', () => {
    expect(graphStructuralProblems(graphDocumentSchemaV1, graphFixture())).toEqual([]);
    expect(graphStructuralProblems(graphDocumentSchemaV2, fixture())).toEqual([]);
    for (const example of [graphDataExamples.v2, graphDataExamples.typedParameters]) expect(validateGraphV2(example).ok).toBe(true);
    expect(validateGraph(graphDataExamples.v1).ok).toBe(true);
    expect(Object.isFrozen(graphDocumentSchemaV2)).toBe(true);
    expect(Object.keys(graphOperationSchemasV1)).toContain('setField');
    expect(Object.keys(graphOperationSchemasV2)).toContain('setParameter');
    expect(Object.keys(graphOperationSchemasV2)).not.toContain('collapse');
    for (const input of [[], [{ type: 'setParameter', nodeId: 'a', key: 'weights', value: [1, 2] }], [{ type: 'addNode', nodeType: 'project' }], [{ type: 'defineNodeType', definition: fixture().nodeTypes[0] }], [{ type: 'setParameter', nodeId: 'a', key: 'weights', value: [1, 'bad'] }], [{ type: 'setParameter', nodeId: 'a', key: 'bad.key', value: 1 }], [{ type: 'connect', source: 'a', target: 'b' }]]) {
      expect(parseGraphOperationsV2(input).ok).toBe(graphStructuralProblems(graphOperationsSchemaV2, input, 'operations').length === 0);
    }
    for (const input of [[{ type: 'addNode', nodeType: 'processor' }], [{ type: 'setField', nodeId: 'a', fieldId: 'prompt', value: 'Text' }], [{ type: 'connect', edge: { source: 'a', sourcePort: 'out', target: 'c', targetPort: 'in' } }]]) {
      expect(parseGraphOperations(input).ok).toBe(true); expect(graphStructuralProblems(graphOperationsSchemaV1, input)).toEqual([]);
    }
    expect(JSON.stringify(graphDocumentSchemaV2)).not.toContain('slider');
    expect(copyUiValue([1, 2])).toEqual([1, 2]);
    expect(emptyGraphV2().schema).toBe('vict.flow-graph@2');
  });

  it('keeps every public v2 operation shape executable through the same parser and atomic reducer', () => {
    const graph = fixture(); graph.nodeTypes.push({ id: 'spare', label: 'Unused project type', parameters: {}, ports: [] });
    const operations = {
      setCyclePolicy: { type: 'setCyclePolicy', allowCycles: true },
      defineNodeType: { type: 'defineNodeType', definition: { id: 'new-family', label: 'Another project family', parameters: {}, ports: [] } },
      removeNodeType: { type: 'removeNodeType', nodeType: 'spare' },
      addNode: { type: 'addNode', nodeType: 'project', id: 'new-node', position: { x: 70, y: 30 } },
      moveNodes: { type: 'moveNodes', positions: { a: { x: 80, y: 14 } } },
      setLabel: { type: 'setLabel', nodeId: 'a', label: 'New label' },
      connect: { type: 'connect', edge: { source: 'a', sourcePort: 'out', target: 'c', targetPort: 'in' } },
      reconnect: { type: 'reconnect', edgeId: 'ab', connection: { source: 'a', sourcePort: 'out', target: 'c', targetPort: 'in' } },
      remove: { type: 'remove', selection: { nodes: ['c'], edges: [] } },
      duplicate: { type: 'duplicate', selection: { nodes: ['a', 'b'], edges: [] }, offset: 40 },
      replacePorts: { type: 'replacePorts', nodeId: 'b', ports: graph.nodeTypes[0]!.ports },
      paste: { type: 'paste', clipboard: copyGraphSelectionV2(graph, { nodes: ['c'], edges: [] }) },
      setParameter: { type: 'setParameter', nodeId: 'a', key: 'weights', value: [0.3, 0.7] },
      unsetParameter: { type: 'unsetParameter', nodeId: 'a', key: 'title' },
    } satisfies { [K in GraphOperationV2['type']]: Extract<GraphOperationV2, { type: K }> };
    expect(Object.keys(operations).sort()).toEqual(Object.keys(graphOperationSchemasV2).sort());
    for (const [name, operation] of Object.entries(operations)) {
      expect(graphStructuralProblems(graphOperationsSchemaV2, [operation]), name).toEqual([]);
      expect(parseGraphOperationsV2([operation]).ok, name).toBe(true);
      const result = applyGraphOperationsV2(graph, [operation]);
      expect(result.ok, `${name}: ${JSON.stringify(result)}`).toBe(true);
      if (result.ok) expect(result.graph.revision, name).toBe(4);
    }
    expect(graph.revision).toBe(3); expect(graph.nodes[0]!.values.weights).toEqual([0.1, 0.9]);
  });
});
