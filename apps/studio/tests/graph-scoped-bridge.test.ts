// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { canonicalUiDocument, type UiDocument, type UiValue } from '@victframework/ui';
import { EditorBridge } from '@victframework/ui-editor';
import nestedSource from './fixtures/scoped-graph-source.json';
import {
  designerCatalogs,
  screenIssues,
  screenApplication,
} from '../src/lib/designer/application.js';
import { screenPlacementIssues } from '../src/lib/designer/placement.js';
import { screenStore } from '../src/lib/designer/storage.js';
import {
  graphHistoryFor,
  graphUsesSourceHistory,
  graphAuthoringFor,
} from '../src/lib/designer/graph-history.js';
import type { GraphOccurrenceIdentity } from '@victframework/ui-flow-svelte';
import { rebaseGraphRuntime } from '../src/lib/designer/graph-authoring.js';
import { graphRuntimeChanged } from '../src/lib/designer/graph-runtime.js';
import {
  documentCursor,
  prepareAgentEdit,
  applyAgentProposal,
  type AgentEdit,
} from '../src/lib/designer/agent-edits.js';
import { prepareSourceImport } from '../src/lib/designer/source-import.js';
import FoundationConsumer from './fixtures/FoundationConsumer.svelte';

let consumer: ReturnType<typeof mount> | undefined;
// Serialized copy of the existing package nested-composition test fixture.
// This is explicit diagnostic-fixture evidence, never actual-agent output.
const nestedCompositionDocument = () => JSON.parse(JSON.stringify(nestedSource)) as UiDocument;
afterEach(async () => {
  if (consumer) await unmount(consumer);
  consumer = undefined;
  document.body.replaceChildren();
  localStorage.clear();
});
const settle = async () => {
  flushSync();
  await new Promise((resolve) => setTimeout(resolve, 50));
  flushSync();
};
function outer(source: UiDocument) {
  return JSON.parse(String(source.localState.graph.initial));
}
function inner(source: UiDocument, id = 'outer-node') {
  const graph = outer(source),
    node = graph.nodes.find((item: { id: string }) => item.id === id),
    family = graph.nodeTypes.find((item: { id: string }) => item.id === node.type);
  return JSON.parse(String(node.values.innerGraph ?? family.parameters.innerGraph.default));
}
async function open(source: UiDocument) {
  expect(screenIssues(source)).toEqual([]);
  const bridge = new EditorBridge({
    catalogs: designerCatalogs,
    validateDocument: screenPlacementIssues,
    store: screenStore(localStorage, source.id),
    initial: { document: source, storedRevision: 'r1' },
  });
  let values: Record<string, UiValue> = {},
    signal = 0;
  const sync = () => {
    values = rebaseGraphRuntime(bridge.document, values);
    consumer?.updateSource(bridge.document);
    consumer?.updateRuntime(values, signal);
  };
  const globalHistory = {
    canUndo: () => bridge.getSnapshot().canUndo,
    canRedo: () => bridge.getSnapshot().canRedo,
    undo: () => {
      bridge.undo();
      sync();
    },
    redo: () => {
      bridge.redo();
      sync();
    },
  };
  const write = vi.fn((key: string, value: UiValue) =>
    graphRuntimeChanged(bridge.document, key, value, {
      values,
      applyGraph: (next) => {
        const result = bridge.apply({
          requestId: crypto.randomUUID(),
          reason: 'Manual graph edit',
          commands: [{ op: 'replaceDocument', document: next }],
        });
        if (result.ok) sync();
        return result.ok;
      },
      reset: () => {
        signal++;
      },
      supply: (next) => {
        values = next;
        consumer?.updateRuntime(values, signal);
      },
      invalid: () => {
        throw Error('Graph write unexpectedly refused');
      },
    }),
  );
  const authoringFor = vi.fn((identity: GraphOccurrenceIdentity) =>
    graphAuthoringFor(bridge.document, identity, globalHistory),
  );
  consumer = mount(FoundationConsumer, {
    target: document.body,
    props: {
      source,
      onStateChange: write,
      history: {
        historyFor: (identity: { nodeId: string; occurrenceKey: string }) =>
          graphHistoryFor(bridge.document, identity.nodeId, globalHistory),
      },
      occurrenceHost: { authoringFor },
    },
  });
  await settle();
  return { bridge, write, sync, globalHistory, authoringFor };
}
function agentEdit(bridge: EditorBridge, operations: AgentEdit['operations']) {
  const cursor = documentCursor(bridge.document, bridge.getSnapshot().revision, 'scoped-bridge');
  const edit = {
    expectedRevision: cursor.revision,
    reason: 'Exact scoped graph agent operation',
    operations,
  };
  const prepared = prepareAgentEdit(bridge.document, cursor, edit, crypto.randomUUID());
  expect(prepared.ok, JSON.stringify(prepared)).toBe(true);
  if (!prepared.ok) throw Error(prepared.message);
  expect(
    applyAgentProposal(
      bridge,
      { proposalId: crypto.randomUUID(), cursor, edit, resultDigest: prepared.digest },
      'scoped-bridge',
      false,
    ).ok,
  ).toBe(true);
}
async function selectedNode(id: string, within: Element = document.body) {
  const node = within.querySelector<HTMLElement>(`.svelte-flow__node[data-id="${id}"]`)!;
  expect(node).toBeTruthy();
  node.click();
  await settle();
  node.focus();
  return node;
}
function keyboard(node: Element, key: string, ctrlKey = false) {
  node.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      code: key === 'z' ? 'KeyZ' : key,
      ctrlKey,
      bubbles: true,
      cancelable: true,
    }),
  );
}

