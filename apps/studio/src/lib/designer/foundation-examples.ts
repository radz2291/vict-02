/** Offline reference applications authored through the public Studio agent edit boundary.
 * These fixtures prove exposed contracts; they make no live-model, device or processing-engine claim. */
import type { UiDocument } from '@victframework/ui';
import { emptyGraph, serializeGraph, applyGraphOperations } from '@victframework/ui-flow-svelte';
import { newScreen } from './application.js';
import { documentCursor, prepareAgentEdit, type AgentEdit } from './agent-edits.js';

export type FoundationExample = 'responsive' | 'chat' | 'graph';
export const FOUNDATION_EPOCH = '269986a4-3865-4667-8749-f61a57369cd0';
export function authorFoundationBatches(
  title: string,
  id: string,
  batches: readonly AgentEdit['operations'][],
): UiDocument {
  let source = newScreen(title, id);
  for (const [index, operations] of batches.entries()) {
    const cursor = documentCursor(source, `${source.revision}#${index}`, FOUNDATION_EPOCH);
    const result = prepareAgentEdit(
      source,
      cursor,
      {
        expectedRevision: cursor.revision,
        reason: `Author ${title}: part ${index + 1}`,
        operations,
      },
      `foundation-${id}-${index}`,
    );
    if (!result.ok)
      throw Error(
        `${id} batch ${index}: ${result.code}: ${result.message}; ${JSON.stringify(result.diagnostics ?? [])}`,
      );
    source = result.document;
  }
  return source;
}
const brand = JSON.stringify({
  schema: 'vict.vector@1',
  viewBox: '0 0 64 64',
  nodes: [
    { tag: 'circle', attributes: { cx: 32, cy: 32, r: 28, fill: '#14b8a6' } },
    {
      tag: 'path',
      attributes: { d: 'M18 32 28 42 46 22', fill: 'none', stroke: '#082f49', 'stroke-width': 6 },
    },
  ],
});
export function responsiveFoundationExample(id = 'foundation-responsive'): UiDocument {
  return authorFoundationBatches('Adaptive field journal', id, [
    [
      { op: 'theme', role: 'surface', value: '#102331' },
      { op: 'theme', role: 'text', value: '#f5f8fa' },
      { op: 'theme', role: 'accent', value: '#14b8a6' },
      { op: 'theme', role: 'accentText', value: '#082f49' },
      {
        op: 'style',
        nodeId: 'screen',
        property: 'background-color',
        value: { type: 'text', value: '#102331' },
      },
      {
        op: 'style',
        nodeId: 'screen',
        property: 'color',
        value: { type: 'text', value: '#f5f8fa' },
      },
      {
        op: 'style',
        nodeId: 'screen',
        property: 'padding',
        value: { type: 'text', value: '24px' },
      },
      { op: 'declareCondition', id: 'phone-layout', kind: 'media', query: '(max-width: 600px)' },
      {
        op: 'style',
        nodeId: 'screen',
        property: 'padding',
        value: { type: 'text', value: '12px' },
        conditionId: 'phone-layout',
      },
      { op: 'declareState', key: 'menuOpen', type: 'boolean', initial: false },
      { op: 'declareState', key: 'section', type: 'string', initial: 'Notes' },
      { op: 'declareState', key: 'query', type: 'string', initial: '' },
      { op: 'declareState', key: 'slide', type: 'number', initial: 0 },
      { op: 'declareState', key: 'offerDismissed', type: 'boolean', initial: false },
      {
        op: 'insert',
        kind: 'element',
        nodeId: 'heading',
        parentId: 'screen',
        tag: 'h1',
        text: 'Field journal',
      },
      {
        op: 'insert',
        kind: 'component',
        nodeId: 'brand',
        parentId: 'screen',
        componentId: 'vict.media.vector',
        revision: '1',
        props: { data: brand, label: 'Field journal mark', decorative: false },
      },
      {
        op: 'insert',
        kind: 'component',
        nodeId: 'drawer',
        parentId: 'screen',
        componentId: 'vict.pattern.drawer',
        revision: '1',
        props: { title: 'Journal navigation', triggerLabel: 'Open journal navigation' },
      },
      {
        op: 'insert',
        kind: 'component',
        nodeId: 'menuIcon',
        parentId: 'drawer',
        slotName: 'trigger',
        componentId: 'vict.media.icon',
        revision: '1',
        props: { name: 'menu', decorative: true },
      },
      {
        op: 'insert',
        kind: 'component',
        nodeId: 'navigation',
        parentId: 'drawer',
        slotName: 'body',
        componentId: 'vict.pattern.navigation',
        revision: '1',
        props: { items: ['Notes', 'Saved', 'Settings'], values: ['Notes', 'Saved', 'Settings'] },
      },
      {
        op: 'bind',
        nodeId: 'drawer',
        prop: 'open',
        expression: { type: 'ref', path: 'state.menuOpen' },
      },
      {
        op: 'connect',
        nodeId: 'drawer',
        output: 'openChange',
        binding: { setState: { key: 'menuOpen' } },
      },
      {
        op: 'bind',
        nodeId: 'navigation',
        prop: 'selected',
        expression: { type: 'ref', path: 'state.section' },
      },
      {
        op: 'connect',
        nodeId: 'navigation',
        output: 'activate',
        binding: { setState: { key: 'section' } },
      },
      {
        op: 'insert',
        kind: 'text',
        nodeId: 'activeSection',
        parentId: 'screen',
        expression: { type: 'ref', path: 'state.section' },
      },
    ],
    [
      {
        op: 'insert',
        kind: 'component',
        nodeId: 'notes',
        parentId: 'screen',
        componentId: 'vict.pattern.filtered-list',
        revision: '1',
        props: {
          label: 'Journal notes',
          items: ['Forest walk', 'Harbour sketch', 'Mountain observations'],
        },
      },
      {
        op: 'bind',
        nodeId: 'notes',
        prop: 'query',
        expression: { type: 'ref', path: 'state.query' },
      },
      {
        op: 'connect',
        nodeId: 'notes',
        output: 'queryChange',
        binding: { setState: { key: 'query' } },
      },
      {
        op: 'insert',
        kind: 'component',
        nodeId: 'gallery',
        parentId: 'screen',
        componentId: 'vict.pattern.carousel',
        revision: '1',
        props: {
          label: 'Field highlights',
          slides: ['Morning light', 'Harbour colours', 'Mountain route'],
          labels: ['Morning', 'Harbour', 'Mountain'],
        },
      },
      {
        op: 'bind',
        nodeId: 'gallery',
        prop: 'index',
        expression: { type: 'ref', path: 'state.slide' },
      },
      {
        op: 'connect',
        nodeId: 'gallery',
        output: 'indexChange',
        binding: { setState: { key: 'slide' } },
      },
      {
        op: 'insert',
        kind: 'component',
        nodeId: 'firstVisit',
        parentId: 'screen',
        componentId: 'vict.pattern.first-visit',
        revision: '1',
        props: {
          applicationId: id,
          campaignId: 'welcome-1',
          dismissLabel: 'Remember welcome dismissal',
        },
      },
      {
        op: 'insert',
        kind: 'element',
        nodeId: 'welcome',
        parentId: 'firstVisit',
        slotName: 'body',
        tag: 'p',
        text: 'Welcome. Your dismissal is remembered in this browser.',
      },
      {
        op: 'bind',
        nodeId: 'firstVisit',
        prop: 'dismissed',
        expression: { type: 'ref', path: 'state.offerDismissed' },
      },
      {
        op: 'connect',
        nodeId: 'firstVisit',
        output: 'dismissedChange',
        binding: { setState: { key: 'offerDismissed' } },
      },
      {
        op: 'style',
        nodeId: 'drawer',
        part: 'panel',
        property: 'background-color',
        value: { type: 'text', value: '#102331' },
      },
      {
        op: 'style',
        nodeId: 'drawer',
        part: 'panel',
        property: 'color',
        value: { type: 'text', value: '#f5f8fa' },
      },
    ],
  ]);
}
export function chatFoundationExample(id = 'foundation-chat'): UiDocument {
  return authorFoundationBatches('Local chat composition', id, [
    [
      { op: 'theme', role: 'surface', value: '#122231' },
      { op: 'theme', role: 'text', value: '#f4f7fa' },
      {
        op: 'style',
        nodeId: 'screen',
        property: 'background-color',
        value: { type: 'text', value: '#122231' },
      },
      {
        op: 'style',
        nodeId: 'screen',
        property: 'color',
        value: { type: 'text', value: '#f4f7fa' },
      },
      { op: 'declareState', key: 'draft', type: 'string', initial: '' },
      {
        op: 'declareState',
        key: 'sent',
        type: 'string',
        initial: 'This is a local interaction fixture, without a connected AI service.',
      },
      {
        op: 'insert',
        kind: 'element',
        nodeId: 'heading',
        parentId: 'screen',
        tag: 'h1',
        text: 'Local chat composition',
      },
      {
        op: 'insert',
        kind: 'component',
        nodeId: 'conversation',
        parentId: 'screen',
        componentId: 'vict.ai.conversation',
        revision: '2',
        props: { label: 'Local chat' },
      },
      {
        op: 'insert',
        kind: 'component',
        nodeId: 'message',
        parentId: 'conversation',
        slotName: 'messages',
        componentId: 'vict.ai.message',
        revision: '2',
        props: { role: 'user' },
      },
      {
        op: 'bind',
        nodeId: 'message',
        prop: 'text',
        expression: { type: 'ref', path: 'state.sent' },
      },
      {
        op: 'insert',
        kind: 'component',
        nodeId: 'composer',
        parentId: 'conversation',
        slotName: 'composer',
        componentId: 'vict.ai.prompt-input',
        revision: '2',
        props: { label: 'Local message', placeholder: 'Write a local message' },
      },
      {
        op: 'bind',
        nodeId: 'composer',
        prop: 'value',
        expression: { type: 'ref', path: 'state.draft' },
      },
      {
        op: 'connect',
        nodeId: 'composer',
        output: 'valueChange',
        binding: { setState: { key: 'draft' } },
      },
      { op: 'connect', nodeId: 'composer', output: 'send', binding: { setState: { key: 'sent' } } },
      {
        op: 'style',
        nodeId: 'message',
        part: 'bubble',
        property: 'background-color',
        value: { type: 'text', value: '#234558' },
      },
      {
        op: 'style',
        nodeId: 'message',
        part: 'text',
        property: 'color',
        value: { type: 'text', value: '#f4f7fa' },
      },
      {
        op: 'style',
        nodeId: 'composer',
        part: 'field',
        property: 'background-color',
        value: { type: 'text', value: '#102331' },
      },
      {
        op: 'style',
        nodeId: 'composer',
        part: 'field',
        property: 'color',
        value: { type: 'text', value: '#f4f7fa' },
      },
    ],
  ]);
}
/** Historical saved-source fixture, not an available editor recipe or agent proof. */
export function graphFoundationExample(id = 'foundation-graph'): UiDocument {
  const result = applyGraphOperations(emptyGraph(), [
          {
            type: 'defineNodeType',
            definition: {
              id: 'research',
              label: 'Research note',
              fields: [
                { id: 'notes', label: 'Notes', kind: 'textarea', default: 'Initial observation' },
                {
                  id: 'bullets',
                  label: 'Evidence list',
                  kind: 'list',
                  default: ['Source A', 'Source B'],
                },
                {
                  id: 'confidence',
                  label: 'Confidence',
                  kind: 'slider',
                  default: 50,
                  min: 0,
                  max: 100,
                  step: 1,
                },
              ],
              ports: [
                {
                  id: 'in',
                  label: 'Evidence in',
                  direction: 'input',
                  type: 'text',
                  maxConnections: 2,
                },
                { id: 'out', label: 'Summary out', direction: 'output', type: 'text' },
              ],
            },
          },
          { type: 'addNode', id: 'observe', nodeType: 'research', position: { x: 40, y: 40 } },
          { type: 'addNode', id: 'synthesise', nodeType: 'research', position: { x: 440, y: 80 } },
          {
            type: 'connect',
            edge: {
              id: 'evidence',
              source: 'observe',
              sourcePort: 'out',
              target: 'synthesise',
              targetPort: 'in',
            },
          },
        ]);
  if (!result.ok) throw Error('Invalid retained legacy graph fixture');
  const doc = newScreen('Legacy research graph', id);
  return {...doc, nodes: {...doc.nodes,
    screen: {...doc.nodes.screen, children: ['graphEditor']} as UiDocument['nodes'][string],
    graphEditor: {kind:'component',id:'graphEditor',definitionId:'vict.flow.editor',revision:'1',
      props:{graph:{type:'ref',path:'state.graph'},height:{type:'literal',value:560}},
      outputs:{graphChange:{setState:{key:'graph'}}}},
  }, localState:{...doc.localState,graph:{key:'graph',type:'string',initial:serializeGraph(result.graph)}}};
}
export function foundationExample(kind: FoundationExample, id?: string): UiDocument {
  return kind === 'responsive'
    ? responsiveFoundationExample(id)
    : kind === 'chat'
      ? chatFoundationExample(id)
      : graphFoundationExample(id);
}
