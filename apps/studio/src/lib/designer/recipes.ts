import { authoringRecipe, type InsertRecipe } from '@victframework/ui-editor';
import type { UiNode } from '@victframework/ui';
import { installedAuthoringRegistry } from './authoring.js';
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
];

/** Recipes accelerate the same package-owned registered composition path. */
export const screenRecipes: readonly InsertRecipe[] = [...basicRecipes, ...installedAuthoringRegistry.contracts.flatMap(registration => {
  const recipe=authoringRecipe(registration); return recipe?[recipe]:[];
})];
