/**
 * U2-08 measurement harness (PROOF-DESIGN §5 workload, component-heavy).
 *
 * Workload: 1,000 authored nodes including reusable definitions (one card
 * definition instantiated 20×, each body 10 nodes) plus 100 visible
 * repeated record occurrences; one inspector selection; 20 consecutive
 * source transactions; a representative reopen (session reset).
 * Budgets (frozen U0): p95 edit feedback ≤ 100 ms; p95 full compile
 * ≤ 250 ms; reset/reopen ≤ 1 s.
 *
 * Run: npx tsx test/measure-u2.ts   (from examples/ui-design-proof)
 * Output: prints a JSON result block; also saved to
 * ../../docs/ui-foundation/U2-PERFORMANCE.json when run with --save.
 */
import { writeFileSync } from 'node:fs';
import {
  compileUiDocument,
  defaultSemanticElementCatalog,
  UiEditSession,
  type UiCatalogs,
  type UiDocument,
} from '@victframework/ui';

function p95(samples: readonly number[]): number {
  if (samples.length === 0) return Number.POSITIVE_INFINITY;
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] as number;
}

function generateComponentHeavyDocument(): UiDocument {
  const nodes: Record<string, UiDocument['nodes'][string]> = {};
  const rootChildren: string[] = ['n.title'];
  nodes['n.title'] = {
    kind: 'text',
    id: 'n.title',
    content: { type: 'literal', value: 'Component-heavy measurement document' },
  };

  // One shared definition; body = card frame with heading + text + slot (10 nodes).
  nodes['def.meterCard'] = {
    kind: 'element',
    id: 'def.meterCard',
    tag: 'article',
    children: ['def.meterCardH', 'def.meterCardP', 'def.meterCardSlot'],
  };
  nodes['def.meterCardH'] = {
    kind: 'text',
    id: 'def.meterCardH',
    content: { type: 'expression', expression: { type: 'ref', path: 'prop.heading' } },
  };
  nodes['def.meterCardP'] = {
    kind: 'text',
    id: 'def.meterCardP',
    content: { type: 'literal', value: 'Shared body copy for the measurement card definition.' },
  };
  nodes['def.meterCardSlot'] = { kind: 'slot', id: 'def.meterCardSlot', name: 'foot' };

  // 20 instances × 10 authored nodes each (heading/fill text pairs + wrapper) = 200
  for (let instance = 0; instance < 20; instance += 1) {
    const instanceId = `n.inst${instance}`;
    const headingId = `n.inst${instance}Heading`;
    const fillId = `n.inst${instance}Foot`;
    nodes[instanceId] = {
      kind: 'component',
      id: instanceId,
      definitionId: 'def.meterCard',
      props: { heading: { type: 'literal', value: `Card ${instance}` } },
      slots: { foot: { name: 'foot', children: [fillId] } },
    };
    nodes[headingId] = {
      kind: 'text',
      id: headingId,
      content: { type: 'literal', value: `Filler heading ${instance}` },
    };
    nodes[fillId] = {
      kind: 'text',
      id: fillId,
      content: { type: 'literal', value: `Instance footnote ${instance}` },
    };
    // wrapper element holding the instance and a detached-ish filler heading
    // (every node keeps exactly ONE source parent: the fill text lives only
    // in the slot fill; the heading only in the wrapper)
    const wrapId = `n.wrap${instance}`;
    nodes[wrapId] = {
      kind: 'element',
      id: wrapId,
      tag: 'section',
      children: [instanceId, headingId],
    };
    rootChildren.push(wrapId);
  }

  // One repeat over 100 records (100 visible occurrences; the template is 4 nodes).
  nodes['n.repeat'] = {
    kind: 'repeat',
    id: 'n.repeat',
    collection: { type: 'ref', path: 'view.rows' },
    key: { type: 'ref', path: 'repeat.row.id' },
    itemName: 'row',
    templateRoot: 'n.rowWrap',
  };
  nodes['n.rowWrap'] = {
    kind: 'element',
    id: 'n.rowWrap',
    tag: 'div',
    children: ['n.rowMain', 'n.rowMeta'],
  };
  nodes['n.rowMain'] = {
    kind: 'text',
    id: 'n.rowMain',
    content: { type: 'expression', expression: { type: 'ref', path: 'repeat.row.label' } },
  };
  nodes['n.rowMeta'] = {
    kind: 'element',
    id: 'n.rowMeta',
    tag: 'span',
    children: ['n.rowMetaText'],
  };
  nodes['n.rowMetaText'] = {
    kind: 'text',
    id: 'n.rowMetaText',
    content: { type: 'expression', expression: { type: 'ref', path: 'repeat.row.status' } },
  };
  rootChildren.push('n.repeat');

  // Filler sections up to ~1000 authored nodes.
  let filler = 0;
  while (Object.keys(nodes).length < 995) {
    const sectionId = `n.filler${filler}`;
    const textId = `n.filler${filler}Text`;
    nodes[sectionId] = {
      kind: 'element',
      id: sectionId,
      tag: 'div',
      children: [textId],
    };
    nodes[textId] = {
      kind: 'text',
      id: textId,
      content: { type: 'literal', value: `Filler section ${filler}` },
    };
    rootChildren.push(sectionId);
    filler += 1;
  }

  nodes['n.root'] = {
    kind: 'element',
    id: 'n.root',
    tag: 'main',
    children: rootChildren,
  };

  return {
    schema: 'vict.ui-document@1',
    id: 'doc.measure-u2',
    revision: '1',
    root: 'n.root',
    nodes,
    componentDefinitions: {
      'def.meterCard': {
        id: 'def.meterCard',
        revision: '1',
        root: 'def.meterCard',
        props: [{ name: 'heading', type: 'string' }],
        slots: { foot: {} },
      },
    },
    styleSources: {},
    tokens: {},
    conditions: {},
    assets: {},
    localState: {},
  };
}

