import type { UiDocument, UiExpression, UiSlotScope } from '@victframework/ui';
import { serializeGraph, type GraphDocument } from '../src/editor/model.js';
import {migrateGraphV1ToV2} from '../src/editor/model-v2.js';

type Node = UiDocument['nodes'][string];
/** Supporting fixture only, never actual-agent authoring evidence. */
export function typedCompositionDocument(kind:'media'|'research',id=`typed-${kind}`):UiDocument {
  const source=compositionDocument(kind,id);
  const migrated=migrateGraphV1ToV2(compositionGraph(kind),{acknowledgeUnmappedConstraints:true});
  if(!migrated.ok)throw Error(JSON.stringify(migrated));
  for(const node of Object.values(source.nodes))if(node.kind==='component'&&['vict.flow.workspace','vict.flow.viewport','vict.flow.port'].includes(node.definitionId))node.revision='2';
  if(kind==='media'){
    migrated.graph.nodeTypes.find(type=>type.id==='settings')!.parameters.weights={type:'numberList',default:[24]};
    const workspace=source.nodes.workspace;if(workspace.kind!=='component')throw Error('Fixture workspace');
    workspace.slots!.body!.scope!.state!.weights={key:'weights',type:'numberList',initial:[0],controlled:true};
    const card=source.nodes['settings-card'];if(card.kind!=='element')throw Error('Fixture settings');card.children.push('weights-slider');
    source.nodes['weights-slider']={kind:'component',id:'weights-slider',definitionId:'vict.catalog.slider',revision:'1',props:{label:{type:'literal',value:'Node weights'},value:{type:'ref',path:'state.weights'},min:{type:'literal',value:0},max:{type:'literal',value:100}},outputs:{valueChange:{setState:{key:'weights'}}},classes:['nodrag','nopan','nowheel']};
  }
  source.localState.graph={key:'graph',type:'string',initial:JSON.stringify(migrated.graph)};
  return source;
}
const literal = (value: string | number | boolean): UiExpression => ({ type: 'literal', value });
const ref = (path: string): UiExpression => ({ type: 'ref', path });
const family = (name: string): UiExpression => ({ type: 'compare', op: 'eq', left: ref('prop.nodeType'), right: literal(name) });
const style = (property: string, value: string) => ({ property, value: { type: 'text' as const, value } });
const text = (id: string, value: string): Node => ({ kind: 'text', id, content: { type: 'literal', value } });
const element = (id: string, tag: string, children: string[], extra: object = {}): Node => ({ kind: 'element', id, tag, children, ...extra });
const component = (id: string, definitionId: string, extra: object = {}): Node => ({ kind: 'component', id, definitionId, revision: '1', ...extra });
const button = (id: string, label: string, output: string, value?: UiExpression): Node => component(id, 'vict.catalog.button', {
  props: { label: literal(label), disabled: ref('prop.readOnly') },
  outputs: { press: { emit: { output, ...(value ? { value } : {}) } } },
});
const port = (id: string, portId: string, children: string[]): Node => component(id, 'vict.flow.port', {
  props: { id: literal(portId) }, slots: { content: { name: 'content', children } },
});
const field = (id: string, label: string, key: string, type = 'text'): Node => element(id, type === 'textarea' ? 'textarea' : 'input', [], {
  attributes: { ...(type === 'textarea' ? {} : { type }), 'aria-label': label, value: ref(`state.${key}`), disabled: ref('prop.readOnly') },
  classes: [type === 'textarea' ? 'vict-textarea' : 'vict-input', 'nodrag', 'nopan', 'nowheel'],
  interactions: [{ on: 'change', action: 'setState', key, value: literal(type === 'number' ? 0 : '') }],
});

