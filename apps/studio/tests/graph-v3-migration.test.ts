// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { EditorBridge } from '@victframework/ui-editor';
import { canonicalUiDocument, type UiDocument } from '@victframework/ui';
import { parseGraphV3, migrateGraphV2ToV3 } from '@victframework/ui-flow-svelte';
import fixture from './fixtures/scoped-graph-source.json';
import {
  migrateAuthoredGraphs,
  type GraphMigrationTarget,
} from '../src/lib/designer/graph-migration.js';
import {
  patchAuthoredGraph,
  inspectAuthoredGraphSource,
} from '../src/lib/designer/graph-authoring.js';
import { graphUsesSourceHistory } from '../src/lib/designer/graph-history.js';
import {
  prepareAgentEdit,
  applyAgentProposal,
  documentCursor,
  type AgentEdit,
} from '../src/lib/designer/agent-edits.js';
import {
  designerCatalogs,
  screenIssues,
  screenApplication,
} from '../src/lib/designer/application.js';
import { screenPlacementIssues } from '../src/lib/designer/placement.js';
import { screenStore } from '../src/lib/designer/storage.js';
import { prepareSourceImport } from '../src/lib/designer/source-import.js';

afterEach(() => localStorage.clear());
// Diagnostic source fixture; never an actual-agent or saved owner-app receipt.
function initial(): UiDocument {
  const document = structuredClone(fixture) as UiDocument;
  const outer = JSON.parse(String(document.localState.graph.initial));
  outer.nodes.push({
    ...structuredClone(outer.nodes[0]),
    id: 'outer-sibling',
    label: 'Independent sibling',
    position: { x: 700, y: 100 },
    values: {},
  });
  // This fixture represents an explicitly prepared factory. Current inherited
  // graph2 values are materialized before changing the future graph3 default.
  const family = outer.nodeTypes[0],
    previous = family.parameters.innerGraph.default;
  for (const member of outer.nodes) member.values.innerGraph = previous;
  const preparedFactory = migrateGraphV2ToV3(JSON.parse(previous));
  if (!preparedFactory.ok) throw Error('Invalid diagnostic factory');
  family.parameters.innerGraph.default = JSON.stringify(preparedFactory.graph);
  return {
    ...document,
    localState: {
      ...document.localState,
      graph: { ...document.localState.graph, initial: JSON.stringify(outer) },
      helpDraft: { key: 'helpDraft', type: 'string', initial: 'Keep private help content' },
    },
  };
}
function targets(document: UiDocument): GraphMigrationTarget[] {
  const outer = JSON.parse(String(document.localState.graph.initial));
  const nested = outer.nodes.map(
    (node: { id: string; type: string; values: Record<string, unknown> }) => {
      const family = outer.nodeTypes.find((entry: { id: string }) => entry.id === node.type);
      const inner = JSON.parse(
        String(node.values.innerGraph ?? family.parameters.innerGraph.default),
      );
      return {
        nodeId: 'inner-workspace',
        expectedGraphRevision: inner.revision,
        occurrenceRoute: [
          {
            workspaceNodeId: 'outer-workspace',
            graphNodeId: node.id,
            expectedGraphRevision: outer.revision,
          },
        ],
      };
    },
  );
  return [{ nodeId: 'outer-workspace', expectedGraphRevision: outer.revision }, ...nested];
}
function source(document: UiDocument, target: GraphMigrationTarget) {
  const result = inspectAuthoredGraphSource(document, target.nodeId, target.occurrenceRoute);
  if (!result.ok) throw Error(result.message);
  return JSON.parse(result.source);
}
function currentInner(document: UiDocument, member = 'outer-node') {
  const outer = JSON.parse(String(document.localState.graph.initial));
  return {
    nodeId: 'inner-workspace',
    expectedGraphRevision: 0,
    occurrenceRoute: [
      {
        workspaceNodeId: 'outer-workspace',
        graphNodeId: member,
        expectedGraphRevision: outer.revision,
      },
    ],
  };
}