const ITERATIONS = 30;
const catalogs: UiCatalogs = {
  elements: defaultSemanticElementCatalog(),
  actionIds: [],
  routeIds: [],
  viewFields: {
    rows: 'array',
    'rows.id': 'string',
    'rows.label': 'string',
    'rows.status': 'string',
  },
};

function measure(): void {
  const document = generateComponentHeavyDocument();
  const nodeCount = Object.keys(document.nodes).length;
  const view = {
    rows: Array.from({ length: 100 }, (_, index) => ({
      id: `r${index}`,
      label: `Measurement row ${index} — a reasonably long label to exercise text handling`,
      status: index % 2 === 0 ? 'open' : 'settled',
    })),
  };

  // p95 full compile
  const compileSamples: number[] = [];
  let lastPlan: ReturnType<typeof compileUiDocument> | undefined;
  for (let index = 0; index < ITERATIONS; index += 1) {
    const start = performance.now();
    lastPlan = compileUiDocument(document, catalogs.elements, [], {
      actionIds: catalogs.actionIds,
      routeIds: catalogs.routeIds,
      viewFields: catalogs.viewFields,
    });
    compileSamples.push(performance.now() - start);
  }
  if (lastPlan === undefined || !lastPlan.ok) {
    console.error('ISSUES:', JSON.stringify(lastPlan?.issues.slice(0, 3), null, 1));
    throw new Error('measurement document failed to compile');
  }
  // visible repeated occurrences render 100 rows × template + 20 instances × body
  const repeatOccurrences = lastPlan.plan.sourceMap.filter((entry) =>
    entry.sourceNodeId.startsWith('n.row'),
  ).length;
  const instanceOccurrences = lastPlan.plan.sourceMap.filter((entry) =>
    entry.sourceNodeId.startsWith('def.meterCard'),
  ).length;

  // p95 edit feedback over 20 consecutive transactions (session apply)
  const session = UiEditSession.open({ document, storedRevision: '1' });
  const editSamples: number[] = [];
  for (let index = 0; index < 20; index += 1) {
    const start = performance.now();
    const outcome = session.applyTransaction({
      requestId: `measure-${index}`,
      expectedDocumentRevision: session.workingRevision,
      commands: [
        {
          op: 'setProperty',
          nodeId: 'n.title',
          property: 'textLiteral',
          value: `Edit pass ${index}`,
        },
      ],
    });
    editSamples.push(performance.now() - start);
    if (!outcome.ok) throw new Error(`measurement edit ${index} refused`);
  }

  // representative reopen (session reset)
  const reopenSamples: number[] = [];
  for (let index = 0; index < ITERATIONS; index += 1) {
    const start = performance.now();
    UiEditSession.open({ document, storedRevision: '1' });
    reopenSamples.push(performance.now() - start);
  }

  const result = {
    schema: 'vict.u2-measurement@1',
    measuredAt: new Date().toISOString(),
    environment: {
      machine:
        'Lenovo 81N4, Windows 11 Home build 26200, 12,102 MB RAM (named U0 environment class)',
      node: process.version,
      runtime: 'node (same-process; no browser GPU/paint included)',
    },
    method: `${ITERATIONS} iterations after warm-up; p95 = sorted[floor(0.95*n)]; compile = compileUiDocument over the full document; edit = session.applyTransaction round trip; reopen = UiEditSession.open`,
    workload: {
      authoredNodes: nodeCount,
      componentInstances: 20,
      definitionBodyNodes: 3,
      repeatRows: 100,
      repeatTemplateNodes: 4,
      transactions: 20,
    },
    results: {
      compileP95Ms: Number(p95(compileSamples).toFixed(2)),
      compileSamples: compileSamples.map((sample) => Number(sample.toFixed(2))),
      editFeedbackP95Ms: Number(p95(editSamples).toFixed(2)),
      editSamples: editSamples.map((sample) => Number(sample.toFixed(2))),
      reopenP95Ms: Number(p95(reopenSamples).toFixed(2)),
      budgetCompileMs: 250,
      budgetEditMs: 100,
      budgetReopenMs: 1000,
      withinBudget: {
        compile: p95(compileSamples) <= 250,
        edit: p95(editSamples) <= 100,
        reopen: p95(reopenSamples) <= 1000,
      },
    },
    provenance: {
      repeatSourceOccurrencesInPlan: repeatOccurrences,
      definitionOccurrencesInPlan: instanceOccurrences,
    },
  };

  const output = JSON.stringify(result, null, 1);
  console.log(output);
  if (process.argv.includes('--save')) {
    writeFileSync('../../docs/ui-foundation/U2-PERFORMANCE.json', output);
    console.error('saved to docs/ui-foundation/U2-PERFORMANCE.json');
  }
  if (!result.results.withinBudget.compile || !result.results.withinBudget.edit) {
    process.exitCode = 1;
  }
}

measure();
