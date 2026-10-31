// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { EditorBridge } from '@victframework/ui-editor';
import type { UiDocument } from '@victframework/ui';
import {
  migrateGraphV2ToV3,
  parseGraphV3,
  type GraphOperationV2,
} from '@victframework/ui-flow-svelte';
import fixture from './fixtures/scoped-graph-source.json';
import {
  migrateAuthoredGraphs,
  type GraphMigrationTarget,
} from '../src/lib/designer/graph-migration.js';
import { inspectAuthoredGraphSource } from '../src/lib/designer/graph-authoring.js';
import {
  prepareAgentEdit,
  applyAgentProposal,
  documentCursor,
  type AgentEdit,
} from '../src/lib/designer/agent-edits.js';
import {
  designerCatalogs,
  screenApplication,
  screenIssues,
} from '../src/lib/designer/application.js';
import { screenPlacementIssues } from '../src/lib/designer/placement.js';
import { screenStore } from '../src/lib/designer/storage.js';
import { prepareSourceImport } from '../src/lib/designer/source-import.js';

afterEach(() => localStorage.clear());
function original(emptyDefault = false, inherited = false): UiDocument {
  const document = structuredClone(fixture) as UiDocument;
  const outer = JSON.parse(String(document.localState.graph.initial)),
    factory = outer.nodeTypes[0].parameters.innerGraph.default;
  outer.nodeTypes[0].parameters.unrelated = {
    type: 'string',
    default: 'Unrelated ordinary factory value',
  };
  if (!inherited) outer.nodes[0].values.innerGraph = factory;
  const privateCopy = JSON.parse(factory);
  privateCopy.nodes[0].label = 'Keep distinct existing occurrence value';
  outer.nodes.push({
    ...structuredClone(outer.nodes[0]),
    id: 'factory-sibling',
    position: { x: 820, y: 20 },
    values: { innerGraph: JSON.stringify(privateCopy) },
  });
  if (emptyDefault) outer.nodeTypes[0].parameters.innerGraph.default = '';
  return {
    ...document,
    localState: {
      ...document.localState,
      graph: { ...document.localState.graph, initial: JSON.stringify(outer) },
    },
  };
}
function targets(document: UiDocument, revision?: number): GraphMigrationTarget[] {
  const outer = JSON.parse(String(document.localState.graph.initial));
  return [
    { nodeId: 'outer-workspace', expectedGraphRevision: revision ?? outer.revision },
    ...outer.nodes.map((node: { id: string; values: { innerGraph: string } }) => ({
      nodeId: 'inner-workspace',
      expectedGraphRevision: JSON.parse(
        node.values.innerGraph ?? outer.nodeTypes[0].parameters.innerGraph.default,
      ).revision,
      occurrenceRoute: [
        {
          workspaceNodeId: 'outer-workspace',
          graphNodeId: node.id,
          expectedGraphRevision: revision ?? outer.revision,
        },
      ],
    })),
  ];
}

it.each(['graph2', 'empty'] as const)(
  'refuses migration with an unprepared %s factory default while preserving all current source',
  (mode) => {
    const document = original(mode === 'empty'),
      before = structuredClone(document);
    const result = migrateAuthoredGraphs(document, targets(document));
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.message).toMatch(
        /factory default.*defineNodeType|defineNodeType.*factory default/,
      );
    expect(document).toEqual(before);
  },
);