it('persists nested manual and agent changes through Studio history, save/reopen and portable import', async () => {
  const source = nestedCompositionDocument(),
    view = await open(source);
  expect(
    graphUsesSourceHistory(source, 'inner-workspace', [
      { workspaceNodeId: 'outer-workspace', graphNodeId: 'outer-node', expectedGraphRevision: 0 },
    ]),
  ).toBe(true);
  const field = document.querySelector<HTMLInputElement>('[aria-label="Evidence URL"]')!;
  expect(field).toBeTruthy();
  field.value = 'https://example.test/manual-evidence';
  field.dispatchEvent(new Event('change', { bubbles: true }));
  await settle();
  expect(
    inner(view.bridge.document).nodes.find((node: { id: string }) => node.id === 'source-a').values
      .text,
  ).toBe('https://example.test/manual-evidence');
  expect(view.write.mock.calls.every(([key]) => key === 'graph')).toBe(true);
  const afterManual = canonicalUiDocument(view.bridge.document).contentDigest;
  const graph = inner(view.bridge.document);
  agentEdit(view.bridge, [
    {
      op: 'editGraph',
      nodeId: 'inner-workspace',
      expectedGraphRevision: graph.revision,
      occurrenceRoute: [
        {
          workspaceNodeId: 'outer-workspace',
          graphNodeId: 'outer-node',
          expectedGraphRevision: outer(view.bridge.document).revision,
        },
      ],
      changes: [{ type: 'setLabel', nodeId: 'source-a', label: 'Agent-labelled evidence' }],
    },
  ]);
  view.sync();
  await settle();
  expect(
    inner(view.bridge.document).nodes.find((node: { id: string }) => node.id === 'source-a').label,
  ).toBe('Agent-labelled evidence');
  const moved = await selectedNode('source-a');
  keyboard(moved, 'ArrowRight');
  await settle();
  expect(
    inner(view.bridge.document).nodes.find((node: { id: string }) => node.id === 'source-a')
      .position.x,
  ).toBeGreaterThan(0);
  keyboard(await selectedNode('source-a'), 'z', true);
  await settle();
  expect(
    inner(view.bridge.document).nodes.find((node: { id: string }) => node.id === 'source-a')
      .position,
  ).toEqual({ x: 0, y: 0 });
  view.globalHistory.undo();
  await settle();
  expect(canonicalUiDocument(view.bridge.document).contentDigest).toBe(afterManual);
  view.globalHistory.redo();
  await settle();
  expect(
    inner(view.bridge.document).nodes.find((node: { id: string }) => node.id === 'source-a').label,
  ).toBe('Agent-labelled evidence');
  expect(outer(view.bridge.document).nodes[0].position).toEqual({ x: 80, y: 60 });
  const saved = view.bridge.save();
  expect(saved.ok, JSON.stringify(saved)).toBe(true);
  const loaded = screenStore(localStorage, source.id).rawLoad();
  expect(loaded.status).toBe('loaded');
  if (loaded.status !== 'loaded') throw Error('saved screen missing');
  expect(loaded.document).toEqual(view.bridge.document);
  expect(view.bridge.reopen().ok).toBe(true);
  view.sync();
  await settle();
  expect(document.querySelector<HTMLInputElement>('[aria-label="Evidence URL"]')!.value).toBe(
    'https://example.test/manual-evidence',
  );
  const imported = await prepareSourceImport(
    JSON.stringify({
      application: screenApplication(loaded.document),
      uiDocuments: [{ document: loaded.document }],
    }),
  );
  expect(imported.ok, JSON.stringify(imported)).toBe(true);
  if (imported.ok) expect(imported.document).toEqual(loaded.document);
});

