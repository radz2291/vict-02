import { expect, it } from 'vitest';
import type { UiDocument } from '@victframework/ui';
import { emptyGraphV2 } from '@victframework/ui-flow-svelte';
import { newScreen } from '../src/lib/designer/application.js';
import { agentEditSchema } from '../src/lib/designer/agent-edits.js';
import { editPresentation } from '../src/lib/designer/agent-edit-presentation.js';
import {
  graphSourceOwnership,
  graphStateKeys,
  patchAuthoredGraph,
  rebaseGraphRuntime,
} from '../src/lib/designer/graph-authoring.js';

const graph = () => JSON.stringify(emptyGraphV2());
function scoped(controlled = true, key = 'innerGraph'): UiDocument {
  const base = newScreen('Scoped ownership', 'scoped-ownership');
  const nested = graph();
  const outer = JSON.stringify({
    schema: 'vict.flow-graph@2',
    revision: 0,
    nodeTypes: [
      {
        id: 'container',
        label: 'Container',
        parameters: { [key]: { type: 'string', default: nested } },
        ports: [],
      },
    ],
    nodes: ['a', 'b'].map((id) => ({
      id,
      type: 'container',
      label: id,
      position: { x: 0, y: 0 },
      values: {},
    })),
    edges: [],
  });
  return {
    ...base,
    root: 'outer',
    localState: { graph: { key: 'graph', type: 'string', initial: outer } },
    nodes: {
      outer: {
        kind: 'component',
        id: 'outer',
        definitionId: 'vict.flow.workspace',
        revision: '2',
        props: { graph: { type: 'ref', path: 'state.graph' } },
        outputs: { graphChange: { setState: { key: 'graph' } } },
        slots: {
          body: {
            name: 'body',
            children: ['inner'],
            scope: {
              schema: 'vict.ui-slot-scope@1',
              props: [],
              state: { [key]: { key, type: 'string', initial: nested, controlled } },
            },
          },
        },
      },
      inner: {
        kind: 'component',
        id: 'inner',
        definitionId: 'vict.flow.workspace',
        revision: '2',
        props: { graph: { type: 'ref', path: `state.${key}` } },
        outputs: { graphChange: { setState: { key } } },
      },
    },
  };
}
it('does not collect a nested scope key into document runtime history synchronization', () => {
  const source = scoped();
  expect(graphStateKeys(source)).toEqual(['graph']);
  expect(() => {
    for (const key of graphStateKeys(source)) void source.localState[key]!.initial;
  }).not.toThrow();
});
it('does not patch a same-name document declaration for a controlled nested graph', () => {
  const source = scoped(true, 'graph');
  const before = JSON.stringify(source);
  const result = patchAuthoredGraph(
    source,
    'inner',
    [{ type: 'setCyclePolicy', allowCycles: true }],
    0,
  );
  expect(result.ok).toBe(false);
  expect(JSON.stringify(source)).toBe(before);
});
it('edits an uncontrolled scoped template initial and leaves unrelated same-name document state intact', () => {
  const source = scoped(false, 'graph');
  const result = patchAuthoredGraph(
    source,
    'inner',
    [{ type: 'setCyclePolicy', allowCycles: true }],
    0,
  );
  expect(result.ok).toBe(true);
  if (!result.ok) throw Error(result.message);
  expect(result.document.localState).toEqual(source.localState);
  const outer = result.document.nodes.outer;
  if (outer.kind !== 'component') throw Error('fixture');
  expect(JSON.parse(String(outer.slots?.body.scope?.state?.graph.initial))).toMatchObject({
    revision: 1,
    allowCycles: true,
  });
  expect(graphSourceOwnership(source, 'inner')).toEqual({
    kind: 'slot',
    ownerNodeId: 'outer',
    slotName: 'body',
    key: 'graph',
    controlled: false,
  });
});
it('targets exactly one repeated controlled graph occurrence and preserves its family default, sibling and document key', () => {
  const initial = scoped(true, 'graph'),
    before = JSON.stringify(initial);
  const result = patchAuthoredGraph(
    initial,
    'inner',
    [{ type: 'setCyclePolicy', allowCycles: true }],
    0,
    [{ workspaceNodeId: 'outer', graphNodeId: 'a', expectedGraphRevision: 0 }],
  );
  expect(result.ok).toBe(true);
  if (!result.ok) throw Error(result.message);
  const outer = JSON.parse(String(result.document.localState.graph.initial));
  expect(outer.revision).toBe(1);
  expect(JSON.parse(outer.nodes[0].values.graph)).toMatchObject({ revision: 1, allowCycles: true });
  expect(outer.nodes[1].values).toEqual({});
  expect(JSON.parse(outer.nodeTypes[0].parameters.graph.default)).toEqual(emptyGraphV2());
  expect(JSON.stringify(initial)).toBe(before);
  const roundTrip = JSON.parse(JSON.stringify(result.document)) as UiDocument;
  expect(
    patchAuthoredGraph(roundTrip, 'inner', [{ type: 'setCyclePolicy', allowCycles: false }], 1, [
      { workspaceNodeId: 'outer', graphNodeId: 'a', expectedGraphRevision: 1 },
    ]).ok,
  ).toBe(true);
  expect(rebaseGraphRuntime(roundTrip, { graph: 'stale', draft: 'keep' })).toEqual({
    graph: roundTrip.localState.graph.initial,
    draft: 'keep',
  });
});
it('refuses stale, nonexistent and mismatched occurrence routes atomically', () => {
  const source = scoped(),
    before = JSON.stringify(source),
    change = [{ type: 'setCyclePolicy', allowCycles: true }];
  for (const route of [
    [{ workspaceNodeId: 'outer', graphNodeId: 'a', expectedGraphRevision: 1 }],
    [{ workspaceNodeId: 'outer', graphNodeId: 'missing', expectedGraphRevision: 0 }],
    [{ workspaceNodeId: 'inner', graphNodeId: 'a', expectedGraphRevision: 0 }],
    [
      { workspaceNodeId: 'outer', graphNodeId: 'a', expectedGraphRevision: 0 },
      { workspaceNodeId: 'outer', graphNodeId: 'a', expectedGraphRevision: 0 },
    ],
  ])
    expect(patchAuthoredGraph(source, 'inner', change, 0, route).ok).toBe(false);
  expect(
    patchAuthoredGraph(source, 'inner', change, 1, [
      { workspaceNodeId: 'outer', graphNodeId: 'a', expectedGraphRevision: 0 },
    ]).ok,
  ).toBe(false);
  expect(JSON.stringify(source)).toBe(before);
});
it('does not confuse identical names in separate lexical scopes or detached child record order', () => {
  const source = scoped(false),
    outer = source.nodes.outer;
  if (outer.kind !== 'component') throw Error('fixture');
  const copy = JSON.parse(JSON.stringify(source)) as UiDocument;
  const second = {
    ...outer,
    id: 'other',
    slots: { ...outer.slots, body: { ...outer.slots!.body, children: ['otherInner'] } },
  };
  const inner = copy.nodes.inner;
  const document: UiDocument = {
    ...copy,
    nodes: { otherInner: { ...inner, id: 'otherInner' }, ...copy.nodes, other: second },
  };
  const result = patchAuthoredGraph(
    document,
    'otherInner',
    [{ type: 'setCyclePolicy', allowCycles: true }],
    0,
  );
  expect(result.ok).toBe(true);
  if (!result.ok) throw Error(result.message);
  expect(result.document.nodes.outer).toEqual(document.nodes.outer);
  expect(result.document.nodes.other).not.toEqual(document.nodes.other);
  expect(graphStateKeys(document)).toEqual(['graph']);
});
it('retains literal source edits and refuses ambiguous scoped source reuse', () => {
  const source = scoped(false),
    outer = source.nodes.outer,
    inner = source.nodes.inner;
  if (outer.kind !== 'component' || inner.kind !== 'component') throw Error('fixture');
  const literal: UiDocument = {
    ...source,
    nodes: {
      ...source.nodes,
      inner: { ...inner, props: { graph: { type: 'literal', value: graph() } }, outputs: {} },
    },
  };
  const result = patchAuthoredGraph(
    literal,
    'inner',
    [{ type: 'setCyclePolicy', allowCycles: true }],
    0,
  );
  expect(result.ok).toBe(true);
  if (!result.ok) throw Error(result.message);
  expect(result.document.localState).toEqual(source.localState);
  const ambiguous: UiDocument = {
    ...source,
    root: 'screen',
    nodes: {
      ...source.nodes,
      screen: { kind: 'element', id: 'screen', tag: 'div', children: ['outer', 'other'] },
      other: { ...outer, id: 'other' },
    },
  };
  expect(graphSourceOwnership(ambiguous, 'inner')).toBeUndefined();
  expect(
    patchAuthoredGraph(ambiguous, 'inner', [{ type: 'setCyclePolicy', allowCycles: true }], 0).ok,
  ).toBe(false);
});
it('recursively fences and persists two nested controlled occurrence levels', () => {
  const source = scoped(),
    workspace = source.nodes.inner;
  if (workspace.kind !== 'component') throw Error('fixture');
  const middle = {
    schema: 'vict.flow-graph@2',
    revision: 0,
    nodeTypes: [
      {
        id: 'middle',
        label: 'Middle',
        parameters: { deepGraph: { type: 'string', default: graph() } },
        ports: [],
      },
    ],
    nodes: [
      {
        id: 'middle-one',
        type: 'middle',
        label: 'Middle one',
        position: { x: 0, y: 0 },
        values: {},
      },
    ],
    edges: [],
  };
  const outer = JSON.parse(String(source.localState.graph.initial));
  outer.nodeTypes[0].parameters.innerGraph.default = JSON.stringify(middle);
  const nested: UiDocument = {
    ...source,
    localState: { graph: { ...source.localState.graph, initial: JSON.stringify(outer) } },
    nodes: {
      ...source.nodes,
      inner: {
        ...workspace,
        slots: {
          body: {
            name: 'body',
            children: ['deep'],
            scope: {
              schema: 'vict.ui-slot-scope@1',
              props: [],
              state: {
                deepGraph: { key: 'deepGraph', type: 'string', initial: graph(), controlled: true },
              },
            },
          },
        },
      },
      deep: {
        kind: 'component',
        id: 'deep',
        definitionId: 'vict.flow.workspace',
        revision: '2',
        props: { graph: { type: 'ref', path: 'state.deepGraph' } },
        outputs: { graphChange: { setState: { key: 'deepGraph' } } },
      },
    },
  };
  const route = [
    { workspaceNodeId: 'outer', graphNodeId: 'a', expectedGraphRevision: 0 },
    { workspaceNodeId: 'inner', graphNodeId: 'middle-one', expectedGraphRevision: 0 },
  ];
  const result = patchAuthoredGraph(
    nested,
    'deep',
    [{ type: 'setCyclePolicy', allowCycles: true }],
    0,
    route,
  );
  expect(result.ok).toBe(true);
  if (!result.ok) throw Error(result.message);
  const changed = JSON.parse(String(result.document.localState.graph.initial)),
    changedMiddle = JSON.parse(changed.nodes[0].values.innerGraph),
    deep = JSON.parse(changedMiddle.nodes[0].values.deepGraph);
  expect([changed.revision, changedMiddle.revision, deep.revision]).toEqual([1, 1, 1]);
  expect(deep.allowCycles).toBe(true);
  expect(changed.nodes[1].values).toEqual({});
  expect(
    patchAuthoredGraph(
      result.document,
      'deep',
      [{ type: 'setCyclePolicy', allowCycles: false }],
      1,
      route,
    ).ok,
  ).toBe(false);
});
it('exposes the same closed bounded occurrence route through agent validation and presentation', () => {
  const operation = {
    op: 'editGraph',
    nodeId: 'inner',
    expectedGraphRevision: 0,
    occurrenceRoute: [{ workspaceNodeId: 'outer', graphNodeId: 'a', expectedGraphRevision: 0 }],
    changes: [{ type: 'setCyclePolicy', allowCycles: true }],
  };
  const edit = { expectedRevision: '1', reason: 'Scoped instance edit', operations: [operation] };
  expect(agentEditSchema.safeParse(edit).success).toBe(true);
  expect(
    agentEditSchema.safeParse({
      ...edit,
      operations: [
        { ...operation, occurrenceRoute: [{ ...operation.occurrenceRoute[0], unexpected: true }] },
      ],
    }).success,
  ).toBe(false);
  expect(
    agentEditSchema.safeParse({
      ...edit,
      operations: [
        {
          ...operation,
          occurrenceRoute: Array.from({ length: 33 }, () => operation.occurrenceRoute[0]),
        },
      ],
    }).success,
  ).toBe(false);
  expect(JSON.stringify(editPresentation.$defs.editGraph)).toContain('occurrenceRoute');
});
