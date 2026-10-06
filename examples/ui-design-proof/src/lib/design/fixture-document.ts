/**
 * The Studio-style workbench fixture (PROOF-DESIGN §3.3): a GRAPH-SHAPED
 * document with PRESENTATION semantics only. Boxes, labels and connector
 * lines — deliberately long labels, dense rows and scrolling. It carries NO
 * workflow semantics and NO live operator controls: no actions, no routes,
 * no domain references. It exists to prove density, hierarchy, panel
 * behavior, long labels, keyboard access and small-screen adaptation.
 */
import type { UiDocument } from '@victframework/ui';

export const FIXTURE_STORE_KEY = 'vict.u2.fixture.doc';

type AnyNode = UiDocument['nodes'][string];

function box(
  id: string,
  tag: 'div',
  label: string,
  styleSource: string,
  children: string[] = [],
): { node: AnyNode; textId: string } {
  const textId = `${id}Text`;
  return {
    textId,
    node: {
      kind: 'element',
      id,
      tag,
      styleSources: [styleSource],
      children: [textId],
    } as AnyNode,
  };
}

export const fixtureDocument: UiDocument = (() => {
  const nodes: Record<string, AnyNode> = {
    'fx.root': {
      kind: 'element',
      id: 'fx.root',
      tag: 'div',
      styleSources: ['fsrc.canvas'],
      children: ['fx.canvasTitle', 'fx.graph', 'fx.legend'],
    },
    'fx.canvasTitle': {
      kind: 'element',
      id: 'fx.canvasTitle',
      tag: 'p',
      styleSources: ['fsrc.canvasTitle'],
      children: ['fx.canvasTitleText'],
    },
    'fx.canvasTitleText': {
      kind: 'text',
      id: 'fx.canvasTitleText',
      content: {
        type: 'literal',
        value:
          'Fixture canvas — presentation sample (boxes and connectors carry no workflow semantics)',
      },
    },
    'fx.graph': {
      kind: 'element',
      id: 'fx.graph',
      tag: 'div',
      styleSources: ['fsrc.graph'],
      children: [
        'fx.boxIntake',
        'fx.edgeIntakeTriage',
        'fx.boxTriage',
        'fx.edgeTriageReview',
        'fx.boxReview',
        'fx.edgeReviewArchive',
        'fx.boxArchive',
        'fx.boxNotesColumn',
      ],
    },
  };

  const spec: {
    id: string;
    label: string;
    source: string;
    edges?: string[];
  }[] = [
    { id: 'fx.boxIntake', label: 'Intake — requests arrive by post and online form', source: 'fsrc.box' },
    { id: 'fx.boxTriage', label: 'Triage — two clerks sort the week’s pile into priority bands', source: 'fsrc.box' },
    {
      id: 'fx.boxReview',
      label: 'Review panel — meets Thursdays; quorum is three including the chair',
      source: 'fsrc.box',
    },
    {
      id: 'fx.boxArchive',
      label: 'Archive — closed cases are boxed, barcoded and stored for seven years',
      source: 'fsrc.box',
    },
    {
      id: 'fx.boxNotesColumn',
      label:
        'Margin notes — the fixture canvas is a PRESENTATION sample: shapes and labels only, no live operator controls',
      source: 'fsrc.notes',
    },
  ];
  for (const item of spec) {
    const textId = `${item.id}Text`;
    nodes[item.id] = {
      kind: 'element',
      id: item.id,
      tag: 'div',
      styleSources: [item.source],
      children: [textId],
    };
    nodes[textId] = { kind: 'text', id: textId, content: { type: 'literal', value: item.label } };
  }
  const edges: { id: string; label: string }[] = [
    { id: 'fx.edgeIntakeTriage', label: 'sorted into' },
    { id: 'fx.edgeTriageReview', label: 'presented to' },
    { id: 'fx.edgeReviewArchive', label: 'closed to' },
  ];
  for (const edge of edges) {
    nodes[edge.id] = {
      kind: 'element',
      id: edge.id,
      tag: 'div',
      styleSources: ['fsrc.edge'],
      children: [`${edge.id}Text`],
    };
    nodes[`${edge.id}Text`] = {
      kind: 'text',
      id: `${edge.id}Text`,
      content: { type: 'literal', value: edge.label },
    };
  }
  nodes['fx.legend'] = {
    kind: 'element',
    id: 'fx.legend',
    tag: 'div',
    styleSources: ['fsrc.legend'],
    children: ['fx.legendText'],
  };
  nodes['fx.legendText'] = {
    kind: 'text',
    id: 'fx.legendText',
    content: {
      type: 'literal',
      value:
        'Reading the fixture: tall boxes are stages, thin bars are connectors. Try the narrow size — the column stacks and the labels wrap.',
    },
  };

  return {
    schema: 'vict.ui-document@1',
    id: 'doc.fixture',
    revision: '1',
    root: 'fx.root',
    tokens: {
      'color.ink': { id: 'color.ink', value: '#20242c' },
      'color.muted': { id: 'color.muted', value: '#667085' },
      'color.paper': { id: 'color.paper', value: '#f6f7f9' },
      'color.card': { id: 'color.card', value: '#ffffff' },
      'color.line': { id: 'color.line', value: '#cdd3dd' },
      'color.accent': { id: 'color.accent', value: '#33529f' },
      'space.sm': { id: 'space.sm', value: '8px' },
      'space.md': { id: 'space.md', value: '14px' },
      'space.lg': { id: 'space.lg', value: '24px' },
      'radius.md': { id: 'radius.md', value: '8px' },
    },
    conditions: {
      'cond.fxStack': { id: 'cond.fxStack', kind: 'media', query: '(max-width: 900px)' },
    },
    styleSources: {
      'fsrc.canvas': {
        id: 'fsrc.canvas',
        declarations: [
          { property: 'padding', value: { type: 'token', id: 'space.lg' } },
          { property: 'color', value: { type: 'token', id: 'color.ink' } },
          { property: 'font-family', value: { type: 'text', value: 'system-ui, sans-serif' } },
        ],
      },
      'fsrc.canvasTitle': {
        id: 'fsrc.canvasTitle',
        declarations: [
          { property: 'margin', value: { type: 'text', value: '0 0 16px' } },
          { property: 'color', value: { type: 'token', id: 'color.muted' } },
          { property: 'font-size', value: { type: 'text', value: '13px' } },
        ],
      },
      'fsrc.graph': {
        id: 'fsrc.graph',
        declarations: [
          { property: 'display', value: { type: 'text', value: 'grid' } },
          { property: 'grid-template-columns', value: { type: 'text', value: 'minmax(260px, 1.4fr) 1fr' } },
          { property: 'gap', value: { type: 'token', id: 'space.md' } },
          { property: 'align-items', value: { type: 'text', value: 'start' } },
        ],
        conditionId: 'cond.fxStack',
      },
      'fsrc.box': {
        id: 'fsrc.box',
        declarations: [
          { property: 'background', value: { type: 'token', id: 'color.card' } },
          { property: 'border', value: { type: 'text', value: '1px solid var(--ui-token-color_line)' } },
          { property: 'border-left', value: { type: 'text', value: '4px solid var(--ui-token-color_accent)' } },
          { property: 'border-radius', value: { type: 'token', id: 'radius.md' } },
          { property: 'padding', value: { type: 'token', id: 'space.md' } },
          { property: 'font-size', value: { type: 'text', value: '14px' } },
          { property: 'line-height', value: { type: 'text', value: '1.45' } },
          { property: 'overflow-wrap', value: { type: 'text', value: 'anywhere' } },
        ],
      },
      'fsrc.notes': {
        id: 'fsrc.notes',
        declarations: [
          { property: 'background', value: { type: 'token', id: 'color.paper' } },
          { property: 'border', value: { type: 'text', value: '1px dashed var(--ui-token-color_line)' } },
          { property: 'border-radius', value: { type: 'token', id: 'radius.md' } },
          { property: 'padding', value: { type: 'token', id: 'space.md' } },
          { property: 'font-size', value: { type: 'text', value: '13px' } },
          { property: 'color', value: { type: 'token', id: 'color.muted' } },
          { property: 'grid-column', value: { type: 'text', value: '2' } },
          { property: 'grid-row', value: { type: 'text', value: '1 / span 7' } },
        ],
      },
      'fsrc.edge': {
        id: 'fsrc.edge',
        declarations: [
          { property: 'display', value: { type: 'text', value: 'flex' } },
          { property: 'align-items', value: { type: 'text', value: 'center' } },
          { property: 'gap', value: { type: 'text', value: '8px' } },
          { property: 'color', value: { type: 'token', id: 'color.muted' } },
          { property: 'font-size', value: { type: 'text', value: '12px' } },
        ],
      },
      'fsrc.legend': {
        id: 'fsrc.legend',
        declarations: [
          { property: 'margin-top', value: { type: 'token', id: 'space.lg' } },
          { property: 'font-size', value: { type: 'text', value: '13px' } },
          { property: 'color', value: { type: 'token', id: 'color.muted' } },
        ],
      },
    },
    componentDefinitions: {},
    assets: {},
    localState: {},
  } as unknown as UiDocument;
})();
