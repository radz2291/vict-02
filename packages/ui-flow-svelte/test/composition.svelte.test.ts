import { describe, expect, it } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import { compileUiDocument, defaultSemanticElementCatalog, type UiDocument, type UiValue, type UiExtensionDescriptor } from '@victframework/ui';
import type { UiSvelteComponentImplementation } from '@victframework/ui-svelte';
import DocumentHost from '../../ui-svelte/src/document/DocumentHost.svelte';
import { catalogDescriptors, catalogImplementations } from '../../ui-svelte/src/catalog/components/catalog.js';
import { flowAuthoringDescriptors } from '../src/authoring/descriptors.js';
import { flowAuthoringImplementations } from '../src/authoring/implementations.js';
import { parseGraph } from '../src/editor/model.js';
import { compositionDocument } from './composition-fixtures.js';
import CustomControl from './CompositionCustomControl.svelte';
import CompositionHost from './CompositionHost.svelte';
import { type GraphEditorHost } from '../src/editor/host.js';
import { serializeGraph } from '../src/editor/model.js';
import { compositionGraph } from './composition-fixtures.js';

const descriptors = [...catalogDescriptors, ...flowAuthoringDescriptors];
const implementations = [...catalogImplementations, ...flowAuthoringImplementations];
const settle = async () => { flushSync(); await new Promise(resolve => setTimeout(resolve, 40)); flushSync(); };

