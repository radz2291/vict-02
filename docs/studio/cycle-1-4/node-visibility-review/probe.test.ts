// Diagnostic observations of the current candidate, not desired-behavior acceptance tests.
import { expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import type { UiDocument, UiNode } from '@victframework/ui';
import { canonicalUiDocument } from '@victframework/ui';
import { compileScreen, newScreen } from '../../../../apps/studio/src/lib/designer/application.js';
import { projectStructure, filterStructure, connectedStructure, structureId, structureNodePresentation, structureFacts } from '../../../../apps/studio/src/lib/designer/structure.js';
import { structurePorts, groupStructureRelationships } from '../../../../apps/studio/src/lib/designer/structure-connections.js';
import { chooseLayoutEngine } from '../../../../packages/ui-flow-svelte/src/layout.js';

it('records visibility and semantic coverage without changing source', () => {
  const base = newScreen('Visibility probe', 'visibility-probe');
  const literal = (id: string, value = id): UiNode => ({ id, kind: 'text', content: { type: 'literal', value } });
  const source: UiDocument = {
    ...base,
    localState: { ...base.localState, items: { key: 'items', type: 'stringList', initial: [] }, visible: { key: 'visible', type: 'boolean', initial: true } },
    conditions: { ...base.conditions, show: { id: 'show', kind: 'localState', when: { type: 'ref', path: 'state.visible' } } },
    tokens: { ink: { id: 'ink', value: '#333333' } },
    styleSources: { shared: { id: 'shared', declarations: [{ property: 'color', value: { type: 'token', id: 'ink' } }] } },
    assets: { hero: { id: 'hero', kind: 'external', href: 'https://example.com/hero.png' } },
    componentDefinitions: { 'local.card': { id: 'local.card', revision: '1', root: 'definition', props: [], slots: { content: {} } } },
    nodes: {
      screen: { id: 'screen', kind: 'element', tag: 'main', children: ['headline', 'repeat', 'conditional', 'card', 'inputA', 'inputB', 'next', 'portal'], styleSources: ['shared'] },
      portal: { id: 'portal', kind: 'portal', target: { overlayId: 'overlay-review' }, children: ['portalText'] },
      portalText: literal('portalText'),
      headline: { id: 'headline', kind: 'element', tag: 'h1', children: ['headlineText'] },
      headlineText: literal('headlineText', 'A deliberately long title '.repeat(7)),
      repeat: { id: 'repeat', kind: 'repeat', collection: { type: 'ref', path: 'state.items' }, key: { type: 'literal', value: 'stable' }, itemName: 'item', templateRoot: 'template' },
      template: literal('template'),
      conditional: { id: 'conditional', kind: 'conditional', branches: [{ when: 'show', children: ['yes'] }, { children: ['no'] }] },
      yes: literal('yes'), no: literal('no'),
      card: { id: 'card', kind: 'component', definitionId: 'local.card', slots: {} },
      definition: { id: 'definition', kind: 'element', tag: 'section', children: ['slot'] },
      slot: { id: 'slot', kind: 'slot', name: 'content', fallback: ['fallback'] },
      fallback: literal('fallback'),
      inputA: { id: 'inputA', kind: 'element', tag: 'input', attributes: { 'aria-label': 'First field', value: { type: 'ref', path: 'state.message' } }, children: [], interactions: [{ on: 'change', action: 'setState', key: 'message', value: { type: 'ref', path: 'state.message' } }] },
      inputB: { id: 'inputB', kind: 'element', tag: 'input', attributes: { 'aria-label': 'Second field', value: { type: 'ref', path: 'state.message' } }, children: [] },
      next: { id: 'next', kind: 'element', tag: 'button', children: ['nextText'], interactions: [{ on: 'click', action: 'navigate', routeId: 'screen' }] },
      nextText: literal('nextText', 'Next'),
    },
  };
  const compiled = compileScreen(source);
  const digest = canonicalUiDocument(source).contentDigest;
  const graph = projectStructure(source);
  const id = (kind: string, key: string) => structureId(source.id, kind, key);
  const ordinary = filterStructure(graph);
  const expanded = filterStructure(graph, { definitions: true });
  const displayed = graph.nodes.map(n => ({ id: n.id, ...structureNodePresentation(source, n.data) }));
  const headline = displayed.find(n => n.sourceId === 'headline')!;
  const branch = graph.edges.find(e => e.source === id('node', 'conditional') && e.target === id('node', 'yes'))!;
  const conditionConnections = graph.edges.filter(e => e.source === id('node', 'conditional') && e.data?.kind !== 'containment');
  const fanout = connectedStructure(graph, id('node', 'inputA'));
  const emptyContainment = connectedStructure(graph, id('node', 'headline'));
  const result = {
    kind: 'Current-behavior diagnostic; passing assertions reproduce gaps, not product acceptance',
    compile: compiled.ok ? { ok: true, diagnostics: Object.values(compiled.plan.documentPlans ?? {}).flatMap(plan => plan.diagnostics) } : compiled,
    sourceKinds: [...new Set(Object.values(source.nodes).map(n => n.kind))],
    defaultHidden: graph.nodes.filter(n => n.data.sourceId && !ordinary.nodes.some(v => v.id === n.id)).map(n => n.data.sourceId),
    definitionsOnHidden: graph.nodes.filter(n => n.data.sourceId && !expanded.nodes.some(v => v.id === n.id)).map(n => n.data.sourceId),
    conditionalConnections: conditionConnections,
    visibleStateHasAnyConnection: graph.edges.some(e => e.source === id('state', 'visible') || e.target === id('state', 'visible')),
    projectedKinds: [...new Set(graph.nodes.map(n => n.data.kind))],
    declaredRegistries: { conditions: Object.keys(source.conditions), styles: Object.keys(source.styleSources), tokens: Object.keys(source.tokens), assets: Object.keys(source.assets) },
    displayedHeading: headline,
    searchHeading: filterStructure(graph, { search: 'Heading' }).nodes.map(n => n.data.sourceId),
    searchHeadlineId: filterStructure(graph, { search: 'headline' }).nodes.map(n => n.data.sourceId),
    labelSourceLength: source.nodes.headlineText!.kind === 'text' ? 'A deliberately long title '.repeat(7).length : 0,
    labelDisplayLength: headline.label.length,
    branchOriginalLabel: branch.label,
    branchDisplayedRelationship: groupStructureRelationships(graph, id('node', 'conditional')).find(g => g.targetId === id('node', 'yes')),
    firstFieldVisibleSources: fanout.nodes.map(n => n.data.sourceId).filter(Boolean),
    headingSelectedConnections: { nodes: emptyContainment.nodes.length, edges: emptyContainment.edges.length, authoredChildren: 1 },
    portCountInHierarchy: structurePorts(ordinary, id('node', 'inputA')),
    allRelationshipsForInput: groupStructureRelationships(graph, id('node', 'inputA')),
    fullStateFacts: structureFacts(source, graph.nodes.find(n => n.id === id('state', 'visible'))!),
    largeLayout: chooseLayoutEngine(121, 'elk'),
  };
  writeFileSync(new URL('./observations.json', import.meta.url), JSON.stringify(result, null, 2));
  expect(compiled.ok).toBe(true);
  expect(result.defaultHidden).toEqual(expect.arrayContaining(['template', 'yes', 'no', 'slot', 'fallback']));
  expect(result.definitionsOnHidden).toEqual([]);
  expect(conditionConnections).toHaveLength(0);
  expect(result.visibleStateHasAnyConnection).toBe(false);
  expect(result.searchHeading).toEqual([]);
  expect(result.searchHeadlineId).toContain('headline');
  expect(headline.label.length).toBeLessThan(result.labelSourceLength);
  expect(result.firstFieldVisibleSources).toContain('inputB');
  expect(emptyContainment.nodes).toHaveLength(1);
  expect(emptyContainment.edges).toHaveLength(0);
  expect(result.branchDisplayedRelationship?.relations[0]?.label).toBe('Contains');
  expect(result.largeLayout.engine).toBe('dagre');
  expect(canonicalUiDocument(source).contentDigest).toBe(digest);
});

it('records the size of a shared-state neighbourhood in a compiling large document', () => {
  const base = newScreen('Shared state stress', 'shared-state-stress');
  const nodes: Record<string, UiNode> = { screen: { id: 'screen', kind: 'element', tag: 'main', children: Array.from({length: 140}, (_,i) => `field-${i}`) } };
  for(let i=0;i<140;i++) nodes[`field-${i}`] = { id:`field-${i}`, kind:'element',tag:'input',attributes:{'aria-label':`Field ${i}`,value:{type:'ref',path:'state.message'}},children:[] };
  const source = {...base,nodes};
  const compiled = compileScreen(source);
  const graph=projectStructure(source), scope=connectedStructure(graph,structureId(source.id,'node','field-0'));
  const result={compileOk:compiled.ok,sourceNodes:Object.keys(nodes).length,selectedSources:1,connectedNodes:scope.nodes.length,connectedEdges:scope.edges.length,layout:chooseLayoutEngine(scope.nodes.length,'elk'),note:'No browser rendering, visual overlap or interaction latency verdict follows from this projection probe'};
  writeFileSync(new URL('./shared-state-stress.json',import.meta.url),JSON.stringify(result,null,2));
  expect(compiled.ok).toBe(true);
  expect(scope.nodes.length).toBe(141);
  expect(scope.edges.length).toBe(140);
});
