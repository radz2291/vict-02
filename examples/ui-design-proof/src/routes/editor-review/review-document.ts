import {
  defaultSemanticElementCatalog,
  type UiDocument,
  type UiStyleDeclaration,
} from '@victframework/ui';
import type { EditorLabels } from '@victframework/ui-editor';

const styles = (values: Record<string, string>): UiStyleDeclaration[] =>
  Object.entries(values).map(([property, value]) => ({ property, value: { type: 'text', value } }));
export const REVIEW_STORE_KEY = 'vict.u2.inspector-ux.review';
export const reviewCatalogs = {
  elements: defaultSemanticElementCatalog(),
  actionIds: ['review.request'],
  routeIds: [],
};
export const reviewLabels: EditorLabels = {
  nodes: {
    page: 'Fieldnotes · service page',
    hero: 'Introduction',
    title: 'Heading · Make room for better work',
    cards: 'Services',
    cardA: 'Research service',
    cardB: 'Design service',
    cardC:
      'A deliberately long component label for checking wrapping and accessible controls in a narrow Inspector and Layers panel',
    card: 'Service card',
    cardHeading: 'Card heading',
    cardCopy: 'Card description',
    request: 'Request a conversation',
  },
  definitions: { service: 'Service card' },
  actions: { 'review.request': 'Request a conversation' },
};
export const reviewDocument: UiDocument = {
  schema: 'vict.ui-document@1',
  id: 'review',
  revision: '1',
  root: 'page',
  assets: {},
  localState: {},
  tokens: { ink: { id: 'ink', value: '#253346' }, accent: { id: 'accent', value: '#365bd7' } },
  conditions: {
    narrow: { id: 'narrow', kind: 'media', query: '(max-width: 700px)' },
    compact: {
      id: 'compact',
      kind: 'container',
      name: 'review-canvas',
      query: '(max-width: 480px)',
    },
  },
  componentDefinitions: {
    service: { id: 'service', revision: '1', root: 'card', props: [], slots: {} },
  },
  styleSources: {
    cardBase: {
      id: 'cardBase',
      declarations: styles({
        padding: '24px',
        'background-color': '#ffffff',
        border: '1px solid #d9dfea',
        'border-radius': '12px',
      }),
    },
    cardCompact: {
      id: 'cardCompact',
      conditionId: 'compact',
      declarations: styles({ padding: '16px' }),
    },
    cardsCompact: {
      id: 'cardsCompact',
      conditionId: 'compact',
      declarations: styles({ 'grid-template-columns': '1fr' }),
    },
    titleNarrow: {
      id: 'titleNarrow',
      conditionId: 'narrow',
      declarations: styles({ 'font-size': '32px' }),
    },
  },
  nodes: {
    page: {
      kind: 'element',
      id: 'page',
      tag: 'main',
      children: ['hero', 'cards'],
      localStyle: styles({
        padding: '32px',
        'font-family': 'system-ui, sans-serif',
        color: '#253346',
        'background-color': '#eef1f6',
        'min-height': '650px',
        'box-sizing': 'border-box',
      }),
    },
    hero: {
      kind: 'element',
      id: 'hero',
      tag: 'section',
      children: ['eyebrow', 'title', 'intro', 'request'],
      localStyle: styles({ 'max-width': '650px', 'margin-bottom': '36px' }),
    },
    eyebrow: {
      kind: 'element',
      id: 'eyebrow',
      tag: 'p',
      children: ['eyebrowText'],
      localStyle: styles({
        color: '#365bd7',
        'font-size': '12px',
        'letter-spacing': '2px',
        'font-weight': '700',
      }),
    },
    eyebrowText: {
      kind: 'text',
      id: 'eyebrowText',
      content: { type: 'literal', value: 'FIELDNOTES / INDEPENDENT STUDIO' },
    },
    title: {
      kind: 'element',
      id: 'title',
      tag: 'h1',
      children: ['titleText'],
      styleSources: ['titleNarrow'],
      localStyle: styles({
        'font-size': '46px',
        'line-height': '1.1',
        'letter-spacing': '-1px',
        margin: '16px 0',
      }),
    },
    titleText: {
      kind: 'text',
      id: 'titleText',
      content: { type: 'literal', value: 'Make room for better work.' },
    },
    intro: {
      kind: 'element',
      id: 'intro',
      tag: 'p',
      children: ['introText'],
      localStyle: styles({ 'font-size': '16px', 'line-height': '1.7', 'max-width': '520px' }),
    },
    introText: {
      kind: 'text',
      id: 'introText',
      content: {
        type: 'literal',
        value:
          'A small team helping ambitious people turn a promising idea into a thoughtful, useful product.',
      },
    },
    request: {
      kind: 'element',
      id: 'request',
      tag: 'button',
      attributes: { type: 'button' },
      children: ['requestText'],
      localStyle: styles({
        padding: '12px 18px',
        'background-color': '#365bd7',
        color: '#ffffff',
        border: '0',
        'border-radius': '6px',
        'font-size': '14px',
      }),
    },
    requestText: {
      kind: 'text',
      id: 'requestText',
      content: { type: 'literal', value: 'Start a conversation →' },
    },
    cards: {
      kind: 'element',
      id: 'cards',
      tag: 'section',
      children: ['cardA', 'cardB', 'cardC'],
      styleSources: ['cardsCompact'],
      localStyle: styles({
        display: 'grid',
        'grid-template-columns': 'repeat(3, minmax(0, 1fr))',
        gap: '16px',
      }),
    },
    cardA: { kind: 'component', id: 'cardA', definitionId: 'service' },
    cardB: { kind: 'component', id: 'cardB', definitionId: 'service' },
    cardC: { kind: 'component', id: 'cardC', definitionId: 'service' },
    card: {
      kind: 'element',
      id: 'card',
      tag: 'article',
      children: ['cardHeading', 'cardCopy'],
      styleSources: ['cardBase', 'cardCompact'],
    },
    cardHeading: {
      kind: 'element',
      id: 'cardHeading',
      tag: 'h2',
      children: ['cardHeadingText'],
      localStyle: styles({ 'font-size': '20px', margin: '0 0 12px' }),
    },
    cardHeadingText: {
      kind: 'text',
      id: 'cardHeadingText',
      content: { type: 'literal', value: 'From idea to clarity' },
    },
    cardCopy: {
      kind: 'element',
      id: 'cardCopy',
      tag: 'p',
      children: ['cardCopyText'],
      localStyle: styles({ 'font-size': '14px', 'line-height': '1.6', margin: '0' }),
    },
    cardCopyText: {
      kind: 'text',
      id: 'cardCopyText',
      content: {
        type: 'literal',
        value: 'Research, direction and a practical plan for what comes next.',
      },
    },
  },
};
