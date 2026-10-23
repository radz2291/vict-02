// Synthetic public review input. Paste via Designer's canonical Source UI.
// Preserve the fresh screen's actual id/revision; never import into an owner screen.
import { writeFileSync } from 'node:fs';
import { canonicalUiDocument, compileUiDocument, defaultSemanticElementCatalog } from '@victframework/ui';

const text = (id, value) => ({ kind: 'text', id, content: { type: 'literal', value } });
const element = (id, tag, children, attributes = {}) => ({ kind: 'element', id, tag, children, attributes });
const style = values => Object.entries(values).map(([property, value]) => ({ property, value: { type: 'text', value } }));
const document = {
  schema: 'vict.ui-document@1', id: 'REPLACE_WITH_FRESH_UI_DOCUMENT_ID', revision: 'r1', root: 'screen',
  nodes: {
    screen: { ...element('screen', 'main', ['customer', 'destination'], { 'aria-label': 'Completion Structure independent' }), localStyle: style({ display: 'flex', 'flex-direction': 'column', gap: '20px', padding: '24px', 'min-height': '560px', 'background-color': '#ffffff', color: '#243047', 'font-family': 'system-ui, sans-serif' }) },
    customer: { ...element('customer', 'section', ['customer-heading', 'name-field', 'preference-field', 'submit', 'move-paragraph', 'customer-note'], { 'aria-label': 'Customer settings' }), localStyle: style({ display: 'flex', 'flex-direction': 'column', gap: '12px', padding: '16px', border: '1px solid #cbd5e1' }) },
    'customer-heading': element('customer-heading', 'h2', ['customer-title']),
    'customer-title': text('customer-title', 'Customer settings'),
    'name-field': { ...element('name-field', 'input', [], { 'aria-label': 'Structure name', type: 'text', value: { type: 'ref', path: 'state.nameField' } }), interactions: [{ on: 'change', action: 'setState', key: 'nameField', value: { type: 'ref', path: 'state.nameField' } }] },
    'preference-field': { ...element('preference-field', 'input', [], { 'aria-label': 'Structure preference', type: 'checkbox', checked: { type: 'ref', path: 'state.preferenceField' } }), interactions: [{ on: 'change', action: 'setState', key: 'preferenceField', value: { type: 'ref', path: 'state.preferenceField' } }] },
    submit: { ...element('submit', 'button', ['submit-text'], { 'aria-label': 'Submit fixture', type: 'button' }), interactions: [{ on: 'click', action: 'invokeAction', actionId: 'demo.submit', input: { message: { type: 'ref', path: 'state.nameField' }, accepted: { type: 'ref', path: 'state.preferenceField' } } }] },
    'submit-text': text('submit-text', 'Submit fixture'),
    'move-paragraph': element('move-paragraph', 'p', ['move-text'], { 'aria-label': 'Movable paragraph' }),
    'move-text': text('move-text', 'Move this paragraph to Review destination.'),
    'customer-note': text('customer-note', 'Customer source group has six children, so it can collapse.'),
    destination: { ...element('destination', 'section', ['destination-heading', 'destination-note'], { 'aria-label': 'Review destination' }), localStyle: style({ display: 'flex', 'flex-direction': 'column', gap: '12px', padding: '16px', border: '1px solid #cbd5e1' }) },
    'destination-heading': element('destination-heading', 'h2', ['destination-title']),
    'destination-title': text('destination-title', 'Review destination'),
    'destination-note': text('destination-note', 'The keyboard move should place the paragraph here.'),
  },
  componentDefinitions: {}, styleSources: {}, assets: {}, tokens: {}, conditions: {},
  localState: {
    message: { key: 'message', type: 'string', initial: 'Hello from my screen' },
    accepted: { key: 'accepted', type: 'boolean', initial: false },
    dialogOpen: { key: 'dialogOpen', type: 'boolean', initial: false },
    busy: { key: 'busy', type: 'boolean', initial: false },
    actionError: { key: 'actionError', type: 'string', initial: '' },
    actionResult: { key: 'actionResult', type: 'string', initial: '' },
    nameField: { key: 'nameField', type: 'string', initial: 'Initial fixture name' },
    preferenceField: { key: 'preferenceField', type: 'boolean', initial: false },
  },
};
const canonical = canonicalUiDocument(document);
const compilation = compileUiDocument(document, defaultSemanticElementCatalog(), [], { actionIds: ['demo.submit'], routeIds: ['screen'], actionInputs: { 'demo.submit': { message: 'string', accepted: 'boolean' } } });
if (!compilation.ok) throw new Error(JSON.stringify(compilation.issues));
writeFileSync(new URL('./browser-fixture.json', import.meta.url), JSON.stringify(document, null, 2));
writeFileSync(new URL('./browser-fixture-source.json', import.meta.url), JSON.stringify({ synthetic: true, nodes: Object.keys(document.nodes).length, compileUiDocument: 'passed with default semantic catalog and declared demo.submit input types', canonicalDigest: canonical.contentDigest, documentIdMustBeReplaced: true, revisionMustBePreserved: true, sourceAssertions: {
  initialParent: 'customer', movedNode: 'move-paragraph', destination: 'destination',
  nameState: 'nameField', preferenceState: 'preferenceField',
  readPath: 'name-field.attributes.value', writePath: 'name-field.interactions.0',
  actionPath: 'submit.interactions.0',
} }, null, 2));
console.log(JSON.stringify({ ok: true, nodes: Object.keys(document.nodes).length, canonicalDigest: canonical.contentDigest }));
