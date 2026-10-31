import { expect, it } from 'vitest';
import Ajv from 'ajv';
import type { UiDocument } from '@victframework/ui';
import { capturePresentationSchema } from '@victframework/mastra';
import {
  applyGraphOperationsV2,
  emptyGraphV2,
  parseGraphOperationsV2,
} from '@victframework/ui-flow-svelte';
import { agentContext } from '../src/lib/designer/agent-reads.js';
import { documentCursor, agentEditSchema } from '../src/lib/designer/agent-edits.js';
import { editPresentation } from '../src/lib/server/designer-agent.js';
import { patchAuthoredGraph } from '../src/lib/designer/graph-authoring.js';
import partial from './fixtures/nested-route-actual-partial-source.json';
it('independent: real paged knowledge delivers an executable generic example with distinct target and containing revisions', () => {
  const source = JSON.parse(JSON.stringify(partial)) as UiDocument,
    cursor = documentCursor(source, 'r1.r2', 'independent-route-knowledge');
  let result = agentContext(source, cursor, undefined, {
      section: 'knowledge',
      kind: 'component',
      key: 'vict.flow.workspace@2',
      projection: 'guidance',
    }),
    json = '',
    identity = '',
    pages = 0;
  while (true) {
    expect(result.ok).toBe(true);
    const item = (result.items as { contractJson: string; bodyIdentity: string }[])[0]!;
    identity ||= item.bodyIdentity;
    expect(item.bodyIdentity).toBe(identity);
    json += item.contractJson;
    pages++;
    if (result.nextCursor === null) break;
    if (pages > 100) throw Error('Nonterminating knowledge');
    result = agentContext(source, cursor, undefined, {
      section: 'knowledge',
      cursor: result.nextCursor,
    });
  }
  const strings: string[] = [];
  const visit = (value: unknown) => {
    if (typeof value === 'string') strings.push(value);
    else if (value && typeof value === 'object')
      for (const child of Object.values(value)) visit(child);
  };
  visit(JSON.parse(json));
  const guide = strings.find((value) => value.startsWith('Generic operation example'))!;
  expect(guide).toBeTruthy();
  const operation = JSON.parse(
    guide.slice(guide.indexOf('{"op"'), guide.indexOf('}. This is') + 1),
  );
  expect(operation.expectedGraphRevision).not.toBe(
    operation.occurrenceRoute[0].expectedGraphRevision,
  );
  const transaction = {
    expectedRevision: 'current-source-revision',
    reason: 'Independent delivered example',
    operations: [operation],
  };
  expect(agentEditSchema.safeParse(transaction).success).toBe(true);
  const validate = new Ajv({ allErrors: true }).compile(editPresentation);
  expect(validate(transaction), JSON.stringify(validate.errors)).toBe(true);
  const parsed = parseGraphOperationsV2(operation.changes);
  if (!parsed.ok) throw Error(JSON.stringify(parsed));
  expect(
    applyGraphOperationsV2(
      { ...emptyGraphV2(), revision: operation.expectedGraphRevision },
      parsed.operations,
      operation.expectedGraphRevision,
    ).ok,
  ).toBe(true);
  const bytes = new TextEncoder().encode(JSON.stringify(editPresentation)).length;
  expect(bytes).toBeLessThanOrEqual(32768);
  expect(() =>
    capturePresentationSchema(editPresentation, 'Independent actual edit metadata'),
  ).not.toThrow();
  for (const route of [
    [{ ...operation.occurrenceRoute[0], extra: true }],
    [{ ...operation.occurrenceRoute[0], expectedGraphRevision: '7' }],
    [],
  ]) {
    const invalid = { ...transaction, operations: [{ ...operation, occurrenceRoute: route }] };
    expect(agentEditSchema.safeParse(invalid).success).toBe(false);
    expect(validate(invalid)).toBe(false);
  }
  console.log(
    JSON.stringify({
      pages,
      bodyIdentity: identity,
      presentationBytes: bytes,
      distinctTargetParentRevisions: true,
    }),
  );
});
it('independent: controlled nesting requires graph2 containing ownership, not a graph2 target format', () => {
  // Source-resolver compatibility probe, not a rendered/imported graph1 app.
  const original = JSON.parse(JSON.stringify(partial)) as UiDocument,
    inner = original.nodes['project-task-workspace'];
  if (inner.kind !== 'component') throw Error('Fixture');
  const outer = JSON.parse(String(original.localState.graph.initial));
  outer.nodes.find((node: { id: string }) => node.id === 'p1').values.graph = JSON.stringify({
    schema: 'vict.flow-graph@1',
    revision: 0,
    nodeTypes: [],
    nodes: [],
    edges: [],
    allowCycles: false,
  });
  const source: UiDocument = {
    ...original,
    nodes: { ...original.nodes, [inner.id]: { ...inner, revision: '1' } },
    localState: {
      ...original.localState,
      graph: { ...original.localState.graph, initial: JSON.stringify(outer) },
    },
  };
  const before = JSON.stringify(source),
    result = patchAuthoredGraph(
      source,
      inner.id,
      [{ type: 'setCyclePolicy', allowCycles: true }],
      0,
      [
        {
          workspaceNodeId: 'flow-workspace',
          graphNodeId: 'p1',
          expectedGraphRevision: outer.revision,
        },
      ],
    );
  expect(result.ok, JSON.stringify(result)).toBe(true);
  if (!result.ok) throw Error(result.message);
  const after = JSON.parse(String(result.document.localState.graph.initial));
  expect(
    JSON.parse(after.nodes.find((node: { id: string }) => node.id === 'p1').values.graph),
  ).toMatchObject({ schema: 'vict.flow-graph@1', revision: 1, allowCycles: true });
  expect(JSON.stringify(source)).toBe(before);
});
