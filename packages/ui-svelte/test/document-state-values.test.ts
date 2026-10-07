import { expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import {
  compileUiDocument,
  defaultSemanticElementCatalog,
  type UiDocument,
} from '@victframework/ui';
import Host from './DocumentStateHost.svelte';

it('merges only correctly typed declared host state, preserves local edits, and applies values after reset', () => {
  const doc: UiDocument = {
    schema: 'vict.ui-document@1',
    id: 'test.presentation',
    revision: '1',
    root: 'root',
    nodes: {
      root: { kind: 'element', id: 'root', tag: 'section', children: ['busy', 'draft', 'input'] },
      busy: {
        kind: 'text',
        id: 'busy',
        content: { type: 'expression', expression: { type: 'ref', path: 'state.busy' } },
      },
      draft: {
        kind: 'text',
        id: 'draft',
        content: { type: 'expression', expression: { type: 'ref', path: 'state.draft' } },
      },
      input: {
        kind: 'element',
        id: 'input',
        tag: 'input',
        attributes: { type: 'text' },
        children: [],
        interactions: [
          { on: 'change', action: 'setState', key: 'draft', value: { type: 'literal', value: '' } },
        ],
      },
    },
    componentDefinitions: {},
    styleSources: {},
    tokens: {},
    conditions: {},
    assets: {},
    localState: {
      busy: { key: 'busy', type: 'boolean', initial: false },
      draft: { key: 'draft', type: 'string', initial: 'initial' },
    },
  };
  const compiled = compileUiDocument(doc, defaultSemanticElementCatalog());
  expect(compiled.ok, !compiled.ok ? JSON.stringify(compiled.issues) : '').toBe(true);
  if (!compiled.ok) return;
  const target = document.createElement('div');
  const diagnostics: { code: string; detail?: Readonly<Record<string, unknown>> }[] = [];
  const instance = mount(Host, {
    target,
    props: {
      plan: compiled.plan,
      localState: doc.localState,
      diagnostic: (diagnostic: { code: string; detail?: Readonly<Record<string, unknown>> }) =>
        diagnostics.push(diagnostic),
    },
  });
  flushSync();
  try {
    const text = (node: string) => target.querySelector(`[data-ui-node="${node}"]`)?.textContent;
    expect(text('busy')).toBe('false');
    const input = target.querySelector('input')!;
    input.value = 'local correction';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();
    expect(text('draft')).toBe('local correction');
    instance.update({ busy: true, draft: 9, invented: 'rejected' });
    flushSync();
    expect(text('busy')).toBe('true');
    expect(text('draft')).toBe('local correction');
    expect(diagnostics.map((diagnostic) => diagnostic.detail?.['reason'])).toEqual([
      'type-mismatch',
      'undeclared',
    ]);
    instance.update({ busy: false });
    flushSync();
    expect(text('busy')).toBe('false');
    expect(text('draft')).toBe('local correction');
    instance.update({ busy: true }, true);
    flushSync();
    expect(text('busy')).toBe('true');
    expect(text('draft')).toBe('initial');
  } finally {
    unmount(instance);
  }
});
