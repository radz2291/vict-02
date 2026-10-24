import type { UiDocument } from '@victframework/ui';

export function nativeSource(): UiDocument {
  return { schema: 'vict.ui-document@1', id: 'native-wiring', revision: '1', root: 'root', nodes: {
    root: { kind: 'element', id: 'root', tag: 'main', children: ['note', 'choice', 'note-copy', 'choice-copy'] },
    note: { kind: 'element', id: 'note', tag: 'textarea', children: [] },
    choice: { kind: 'element', id: 'choice', tag: 'select', children: ['first', 'second'] },
    first: { kind: 'element', id: 'first', tag: 'option', attributes: { value: 'first' }, children: ['first-label'] },
    'first-label': { kind: 'text', id: 'first-label', content: { type: 'literal', value: 'First' } },
    second: { kind: 'element', id: 'second', tag: 'option', attributes: { value: 'second' }, children: ['second-label'] },
    'second-label': { kind: 'text', id: 'second-label', content: { type: 'literal', value: 'Second' } },
    'note-copy': { kind: 'element', id: 'note-copy', tag: 'p', children: [] },
    'choice-copy': { kind: 'element', id: 'choice-copy', tag: 'p', children: [] },
  }, componentDefinitions: {}, localState: {}, styleSources: {}, tokens: {}, assets: {}, conditions: {} };
}