it('atomically composes two explicit nested occurrences and outer migration through source history/save/import', async () => {
  const original = initial(),
    before = structuredClone(original),
    list = targets(original);
  const bridge = new EditorBridge({
    catalogs: designerCatalogs,
    validateDocument: screenPlacementIssues,
    store: screenStore(localStorage, original.id),
    initial: { document: original, storedRevision: 'r1' },
  });
  const cursor = documentCursor(bridge.document, bridge.getSnapshot().revision, 'migration');
  const edit: AgentEdit = {
    expectedRevision: cursor.revision,
    reason: 'Explicit public graph3 migration',
    operations: [{ op: 'migrateGraph', targets: list }],
  };
  const prepared = prepareAgentEdit(bridge.document, cursor, edit, 'migration');
  expect(prepared.ok, JSON.stringify(prepared)).toBe(true);
  if (!prepared.ok) throw Error(prepared.message);
  expect(bridge.document).toEqual(before); // validation/preflight is read-only
  expect(
    applyAgentProposal(
      bridge,
      { proposalId: 'migration', cursor, edit, resultDigest: prepared.digest },
      'migration',
      false,
    ).ok,
  ).toBe(true);
  expect(screenIssues(bridge.document)).toEqual([]);
  const migrated = structuredClone(bridge.document);
  for (const id of [
    'outer-workspace',
    'inner-workspace',
    'outer-viewport',
    'viewport',
    'source-out',
    'gate-in',
    'gate-out',
  ]) {
    expect(migrated.nodes[id]).toEqual({ ...before.nodes[id], revision: '3' });
  }
  expect(migrated.nodes['gate-reviewed']).toEqual(before.nodes['gate-reviewed']);
  const outer = JSON.parse(String(migrated.localState.graph.initial));
  expect(parseGraphV3(JSON.stringify(outer)).ok).toBe(true);
  expect(outer.revision).toBe(2); // two public containing setParameter writes
  expect(outer.edges).toEqual(JSON.parse(String(before.localState.graph.initial)).edges);
  expect(outer.nodeTypes).toEqual(JSON.parse(String(before.localState.graph.initial)).nodeTypes);
  for (const id of ['outer-node', 'outer-sibling']) {
    const graph = source(migrated, currentInner(migrated, id));
    expect(graph).toEqual({
      ...source(
        before,
        list.find((target) => target.occurrenceRoute?.[0].graphNodeId === id)!,
      ),
      schema: 'vict.flow-graph@3',
    });
    expect(
      graphUsesSourceHistory(
        migrated,
        'inner-workspace',
        currentInner(migrated, id).occurrenceRoute,
      ),
    ).toBe(true);
  }
  expect(migrated.localState.helpDraft).toEqual(before.localState.helpDraft);
  expect(bridge.undo().ok).toBe(true);
  expect(bridge.document).toEqual(before);
  expect(bridge.redo().ok).toBe(true);
  expect(bridge.document).toEqual(migrated);
  expect(bridge.save().ok).toBe(true);
  expect(bridge.reopen().ok).toBe(true);
  const imported = await prepareSourceImport(
    JSON.stringify({
      application: screenApplication(bridge.document),
      uiDocuments: [{ document: bridge.document }],
    }),
  );
  expect(imported.ok, JSON.stringify(imported)).toBe(true);
  if (imported.ok) expect(imported.document).toEqual(bridge.document);
});

it.each(['missing sibling', 'duplicate', 'stale target', 'stale outer', 'wrong route'] as const)(
  'refuses %s without mutating source',
  (mode) => {
    const original = initial(),
      before = structuredClone(original),
      list = targets(original);
    if (mode === 'missing sibling') list.pop();
    if (mode === 'duplicate') list.push(structuredClone(list[1]));
    if (mode === 'stale target') list[1].expectedGraphRevision++;
    if (mode === 'stale outer') list[1].occurrenceRoute![0].expectedGraphRevision++;
    if (mode === 'wrong route') list[1].occurrenceRoute![0].graphNodeId = 'missing';
    expect(migrateAuthoredGraphs(original, list).ok).toBe(false);
    expect(original).toEqual(before);
  },
);

it('keeps graph2 strict and graph3 appearance edits occurrence-owned', () => {
  const original = initial();
  expect(
    patchAuthoredGraph(
      original,
      'outer-workspace',
      [{ type: 'setEdgeDefaults', appearance: { pattern: 'dash' } }],
      0,
    ).ok,
  ).toBe(false);
  const migrated = migrateAuthoredGraphs(original, targets(original));
  expect(migrated.ok, JSON.stringify(migrated)).toBe(true);
  if (!migrated.ok) return;
  const target = currentInner(migrated.document);
  const first = source(migrated.document, target);
  const patched = patchAuthoredGraph(
    migrated.document,
    target.nodeId,
    [{ type: 'setEdgeDefaults', appearance: { pattern: 'dash', color: 'token:accent', width: 2 } }],
    first.revision,
    target.occurrenceRoute,
  );
  expect(patched.ok, JSON.stringify(patched)).toBe(true);
  if (!patched.ok) return;
  expect(source(patched.document, currentInner(patched.document)).edgeDefaults).toEqual({
    pattern: 'dash',
    color: 'token:accent',
    width: 2,
  });
  expect(source(patched.document, currentInner(patched.document, 'outer-sibling'))).toEqual(
    source(migrated.document, currentInner(migrated.document, 'outer-sibling')),
  );
  const active = source(patched.document, currentInner(patched.document));
  const styled = patchAuthoredGraph(
    patched.document,
    'inner-workspace',
    [
      {
        type: 'setEdgeAppearance',
        edgeId: active.edges[0].id,
        appearance: { route: 'straight', endArrow: 'closed' },
      },
    ],
    active.revision,
    currentInner(patched.document).occurrenceRoute,
  );
  expect(styled.ok, JSON.stringify(styled)).toBe(true);
  if (styled.ok) {
    expect(source(styled.document, currentInner(styled.document)).edges[0]).toEqual({
      ...active.edges[0],
      appearance: { route: 'straight', endArrow: 'closed' },
    });
    expect(source(styled.document, currentInner(styled.document, 'outer-sibling'))).toEqual(
      source(migrated.document, currentInner(migrated.document, 'outer-sibling')),
    );
    const current = source(styled.document, currentInner(styled.document));
    const invalid = patchAuthoredGraph(
      styled.document,
      'inner-workspace',
      [{ type: 'setEdgeAppearance', edgeId: 'missing-edge', appearance: { pattern: 'dot' } }],
      current.revision,
      currentInner(styled.document).occurrenceRoute,
    );
    expect(invalid.ok).toBe(false);
    const cleared = patchAuthoredGraph(
      styled.document,
      'inner-workspace',
      [{ type: 'clearEdgeAppearance', edgeId: current.edges[0].id }],
      current.revision,
      currentInner(styled.document).occurrenceRoute,
    );
    expect(cleared.ok, JSON.stringify(cleared)).toBe(true);
    if (cleared.ok)
      expect(source(cleared.document, currentInner(cleared.document)).edges[0]).toEqual(
        active.edges[0],
      );
  }
  expect(canonicalUiDocument(original)).toEqual(canonicalUiDocument(initial()));
});