/** Two authored applications. These are fixture evidence, never actual-agent proof. */
export function compositionGraph(kind: 'media' | 'research'): GraphDocument {
  if (kind === 'media') return {
    schema: 'vict.flow-graph@1', revision: 0,
    nodeTypes: [
      { id: 'prompt', label: 'Prompt', fields: [{ id: 'text', label: 'Prompt', kind: 'textarea', default: '' }], ports: [{ id: 'result', label: 'Prompt', direction: 'output', type: 'text' }] },
      { id: 'settings', label: 'Sampler', fields: [{ id: 'amount', label: 'Steps', kind: 'number', default: 20, min: 1, max: 100 }], ports: [{ id: 'source', label: 'Prompt', direction: 'input', type: 'text' }, { id: 'result', label: 'Frame', direction: 'output', type: 'image' }] },
      { id: 'output', label: 'Preview', fields: [{ id: 'enabled', label: 'Preview enabled', kind: 'toggle', default: true }], ports: [{ id: 'source', label: 'Frame', direction: 'input', type: 'image' }] },
    ],
    nodes: [
      { id: 'prompt-a', type: 'prompt', label: 'Opening shot', position: { x: 0, y: 0 }, values: { text: 'Sunrise over the harbor' } },
      { id: 'prompt-b', type: 'prompt', label: 'Closing shot', position: { x: 0, y: 280 }, values: { text: 'Dusk on the mountain' } },
      { id: 'sampler', type: 'settings', label: 'Draft sampler', position: { x: 360, y: 0 }, values: { amount: 24 } },
      { id: 'preview', type: 'output', label: 'Review frame', position: { x: 650, y: 0 }, values: { enabled: true } },
    ],
    edges: [{ id: 'prompt-sampler', source: 'prompt-a', sourcePort: 'result', target: 'sampler', targetPort: 'source' }, { id: 'sampler-preview', source: 'sampler', sourcePort: 'result', target: 'preview', targetPort: 'source' }],
  };
  return {
    schema: 'vict.flow-graph@1', revision: 0,
    nodeTypes: [
      { id: 'source', label: 'Evidence source', fields: [{ id: 'text', label: 'URL', kind: 'text', default: '' }], ports: [{ id: 'result', label: 'Evidence', direction: 'output', type: 'evidence' }] },
      { id: 'gate', label: 'Review gate', fields: [{ id: 'enabled', label: 'Reviewed', kind: 'toggle', default: false }, { id: 'amount', label: 'Confidence', kind: 'number', default: 60, min: 0, max: 100 }], ports: [{ id: 'source', label: 'Evidence', direction: 'input', type: 'evidence' }, { id: 'result', label: 'Decision', direction: 'output', type: 'decision' }] },
    ],
    nodes: [
      { id: 'source-a', type: 'source', label: 'Primary source', position: { x: 0, y: 0 }, values: { text: 'https://example.com/report' } },
      { id: 'gate-a', type: 'gate', label: 'Editorial review', position: { x: 400, y: 0 }, values: { enabled: false, amount: 70 } },
    ],
    edges: [{ id: 'source-gate', source: 'source-a', sourcePort: 'result', target: 'gate-a', targetPort: 'source' }],
  };
}

