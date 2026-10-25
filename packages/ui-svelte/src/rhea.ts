/** Reusable native compositions, using the canonical UI document vocabulary.
 * These are source recipes, not registered components or implicit host effects.
 * Import rhea.css in preview AND product hosts to use the named classes. */
import type { UiAuthoringFragment, UiNode, UiLocalStateDecl } from '@victframework/ui';

export interface RheaNativePattern {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly cssClasses: readonly string[];
  readonly hostRequirements: readonly string[];
  readonly create: (id: string) => UiAuthoringFragment;
}
type Element = Extract<UiNode, {kind: 'element'}>;
const element = (id: string, tag: string, children: readonly string[] = [], attributes?: Element['attributes'], classes?: readonly string[]): Element =>
  ({kind: 'element', id, tag, children, ...(attributes ? {attributes} : {}), ...(classes ? {classes} : {})});
const text = (id: string, value: string): UiNode => ({kind: 'text', id, content: {type: 'literal', value}});
const scoped = (id: string, tag: string, name: string, children: readonly string[], attributes?: Element['attributes']) =>
  element(id, tag, children, attributes, ['vict-rhea', `vict-rhea-${name}`]);
const fragment = (root: string, nodes: readonly UiNode[], localState?: Readonly<Record<string, UiLocalStateDecl>>): UiAuthoringFragment =>
  ({root, nodes, ...(localState ? {localState} : {})});