function withUntargeted(shared = false): UiDocument {
  const original = initial();
  return {
    ...original,
    nodes: {
      ...original.nodes,
      untargeted: {
        kind: 'component',
        id: 'untargeted',
        definitionId: 'vict.flow.workspace',
        revision: '2',
        props: { graph: { type: 'literal', value: String(original.localState.graph.initial) } },
        slots: shared ? { content: { name: 'content', children: ['source-out'] } } : {},
      },
    },
  };
}
it('leaves an untargeted graph workspace and every source value intact', () => {
  const original = withUntargeted();
  const retained = structuredClone(original.nodes.untargeted);
  const migrated = migrateAuthoredGraphs(original, targets(original));
  expect(migrated.ok, JSON.stringify(migrated)).toBe(true);
  if (migrated.ok) expect(migrated.document.nodes.untargeted).toEqual(retained);
});

it('supports explicit outer-first migration while retaining unselected graph2 nested sources', () => {
  const original = initial();
  const outerOnly = migrateAuthoredGraphs(original, [targets(original)[0]]);
  expect(outerOnly.ok, JSON.stringify(outerOnly)).toBe(true);
  if (!outerOnly.ok) return;
  expect(outerOnly.document.nodes['inner-workspace']).toEqual(original.nodes['inner-workspace']);
  expect(outerOnly.document.nodes.viewport).toEqual(original.nodes.viewport);
  expect(source(outerOnly.document, currentInner(outerOnly.document))).toEqual(
    source(original, targets(original)[1]),
  );
  const remaining = targets(outerOnly.document).slice(1);
  const innerNext = migrateAuthoredGraphs(outerOnly.document, remaining);
  expect(innerNext.ok, JSON.stringify(innerNext)).toBe(true);
  if (innerNext.ok) expect(screenIssues(innerNext.document)).toEqual([]);
});

it('refuses changing a context component also shared with an untargeted workspace', () => {
  const original = withUntargeted(true);
  const before = structuredClone(original);
  const migrated = migrateAuthoredGraphs(original, targets(original));
  expect(migrated.ok).toBe(false);
  if (!migrated.ok) expect(migrated.message).toContain('shared with an untouched workspace');
  expect(original).toEqual(before);
});

it('retains the existing stale proposal fence after migration preflight', () => {
  const original = initial();
  const bridge = new EditorBridge({
    catalogs: designerCatalogs,
    validateDocument: screenPlacementIssues,
    store: screenStore(localStorage, original.id),
    initial: { document: original, storedRevision: 'r1' },
  });
  const cursor = documentCursor(bridge.document, bridge.getSnapshot().revision, 'stale-migration');
  const edit: AgentEdit = {
    expectedRevision: cursor.revision,
    reason: 'Public migration preflight',
    operations: [{ op: 'migrateGraph', targets: targets(original) }],
  };
  const prepared = prepareAgentEdit(bridge.document, cursor, edit, 'stale-migration');
  expect(prepared.ok, JSON.stringify(prepared)).toBe(true);
  if (!prepared.ok) return;
  expect(
    bridge.apply({
      requestId: 'intervening',
      reason: 'An independent source change',
      commands: [
        {
          op: 'replaceDocument',
          document: {
            ...bridge.document,
            localState: {
              ...bridge.document.localState,
              helpDraft: { key: 'helpDraft', type: 'string', initial: 'New private help draft' },
            },
          },
        },
      ],
    }).ok,
  ).toBe(true);
  const current = structuredClone(bridge.document);
  expect(
    applyAgentProposal(
      bridge,
      { proposalId: 'stale-migration', cursor, edit, resultDigest: prepared.digest },
      'stale-migration',
      false,
    ).ok,
  ).toBe(false);
  expect(bridge.document).toEqual(current);
});
