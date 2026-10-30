import { expect, it, vi } from 'vitest';
import type { UiDocument } from '@victframework/ui';
import sourceFixture from './fixtures/scoped-graph-source.json';
import { graphAuthoringFor, graphUsesSourceHistory } from '../src/lib/designer/graph-history.js';
import {
  graphLexicalOwners,
  graphSourceOwnership,
  patchAuthoredGraph,
} from '../src/lib/designer/graph-authoring.js';
import { graphRuntimeChanged } from '../src/lib/designer/graph-runtime.js';
const source = () => JSON.parse(JSON.stringify(sourceFixture)) as UiDocument;
const history = { canUndo: () => true, canRedo: () => true, undo: vi.fn(), redo: vi.fn() };
const identity = {
  nodeId: 'inner-workspace',
  occurrenceKey: 'opaque/never-parsed',
  occurrenceRoute: [
    { workspaceNodeId: 'outer-workspace', graphNodeId: 'outer-node', expectedGraphRevision: 0 },
  ],
};
it('requires the actual selected containing node parameter and revision for nested source history', () => {
  const original = source();
  expect(graphAuthoringFor(original, identity, history)).toEqual({ kind: 'source', history });
  expect(graphUsesSourceHistory(original, 'inner-workspace')).toBe(false);
  const stale = {
    ...identity,
    occurrenceRoute: [{ ...identity.occurrenceRoute[0]!, expectedGraphRevision: 1 }],
  };
  expect(graphAuthoringFor(original, stale, history).kind).toBe('refused');
  const graph = JSON.parse(String(original.localState.graph.initial));
  graph.nodeTypes[0].parameters = {};
  const missing = {
    ...original,
    localState: { graph: { ...original.localState.graph, initial: JSON.stringify(graph) } },
  };
  expect(graphAuthoringFor(missing, identity, history).kind).toBe('refused');
  expect(graphUsesSourceHistory(missing, 'inner-workspace', identity.occurrenceRoute)).toBe(false);
});
it('keeps explicitly unbound graph writes runtime-owned', () => {
  const original = source(),
    workspace = original.nodes['outer-workspace'];
  if (workspace.kind !== 'component') throw Error('fixture');
  const runtime = {
    ...original,
    nodes: { ...original.nodes, 'outer-workspace': { ...workspace, outputs: {} } },
  };
  expect(
    graphAuthoringFor(
      runtime,
      { nodeId: 'outer-workspace', occurrenceKey: 'root', occurrenceRoute: [] },
      history,
    ),
  ).toEqual({ kind: 'runtime' });
  expect(graphAuthoringFor(runtime, identity, history)).toEqual({ kind: 'runtime' });
});
it('discards partial lexical ownership and refuses source and runtime graph promotion when inspection is incomplete', () => {
  const original = source();
  // Defensive direct-helper challenge: cyclic source is not a valid authored
  // application and is also rejected by canonical validation. It must never
  // leave the convenient document owner cached as if inspection completed.
  const broken: UiDocument = {
    ...original,
    root: 'cyclic',
    nodes: {
      ...original.nodes,
      cyclic: {
        kind: 'element',
        id: 'cyclic',
        tag: 'div',
        children: ['outer-workspace', 'cyclic'],
      },
    },
  };
  const inventory = graphLexicalOwners(broken);
  expect(inventory.complete).toBe(false);
  expect(inventory.size).toBe(0);
  expect(graphSourceOwnership(broken, 'outer-workspace')).toBeUndefined();
  expect(
    graphAuthoringFor(
      broken,
      { nodeId: 'outer-workspace', occurrenceKey: 'root', occurrenceRoute: [] },
      history,
    ).kind,
  ).toBe('refused');
  expect(
    patchAuthoredGraph(
      broken,
      'outer-workspace',
      [{ type: 'setCyclePolicy', allowCycles: true }],
      0,
    ).ok,
  ).toBe(false);
  const applyGraph = vi.fn(),
    reset = vi.fn(),
    supply = vi.fn(),
    invalid = vi.fn();
  graphRuntimeChanged(broken, 'graph', 'must not become a temporary replacement', {
    values: { graph: 'stale runtime', draft: 'keep' },
    applyGraph,
    reset,
    supply,
    invalid,
  });
  expect(applyGraph).not.toHaveBeenCalled();
  expect(reset).toHaveBeenCalledOnce();
  expect(invalid).toHaveBeenCalledOnce();
  expect(supply).toHaveBeenCalledWith({ graph: original.localState.graph.initial, draft: 'keep' });
});
