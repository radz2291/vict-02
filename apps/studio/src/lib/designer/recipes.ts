import type { InsertRecipe } from '@victframework/ui-editor';
import type { UiNode, UiExpression } from '@victframework/ui';
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
export const screenRecipes: readonly InsertRecipe[] = [
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
    description: 'Accessible input connected to message state',
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
          value: { type: 'ref', path: 'state.message' },
        },
        interactions: [
          {
            on: 'change',
            action: 'setState',
            key: 'message',
            value: { type: 'ref', path: 'state.message' },
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
    description: 'Catalog · boolean value and output',
    create: (id) =>
      component(id, 'checkbox', { label: literal('I agree to continue'), checked: literal(false) }),
  },
  {
    id: 'switch',
    label: 'Switch',
    description: 'Catalog · a labeled on/off control',
    create: (id) =>
      component(id, 'switch', { label: literal('Enable notifications'), checked: literal(false) }),
  },
  {
    id: 'dialog',
    label: 'Dialog',
    description: 'Catalog · compose the body slot',
    create: (id) =>
      component(id, 'dialog', { title: literal('More details'), open: literal(false) }),
  },
  {
    id: 'separator',
    label: 'Separator',
    description: 'Catalog · a quiet visual divider',
    create: (id) =>
      component(id, 'separator', { orientation: literal('horizontal'), decorative: literal(true) }),
  },
];
