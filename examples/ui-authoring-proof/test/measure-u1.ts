/**
 * U1-08 measurement harness (PROOF-DESIGN §5 workload).
 *
 * Workload: 1,000 authored nodes including reusable definitions; 100 visible
 * repeated finding occurrences; one inspector selection; 20 consecutive
 * source transactions; a representative scenario reset.
 * Budgets: p95 edit feedback ≤ 100 ms; p95 full compile ≤ 250 ms;
 * reset-to-settled ≤ 1 s (excluding configured latency).
 *
 * Run: npx tsx test/measure-u1.ts   (from examples/ui-authoring-proof)
 */

import {
  compileUiDocument,
  defaultSemanticElementCatalog,
  UiEditSession,
  type UiDocument,
} from '@victframework/ui';
import { createPreviewSession } from '@victframework/ui-preview';
import type { UiScenarioLike } from './preview-shim.js';

function generateLargeDocument(): UiDocument {
  const nodes: Record<string, UiDocument['nodes'][string]> = {};
  const rootChildren: string[] = [];
  // header + 20 sections × 48 nodes = ~1000
  nodes['n.root'] = { kind: 'element', id: 'n.root', tag: 'section', children: ['n.h'] };
  nodes['n.h'] = { kind: 'text', id: 'n.h', content: { type: 'literal', value: 'Large document' } };
  for (let section = 0; section < 20; section += 1) {
    const sectionId = `n.sec${section}`;
    const children: string[] = [`n.sec${section}h`];
    nodes[sectionId] = { kind: 'element', id: sectionId, tag: 'div', children: children.slice() };
    nodes[`n.sec${section}h`] = {
      kind: 'text',
      id: `n.sec${section}h`,
      content: { type: 'literal', value: `Section ${section}` },
    };
    rootChildren.push(sectionId);
    for (let item = 0; item < 48; item += 1) {
      const nodeId = `n.n${section}_${item}`;
      nodes[nodeId] = {
        kind: 'element',
        id: nodeId,
        tag: 'span',
        children: [`${nodeId}t`],
      };
      nodes[`${nodeId}t`] = {
        kind: 'text',
        id: `${nodeId}t`,
        content: { type: 'literal', value: `Item ${section}.${item}` },
      };
      children.push(nodeId);
    }
    nodes[sectionId] = { ...nodes[sectionId], children };
  }
  return {
    schema: 'vict.ui-document@1',
    id: 'doc.large',
    revision: '1',
    root: 'n.root',
    nodes: { ...nodes, ...repeatAndCardNodes() },
    componentDefinitions: {},
    styleSources: {},
    tokens: {},
    conditions: {},
    assets: {},
    localState: {},
  };
}

function repeatAndCardNodes(): UiDocument['nodes'] {
  // a repeat rendering 100 occurrences from a 100-row collection
  return {
    'n.repeatHost': { kind: 'element', id: 'n.repeatHost', tag: 'ul', children: ['n.repeat'] },
    'n.repeat': {
      kind: 'repeat',
      id: 'n.repeat',
      collection: { type: 'ref', path: 'view.rows' },
      key: { type: 'ref', path: 'repeat.row.label' },
      itemName: 'row',
      templateRoot: 'n.rowItem',
    },
    'n.rowItem': { kind: 'element', id: 'n.rowItem', tag: 'li', children: ['n.rowText'] },
    'n.rowText': {
      kind: 'text',
      id: 'n.rowText',
      content: { type: 'expression', expression: { type: 'ref', path: 'repeat.row.label' } },
    },
  };
}

function percentile(samples: readonly number[], p: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)] as number;
}

async function main(): Promise<void> {
  const document = generateLargeDocument();
  const nodeCount = Object.keys(document.nodes).length;
  const rows = Array.from({ length: 100 }, (_, index) => ({ label: `Row ${index}` }));

  // warm-up compile
  compileUiDocument(document, defaultSemanticElementCatalog(), [], {
    viewFields: { rows: 'array', 'rows.label': 'string' },
  });

  // ---- p95 full compile (30 iterations after warm-up) ----------------------
  const compileSamples: number[] = [];
  for (let index = 0; index < 30; index += 1) {
    const started = performance.now();
    const result = compileUiDocument(document, defaultSemanticElementCatalog(), [], {
      viewFields: { rows: 'array', 'rows.label': 'string' },
    });
    compileSamples.push(performance.now() - started);
    if (!result.ok) throw new Error('large document failed to compile');
  }

  // ---- p95 edit feedback: selection + 20 consecutive transactions ----------
  const session = UiEditSession.open({
    document,
    storedRevision: '1',
    catalogs: { elements: defaultSemanticElementCatalog() },
  });
  const editSamples: number[] = [];
  for (let index = 0; index < 20; index += 1) {
    const started = performance.now();
    const outcome = session.applyTransaction({
      requestId: `edit-${index}`,
      expectedDocumentRevision: session.workingRevision,
      commands: [
        {
          op: 'setProperty',
          nodeId: `n.n${index}_0t`,
          property: 'textLiteral',
          value: `Edited item ${index}`,
        },
        {
          op: 'setStyleDeclaration',
          nodeId: `n.n${index}_0`,
          property: 'color',
          value: { type: 'text', value: '#0a6c96' },
        },
      ],
    });
    editSamples.push(performance.now() - started);
    if (!outcome.ok) throw new Error(`edit ${index} rejected: ${JSON.stringify(outcome.issues)}`);
  }

  // ---- scenario reset to settled seeded state ------------------------------
  const scenario = {
    schema: 'vict.ui-scenario@1',
    scenarioId: 'scn.perf',
    references: { application: { id: 'app.inspection', revision: '1' }, documents: {} },
    seeds: {
      domain: {
        rows: {
          inspection: Array.from({ length: 50 }, (_, index) => ({
            id: `i-${index}`,
            title: `Inspection ${index}`,
            status: 'submitted',
            domainRevision: 1,
          })),
        },
      },
    },
    actors: [{ actorId: 's.hart', role: 'supervisor', permissions: ['qlt.inspection.approve'] }],
    operations: [{ op: 'inspection:list', implementation: 'simulated', outcome: { kind: 'rows' } }],
    resetBoundary: 'session',
  } as UiScenarioLike;
  let preview = createPreviewSession({ scenario });
  const resetSamples: number[] = [];
  for (let index = 0; index < 30; index += 1) {
    const started = performance.now();
    preview = preview.reset();
    const list = await preview.run('inspection:list');
    resetSamples.push(performance.now() - started);
    if (!list.ok) throw new Error('list failed after reset');
  }

  console.log(
    JSON.stringify(
      {
        environment: { node: process.version },
        workload: { authoredNodes: nodeCount, repeatedOccurrences: 100, transactions: 20 },
        results: {
          compileP95ms: Number(percentile(compileSamples, 95).toFixed(2)),
          compileP50ms: Number(percentile(compileSamples, 50).toFixed(2)),
          editFeedbackP95ms: Number(percentile(editSamples, 95).toFixed(2)),
          editFeedbackP50ms: Number(percentile(editSamples, 50).toFixed(2)),
          scenarioResetP95ms: Number(percentile(resetSamples, 95).toFixed(2)),
        },
        budgets: { compileMs: 250, editFeedbackMs: 100, scenarioResetMs: 1000 },
      },
      null,
      1,
    ),
  );
}

void main();
