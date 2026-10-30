import {
  compileUiDocument,
  defaultSemanticElementCatalog,
  type UiDocument,
  type UiExtensionDescriptor,
} from '@victframework/ui';
import { newScreen } from '../../src/lib/designer/application.js';
export function bindingFixture(): UiDocument {
  return {
    ...newScreen('Bindings', 'bindings'),
    nodes: {
      screen: { id: 'screen', kind: 'element', tag: 'main', children: ['field', 'mirror'] },
      field: {
        id: 'field',
        kind: 'element',
        tag: 'input',
        children: [],
        attributes: { value: { type: 'ref', path: 'state.message' } },
        interactions: [
          {
            on: 'change',
            action: 'setState',
            key: 'message',
            value: { type: 'ref', path: 'state.message' },
          },
        ],
      },
      mirror: {
        id: 'mirror',
        kind: 'element',
        tag: 'input',
        children: [],
        attributes: { value: { type: 'ref', path: 'state.message' } },
      },
    },
  };
}
export function definitionsFixture(): UiDocument {
  return {
    ...newScreen('Definitions', 'definitions'),
    nodes: {
      screen: { id: 'screen', kind: 'element', tag: 'main', children: ['a', 'b'] },
      a: {
        id: 'a',
        kind: 'component',
        definitionId: 'a',
        props: { title: { type: 'literal', value: 'Alpha' } },
      },
      b: {
        id: 'b',
        kind: 'component',
        definitionId: 'b',
        props: { title: { type: 'literal', value: 'Beta' } },
      },
      ta: {
        id: 'ta',
        kind: 'text',
        content: { type: 'expression', expression: { type: 'ref', path: 'prop.title' } },
      },
      tb: {
        id: 'tb',
        kind: 'text',
        content: { type: 'expression', expression: { type: 'ref', path: 'prop.title' } },
      },
    },
    componentDefinitions: {
      a: {
        id: 'a',
        revision: '1',
        root: 'ta',
        props: [{ name: 'title', type: 'string' }],
        slots: {},
      },
      b: {
        id: 'b',
        revision: '1',
        root: 'tb',
        props: [{ name: 'title', type: 'string' }],
        slots: {},
      },
    },
  };
}
export function repeatFixture(): UiDocument {
  return {
    ...newScreen('Repeats', 'repeats'),
    nodes: {
      screen: { id: 'screen', kind: 'element', tag: 'main', children: ['a', 'b'] },
      a: {
        id: 'a',
        kind: 'repeat',
        collection: { type: 'ref', path: 'view.products' },
        key: { type: 'ref', path: 'repeat.row.id' },
        itemName: 'row',
        templateRoot: 'ta',
      },
      b: {
        id: 'b',
        kind: 'repeat',
        collection: { type: 'ref', path: 'view.orders' },
        key: { type: 'ref', path: 'repeat.row.id' },
        itemName: 'row',
        templateRoot: 'tb',
      },
      ta: {
        id: 'ta',
        kind: 'text',
        content: { type: 'expression', expression: { type: 'ref', path: 'repeat.row.name' } },
      },
      tb: {
        id: 'tb',
        kind: 'text',
        content: { type: 'expression', expression: { type: 'ref', path: 'repeat.row.name' } },
      },
    },
  };
}
export const repeatFields = {
  products: 'array',
  'products.id': 'string',
  'products.name': 'string',
  orders: 'array',
  'orders.id': 'string',
  'orders.name': 'string',
} as const;
export const outputDescriptor: UiExtensionDescriptor = {
  id: 'probe.toggle',
  revision: '1',
  props: [],
  abi: 'vict.ui-component-abi@1',
  events: ['vict.ui-component-abi@1'],
  outputs: [{ name: 'change', payload: 'boolean' }],
  rendererImplementationId: 'probe@1',
};
export function outputFixture(): UiDocument {
  return {
    ...newScreen('Outputs', 'outputs'),
    nodes: {
      screen: { id: 'screen', kind: 'element', tag: 'main', children: ['a', 'b'] },
      a: {
        id: 'a',
        kind: 'component',
        definitionId: outputDescriptor.id,
        outputs: {
          change: { setState: { key: 'accepted', value: { type: 'ref', path: '$output' } } },
        },
      },
      b: {
        id: 'b',
        kind: 'component',
        definitionId: outputDescriptor.id,
        outputs: {
          change: { setState: { key: 'dialogOpen', value: { type: 'ref', path: '$output' } } },
        },
      },
    },
  };
}
export function styleFixture(): UiDocument {
  const seed = newScreen('Styles', 'styles');
  return {
    ...seed,
    localState: { ...seed.localState, tint: { key: 'tint', type: 'string', initial: '#223344' } },
    tokens: { accent: { id: 'accent', value: '#102030' } },
    conditions: { compact: { id: 'compact', kind: 'media', query: '(max-width: 600px)' } },
    styleSources: {
      shared: {
        id: 'shared',
        conditionId: 'compact',
        declarations: [
          {
            property: 'color',
            value: { type: 'binding', expression: { type: 'ref', path: 'state.tint' } },
          },
          { property: 'background-color', value: { type: 'token', id: 'accent' } },
        ],
      },
    },
    nodes: {
      screen: {
        id: 'screen',
        kind: 'element',
        tag: 'main',
        children: [],
        styleSources: ['shared'],
      },
    },
  };
}
export function compileFixture(
  source: UiDocument,
  extensions: readonly UiExtensionDescriptor[] = [],
  catalogs: Parameters<typeof compileUiDocument>[3] = {},
) {
  return compileUiDocument(source, defaultSemanticElementCatalog(), extensions, catalogs);
}
