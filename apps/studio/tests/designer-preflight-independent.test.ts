import { expect, it } from 'vitest';
import type { UiDocument, UiNode } from '@victframework/ui';
import { compileScreen, newScreen } from '../src/lib/designer/application.js';

function fixture(mode: 'empty-repeat' | 'local-fallback', filled: boolean): UiDocument {
  const source = newScreen('Independent preflight challenge', `independent-${mode}`);
  const dialog: UiNode = {
    kind: 'component',
    id: 'dialog',
    definitionId: 'vict.catalog.dialog',
    slots: { body: { name: 'body', children: filled ? ['body'] : [] } },
  };
  const body: UiNode = {
    kind: 'text',
    id: 'body',
    content: { type: 'literal', value: 'Valid body' },
  };
  if (mode === 'empty-repeat')
    return {
      ...source,
      localState: {
        ...source.localState,
        items: { key: 'items', type: 'stringList', initial: [] },
      },
      nodes: {
        ...source.nodes,
        screen: { ...source.nodes.screen!, children: ['repeat'] } as UiNode,
        repeat: {
          kind: 'repeat',
          id: 'repeat',
          collection: { type: 'ref', path: 'state.items' },
          key: { type: 'literal', value: 'stable' },
          itemName: 'item',
          templateRoot: 'dialog',
        },
        dialog,
        ...(filled ? { body } : {}),
      },
    };
  return {
    ...source,
    nodes: {
      ...source.nodes,
      screen: { ...source.nodes.screen!, children: ['card'] } as UiNode,
      card: { kind: 'component', id: 'card', definitionId: 'local.card', slots: {} },
      definition: { kind: 'element', id: 'definition', tag: 'section', children: ['slot'] },
      slot: { kind: 'slot', id: 'slot', name: 'content', fallback: ['dialog'] },
      dialog,
      ...(filled ? { body } : {}),
    },
    componentDefinitions: {
      'local.card': {
        id: 'local.card',
        revision: '1',
        root: 'definition',
        props: [],
        slots: { content: {} },
      },
    },
  };
}

it.each(['empty-repeat', 'local-fallback'] as const)(
  'preflights required content in %s and accepts its filled positive control',
  (mode) => {
    const rejected = compileScreen(fixture(mode, false));
    expect(rejected.ok).toBe(false);
    if (rejected.ok) return;
    expect(rejected.issues.some((issue) => issue.code === 'UI_COMPONENT_SLOT_REQUIRED')).toBe(true);
    expect(compileScreen(fixture(mode, true)).ok).toBe(true);
  },
);
