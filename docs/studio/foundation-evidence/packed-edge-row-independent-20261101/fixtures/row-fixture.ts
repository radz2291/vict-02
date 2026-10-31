import { compileUiDocument, defaultSemanticElementCatalog, createUiAuthoringRegistry, type UiDocument, type UiNode } from '@victframework/ui';
import { flowAuthoringPackage, flowAuthoringDescriptors, flowAuthoringImplementations } from '@victframework/ui-flow-svelte/authoring';
import { parseGraph, parseGraphV2, parseGraphV3 } from '@victframework/ui-flow-svelte';

export const descriptors = flowAuthoringDescriptors, implementations = flowAuthoringImplementations;
export const registry = createUiAuthoringRegistry([flowAuthoringPackage], implementations, { requireCompatibility: true });
const literal = (value: string | number | boolean) => ({ type: 'literal' as const, value });
export function rowSource(version: 1 | 2 | 3 = 3, options: { unsafe?: boolean; missing?: boolean; duplicate?: boolean; readOnly?: boolean; hideType?: boolean } = {}): UiDocument {
  const ports = [{ id: 'incoming', label: 'Source material', direction: 'input', type: 'text' }, { id: 'outgoing', label: 'Reviewed result', direction: 'output', type: 'text' }];
  const typed = { parameters: { title: { type: 'string', default: 'Task' } } }, legacy = { fields: [{ id: 'title', label: 'Title', kind: 'text', default: 'Task' }] };
  const graph = { schema: `vict.flow-graph@${version}`, revision: 0, nodeTypes: [{ id: 'task', label: 'Task', ...(version === 1 ? legacy : typed), ports }], nodes: [
    { id: 'alpha', type: 'task', label: 'Alpha', position: { x: 20, y: 20 }, values: { title: 'Original alpha' } },
    { id: 'beta', type: 'task', label: 'Beta', position: { x: 360, y: 20 }, values: { title: 'Original beta' }, ports: [{ id: 'incoming', label: 'Local prompt override', direction: 'input', type: 'text', maxConnections: 2 }, { id: 'outgoing', label: 'Local produced bytes', direction: 'output', type: 'number' }] },
  ], edges: [{ id: 'shared-edge', source: 'alpha', sourcePort: 'outgoing', target: 'beta', targetPort: 'incoming' }] };
  const source = JSON.stringify(graph), parsed = version === 3 ? parseGraphV3(source) : version === 2 ? parseGraphV2(source) : parseGraph(source);
  if (!parsed.ok) throw Error(JSON.stringify(parsed));
  const nodes: Record<string, UiNode> = {
    workspace: { kind: 'component', id: 'workspace', definitionId: 'vict.flow.workspace', revision: String(version), props: { graph: { type: 'ref', path: 'state.graph' }, readOnly: literal(options.readOnly === true) }, outputs: { graphChange: { setState: { key: 'graph' } } }, slots: {
      content: { name: 'content', children: ['viewport'], scope: { schema: 'vict.ui-slot-scope@1', props: [] } },
      body: { name: 'body', children: ['card'], scope: { schema: 'vict.ui-slot-scope@1', props: [{ name: 'nodeId', type: 'string' }] } },
    } },
    viewport: { kind: 'component', id: 'viewport', definitionId: 'vict.flow.viewport', revision: String(version), props: { height: literal(380) } },
    card: { kind: 'element', id: 'card', tag: 'section', children: ['heading', 'incoming-row', 'outgoing-row', ...(options.duplicate ? ['bare-duplicate'] : [])] },
    heading: { kind: 'text', id: 'heading', content: literal('Installed semantic port rows') },
    'incoming-row': { kind: 'component', id: 'incoming-row', definitionId: 'vict.flow.port-row', revision: '1', props: { id: literal(options.missing ? 'not-declared' : 'incoming'), color: literal(options.unsafe ? 'url(https://invalid.example/paint)' : '#1a8'), showType: literal(!options.hideType) }, slots: { content: { name: 'content', children: ['annotation'] } } },
    annotation: { kind: 'text', id: 'annotation', content: literal('Own ordinary annotation') },
    'outgoing-row': { kind: 'component', id: 'outgoing-row', definitionId: 'vict.flow.port-row', revision: '1', props: { id: literal('outgoing'), color: literal('token:accent') } },
  };
  if (options.duplicate) nodes['bare-duplicate'] = { kind: 'component', id: 'bare-duplicate', definitionId: 'vict.flow.port', revision: String(version), props: { id: literal('incoming') } };
  return { schema: 'vict.ui-document@1', id: `packed-port-rows-${version}`, revision: '1', root: 'workspace', nodes, localState: { graph: { key: 'graph', type: 'string', initial: source } }, componentDefinitions: {}, styleSources: {}, assets: {}, conditions: {}, tokens: {}, theme: { schema: 'vict.ui-theme@1', roles: { surface: '#fff', text: '#123', border: '#bcd', accent: '#175' } } };
}
export function compile(source: UiDocument) {
  const compiled = compileUiDocument(source, defaultSemanticElementCatalog(), descriptors);
  if (!compiled.ok) throw Error(JSON.stringify(compiled));
  return compiled.plan;
}
