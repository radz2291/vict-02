import {
  createUiAuthoringRegistry, materializeAuthoringFragment, authoringSemanticIssues,
  compileUiDocument, defaultSemanticElementCatalog, canonicalUiDocument,
  type UiDocument, type UiNode, type UiStyleSource, type DocumentStorePort,
} from '@victframework/ui';
import { catalogAuthoringPackage, catalogImplementations, validateSvelteComponentPlan } from '@victframework/ui-svelte';
import { aiAuthoringPackage, aiAuthoringImplementations } from '@victframework/ui-ai-svelte/authoring';
import { flowAuthoringPackage, flowAuthoringImplementations } from '@victframework/ui-flow-svelte/authoring';
import { EditorBridge, insertRegisteredComponent, wireNativeInput, defineStyleSource, attachStyleSource, detachStyleSource, removeStyleSource, StyleSourceEditError } from '@victframework/ui-editor';
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
    { kind: 'element', id: 'root', tag: 'div', children: ['recipient-label', 'recipient-input', 'recipient-text', 'notes-label', 'notes-input', 'notes-text', 'choice-label', 'choice-input', 'choice-text', chat.root, flow.root] },
    { kind: 'element', id: 'recipient-label', tag: 'label', attributes: { for: 'consumer-recipient' }, children: ['recipient-caption'] },
    { kind: 'text', id: 'recipient-caption', content: { type: 'literal', value: 'Recipient (native input and text reference)' } },
    { kind: 'element', id: 'recipient-input', tag: 'input', attributes: { id: 'consumer-recipient', type: 'text' }, children: [] },
    { kind: 'text', id: 'recipient-text', content: { type: 'expression', expression: { type: 'ref', path: 'state.recipient' } } },
    { kind: 'element', id: 'notes-label', tag: 'label', attributes: { for: 'consumer-notes' }, children: ['notes-caption'] },
    { kind: 'text', id: 'notes-caption', content: { type: 'literal', value: 'Notes (native textarea and text reference)' } },
    { kind: 'element', id: 'notes-input', tag: 'textarea', attributes: { id: 'consumer-notes', rows: '3' }, children: [] },
    { kind: 'text', id: 'notes-text', content: { type: 'expression', expression: { type: 'ref', path: 'state.notes' } } },
    { kind: 'element', id: 'choice-label', tag: 'label', attributes: { for: 'consumer-choice' }, children: ['choice-caption'] },
    { kind: 'text', id: 'choice-caption', content: { type: 'literal', value: 'Choice (native select and text reference)' } },
    { kind: 'element', id: 'choice-input', tag: 'select', attributes: { id: 'consumer-choice' }, children: ['choice-alpha', 'choice-beta'] },
    { kind: 'element', id: 'choice-alpha', tag: 'option', attributes: { value: 'alpha' }, children: ['choice-alpha-text'] },
    { kind: 'text', id: 'choice-alpha-text', content: { type: 'literal', value: 'Alpha option' } },
    { kind: 'element', id: 'choice-beta', tag: 'option', attributes: { value: 'beta' }, children: ['choice-beta-text'] },
    { kind: 'text', id: 'choice-beta-text', content: { type: 'literal', value: 'Beta option' } },
    { kind: 'text', id: 'choice-text', content: { type: 'expression', expression: { type: 'ref', path: 'state.choice' } } },
    ...chat.nodes.map(node => node.id === prompt.id && node.kind === 'component' ? { ...node, outputs: { ...node.outputs, send: { setState: { key: 'lastSent' } } } } : node), ...flow.nodes,
  ].map(node => [node.id, node as UiNode])),
  componentDefinitions: {}, styleSources: {}, tokens: {}, conditions: {}, assets: {},
  localState: { ...chat.localState, recipient: { key: 'recipient', type: 'string', initial: 'Avery' }, lastSent: { key: 'lastSent', type: 'string', initial: '' },
    notes: { key: 'notes', type: 'string', initial: 'Native textarea initial' }, choice: { key: 'choice', type: 'string', initial: 'beta' },
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
  check('public native textarea wiring', bridge.apply(wireNativeInput({ requestId: 'consumer-notes-wire', document: bridge.document, nodeId: 'notes-input', key: 'notes', initial: 'Native textarea initial' })).ok);
  check('public native select wiring with nonfirst initial option', bridge.apply(wireNativeInput({ requestId: 'consumer-choice-wire', document: bridge.document, nodeId: 'choice-input', key: 'choice', initial: 'beta' })).ok);
  const before = canonicalUiDocument(bridge.document).contentDigest;
  check('generic registered insertion', insertButton().ok && !!bridge.document.nodes['inserted-button']);
  check('Undo restores exact source digest', bridge.undo().ok && canonicalUiDocument(bridge.document).contentDigest === before);
  check('Redo restores insertion', bridge.redo().ok && !!bridge.document.nodes['inserted-button']);
  check('canonical remove', bridge.apply({ requestId: 'consumer-remove', commands: [{ op: 'remove', nodeId: 'inserted-button', detachFromParent: true }] }).ok && !bridge.document.nodes['inserted-button']);
  check('Undo restores removed node', bridge.undo().ok && !!bridge.document.nodes['inserted-button']);
  const sharedId = 'consumer-shared-style';
  const shared = (color: string): UiStyleSource => ({ id: sharedId, declarations: [{ property: 'color', value: { type: 'text', value: color } }] });
  const targets = ['recipient-label', 'chat'];
  check('public shared style-source definition', bridge.apply(defineStyleSource({ requestId: 'consumer-style-define', document: bridge.document, source: shared('#355cc9') })).ok);
  for (const nodeId of targets) check(`reuse shared style source on ${nodeId}`, bridge.apply(attachStyleSource({ requestId: `consumer-style-attach-${nodeId}`, document: bridge.document, nodeId, sourceId: sharedId })).ok && bridge.document.nodes[nodeId]?.styleSources?.includes(sharedId) === true);
  const beforeStyleReplace = canonicalUiDocument(bridge.document).contentDigest;
  check('explicit shared style-source replacement', bridge.apply(defineStyleSource({ requestId: 'consumer-style-replace', document: bridge.document, source: shared('#146a53'), replace: true })).ok && targets.every(nodeId => bridge.document.nodes[nodeId]?.styleSources?.includes(sharedId)));
  check('Undo restores exact shared style source', bridge.undo().ok && canonicalUiDocument(bridge.document).contentDigest === beforeStyleReplace);
  const redoneStyle = bridge.redo(), redoneColor = bridge.document.styleSources[sharedId]?.declarations[0]?.value;
  check('Redo restores shared style replacement', redoneStyle.ok && redoneColor?.type === 'text' && redoneColor.value === '#146a53');
  const beforeReferencedRemoval = canonicalUiDocument(bridge.document).contentDigest;
  let referencedRemovalRefused = false;
  try { bridge.apply(removeStyleSource({ requestId: 'consumer-style-remove-referenced', document: bridge.document, sourceId: sharedId })); }
  catch (error) { referencedRemovalRefused = error instanceof StyleSourceEditError && error.code === 'UI_STYLE_SOURCE_EDIT' && error.field === 'sourceId'; }
  check('referenced shared style deletion refused without source mutation', referencedRemovalRefused && canonicalUiDocument(bridge.document).contentDigest === beforeReferencedRemoval);
  for (const nodeId of targets) check(`detach shared style source from ${nodeId}`, bridge.apply(detachStyleSource({ requestId: `consumer-style-detach-${nodeId}`, document: bridge.document, nodeId, sourceId: sharedId })).ok && !bridge.document.nodes[nodeId]?.styleSources?.includes(sharedId));
  check('remove unused shared style source', bridge.apply(removeStyleSource({ requestId: 'consumer-style-remove-unused', document: bridge.document, sourceId: sharedId })).ok && !bridge.document.styleSources[sharedId]);
  check('recreate shared style source', bridge.apply(defineStyleSource({ requestId: 'consumer-style-recreate', document: bridge.document, source: shared('#146a53') })).ok);
  for (const nodeId of targets) check(`reattach recreated shared source to ${nodeId}`, bridge.apply(attachStyleSource({ requestId: `consumer-style-reattach-${nodeId}`, document: bridge.document, nodeId, sourceId: sharedId })).ok);
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
  check('shared source and both attachments survive explicit Save/reopen', !!bridge.document.styleSources[sharedId] && targets.every(nodeId => bridge.document.nodes[nodeId]?.styleSources?.includes(sharedId)));
  check('typed date/time/list initials retained', bridge.document.localState.date?.type === 'isoDate' && bridge.document.localState.time?.type === 'isoTime' && bridge.document.localState.labels?.type === 'stringList' && bridge.document.localState.points?.type === 'numberList');
  return { sourceCandidate: __CONSUMER_SOURCE__, checks, passed: checks.every(item => item.passed), sourceDigest: savedDigest, nodeCount: Object.keys(bridge.document.nodes).length, stateCount: Object.keys(bridge.document.localState).length, registryContracts: registry.contracts.length, frameworkPackagesInstalled: 8,
    sharedStyleEvidence: 'Canonical source/helper checks only; no computed CSS or visual assertion.',
    boundary: 'Public installed packages only. Source helper checks are local; browser interactions are verified separately. Save/reopen uses a disposable in-memory revision-checked store. Provider/shell/workflow execution is absent.' };
}