export function compositionDocument(kind: 'media' | 'research', id = `composed-${kind}`): UiDocument {
  const bodyScope: UiSlotScope = {
    schema: 'vict.ui-slot-scope@1',
    props: [{ name: 'nodeId', type: 'string' }, { name: 'nodeType', type: 'string' }, { name: 'label', type: 'string' }, { name: 'readOnly', type: 'boolean' }],
    state: {
      text: { key: 'text', type: 'string', initial: '', controlled: true },
      amount: { key: 'amount', type: 'number', initial: 0, controlled: true },
      enabled: { key: 'enabled', type: 'boolean', initial: false, controlled: true },
      expanded: { key: 'expanded', type: 'boolean', initial: false },
    },
    outputs: [{ name: 'review', payload: 'string' }],
    conditions: Object.fromEntries((kind === 'media' ? ['prompt', 'settings', 'output'] : ['source', 'gate']).map(name => [name, family(name)])),
  };
  const nodes: Record<string, Node> = {
    workspace: component('workspace', 'vict.flow.workspace', {
      props: { graph: ref('state.graph'), label: literal(kind === 'media' ? 'Shot planning' : 'Evidence review') },
      outputs: { graphChange: { setState: { key: 'graph' } }, nodeAction: { setState: { key: 'intent' } }, operationResult: { setState: { key: 'operationResult' } } },
      slots: {
        content: { name: 'content', children: ['application'], scope: { schema: 'vict.ui-slot-scope@1', props: [{ name: 'readOnly', type: 'boolean' }, { name: 'nodeCount', type: 'number' }], outputs: [{ name: 'operation', payload: 'string' }, { name: 'undo', payload: 'void' }] } },
        body: { name: 'body', children: ['families'], scope: bodyScope },
      },
    }),
    application: element('application', 'section', kind === 'media' ? ['app-title', 'compact-actions', 'viewport'] : ['app-title', 'viewport', 'compact-actions'], { attributes: { 'aria-label': kind === 'media' ? 'Storyboard workspace' : 'Research notebook' } }),
    'app-title': text('app-title', kind === 'media' ? 'Plan a sequence' : 'Check evidence before approving'),
    'compact-actions': element('compact-actions', 'div', ['rename', 'undo'], { attributes: { 'aria-label': 'App chosen actions' } }),
    rename: button('rename', kind === 'media' ? 'Name opening shot' : 'Name primary source', 'operation', literal(JSON.stringify([{ type: 'setLabel', nodeId: kind === 'media' ? 'prompt-a' : 'source-a', label: kind === 'media' ? 'Named by app control' : 'Named source' }]))),
    undo: button('undo', 'Undo local change', 'undo'),
    viewport: component('viewport', 'vict.flow.viewport', { props: { height: literal(420), label: literal('Authored graph canvas') } }),
    families: { kind: 'conditional', id: 'families', branches: kind === 'media' ? [{ when: 'prompt', children: ['prompt-card'] }, { when: 'settings', children: ['settings-card'] }, { when: 'output', children: ['output-card'] }] : [{ when: 'source', children: ['source-card'] }, { when: 'gate', children: ['gate-card'] }] },
  };
  const title = (id: string): Node => element(id, 'header', [`${id}-label`], { classes: ['vict-graph-drag-handle'] });
  const titleText = (id: string): Node => ({ kind: 'text', id, content: { type: 'expression', expression: ref('prop.label') } });
  const card = (id: string, width: number, children: string[]): Node => element(id, 'article', children, { attributes: { 'aria-label': ref('prop.label') }, localStyle: [style('width', `${width}px`), style('padding', 'var(--vict-space-3,12px)'), style('background-color', 'var(--vict-color-surface)'), style('color', 'var(--vict-color-text)'), style('border', '1px solid var(--vict-color-border)')] });
  const switchNode = (id: string, key: string, label: string): Node => component(id, 'vict.catalog.switch', { props: { label: literal(label), checked: ref(`state.${key}`), disabled: ref('prop.readOnly') }, outputs: { checkedChange: { setState: { key } } } });
  if (kind === 'media') Object.assign(nodes, {
    'prompt-card': card('prompt-card', 290, ['prompt-title', 'prompt-port', 'review']),
    'prompt-title': title('prompt-title'), 'prompt-title-label': titleText('prompt-title-label'),
    'prompt-port': port('prompt-port', 'result', ['prompt-input']),
    'prompt-input': field('prompt-input', 'Shot prompt', 'text', 'textarea'),
    review: button('review', 'Request shot review', 'review', ref('state.text')),
    'settings-card': card('settings-card', 210, ['settings-title', 'settings-in', 'settings-out']),
    'settings-title': title('settings-title'), 'settings-title-label': titleText('settings-title-label'),
    'settings-in': port('settings-in', 'source', ['settings-caption']), 'settings-caption': text('settings-caption', 'Prompt input'),
    'settings-out': port('settings-out', 'result', ['steps-input']), 'steps-input': field('steps-input', 'Sampling steps', 'amount', 'number'),
    'output-card': card('output-card', 170, ['output-title', 'output-in', 'preview-status']),
    'output-title': title('output-title'), 'output-title-label': titleText('output-title-label'),
    'output-in': port('output-in', 'source', ['preview-toggle']), 'preview-toggle': switchNode('preview-toggle', 'enabled', 'Show preview'),
    'preview-status': text('preview-status', 'Frame awaiting local review'),
  });
  else Object.assign(nodes, {
    'source-card': card('source-card', 340, ['source-title', 'source-description', 'source-link', 'source-out']),
    'source-title': title('source-title'), 'source-title-label': titleText('source-title-label'),
    'source-description': text('source-description', 'Keep the source address with the evidence.'),
    'source-link': field('source-link', 'Evidence URL', 'text'),
    'source-out': port('source-out', 'result', ['source-caption']), 'source-caption': text('source-caption', 'Send evidence to a review gate'),
    'gate-card': card('gate-card', 230, ['gate-title', 'gate-in', 'gate-confidence', 'gate-local', 'gate-out', 'review']),
    'gate-title': component('gate-title', 'app.review-heading', { props: { caption: ref('prop.label') } }),
    'review-heading-root': element('review-heading-root', 'header', ['review-heading-caption'], { classes: ['vict-graph-drag-handle'] }),
    'review-heading-caption': { kind: 'text', id: 'review-heading-caption', content: { type: 'expression', expression: ref('prop.caption') } },
    'gate-in': port('gate-in', 'source', ['gate-reviewed']), 'gate-reviewed': switchNode('gate-reviewed', 'enabled', 'Evidence reviewed'),
    'gate-confidence': field('gate-confidence', 'Confidence score', 'amount', 'number'),
    'gate-local': switchNode('gate-local', 'expanded', 'Show review notes'),
    'gate-out': port('gate-out', 'result', ['gate-caption']), 'gate-caption': text('gate-caption', 'Editorial decision'),
    review: button('review', 'Request editorial signoff', 'review', literal('request-editorial-signoff')),
  });
  return {
    schema: 'vict.ui-document@1', id, revision: '1', root: 'workspace', nodes,
    componentDefinitions: kind === 'research' ? {
      'app.review-heading': { id: 'app.review-heading', revision: '1', root: 'review-heading-root', props: [{ name: 'caption', type: 'string' }], slots: {} },
    } : {}, styleSources: {}, tokens: {}, conditions: {}, assets: {},
    theme: { schema: 'vict.ui-theme@1', roles: { surface: kind === 'media' ? '#142531' : '#fcf8ee', text: kind === 'media' ? '#f5f7fa' : '#302a21', border: kind === 'media' ? '#324b60' : '#d8cbae', accent: kind === 'media' ? '#48bea9' : '#856527' } },
    localState: { graph: { key: 'graph', type: 'string', initial: serializeGraph(compositionGraph(kind)) }, intent: { key: 'intent', type: 'string', initial: '' }, operationResult: { key: 'operationResult', type: 'string', initial: '' } },
  };
}
