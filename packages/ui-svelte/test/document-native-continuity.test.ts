import { expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import {
  compileUiDocument,
  defaultSemanticElementCatalog,
  type UiDocument,
  type UiExtensionDescriptor,
  type UiValue,
} from '@victframework/ui';
import Host from './DocumentContinuityHost.svelte';
import Probe from './ContinuityOutputProbe.svelte';
import ScopedProbe from './ScopedChannelContinuityHost.svelte';
import { continuityEmissions } from './continuity-probe-emissions.js';
const source = (id = 'native-continuity'): UiDocument => ({
  schema: 'vict.ui-document@1',
  id,
  revision: '1',
  root: 'root',
  nodes: {
    root: { kind: 'element', id: 'root', tag: 'main', children: ['field'] },
    field: {
      kind: 'element',
      id: 'field',
      tag: 'input',
      children: [],
      attributes: { type: 'text', value: { type: 'ref', path: 'state.draft' } },
      interactions: [
        { on: 'change', action: 'setState', key: 'draft', value: { type: 'literal', value: '' } },
      ],
    },
  },
  localState: { draft: { key: 'draft', type: 'string', initial: 'Start' } },
  componentDefinitions: {},
  styleSources: {},
  tokens: {},
  conditions: {},
  assets: {},
});
function plan(document: UiDocument, descriptors: UiExtensionDescriptor[] = []) {
  const result = compileUiDocument(document, defaultSemanticElementCatalog(), descriptors);
  if (!result.ok) throw Error(JSON.stringify(result));
  return result.plan;
}
const settle = async () => {
  flushSync();
  await Promise.resolve();
  flushSync();
};
it('retains the live native input and focus across accepted same-document source echoes', async () => {
  let documentSource = source();
  const target = document.createElement('div');
  document.body.append(target);
  const app = mount(Host, {
    target,
    props: {
      plan: plan(documentSource),
      localState: documentSource.localState,
      onStateChange: (key, value) => {
        documentSource = {
          ...documentSource,
          revision: '2',
          localState: {
            ...documentSource.localState,
            [key]: { ...documentSource.localState[key]!, initial: value },
          },
        };
        app.supply(plan(documentSource), documentSource.localState, { [key]: value });
      },
    },
  });
  await settle();
  try {
    const input = target.querySelector('input')!;
    input.focus();
    input.value = 'Startx';
    input.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'x' }),
    );
    await settle();
    expect(target.querySelector('input')).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('Startx');
    input.value = 'Stxart';
    input.setSelectionRange(3, 3);
    input.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'x' }),
    );
    await settle();
    expect(target.querySelector('input')).toBe(input);
    expect(input.selectionStart).toBe(3);
    expect(input.selectionEnd).toBe(3);
  } finally {
    await unmount(app);
    target.remove();
  }
});
it('expires retained component emissions on a new plan without replacing its live DOM, and keeps output validation strict', async () => {
  continuityEmissions.length = 0;
  const base = source(),
    descriptor: UiExtensionDescriptor = {
      id: 'test.continuity',
      revision: '1',
      abi: 'vict.ui-component-abi@1',
      events: ['vict.ui-component-abi@1'],
      rendererImplementationId: 'test.continuity',
      props: [],
      outputs: [{ name: 'change', payload: 'string' }],
    };
  const documentSource: UiDocument = {
    ...base,
    nodes: {
      ...base.nodes,
      root: { kind: 'element', id: 'root', tag: 'main', children: ['field', 'probe'] },
      probe: {
        kind: 'component',
        id: 'probe',
        definitionId: descriptor.id,
        revision: '1',
        outputs: { change: { setState: { key: 'draft' } } },
      },
    },
  };
  const writes: unknown[] = [],
    diagnostics: { code: string }[] = [],
    target = document.createElement('div');
  document.body.append(target);
  const app = mount(Host, {
    target,
    props: {
      plan: plan(documentSource, [descriptor]),
      localState: documentSource.localState,
      descriptors: [descriptor],
      implementations: [
        {
          extensionId: descriptor.id,
          revision: '1',
          abi: 'vict.ui-component-abi@1',
          events: ['vict.ui-component-abi@1'],
          rendererImplementationId: descriptor.rendererImplementationId,
          component: Probe,
        },
      ],
      onStateChange: (...args) => writes.push(args),
      onDiagnostic: (issue) => diagnostics.push(issue),
    },
  });
  await settle();
  try {
    const button = target.querySelector('button')!,
      old = continuityEmissions.at(-1)!;
    app.supply(plan({ ...documentSource, revision: '2' }, [descriptor]), documentSource.localState);
    await settle();
    expect(target.querySelector('button')).toBe(button);
    old('change', 'expired');
    await settle();
    expect(writes).toEqual([]);
    expect(diagnostics.at(-1)?.code).toBe('UI_COMPONENT_OUTPUT_STALE');
    const current = continuityEmissions.at(-1)!;
    expect(current).not.toBe(old);
    current('ghost', 'undeclared');
    current('change', true);
    await settle();
    expect(writes).toEqual([]);
    expect(
      diagnostics.slice(-2).every((issue) => issue.code === 'UI_COMPONENT_OUTPUT_REJECTED'),
    ).toBe(true);
    current('change', 'valid');
    await settle();
    expect(writes).toEqual([['draft', 'valid']]);
    app.reset();
    await settle();
    current('change', 'expired by reset');
    await settle();
    expect(writes).toHaveLength(1);
    expect(diagnostics.at(-1)?.code).toBe('UI_COMPONENT_OUTPUT_STALE');
  } finally {
    await unmount(app);
    target.remove();
    continuityEmissions.length = 0;
  }
});
it('expires retained scoped channels on plan generation and refuses undeclared or wrongly typed new writes', async () => {
  type Channels = {
    write: (key: string, value: unknown) => void;
    emit: (name: string, payload?: UiValue) => void;
  };
  const channels: Channels[] = [],
    writes: unknown[] = [],
    outputs: unknown[] = [],
    diagnostics: string[] = [],
    target = document.createElement('div');
  document.body.append(target);
  const app = mount(ScopedProbe, {
    target,
    props: {
      onCapture: (value) => channels.push(value),
      onWrite: (...args) => writes.push(args),
      onOutput: (...args) => outputs.push(args),
      onDiagnostic: (code) => diagnostics.push(code),
    },
  });
  await settle();
  try {
    const old = channels.at(-1)!;
    app.replacePlan();
    await settle();
    old.write('draft', 'expired');
    old.emit('choose', 'expired');
    expect(writes).toEqual([]);
    expect(outputs).toEqual([]);
    expect(diagnostics).toContain('UI_COMPONENT_SLOT_SCOPE_REJECTED');
    expect(diagnostics).toContain('UI_COMPONENT_OUTPUT_REJECTED');
    const current = channels.at(-1)!;
    expect(current.write).not.toBe(old.write);
    current.write('missing', 'no');
    current.write('draft', true);
    expect(writes).toEqual([]);
    current.write('draft', 'valid');
    current.emit('choose', 'valid');
    expect(writes).toEqual([['draft', 'valid']]);
    expect(outputs).toEqual([['choose', 'valid']]);
  } finally {
    await unmount(app);
    target.remove();
  }
});
it('still replaces the live native subtree on explicit reset and different document identity', async () => {
  const original = source(),
    target = document.createElement('div');
  document.body.append(target);
  const app = mount(Host, {
    target,
    props: { plan: plan(original), localState: original.localState },
  });
  await settle();
  try {
    const first = target.querySelector('input')!;
    app.reset();
    await settle();
    expect(target.querySelector('input')).not.toBe(first);
    const second = target.querySelector('input')!,
      replacement = source('different-document');
    app.supply(plan(replacement), replacement.localState);
    await settle();
    expect(target.querySelector('input')).not.toBe(second);
  } finally {
    await unmount(app);
    target.remove();
  }
});
it('discards late action results after a plan refresh even while the live DOM is retained', async () => {
  const base = source(),
    documentSource: UiDocument = {
      ...base,
      nodes: {
        ...base.nodes,
        root: { kind: 'element', id: 'root', tag: 'main', children: ['field', 'save'] },
        save: {
          kind: 'element',
          id: 'save',
          tag: 'button',
          children: [],
          attributes: { 'aria-label': 'Save' },
          interactions: [{ on: 'click', action: 'invokeAction', actionId: 'save' }],
        },
      },
    };
  const compile = (document: UiDocument) => {
    const result = compileUiDocument(document, defaultSemanticElementCatalog(), [], {
      actionIds: ['save'],
    });
    if (!result.ok) throw Error(JSON.stringify(result));
    return result.plan;
  };
  let resolve!: (value: unknown) => void;
  const writes: unknown[] = [],
    target = document.createElement('div');
  document.body.append(target);
  const app = mount(Host, {
    target,
    props: {
      plan: compile(documentSource),
      localState: documentSource.localState,
      dispatch: () =>
        new Promise((next) => {
          resolve = next;
        }),
      actionState: { save: { result: 'draft' } },
      onStateChange: (...args) => writes.push(args),
    },
  });
  await settle();
  try {
    const button = target.querySelector<HTMLButtonElement>('button')!;
    button.click();
    await settle();
    app.supply(compile({ ...documentSource, revision: '2' }), documentSource.localState, {
      draft: 'new source',
    });
    await settle();
    expect(target.querySelector('button')).toBe(button);
    resolve({ ok: true, value: 'expired result' });
    await settle();
    expect(target.querySelector('input')!.value).toBe('new source');
    expect(writes).toEqual([]);
  } finally {
    await unmount(app);
    target.remove();
  }
});