it('prepares an explicit meaningful graph3 factory then migrates atomically; a new node inherits valid graph3', async () => {
  const document = original(false, true),
    outer = JSON.parse(String(document.localState.graph.initial)),
    family = outer.nodeTypes[0];
  const oldFactory = JSON.parse(family.parameters.innerGraph.default),
    factory = migrateGraphV2ToV3(oldFactory);
  expect(factory.ok).toBe(true);
  if (!factory.ok) return;
  expect(factory.graph.nodes.length).toBeGreaterThan(0);
  expect(factory.graph.edges.length).toBeGreaterThan(0);
  expect(factory.graph.nodes).toEqual(oldFactory.nodes);
  expect(factory.graph.edges).toEqual(oldFactory.edges);
  const definition = {
    ...family,
    parameters: {
      ...family.parameters,
      innerGraph: { ...family.parameters.innerGraph, default: JSON.stringify(factory.graph) },
    },
  };
  const bridge = new EditorBridge({
    catalogs: designerCatalogs,
    validateDocument: screenPlacementIssues,
    store: screenStore(localStorage, document.id),
    initial: { document, storedRevision: 'r1' },
  });
  const cursor = documentCursor(
    bridge.document,
    bridge.getSnapshot().revision,
    'factory-migration',
  );
  const edit: AgentEdit = {
    expectedRevision: cursor.revision,
    reason: 'Explicit intended graph3 factory and complete migration',
    operations: [
      {
        op: 'editGraph',
        nodeId: 'outer-workspace',
        expectedGraphRevision: outer.revision,
        changes: [
          {
            type: 'setParameter',
            nodeId: outer.nodes[0].id,
            key: 'innerGraph',
            value: family.parameters.innerGraph.default,
          },
          { type: 'defineNodeType', definition, replace: true },
        ] satisfies GraphOperationV2[],
      },
      { op: 'migrateGraph', targets: targets(document, outer.revision + 1) },
    ],
  };
  const prepared = prepareAgentEdit(bridge.document, cursor, edit, 'factory-migration');
  expect(prepared.ok, JSON.stringify(prepared)).toBe(true);
  if (!prepared.ok) return;
  expect(bridge.document).toEqual(document);
  expect(
    applyAgentProposal(
      bridge,
      { proposalId: 'factory-migration', cursor, edit, resultDigest: prepared.digest },
      'factory-migration',
      false,
    ).ok,
  ).toBe(true);
  const migrated = structuredClone(bridge.document),
    graph = JSON.parse(String(migrated.localState.graph.initial));
  expect(graph.nodeTypes[0].parameters.unrelated).toEqual(family.parameters.unrelated);
  expect(JSON.parse(graph.nodeTypes[0].parameters.innerGraph.default)).toEqual({
    ...oldFactory,
    schema: 'vict.flow-graph@3',
  });
  for (const node of graph.nodes) {
    const old = outer.nodes.find((item: { id: string }) => item.id === node.id);
    expect(JSON.parse(node.values.innerGraph)).toEqual({
      ...JSON.parse(old.values.innerGraph ?? family.parameters.innerGraph.default),
      schema: 'vict.flow-graph@3',
    });
    expect(node.position).toEqual(old.position);
  }
  expect(bridge.undo().ok).toBe(true);
  expect(bridge.document).toEqual(document);
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
  const nextCursor = documentCursor(
    bridge.document,
    bridge.getSnapshot().revision,
    'factory-migration',
  );
  const add: AgentEdit = {
    expectedRevision: nextCursor.revision,
    reason: 'Ordinary subsequent parent node',
    operations: [
      {
        op: 'editGraph',
        nodeId: 'outer-workspace',
        expectedGraphRevision: graph.revision,
        changes: [{ type: 'addNode', nodeType: family.id, id: 'new-inherited-parent' }],
      },
    ],
  };
  const added = prepareAgentEdit(bridge.document, nextCursor, add, 'new-parent');
  expect(added.ok, JSON.stringify(added)).toBe(true);
  if (!added.ok) return;
  const latest = JSON.parse(String(added.document.localState.graph.initial));
  const nested = inspectAuthoredGraphSource(added.document, 'inner-workspace', [
    {
      workspaceNodeId: 'outer-workspace',
      graphNodeId: 'new-inherited-parent',
      expectedGraphRevision: latest.revision,
    },
  ]);
  expect(nested.ok, JSON.stringify(nested)).toBe(true);
  if (!nested.ok) return;
  const inherited = parseGraphV3(nested.source);
  expect(inherited.ok).toBe(true);
  if (inherited.ok) expect(inherited.graph).toEqual(factory.graph);
  expect(screenIssues(added.document)).toEqual([]);
});
