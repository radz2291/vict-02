import { expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import {
  compileUiDocument,
  defaultSemanticElementCatalog,
  type UiDocument,
} from '@victframework/ui';
import Host from './DocumentContinuityHost.svelte';

const source = (id = 'independent'): UiDocument => ({
  schema: 'vict.ui-document@1',
  id,
  revision: '1',
  root: 'root',
  nodes: {
    root: { kind: 'element', id: 'root', tag: 'main', children: ['field'] },
    field: {
      kind: 'element',
      id: 'field',
      tag: 'textarea',
      children: [],
      attributes: { value: { type: 'ref', path: 'state.draft' } },
      interactions: [
        { on: 'change', action: 'setState', key: 'draft', value: { type: 'literal', value: '' } },
      ],
    },
  },
  localState: { draft: { key: 'draft', type: 'string', initial: 'Initial' } },
  componentDefinitions: {},
  styleSources: {},
  tokens: {},
  conditions: {},
  assets: {},
});
const compile = (value: UiDocument) => {
  const result = compileUiDocument(value, defaultSemanticElementCatalog());
  if (!result.ok) throw Error(JSON.stringify(result));
  return result.plan;
};
const settle = async () => {
  flushSync();
  await Promise.resolve();
  flushSync();
};

it('independent: textarea preserves identity/caret across fresh equal-revision plans and another document clears private state', async () => {
  const target = document.createElement('div');
  document.body.append(target);
  const original = source(),
    writes: unknown[] = [];
  const app = mount(Host, {
    target,
    props: {
      plan: compile(original),
      localState: original.localState,
      onStateChange: (...args) => writes.push(args),
    },
  });
  await settle();
  try {
    const field = target.querySelector('textarea')!;
    field.focus();
    field.value = 'private draft';
    field.setSelectionRange(3, 5);
    field.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'x' }));
    await settle();
    // Neither source revision nor source bytes change: plan identity still changes.
    app.supply(compile(original), original.localState);
    await settle();
    expect(target.querySelector('textarea')).toBe(field);
    expect(document.activeElement).toBe(field);
    expect(field.value).toBe('private draft');
    expect([field.selectionStart, field.selectionEnd]).toEqual([3, 5]);
    const other = source('other');
    app.supply(compile(other), other.localState);
    await settle();
    expect(target.querySelector('textarea')).not.toBe(field);
    expect(target.querySelector('textarea')!.value).toBe('Initial');
    const second = target.querySelector('textarea')!;
    second.value = 'second draft';
    second.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await settle();
    app.reset();
    await settle();
    expect(target.querySelector('textarea')).not.toBe(second);
    expect(target.querySelector('textarea')!.value).toBe('Initial');
    expect(writes).toEqual([
      ['draft', 'private draft'],
      ['draft', 'second draft'],
    ]);
  } finally {
    await unmount(app);
    target.remove();
  }
});

it('independent: a retained native handler obeys changed declarations and rejects invalid host supply', async () => {
  const target = document.createElement('div');
  document.body.append(target);
  const original = source();
  original.nodes.field = { ...original.nodes.field, tag: 'input' } as typeof original.nodes.field;
  const writes: unknown[] = [],
    diagnostics: { code: string }[] = [];
  const app = mount(Host, {
    target,
    props: {
      plan: compile(original),
      localState: original.localState,
      onStateChange: (...args) => writes.push(args),
      onDiagnostic: (issue) => diagnostics.push(issue),
    },
  });
  await settle();
  try {
    const field = target.querySelector('input')!;
    const changed: UiDocument = {
      ...original,
      revision: '2',
      localState: { draft: { key: 'draft', type: 'number', initial: 7 } },
    };
    app.supply(compile(changed), changed.localState, {
      draft: 'must refuse',
      undeclared: 'must refuse',
    });
    await settle();
    expect(target.querySelector('input')).toBe(field);
    expect(String(field.value)).toBe('7');
    expect(
      diagnostics.filter((issue) => issue.code === 'UI_RENDER_STATE_VALUE_REJECTED'),
    ).toHaveLength(2);
    field.value = 'invalid string';
    field.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await settle();
    expect(writes).toEqual([]);
    const removed: UiDocument = {
      ...original,
      revision: '3',
      localState: {},
      nodes: {
        ...original.nodes,
        field: {
          kind: 'element',
          id: 'field',
          tag: 'input',
          children: [],
          attributes: { 'aria-label': 'No binding' },
        },
      },
    };
    app.supply(compile(removed), removed.localState);
    await settle();
    field.value = 'no authority';
    field.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await settle();
    expect(writes).toEqual([]);
  } finally {
    await unmount(app);
    target.remove();
  }
});