async function open(source: UiDocument, extraDescriptors: UiExtensionDescriptor[] = [], extraImplementations: UiSvelteComponentImplementation[] = []) {
  const installedDescriptors = [...descriptors, ...extraDescriptors], installedImplementations = [...implementations, ...extraImplementations];
  const compiled = compileUiDocument(source, defaultSemanticElementCatalog(), installedDescriptors);
  expect(compiled.ok, JSON.stringify(compiled)).toBe(true);
  if (!compiled.ok) throw Error('Fixture did not compile');
  const target = document.createElement('div'); document.body.append(target);
  const writes: [string, UiValue][] = [], diagnostics: unknown[] = [];
  const app = mount(DocumentHost, { target, props: {
    plan: compiled.plan, localState: source.localState, extensionDescriptors: installedDescriptors,
    extensionImplementations: installedImplementations, dispatch: async () => undefined, navigate: () => {},
    onStateChange: (key, value) => writes.push([key, value]),
    onRenderDiagnostic: issue => diagnostics.push(issue),
  } });
  await settle();
  return { target, writes, diagnostics, async close() { await unmount(app); target.remove(); } };
}
function changedGraph(writes: readonly [string, UiValue][]) {
  const value = [...writes].reverse().find(([key]) => key === 'graph')?.[1];
  if (typeof value !== 'string') throw Error('No graph write');
  const parsed = parseGraph(value);
  if (!parsed.ok) throw Error(JSON.stringify(parsed.issues));
  return parsed.graph;
}
function click(target: Element, label: string) {
  const button = [...target.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === label);
  expect(button, label).toBeTruthy(); button!.click();
}
function change(target: Element, label: string, value: string) {
  const field = target.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[aria-label="${label}"]`);
  expect(field, label).toBeTruthy(); field!.value = value; field!.dispatchEvent(new Event('change', { bubbles: true }));
}
async function hosted(source: UiDocument, host: GraphEditorHost) {
  const target = document.createElement('div'); document.body.append(target);
  const writes: [string, UiValue][] = [], diagnostics: unknown[] = [];
  const app = mount(CompositionHost, { target, props: { source, host,
    onWrite: (key, value) => writes.push([key, value]), onDiagnostic: issue => diagnostics.push(issue),
  } });
  await settle();
  return { target, writes, diagnostics, supply: app.supply, async close() { await unmount(app); target.remove(); } };
}

describe('canonical application-owned graph composition', () => {
  it('renders distinct prompt/settings/output subtrees and app-chosen controls without editor chrome', async () => {
    const view = await open(compositionDocument('media'));
    try {
      expect(view.target.querySelectorAll('[data-graph-node]')).toHaveLength(4);
      const prompt = view.target.querySelector('[data-graph-node="prompt-a"]')!;
      const settings = view.target.querySelector('[data-graph-node="sampler"]')!;
      const output = view.target.querySelector('[data-graph-node="preview"]')!;
      expect(prompt.querySelector('textarea[aria-label="Shot prompt"]')).not.toBeNull();
      expect(settings.querySelector('input[type="number"]')).not.toBeNull();
      expect(output.querySelector('[role="switch"]')).not.toBeNull();
      expect(settings.querySelector('textarea')).toBeNull();
      expect(prompt.querySelector('[data-node-port="prompt-a/result"] textarea')).not.toBeNull();
      expect(settings.querySelector('[data-node-port="sampler/result"] input')).not.toBeNull();
      expect(prompt.querySelector('.vict-graph-drag-handle')).not.toBeNull();
      expect(prompt.querySelector('textarea')?.classList.contains('nodrag')).toBe(true);
      expect(view.target.querySelector('[aria-label="App chosen actions"]')?.textContent).toContain('Name opening shot');
      expect(view.target.querySelector('.graph-toolbar,.graph-inspector,[aria-label="Graph tools"],[aria-label="Graph selection"],.svelte-flow__controls,.svelte-flow__minimap')).toBeNull();
      for (const label of ['Node family', 'Connect or reconnect', 'Graph clipboard', 'Find nodes']) expect(view.target.textContent).not.toContain(label);
      expect(view.diagnostics).toEqual([]);
    } finally { await view.close(); }
  });

  it('isolates parameters by node and workspace, then emits a meaningful local node action', async () => {
    const source = compositionDocument('media'), one = await open(source), two = await open(compositionDocument('media', 'another-media'));
    try {
      const a = one.target.querySelector('[data-graph-node="prompt-a"]')!;
      const b = one.target.querySelector('[data-graph-node="prompt-b"]')!;
      change(a, 'Shot prompt', 'A deliberately changed opening'); await settle();
      const graph = changedGraph(one.writes);
      expect(graph.nodes.find(node => node.id === 'prompt-a')?.values.text).toBe('A deliberately changed opening');
      expect(graph.nodes.find(node => node.id === 'prompt-b')?.values.text).toBe('Dusk on the mountain');
      expect(graph.nodes.find(node => node.id === 'sampler')?.values.amount).toBe(24);
      expect(two.writes).toEqual([]);
      expect(two.target.querySelector<HTMLTextAreaElement>('[data-graph-node="prompt-a"] textarea')?.value).toBe('Sunrise over the harbor');
      expect(b.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe('Dusk on the mountain');
      click(a, 'Request shot review'); await settle();
      const receipt = one.writes.findLast(([key]) => key === 'intent')?.[1];
      expect(typeof receipt).toBe('string');
      expect(JSON.parse(receipt as string)).toEqual({ nodeId: 'prompt-a', nodeType: 'prompt', output: 'review', payload: 'A deliberately changed opening' });
      expect(one.writes.some(([key]) => ['text', 'amount', 'enabled'].includes(key))).toBe(false);
      expect(one.diagnostics).toEqual([]);
    } finally { await one.close(); await two.close(); }
  });

  it('lets an authored compact action perform a graph transaction and local history undo', async () => {
    const view = await open(compositionDocument('media'));
    try {
      click(view.target, 'Name opening shot'); await settle();
      expect(view.writes.some(([key]) => key === 'graph'), JSON.stringify({ diagnostics: view.diagnostics, alerts: [...view.target.querySelectorAll('[role="alert"]')].map(element => element.textContent) })).toBe(true);
      expect(changedGraph(view.writes).nodes.find(node => node.id === 'prompt-a')?.label).toBe('Named by app control');
      click(view.target, 'Undo local change'); await settle();
      const graph = changedGraph(view.writes);
      expect(graph.nodes.find(node => node.id === 'prompt-a')?.label).toBe('Opening shot');
      expect(graph.revision).toBe(2);
      expect(graph.edges).toHaveLength(2);
      expect(view.diagnostics).toEqual([]);
    } finally { await view.close(); }
  });

  it('renders a newly registered project control in node bodies without a flow component allowlist', async () => {
    const source = compositionDocument('media', 'new-component-composition');
    const control: UiExtensionDescriptor = {
      id: 'test.project.approval', revision: '1', abi: 'vict.ui-component-abi@1', events: ['vict.ui-component-abi@1'],
      rendererImplementationId: 'test.project.controls', styleTargets: ['root'],
      props: [{ name: 'label', type: 'string' }, { name: 'value', type: 'string' }, { name: 'disabled', type: 'boolean', default: false }],
      outputs: [{ name: 'approve', payload: 'string' }], slots: [],
    };
    const implementation: UiSvelteComponentImplementation = {
      extensionId: control.id, revision: '1', rendererImplementationId: control.rendererImplementationId!,
      abi: 'vict.ui-component-abi@1', styleTargets: ['root'], slots: [], component: CustomControl,
    };
    const modified: UiDocument = { ...source, nodes: { ...source.nodes,
      'prompt-card': { ...source.nodes['prompt-card'], children: ['prompt-title', 'prompt-port', 'project-control'] } as UiDocument['nodes'][string],
      'project-control': { kind: 'component', id: 'project-control', definitionId: control.id, revision: '1',
        props: { label: { type: 'literal', value: 'Approve this shot' }, value: { type: 'ref', path: 'state.text' }, disabled: { type: 'ref', path: 'prop.readOnly' } },
        outputs: { approve: { emit: { output: 'review', value: { type: 'ref', path: '$output' } } } } },
    } };
    // Remove the replaced, now-unreachable source node rather than permitting an
    // orphan in the canonical source. No flow implementation/registry list changes.
    const { review: _oldReview, ...reachableNodes } = modified.nodes;
    const view = await open({ ...modified, nodes: reachableNodes }, [control], [implementation]);
    try {
      const a = view.target.querySelector('[data-graph-node="prompt-a"]')!, b = view.target.querySelector('[data-graph-node="prompt-b"]')!;
      expect(view.target.querySelectorAll('[data-project-control]')).toHaveLength(2);
      expect(a.querySelector('[data-project-control] .vict-btn')).not.toBeNull();
      expect(a.querySelector('[data-project-control]')?.closest('[data-ui-owner]')).not.toBeNull();
      expect(b.querySelector('[data-project-control]')?.closest('[data-ui-owner]')).not.toBeNull();
      const css = [...document.querySelectorAll('style')].map(element => element.textContent).join('\n');
      expect(css).toContain('#142531'); // The app theme remains in canonical compiled CSS.
      click(a, 'Approve this shot'); await settle();
      expect(JSON.parse(view.writes.findLast(([key]) => key === 'intent')?.[1] as string)).toEqual({ nodeId: 'prompt-a', nodeType: 'prompt', output: 'review', payload: 'Sunrise over the harbor' });
      expect(view.writes.filter(([key]) => key === 'intent')).toHaveLength(1);
      expect(view.writes.filter(([key]) => key === 'graph')).toHaveLength(0);
      expect(view.diagnostics).toEqual([]);
    } finally { await view.close(); }
  });

  it('authors a different research application with private UI state and roundtrips its edited graph', async () => {
    const source = compositionDocument('research'), view = await open(source);
    let saved: UiDocument;
    try {
      expect(view.target.querySelectorAll('[data-graph-node]')).toHaveLength(2);
      expect(view.target.textContent).toContain('Keep the source address with the evidence.');
      expect(view.target.querySelector('textarea')).toBeNull();
      const gate = view.target.querySelector('[data-graph-node="gate-a"]')!;
      const local = gate.querySelector<HTMLButtonElement>('[role="switch"][aria-label="Show review notes"]')
        ?? [...gate.querySelectorAll<HTMLButtonElement>('[role="switch"]')].find(element => element.getAttribute('aria-label')?.includes('review notes'));
      // Shared switch labels may be linked with aria-labelledby rather than aria-label.
      const localSwitch = local ?? gate.querySelectorAll<HTMLButtonElement>('[role="switch"]')[1]!;
      localSwitch.click(); await settle();
      expect(localSwitch.getAttribute('aria-checked')).toBe('true');
      expect(view.writes).toEqual([]);
      change(gate, 'Confidence score', '85'); await settle();
      expect(gate.querySelectorAll('[role="switch"]')[1]?.getAttribute('aria-checked')).toBe('true');
      const graph = changedGraph(view.writes);
      expect(graph.nodes.find(node => node.id === 'gate-a')?.values.amount).toBe(85);
      expect(graph.nodes.find(node => node.id === 'gate-a')?.values.expanded).toBeUndefined();
      click(gate, 'Request editorial signoff'); await settle();
      expect(JSON.parse(view.writes.findLast(([key]) => key === 'intent')?.[1] as string)).toMatchObject({ nodeId: 'gate-a', output: 'review', payload: 'request-editorial-signoff' });
      const serializedGraph = view.writes.findLast(([key]) => key === 'graph')![1];
      saved = JSON.parse(JSON.stringify({ ...source, revision: '2', localState: { ...source.localState, graph: { key: 'graph', type: 'string', initial: serializedGraph } } }));
      expect(view.diagnostics).toEqual([]);
    } finally { await view.close(); }
    const reopened = await open(saved!);
    try {
      expect(reopened.target.querySelector<HTMLInputElement>('[aria-label="Confidence score"]')?.value).toBe('85');
      expect(reopened.target.querySelectorAll('[data-node-port]')).toHaveLength(3);
      // happy-dom has no measured node geometry. Assert the saved semantic edge;
      // actual wire painting/direct handle gestures require browser evidence.
      const restored = parseGraph(saved!.localState!.graph!.initial as string);
      expect(restored.ok && restored.graph.edges).toEqual([{ id: 'source-gate', source: 'source-a', sourcePort: 'result', target: 'gate-a', targetPort: 'source' }]);
      expect(reopened.diagnostics).toEqual([]);
    } finally { await reopened.close(); }
  });

  it('refuses app-chosen operations and undo in read-only mode even when the app leaves its buttons enabled', async () => {
    const original = compositionDocument('media'), nodes = { ...original.nodes };
    const workspace = nodes.workspace as Extract<UiDocument['nodes'][string], { kind: 'component' }>;
    nodes.workspace = { ...workspace, props: { ...workspace.props, readOnly: { type: 'literal', value: true } } };
    for (const id of ['rename', 'undo']) {
      const button = nodes[id] as Extract<UiDocument['nodes'][string], { kind: 'component' }>;
      nodes[id] = { ...button, props: { ...button.props, disabled: { type: 'literal', value: false } } };
    }
    let undoCalls = 0;
    const view = await hosted({ ...original, nodes }, { historyFor: () => ({ canUndo: () => true, canRedo: () => true, undo: () => { undoCalls++; }, redo: () => { throw Error('Unexpected redo'); } }) });
    try {
      click(view.target, 'Name opening shot'); click(view.target, 'Undo local change'); await settle();
      expect(view.writes.filter(([key]) => key === 'graph')).toEqual([]);
      expect(undoCalls).toBe(0);
      expect(view.target.querySelector('[data-graph-node="prompt-a"]')?.textContent).toContain('Opening shot');
      expect(view.target.querySelector('[role="alert"]')?.textContent).toContain('read-only');
    } finally { await view.close(); }
  });

  it('retains the previous valid graph and blocks edits after invalid or host-rejected source replacement', async () => {
    const view = await hosted(compositionDocument('media'), { historyFor: () => undefined,
      validate: (_identity, graph) => graph.nodes.some(node => node.label === 'Forbidden') ? [{ code: 'PROJECT_POLICY', path: 'nodes', message: 'Project label policy refused this graph.' }] : [],
    });
    try {
      view.supply('graph', '{not valid JSON'); await settle();
      expect(view.target.querySelectorAll('[data-graph-node]')).toHaveLength(4);
      const a = view.target.querySelector('[data-graph-node="prompt-a"]')!;
      change(a, 'Shot prompt', 'Must not commit while invalid'); click(a, 'Request shot review'); await settle();
      expect(view.writes.filter(([key]) => ['graph', 'intent'].includes(key))).toEqual([]);
      expect(view.target.querySelector('[role="alert"]')?.textContent).toContain('valid graph source');
      const rejected = compositionGraph('media'); rejected.nodes[0]!.label = 'Forbidden';
      view.supply('graph', serializeGraph(rejected)); await settle();
      expect(view.target.querySelector('[role="alert"]')?.textContent).toContain('Project label policy');
      expect(view.target.querySelector('[data-graph-node="prompt-a"]')?.textContent).toContain('Opening shot');
      click(view.target, 'Name opening shot'); await settle();
      expect(view.writes.filter(([key]) => key === 'graph')).toEqual([]);
      // Explicit valid source restoration re-enables normal graph parameter edits.
      view.supply('graph', serializeGraph(compositionGraph('media'))); await settle();
      change(view.target.querySelector('[data-graph-node="prompt-a"]')!, 'Shot prompt', 'Allowed after recovery'); await settle();
      expect(changedGraph(view.writes).nodes.find(node => node.id === 'prompt-a')?.values.text).toBe('Allowed after recovery');
    } finally { await view.close(); }
  });

  it('keeps active node callbacks after an unavailable host undo', async () => {
    let undoCalls = 0;
    const view = await hosted(compositionDocument('media'), { historyFor: () => ({ canUndo: () => false, canRedo: () => false, undo: () => { undoCalls++; }, redo: () => {} }) });
    try {
      const a = view.target.querySelector('[data-graph-node="prompt-a"]')!;
      click(view.target, 'Undo local change'); await settle();
      expect(undoCalls).toBe(0);
      change(a, 'Shot prompt', 'Still an active instance'); await settle();
      expect(changedGraph(view.writes).nodes.find(node => node.id === 'prompt-a')?.values.text).toBe('Still an active instance');
      click(view.target.querySelector('[data-graph-node="prompt-a"]')!, 'Request shot review'); await settle();
      expect(JSON.parse(view.writes.findLast(([key]) => key === 'intent')?.[1] as string)).toMatchObject({ nodeId: 'prompt-a', payload: 'Still an active instance' });
      expect(view.diagnostics).toEqual([]);
    } finally { await view.close(); }
  });

  it('recovers mutation and intent callbacks when restoring the last emitted graph after invalid source', async () => {
    const view = await hosted(compositionDocument('media'), { historyFor: () => undefined });
    try {
      change(view.target.querySelector('[data-graph-node="prompt-a"]')!, 'Shot prompt', 'First accepted edit'); await settle();
      const snapshotA = view.writes.findLast(([key]) => key === 'graph')?.[1];
      expect(typeof snapshotA).toBe('string');
      expect(changedGraph(view.writes).nodes.find(node => node.id === 'prompt-a')?.values.text).toBe('First accepted edit');
      view.supply('graph', '{invalid replacement'); await settle();
      change(view.target.querySelector('[data-graph-node="prompt-a"]')!, 'Shot prompt', 'Must remain refused'); await settle();
      expect(view.writes.filter(([key]) => key === 'graph')).toHaveLength(1);
      // This is exactly the last emitted value, not the original fixture source.
      view.supply('graph', snapshotA as string); await settle();
      expect(view.target.querySelector<HTMLInputElement>('[data-graph-node="prompt-a"] textarea')?.value).toBe('First accepted edit');
      change(view.target.querySelector('[data-graph-node="prompt-a"]')!, 'Shot prompt', 'Second accepted edit after recovery'); await settle();
      expect(view.writes.filter(([key]) => key === 'graph')).toHaveLength(2);
      expect(changedGraph(view.writes).nodes.find(node => node.id === 'prompt-a')?.values.text).toBe('Second accepted edit after recovery');
      click(view.target.querySelector('[data-graph-node="prompt-a"]')!, 'Request shot review'); await settle();
      expect(JSON.parse(view.writes.findLast(([key]) => key === 'intent')?.[1] as string)).toMatchObject({ nodeId: 'prompt-a', payload: 'Second accepted edit after recovery' });
      expect(view.diagnostics).toEqual([]);
    } finally { await view.close(); }
  });

  it('removes ambiguous duplicate port handles dynamically and restores the original anchor when resolved', async () => {
    const original = compositionDocument('media'), nodes = { ...original.nodes };
    const workspace = nodes.workspace as Extract<UiDocument['nodes'][string], { kind: 'component' }>;
    const body = workspace.slots!.body!;
    nodes.workspace = { ...workspace, slots: { ...workspace.slots, body: { ...body, scope: { ...body.scope!, conditions: { ...body.scope!.conditions, duplicate: { type: 'ref', path: 'state.expanded' } } } } } };
    nodes['prompt-card'] = { ...nodes['prompt-card'], children: ['prompt-title', 'prompt-port', 'review', 'duplicate-toggle', 'duplicate-branch'] } as UiDocument['nodes'][string];
    nodes['duplicate-toggle'] = { kind: 'component', id: 'duplicate-toggle', definitionId: 'vict.catalog.switch', revision: '1', props: { label: { type: 'literal', value: 'Duplicate socket for test' }, checked: { type: 'ref', path: 'state.expanded' } }, outputs: { checkedChange: { setState: { key: 'expanded' } } } };
    nodes['duplicate-branch'] = { kind: 'conditional', id: 'duplicate-branch', branches: [{ when: 'duplicate', children: ['duplicate-port'] }] };
    nodes['duplicate-port'] = { kind: 'component', id: 'duplicate-port', definitionId: 'vict.flow.port', revision: '1', props: { id: { type: 'literal', value: 'result' } } };
    const view = await open({ ...original, nodes });
    try {
      const a = view.target.querySelector('[data-graph-node="prompt-a"]')!, b = view.target.querySelector('[data-graph-node="prompt-b"]')!;
      expect(a.querySelectorAll('[data-node-port="prompt-a/result"]')).toHaveLength(1);
      a.querySelector<HTMLButtonElement>('[role="switch"]')!.click(); await settle();
      expect(a.querySelectorAll('[data-node-port="prompt-a/result"]')).toHaveLength(0);
      expect(a.querySelectorAll('.svelte-flow__handle')).toHaveLength(0);
      expect(a.textContent).toContain('duplicated');
      expect(b.querySelectorAll('[data-node-port="prompt-b/result"]')).toHaveLength(1);
      a.querySelector<HTMLButtonElement>('[role="switch"]')!.click(); await settle();
      expect(a.querySelectorAll('[data-node-port="prompt-a/result"]')).toHaveLength(1);
      expect(a.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe('Sunrise over the harbor');
      expect([...a.querySelectorAll('[role="alert"]')].filter(element => element.textContent?.trim())).toEqual([]);
      expect(view.writes).toEqual([]);
    } finally { await view.close(); }
  });
});