it('keeps repeated private graph occurrences temporary with local undo and no canonical or save promotion', async () => {
  const base = nestedCompositionDocument(),
    workspace = base.nodes['outer-workspace'];
  if (workspace.kind !== 'component') throw Error('fixture');
  const graph = outer(base),
    initial = graph.nodeTypes[0].parameters.innerGraph.default;
  graph.nodes.push({ ...graph.nodes[0], id: 'outer-two', position: { x: 900, y: 60 } });
  const source: UiDocument = {
    ...base,
    localState: { graph: { ...base.localState.graph, initial: JSON.stringify(graph) } },
    nodes: {
      ...base.nodes,
      'outer-workspace': {
        ...workspace,
        slots: {
          ...workspace.slots,
          body: {
            ...workspace.slots!.body,
            scope: {
              ...workspace.slots!.body.scope!,
              state: {
                innerGraph: { key: 'innerGraph', type: 'string', initial, controlled: false },
              },
            },
          },
        },
      },
    },
  };
  const view = await open(source),
    before = canonicalUiDocument(source).contentDigest;
  expect(graphUsesSourceHistory(source, 'inner-workspace')).toBe(false);
  const first = document.querySelector<HTMLElement>('.svelte-flow__node[data-id="outer-node"]')!,
    second = document.querySelector<HTMLElement>('.svelte-flow__node[data-id="outer-two"]')!;
  const node = await selectedNode('source-a', first),
    beforeTransform = node.style.transform;
  keyboard(node, 'ArrowRight');
  await settle();
  expect(
    first.querySelector<HTMLElement>('.svelte-flow__node[data-id="source-a"]')!.style.transform,
  ).not.toBe(beforeTransform);
  expect(
    second.querySelector<HTMLElement>('.svelte-flow__node[data-id="source-a"]')!.style.transform,
  ).toBe(beforeTransform);
  // The public local history action restores the first occurrence even though
  // canonical Studio history has nothing to undo. The sibling stays untouched.
  expect(view.bridge.getSnapshot().canUndo).toBe(false);
  keyboard(await selectedNode('source-a', first), 'z', true);
  await settle();
  const firstNode = first.querySelector<HTMLElement>('.svelte-flow__node[data-id="source-a"]')!,
    secondNode = second.querySelector<HTMLElement>('.svelte-flow__node[data-id="source-a"]')!;
  expect(firstNode.style.transform).toBe(secondNode.style.transform);
  expect(view.write).not.toHaveBeenCalled();
  const input = document.querySelector<HTMLInputElement>('[aria-label="Evidence URL"]')!;
  const nativeUndo = new KeyboardEvent('keydown', {
    key: 'z',
    code: 'KeyZ',
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  input.dispatchEvent(nativeUndo);
  expect(nativeUndo.defaultPrevented).toBe(false);
  expect(canonicalUiDocument(view.bridge.document).contentDigest).toBe(before);
  expect(view.bridge.save().ok).toBe(true);
  const loaded = screenStore(localStorage, source.id).rawLoad();
  expect(loaded.status).toBe('loaded');
  if (loaded.status === 'loaded')
    expect(loaded.document).toEqual({ ...source, revision: loaded.document.revision });
  const unchangedOuter = view.bridge.document.localState.graph.initial;
  agentEdit(view.bridge, [
    {
      op: 'editGraph',
      nodeId: 'inner-workspace',
      expectedGraphRevision: 0,
      changes: [{ type: 'setLabel', nodeId: 'source-a', label: 'Authored private initial' }],
    },
  ]);
  view.sync();
  await settle();
  expect(view.bridge.document.localState.graph.initial).toBe(unchangedOuter);
  // Existing keyed scoped-slot rendering remounts on a declaration change.
  // Both occurrences receive the authored template initial; runtime movement
  // above was never silently promoted into that initial or a graph parameter.
  const rendered = [
    ...document.querySelectorAll<HTMLElement>('.svelte-flow__node[data-id="source-a"]'),
  ];
  expect(rendered).toHaveLength(2);
  expect(rendered.every((node) => node.textContent?.includes('Authored private initial'))).toBe(
    true,
  );
  view.globalHistory.undo();
  await settle();
  expect(
    [...document.querySelectorAll<HTMLElement>('.svelte-flow__node[data-id="source-a"]')].some(
      (node) => node.textContent?.includes('Authored private initial'),
    ),
  ).toBe(false);
});

it('refuses nested source Undo and editing when a controlled declaration has no actual parent parameter', async () => {
  const base = nestedCompositionDocument(),
    workspace = base.nodes['outer-workspace'];
  if (workspace.kind !== 'component') throw Error('fixture');
  const graph = outer(base),
    fallback = graph.nodeTypes[0].parameters.innerGraph.default;
  graph.nodeTypes[0].parameters = {};
  const source: UiDocument = {
    ...base,
    localState: { graph: { ...base.localState.graph, initial: JSON.stringify(graph) } },
    nodes: {
      ...base.nodes,
      'outer-workspace': {
        ...workspace,
        slots: {
          ...workspace.slots,
          body: {
            ...workspace.slots!.body,
            scope: {
              ...workspace.slots!.body.scope!,
              state: {
                innerGraph: {
                  key: 'innerGraph',
                  type: 'string',
                  initial: fallback,
                  controlled: true,
                },
              },
            },
          },
        },
      },
    },
  };
  const view = await open(source);
  agentEdit(view.bridge, [
    {
      op: 'editGraph',
      nodeId: 'outer-workspace',
      expectedGraphRevision: 0,
      changes: [
        { type: 'setLabel', nodeId: 'outer-node', label: 'Retain unrelated canonical edit' },
      ],
    },
  ]);
  view.sync();
  await settle();
  const before = canonicalUiDocument(view.bridge.document).contentDigest;
  expect(view.bridge.getSnapshot().canUndo).toBe(true);
  expect(
    [...document.querySelectorAll('[role="alert"]')].some((node) =>
      node.textContent?.includes('declared string parameter'),
    ),
  ).toBe(true);
  const node = await selectedNode('source-a');
  keyboard(node, 'ArrowRight');
  await settle();
  keyboard(node, 'z', true);
  await settle();
  expect(canonicalUiDocument(view.bridge.document).contentDigest).toBe(before);
  expect(outer(view.bridge.document).nodes[0].label).toBe('Retain unrelated canonical edit');
  expect(view.write).not.toHaveBeenCalled();
  expect(
    [...document.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.trim() === 'Name primary source',
    )?.disabled,
  ).toBe(true);
  const input = document.querySelector<HTMLInputElement>('[aria-label="Evidence URL"]')!;
  const nativeUndo = new KeyboardEvent('keydown', {
    key: 'z',
    code: 'KeyZ',
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  input.dispatchEvent(nativeUndo);
  expect(nativeUndo.defaultPrevented).toBe(false);
  const scoped = view.authoringFor.mock.calls.filter(
    ([identity]) => identity.nodeId === 'inner-workspace',
  );
  expect(scoped.length).toBeGreaterThan(0);
  expect(scoped.at(-1)![0].occurrenceRoute).toEqual([
    { workspaceNodeId: 'outer-workspace', graphNodeId: 'outer-node', expectedGraphRevision: 1 },
  ]);
});

it('keeps canonical graph ownership and persistence beyond 64 ordinary source wrappers', async () => {
  const base = nestedCompositionDocument(),
    nodes = { ...base.nodes };
  for (let index = 0; index < 66; index++)
    nodes[`deep-${index}`] = {
      kind: 'element',
      id: `deep-${index}`,
      tag: 'div',
      children: [index === 65 ? base.root : `deep-${index + 1}`],
    };
  const source = { ...base, root: 'deep-0', nodes },
    view = await open(source);
  expect(graphUsesSourceHistory(source, 'outer-workspace')).toBe(true);
  const node = await selectedNode('outer-node');
  keyboard(node, 'ArrowRight');
  await settle();
  expect(outer(view.bridge.document).nodes[0].position.x).toBeGreaterThan(80);
  expect(view.bridge.getSnapshot().canUndo).toBe(true);
  keyboard(await selectedNode('outer-node'), 'z', true);
  await settle();
  expect(outer(view.bridge.document).nodes[0].position).toEqual({ x: 80, y: 60 });
});

it('keeps controlled nested graphs usable after runtime-root parent revisions depart from authored literals', async () => {
  const base = nestedCompositionDocument(),
    workspace = base.nodes['outer-workspace'];
  if (workspace.kind !== 'component') throw Error('fixture');
  const source: UiDocument = {
    ...base,
    nodes: {
      ...base.nodes,
      'outer-workspace': {
        ...workspace,
        props: {
          ...workspace.props,
          graph: { type: 'literal', value: String(base.localState.graph.initial) },
        },
      },
    },
  };
  const view = await open(source),
    before = canonicalUiDocument(source).contentDigest;
  keyboard(await selectedNode('outer-node'), 'ArrowRight');
  await settle();
  expect(view.bridge.getSnapshot().canUndo).toBe(false);
  const field = document.querySelector<HTMLInputElement>('[aria-label="Evidence URL"]')!;
  expect(field.disabled).toBe(false);
  field.value = 'https://example.test/runtime-nested';
  field.dispatchEvent(new Event('change', { bubbles: true }));
  await settle();
  expect(document.querySelector<HTMLInputElement>('[aria-label="Evidence URL"]')!.value).toBe(
    'https://example.test/runtime-nested',
  );
  const calls = view.authoringFor.mock.calls.filter(
    ([identity]) => identity.nodeId === 'inner-workspace',
  );
  expect(calls.some(([identity]) => (identity.occurrenceRoute[0]?.expectedGraphRevision ?? 0) > 0)).toBe(
    true,
  );
  expect(
    view.authoringFor.mock.results
      .filter((_, index) => view.authoringFor.mock.calls[index]?.[0].nodeId === 'inner-workspace')
      .every((result) => result.value.kind === 'runtime'),
  ).toBe(true);
  keyboard(await selectedNode('source-a'), 'z', true);
  await settle();
  expect(document.querySelector<HTMLInputElement>('[aria-label="Evidence URL"]')!.value).not.toBe(
    'https://example.test/runtime-nested',
  );
  expect(canonicalUiDocument(view.bridge.document).contentDigest).toBe(before);
});
