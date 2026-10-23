import type { InsertRecipe } from '@victframework/ui-editor';
import type { UiNode, UiExpression, UiValue, UiLocalStateDecl, UiOutputBinding } from '@victframework/ui';
import { catalogDescriptors } from '@victframework/ui-svelte';
const styles = (values: Record<string, string>) =>
  Object.entries(values).map(([property, value]) => ({
    property,
    value: { type: 'text' as const, value },
  }));
function textElement(
  id: string,
  tag: string,
  text: string,
  values: Record<string, string> = {},
): readonly UiNode[] {
  return [
    { kind: 'element', id, tag, children: [`${id}-text`], localStyle: styles(values) },
    { kind: 'text', id: `${id}-text`, content: { type: 'literal', value: text } },
  ];
}
function component(
  id: string,
  family: string,
  props: Record<string, UiExpression>,
): readonly UiNode[] {
  return [{ kind: 'component', id, definitionId: `vict.catalog.${family}`, props }];
}
const literal = (value: string | boolean | number): UiExpression => ({ type: 'literal', value });
const basicRecipes: readonly InsertRecipe[] = [
  {
    id: 'section',
    label: 'Section',
    description: 'A vertical container for nested content',
    create: (id) => [
      {
        kind: 'element',
        id,
        tag: 'section',
        attributes: { 'aria-label': 'Section' },
        children: [],
        localStyle: styles({
          display: 'flex',
          'flex-direction': 'column',
          gap: '16px',
          padding: '24px',
          'min-height': '100px',
          'background-color': '#f5f7fb',
          'border-radius': '12px',
        }),
      },
    ],
  },
  {
    id: 'row',
    label: 'Row',
    description: 'Arrange children side by side, with wrapping',
    create: (id) => [
      {
        kind: 'element',
        id,
        tag: 'div',
        children: [],
        localStyle: styles({
          display: 'flex',
          'flex-wrap': 'wrap',
          gap: '16px',
          'align-items': 'center',
          'min-height': '60px',
        }),
      },
    ],
  },
  {
    id: 'heading',
    label: 'Heading',
    description: 'A clear title for your screen',
    create: (id) =>
      textElement(id, 'h1', 'Make something useful.', {
        'font-size': '32px',
        'font-weight': '600',
        'line-height': '1.2',
        margin: '0',
      }),
  },
  {
    id: 'text',
    label: 'Text',
    description: 'Supporting copy or a state-bound value',
    create: (id) =>
      textElement(id, 'p', 'Give your screen a little context.', {
        'font-size': '16px',
        'line-height': '1.6',
        margin: '0',
        color: '#647187',
      }),
  },
  {
    id: 'input',
    label: 'Text input',
    description: 'Accessible text input with independent local state and change binding',
    initialState: id => { const key = `input_${id.replace(/[^a-zA-Z0-9_-]/g, '_')}`; return { [key]: { key, type: 'string', initial: '' } }; },
    create: (id) => [
      {
        kind: 'element',
        id,
        tag: 'input',
        children: [],
        attributes: {
          type: 'text',
          'aria-label': 'Message',
          placeholder: 'Your message',
          value: { type: 'ref', path: `state.input_${id.replace(/[^a-zA-Z0-9_-]/g, '_')}` },
        },
        interactions: [
          {
            on: 'change',
            action: 'setState',
            key: `input_${id.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
            value: { type: 'ref', path: `state.input_${id.replace(/[^a-zA-Z0-9_-]/g, '_')}` },
          },
        ],
        localStyle: styles({
          padding: '12px',
          'border-radius': '8px',
          border: '1px solid #cbd3e1',
          'font-size': '16px',
          width: '100%',
          'box-sizing': 'border-box',
        }),
      },
    ],
  },
  {
    id: 'button',
    label: 'Button',
    description: 'Catalog · declared press action',
    create: (id) =>
      component(id, 'button', {
        label: literal('Continue'),
        loading: { type: 'ref', path: 'state.busy' },
      }),
  },
  {
    id: 'checkbox',
    label: 'Checkbox',
    description: 'Independently wired boolean value and matching output',
    initialState: id => {const key=`field_${id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;return {[key]:{key,type:'boolean',initial:false}};},
    create: id => {const key=`field_${id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;return [{kind:'component',id,definitionId:'vict.catalog.checkbox',props:{label:literal('I agree to continue'),checked:{type:'ref',path:`state.${key}`}},outputs:{checkedChange:{setState:{key}}}}];},
  },
  {
    id: 'switch',
    label: 'Switch',
    description: 'Independently wired boolean value and matching output',
    initialState: id => {const key=`field_${id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;return {[key]:{key,type:'boolean',initial:false}};},
    create: id => {const key=`field_${id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;return [{kind:'component',id,definitionId:'vict.catalog.switch',props:{label:literal('Enable notifications'),checked:{type:'ref',path:`state.${key}`}},outputs:{checkedChange:{setState:{key}}}}];},
  },
  {
    id: 'dialog',
    label: 'Dialog',
    description: 'Catalog · compose the body slot',
    create: (id) => seedNodes(id, { family: 'dialog', props: { title: 'More details', open: false }, slots: { body: [copy('Add your details here.')] } }),
  },
  {
    id: 'separator',
    label: 'Separator',
    description: 'Catalog · a quiet visual divider',
    create: (id) =>
      component(id, 'separator', { orientation: literal('horizontal'), decorative: literal(true) }),
  },
];

/** Seed usable canonical compositions, never standalone context-owned Bits parts. */
type Seed = { family?: string; props?: Record<string, UiValue>; slots?: Record<string, Seed[]>; text?: string };
const copy = (text: string): Seed => ({ text });
const item = (family: string, label = 'First option', value = 'first'): Seed => ({ family, props: { label, value } });
const seed = (family: string): Seed => {
  const props: Record<string, UiValue> = {};
  const slots: Record<string, Seed[]> = {};
  const descriptor = catalogDescriptors.find(d => d.id === `vict.catalog.${family}`)!;
  for (const prop of descriptor.props) if (prop.type === 'stringList' || prop.type === 'numberList') props[prop.name] = prop.default ?? [];
  if (descriptor.props.some(p => p.name === 'label')) props.label = title(family);
  if (descriptor.props.some(p => p.name === 'title')) props.title = title(family);
  if (descriptor.props.some(p => p.name === 'description')) props.description = 'Add your own content.';
  if (family === 'avatar') { props.fallback = 'VI'; props.alt = 'Profile'; }
  if (family === 'slider') props.value = [25];
  if (family === 'meter' || family === 'progress') props.value = 40;
  if (family === 'pagination') props.count = 100;
  if (family === 'label') props.label = 'Field label';
  if (family === 'link-preview' || family === 'navigation-menu.link') props.href = '#';
  if (family === 'time-field') props.value = '09:00';
  if (['date-field', 'date-picker', 'calendar'].includes(family)) props.value = '2026-10-23';
  if (['date-range-field', 'date-range-picker', 'range-calendar'].includes(family)) {
    props.start = '2026-10-23'; props.end = '2026-10-25';
  }
  if (/^(select|combobox|toggle-group)(-multiple)?$/.test(family)) {
    const child = family.replace('-multiple', '') + '-item';
    slots.items = [item(child), item(child, 'Second option', 'second')];
  }
  if (family === 'accordion' || family === 'accordion-multiple') slots.items = [seed('accordion-item')];
  if (family === 'accordion-item') { props.value = 'first'; props.label = 'Details'; slots.content = [copy('Expandable content')]; }
  if (family === 'tabs') {
    props.value = 'first'; slots.tabs = [item('tabs-trigger', 'First tab')];
    slots.panels = [{ family: 'tabs-panel', props: { value: 'first' }, slots: { content: [copy('Tab content')] } }];
  }
  if (family === 'tabs-trigger' || family === 'tabs-panel') props.value = 'first';
  if (family === 'tabs-panel') slots.content = [copy('Tab content')];
  if (family === 'toolbar') slots.tools = [{ family: 'toolbar-button', props: { label: 'Action' } }];
  if (family === 'menubar') slots.menus = [seed('menubar.menu')];
  if (family === 'menubar.menu') { props.value = 'file'; props.label = 'File'; slots.items = [item('menubar.item', 'New item')]; }
  if (['dropdown-menu', 'context-menu'].includes(family)) slots.items = [item(`${family}.item`, 'New item')];
  if (/^(dropdown-menu|context-menu|menubar)\.(sub|group|checkbox-group|radio-group)$/.test(family)) {
    const prefix = family.split('.')[0]!;
    const child = family.endsWith('checkbox-group') ? 'checkbox-item' : family.endsWith('radio-group') ? 'radio-item' : 'item';
    slots.items = [item(`${prefix}.${child}`)];
  }
  if (family === 'command' || family === 'command.group') slots.items = [item('command.item', 'Choose an action')];
  if (family === 'command') props.placeholder = 'Search actions…';
  if (family === 'navigation-menu' || family === 'navigation-menu.sub') slots.items = [seed('navigation-menu.item')];
  if (family === 'navigation-menu.item') { props.value = 'first'; slots.content = [seed('navigation-menu.link')]; }
  if (['aspect-ratio', 'scroll-area', 'collapsible', 'popover', 'link-preview'].includes(family)) slots.content = [copy('Your content')];
  if (family === 'alert-dialog') slots.body = [copy('Review this local preview action before continuing.')];
  return { family, props, slots };
};
function title(family: string): string {
  return family.replace(/[.-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
function seedNodes(rootId: string, source: Seed, state: Record<string, UiLocalStateDecl> = {}): readonly UiNode[] {
  if (source.text !== undefined) return textElement(rootId, 'p', source.text);
  const descendants: UiNode[] = [];
  const slots = Object.fromEntries(Object.entries(source.slots ?? {}).map(([name, children]) => {
    const ids = children.map((child, index) => {
      const id = `${rootId}-${name}-${index + 1}`;
      descendants.push(...seedNodes(id, child, state)); return id;
    });
    return [name, { name, children: ids }];
  }));
  const descriptor = catalogDescriptors.find(entry => entry.id === `vict.catalog.${source.family}`)!;
  const props: Record<string, UiExpression> = {};
  const outputs: Record<string, UiOutputBinding> = {};
  for (const [name, value] of Object.entries(source.props ?? {})) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      props[name] = { type: 'literal', value };
    } else {
      const prop = descriptor.props.find(prop => prop.name === name)!;
      if (prop.type !== 'stringList' && prop.type !== 'numberList') throw Error('A recipe list needs a typed presentation value.');
      const key = `catalog_${rootId.replace(/[^a-zA-Z0-9_-]/g, '_')}_${name}`;
      state[key] = { key, type: prop.type, initial: value };
      props[name] = { type: 'ref', path: `state.${key}` };
      const output = descriptor.outputs?.find(output => output.name === `${name}Change` && output.payload === prop.type);
      if (output) outputs[output.name] = { setState: { key } };
    }
  }
  return [{ kind: 'component', id: rootId, definitionId: `vict.catalog.${source.family}`,
    props, ...(Object.keys(outputs).length ? { outputs } : {}),
    ...(Object.keys(slots).length ? { slots } : {}) }, ...descendants];
}
function placements(family: string): InsertRecipe['placements'] {
  const under = (parents: string[], slotName: string) => parents.map(parent => ({ definitionId: `vict.catalog.${parent}`, slotName }));
  if (family === 'select-item') return under(['select', 'select-multiple'], 'items');
  if (family === 'combobox-item') return under(['combobox', 'combobox-multiple'], 'items');
  if (family === 'toggle-group-item') return under(['toggle-group', 'toggle-group-multiple'], 'items');
  if (family === 'accordion-item') return under(['accordion', 'accordion-multiple'], 'items');
  if (family === 'tabs-trigger') return under(['tabs'], 'tabs');
  if (family === 'tabs-panel') return under(['tabs'], 'panels');
  if (family === 'toolbar-button') return under(['toolbar'], 'tools');
  if (family === 'menubar.menu') return under(['menubar'], 'menus');
  if (/^(dropdown-menu|context-menu|menubar)\./.test(family)) {
    const prefix = family.split('.')[0]!;
    if (family.endsWith('.radio-item')) return under([`${prefix}.radio-group`], 'items');
    const parents = [prefix === 'menubar' ? 'menubar.menu' : prefix, `${prefix}.sub`, `${prefix}.group`];
    if (family.endsWith('.checkbox-item')) parents.push(`${prefix}.checkbox-group`);
    return under(parents, 'items');
  }
  if (family === 'command.item' || family === 'command.group') return under(['command', 'command.group'], 'items');
  if (family === 'navigation-menu.item' || family === 'navigation-menu.sub') return under(['navigation-menu', 'navigation-menu.sub'], 'items');
  if (family === 'navigation-menu.link') return under(['navigation-menu.item'], 'content');
  return undefined;
}
const existing = new Set(basicRecipes.map(recipe => recipe.id));
const catalogRecipes: InsertRecipe[] = catalogDescriptors
  .filter(descriptor => !['vict.catalog.radio-group', 'vict.catalog.appshell'].includes(descriptor.id))
  .map(descriptor => descriptor.id.replace('vict.catalog.', ''))
  .filter(family => !existing.has(family))
  .map(family => ({ id: family, label: title(family),
    description: `Catalog · ${placements(family) ? 'part for a compatible component slot' : 'editable properties, declared slots and events'}`,
    placements: placements(family), create: id => seedNodes(id, seed(family)),
    initialState: id => { const state: Record<string, UiLocalStateDecl> = {}; seedNodes(id, seed(family), state); return state; } }));

export const screenRecipes: readonly InsertRecipe[] = [...basicRecipes, ...catalogRecipes];
