import {
  createUiAuthoringRegistry, materializeAuthoringFragment, authoringSemanticIssues,
  compileUiDocument, defaultSemanticElementCatalog, canonicalUiDocument,
  type UiDocument, type UiNode, type DocumentStorePort,
} from '@victframework/ui';
import { catalogAuthoringPackage, catalogImplementations, validateSvelteComponentPlan } from '@victframework/ui-svelte';
import { aiAuthoringPackage, aiAuthoringImplementations } from '@victframework/ui-ai-svelte/authoring';
import { flowAuthoringPackage, flowAuthoringImplementations } from '@victframework/ui-flow-svelte/authoring';
import { EditorBridge, insertRegisteredComponent, wireNativeInput } from '@victframework/ui-editor';
declare const __CONSUMER_SOURCE__: string;

export const implementations = [...catalogImplementations, ...aiAuthoringImplementations, ...flowAuthoringImplementations];
export const registry = createUiAuthoringRegistry([catalogAuthoringPackage, aiAuthoringPackage, flowAuthoringPackage], implementations, { requireCompatibility: true });
export const elements = defaultSemanticElementCatalog();
const hostCapabilities = ['vict.flow.canvas-context@1'];
const chat = materializeAuthoringFragment(aiAuthoringPackage.registrations.find(item => item.descriptor.id === 'vict.ai.conversation')!.seed!, 'chat');
const flow = materializeAuthoringFragment(flowAuthoringPackage.registrations.find(item => item.descriptor.id === 'vict.flow.canvas')!.seed!, 'flow');
const prompt = chat.nodes.find(node => node.kind === 'component' && node.definitionId === 'vict.ai.prompt-input')!;
const initial: UiDocument = {
  schema: 'vict.ui-document@1', id: 'public-consumer', revision: '1', root: 'root',
  nodes: Object.fromEntries([
    { kind: 'element', id: 'root', tag: 'div', children: ['recipient-label', 'recipient-input', 'recipient-text', chat.root, flow.root] },
    { kind: 'element', id: 'recipient-label', tag: 'label', attributes: { for: 'consumer-recipient' }, children: ['recipient-caption'] },
    { kind: 'text', id: 'recipient-caption', content: { type: 'literal', value: 'Recipient (native input and text reference)' } },
    { kind: 'element', id: 'recipient-input', tag: 'input', attributes: { id: 'consumer-recipient', type: 'text' }, children: [] },
    { kind: 'text', id: 'recipient-text', content: { type: 'expression', expression: { type: 'ref', path: 'state.recipient' } } },
    ...chat.nodes.map(node => node.id === prompt.id && node.kind === 'component' ? { ...node, outputs: { ...node.outputs, send: { setState: { key: 'lastSent' } } } } : node), ...flow.nodes,
  ].map(node => [node.id, node as UiNode])),
  componentDefinitions: {}, styleSources: {}, tokens: {}, conditions: {}, assets: {},
  localState: { ...chat.localState, recipient: { key: 'recipient', type: 'string', initial: 'Avery' }, lastSent: { key: 'lastSent', type: 'string', initial: '' },
    date: { key: 'date', type: 'isoDate', initial: '2026-10-24' }, time: { key: 'time', type: 'isoTime', initial: '09:30' },
    labels: { key: 'labels', type: 'stringList', initial: ['Alpha', 'Beta'] }, points: { key: 'points', type: 'numberList', initial: [10, 20] } },
};
let stored = JSON.stringify(initial), storedRevision = '1';
const store: DocumentStorePort = {
  load: () => ({ status: 'loaded', document: JSON.parse(stored), storedRevision }),
  save(input) {
    if (input.expectedStoredRevision !== storedRevision) return { ok: false, code: 'UI_DOC_STALE_REVISION', reason: 'Memory store revision changed.' };
    stored = JSON.stringify(input.document); storedRevision = input.newStoredRevision;
    return { ok: true, storedRevision };
  },
};
export const bridge = new EditorBridge({ store, initial: { document: initial, storedRevision },
  validateDocument: (document, previous) => authoringSemanticIssues(document, registry, { previous, hostCapabilities }),
});
export function insertButton() {
  return bridge.apply(insertRegisteredComponent({ requestId: crypto.randomUUID(), registry, nodeId: 'inserted-button', definitionId: 'vict.catalog.button', revision: '1', props: { label: { type: 'literal', value: 'Inserted through the public helper' } }, target: { nodeId: 'root' } }));
}
export function runSourceProof() {
  const checks: { name: string; passed: boolean; detail: string }[] = [];
  const check = (name: string, passed: boolean, detail = '') => checks.push({ name, passed, detail });
  check('strict installed registry', registry.ok, `${registry.contracts.length} pinned contracts across ${registry.packages.length} packages`);
  const compiled = compileUiDocument(initial, elements, registry.descriptors);
  check('initial canonical compilation without error diagnostics', compiled.ok && !compiled.plan.diagnostics.some(issue => issue.severity === 'error'), JSON.stringify(compiled.ok ? compiled.plan.diagnostics : compiled.issues));
  check('exact renderer ABI and slot preflight', compiled.ok && validateSvelteComponentPlan(compiled.plan, registry.descriptors, implementations).length === 0);
  const wired = bridge.apply(wireNativeInput({ requestId: 'consumer-native-wire', document: bridge.document, nodeId: 'recipient-input', key: 'recipient', initial: 'Avery' }));
  check('public native input wiring', wired.ok);
  const before = canonicalUiDocument(bridge.document).contentDigest;
  check('generic registered insertion', insertButton().ok && !!bridge.document.nodes['inserted-button']);
  check('Undo restores exact source digest', bridge.undo().ok && canonicalUiDocument(bridge.document).contentDigest === before);
  check('Redo restores insertion', bridge.redo().ok && !!bridge.document.nodes['inserted-button']);
  check('canonical remove', bridge.apply({ requestId: 'consumer-remove', commands: [{ op: 'remove', nodeId: 'inserted-button', detachFromParent: true }] }).ok && !bridge.document.nodes['inserted-button']);
  check('Undo restores removed node', bridge.undo().ok && !!bridge.document.nodes['inserted-button']);
  const finish = Object.values(bridge.document.nodes).find(node => node.kind === 'component' && node.definitionId === 'vict.flow.node' && node.props?.id?.type === 'literal' && node.props.id.value === 'finish');
  if (finish?.kind === 'component') {
    const current = bridge.document, digest = canonicalUiDocument(current).contentDigest;
    const invalid = { ...current, nodes: { ...current.nodes, [finish.id]: { ...finish, props: { ...finish.props, id: { type: 'literal' as const, value: 'start' } } } } };
    const refused = bridge.apply({ requestId: 'consumer-invalid-duplicate', commands: [{ op: 'replaceDocument', document: invalid }] });
    check('new duplicate Flow identity is refused atomically', !refused.ok && canonicalUiDocument(bridge.document).contentDigest === digest);
  }
  const saved = bridge.save(); check('explicit memory Save', saved.ok);
  const savedDigest = canonicalUiDocument(bridge.document).contentDigest;
  check('explicit memory reopen preserves canonical source', bridge.reopen().ok && canonicalUiDocument(bridge.document).contentDigest === savedDigest);
  check('typed date/time/list initials retained', bridge.document.localState.date?.type === 'isoDate' && bridge.document.localState.time?.type === 'isoTime' && bridge.document.localState.labels?.type === 'stringList' && bridge.document.localState.points?.type === 'numberList');
  return { sourceCandidate: __CONSUMER_SOURCE__, checks, passed: checks.every(item => item.passed), sourceDigest: savedDigest, nodeCount: Object.keys(bridge.document.nodes).length, stateCount: Object.keys(bridge.document.localState).length, registryContracts: registry.contracts.length, frameworkPackagesInstalled: 8,
    boundary: 'Public installed packages only. Source helper checks are local; browser interactions are verified separately. Save/reopen uses a disposable in-memory revision-checked store. Provider/shell/workflow execution is absent.' };
}