const valueKey = (id: string) => `rhea_${id.replace(/[^a-zA-Z0-9_-]/g, '_')}_value`;
function field(id: string, mode: 'input' | 'textarea' | 'native-select' | 'field'): UiAuthoringFragment {
  const key = valueKey(id), control = `${id}-control`, label = `${id}-label`;
  const select = mode === 'native-select';
  const node: UiNode = {
    ...element(control, select ? 'select' : mode === 'textarea' ? 'textarea' : 'input', select ? [`${id}-option-first`, `${id}-option-second`] : [],
      {id: control, 'aria-describedby': `${id}-help`, ...(mode === 'input' || mode === 'field' ? {type: 'text'} : {}), value: {type: 'ref', path: `state.${key}`}},
      [select ? 'vict-rhea-native-select' : 'vict-rhea-input']),
    interactions: [{on: 'change', action: 'setState', key, value: {type: 'ref', path: `state.${key}`}}],
  };
  return fragment(id, [
    scoped(id, 'div', 'field', [label, control, `${id}-help`]),
    element(label, 'label', [`${label}-text`], {for: control}), text(`${label}-text`, select ? 'Choose an option' : 'Your name'),
    node,
    ...(select ? [element(`${id}-option-first`, 'option', [`${id}-first-text`], {value: 'first'}), text(`${id}-first-text`, 'First option'),
      element(`${id}-option-second`, 'option', [`${id}-second-text`], {value: 'second'}), text(`${id}-second-text`, 'Second option')] : []),
    element(`${id}-help`, 'small', [`${id}-help-text`]), text(`${id}-help-text`, 'Local preview value; connect a declared action to submit.'),
  ], {[key]: {key, type: 'string', initial: select ? 'first' : ''}});
}
const patterns: readonly RheaNativePattern[] = [
  {id: 'alert', label: 'Alert', description: 'A semantic inline status with title and description; no toast host.', cssClasses: ['vict-rhea-alert'], hostRequirements: [], create: id => fragment(id, [
    scoped(id, 'div', 'alert', [`${id}-title`, `${id}-body`], {role: 'status'}),
    element(`${id}-title`, 'strong', [`${id}-title-text`]), text(`${id}-title-text`, 'Changes saved'),
    element(`${id}-body`, 'p', [`${id}-body-text`]), text(`${id}-body-text`, 'Your work is ready to review.'),
  ])},
  {id: 'breadcrumb', label: 'Breadcrumb', description: 'Labelled native navigation and current-page semantics; destinations remain host-owned.', cssClasses: ['vict-rhea-breadcrumb'], hostRequirements: ['Replace example links with declared application destinations.'], create: id => fragment(id, [
    element(id, 'nav', [`${id}-list`], {'aria-label': 'Breadcrumb'}, ['vict-rhea']),
    element(`${id}-list`, 'ol', [`${id}-home`, `${id}-current`], undefined, ['vict-rhea-breadcrumb']),
    element(`${id}-home`, 'li', [`${id}-link`]), element(`${id}-link`, 'a', [`${id}-home-text`], {href: '#'}), text(`${id}-home-text`, 'Home'),
    element(`${id}-current`, 'li', [`${id}-current-text`], {'aria-current': 'page'}), text(`${id}-current-text`, 'Current page'),
  ])},
  {id: 'button-group', label: 'Button group', description: 'A labelled group of ordinary buttons; connect each through declared canonical interactions.', cssClasses: ['vict-rhea-button-group'], hostRequirements: ['Buttons are presentation until declared actions or local interactions are connected.'], create: id => fragment(id, [
    scoped(id, 'div', 'button-group', [`${id}-first`, `${id}-second`], {role: 'group', 'aria-label': 'Actions'}),
    element(`${id}-first`, 'button', [`${id}-first-text`], {type: 'button'}, ['vict-btn', 'vict-btn--secondary']), text(`${id}-first-text`, 'Previous'),
    element(`${id}-second`, 'button', [`${id}-second-text`], {type: 'button'}, ['vict-btn', 'vict-btn--secondary']), text(`${id}-second-text`, 'Next'),
  ])},
  {id: 'card', label: 'Card', description: 'A reusable semantic article with editable title and body; no fixed marketing template.', cssClasses: ['vict-rhea-card'], hostRequirements: [], create: id => fragment(id, [
    scoped(id, 'article', 'card', [`${id}-title`, `${id}-body`]),
    element(`${id}-title`, 'h2', [`${id}-title-text`]), text(`${id}-title-text`, 'Card title'),
    element(`${id}-body`, 'p', [`${id}-body-text`]), text(`${id}-body-text`, 'Add your own content.'),
  ])},
  {id: 'empty', label: 'Empty state', description: 'A restrained empty-content message; add an action only when the product has one.', cssClasses: ['vict-rhea-empty'], hostRequirements: [], create: id => fragment(id, [
    scoped(id, 'div', 'empty', [`${id}-title`, `${id}-body`]),
    element(`${id}-title`, 'h2', [`${id}-title-text`]), text(`${id}-title-text`, 'Nothing here yet'),
    element(`${id}-body`, 'p', [`${id}-body-text`]), text(`${id}-body-text`, 'New items will appear here.'),
  ])},
  ...(['field', 'input', 'textarea', 'native-select'] as const).map(id => ({
    id, label: id === 'native-select' ? 'Native select' : id === 'textarea' ? 'Text area' : id === 'field' ? 'Field' : 'Input',
    description: 'Associated native label, typed local value and canonical change binding. No form transport.',
    cssClasses: ['vict-rhea-field', id === 'native-select' ? 'vict-rhea-native-select' : 'vict-rhea-input'],
    hostRequirements: ['Submission, authorization and persistence require declared host actions.'], create: (nodeId: string) => field(nodeId, id),
  })),
  {id: 'kbd', label: 'Keyboard hint', description: 'A native kbd label; this does not register a shortcut.', cssClasses: ['vict-rhea-kbd'], hostRequirements: ['Only advertise shortcuts actually implemented by the host.'], create: id => fragment(id, [scoped(id, 'kbd', 'kbd', [`${id}-text`]), text(`${id}-text`, 'Esc')])},
  {id: 'skeleton', label: 'Skeleton', description: 'A decorative loading placeholder; drive visibility from real loading state.', cssClasses: ['vict-rhea-skeleton'], hostRequirements: [], create: id => fragment(id, [scoped(id, 'div', 'skeleton', [], {'aria-hidden': 'true'})])},
  {id: 'spinner', label: 'Spinner', description: 'An accessible local status indicator with reduced-motion support; no fabricated task progress.', cssClasses: ['vict-rhea-spinner'], hostRequirements: [], create: id => fragment(id, [scoped(id, 'span', 'spinner', [], {role: 'status', 'aria-label': 'Loading'})])},
  {id: 'table', label: 'Table', description: 'Native semantic table with headers and caption; not a sorting/filtering data-grid adapter.', cssClasses: ['vict-rhea-table'], hostRequirements: ['Dynamic rows, pagination and effects require declared view/action bindings.'], create: id => fragment(id, [
    scoped(id, 'table', 'table', [`${id}-caption`, `${id}-head`, `${id}-body`]),
    element(`${id}-caption`, 'caption', [`${id}-caption-text`]), text(`${id}-caption-text`, 'Example records'),
    element(`${id}-head`, 'thead', [`${id}-header-row`]), element(`${id}-header-row`, 'tr', [`${id}-name-header`, `${id}-status-header`]),
    element(`${id}-name-header`, 'th', [`${id}-name-header-text`], {scope: 'col'}), text(`${id}-name-header-text`, 'Name'),
    element(`${id}-status-header`, 'th', [`${id}-status-header-text`], {scope: 'col'}), text(`${id}-status-header-text`, 'Status'),
    element(`${id}-body`, 'tbody', [`${id}-row`]), element(`${id}-row`, 'tr', [`${id}-name`, `${id}-status`]),
    element(`${id}-name`, 'td', [`${id}-name-text`]), text(`${id}-name-text`, 'Example item'),
    element(`${id}-status`, 'td', [`${id}-status-text`]), text(`${id}-status-text`, 'Ready'),
  ])},
];
export const rheaNativePatterns: readonly RheaNativePattern[] = patterns;
export const RHEA_UPSTREAM_COMMIT = 'b10f153250b18abfccf49a06e1c4c68945edffa5';
