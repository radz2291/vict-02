import { expect, it, vi } from 'vitest';
import { mount, unmount, tick, flushSync } from 'svelte';
import { UiEditSession, type UiDocument } from '@victframework/ui';
import EditorCanvas from '../src/EditorCanvas.svelte';
import { literalTextTarget } from '../src/selection-tools.js';
import type { TransactionDraft } from '../src/commands.js';
const source: UiDocument = {
  schema: 'vict.ui-document@1',
  id: 'inline',
  revision: '1',
  root: 'root',
  nodes: {
    root: { id: 'root', kind: 'element', tag: 'main', children: ['heading'] },
    heading: { id: 'heading', kind: 'element', tag: 'h1', children: ['text'] },
    text: { id: 'text', kind: 'text', content: { type: 'literal', value: 'Original' } },
  },
  componentDefinitions: {},
  tokens: {},
  assets: {},
  conditions: {},
  styleSources: {},
  localState: {},
};
it('supports double-click, focus, cancel, keyboard commit and one undo through the shared session', async () => {
  const target = document.createElement('div');
  document.body.append(target);
  const session = UiEditSession.open({ document: source, storedRevision: '1' });
  let changes = 0;
  const canvas = mount(EditorCanvas, {
    target,
    props: {
      document: source,
      interactionMode: 'design',
      onSelect: () => {},
      dispatch: async () => {},
      navigate: () => {},
      onApply: (draft: TransactionDraft) => {
        changes++;
        return session.applyTransaction({
          ...draft,
          expectedDocumentRevision: session.workingRevision,
        }).ok;
      },
    },
  });
  try {
    flushSync();
    await tick();
    target
      .querySelector('h1')!
      .dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    await tick();
    let input = target.querySelector<HTMLTextAreaElement>('[aria-label="Edit canvas text"]')!;
    expect(document.activeElement).toBe(input);
    input.value = 'Discarded';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    flushSync();
    expect(changes).toBe(0);
    target
      .querySelector('h1')!
      .dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    await tick();
    input = target.querySelector<HTMLTextAreaElement>('[aria-label="Edit canvas text"]')!;
    input.value = 'Saved source';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }),
    );
    flushSync();
    expect(changes).toBe(1);
    expect(literalTextTarget(session.document, 'heading')?.value).toBe('Saved source');
    expect(session.undo().ok).toBe(true);
    expect(session.document.nodes).toEqual(source.nodes);
  } finally {
    await unmount(canvas);
    target.remove();
  }
});
it('leaves double-click behavior alone in Interact', async () => {
  const target = document.createElement('div');
  document.body.append(target);
  const canvas = mount(EditorCanvas, {
    target,
    props: {
      document: source,
      interactionMode: 'interact',
      onSelect: () => {},
      dispatch: async () => {},
      navigate: () => {},
      onApply: () => {
        throw new Error('Must not author in Interact');
      },
    },
  });
  try {
    flushSync();
    await tick();
    target.querySelector('h1')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await tick();
    expect(target.querySelector('textarea')).toBeNull();
  } finally {
    await unmount(canvas);
    target.remove();
  }
});
it('edits selected slot text even when the current definition does not render that slot', async () => {
  const bounds = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 10,
    right: 310,
    top: 100,
    bottom: 140,
    width: 300,
    height: 40,
    x: 10,
    y: 100,
    toJSON: () => ({}),
  });
  const hidden: UiDocument = {
    ...source,
    nodes: {
      root: { id: 'root', kind: 'element', tag: 'main', children: ['panel'] },
      panel: {
        id: 'panel',
        kind: 'component',
        definitionId: 'panel',
        slots: { body: { name: 'body', children: ['body-text'] } },
      },
      trigger: { id: 'trigger', kind: 'element', tag: 'button', children: [] },
      'body-text': {
        id: 'body-text',
        kind: 'text',
        content: { type: 'literal', value: 'Hidden body' },
      },
    },
    componentDefinitions: {
      panel: { id: 'panel', revision: '1', root: 'trigger', props: [], slots: { body: {} } },
    },
  };
  const target = document.createElement('div');
  document.body.append(target);
  const session = UiEditSession.open({ document: hidden, storedRevision: '1' });
  const canvas = mount(EditorCanvas, {
    target,
    props: {
      document: hidden,
      selectedOccurrence: 'inline|body-text',
      editTextSignal: Symbol('edit-hidden'),
      interactionMode: 'design',
      onSelect: () => {},
      dispatch: async () => {},
      navigate: () => {},
      onApply: (draft: TransactionDraft) =>
        session.applyTransaction({ ...draft, expectedDocumentRevision: session.workingRevision })
          .ok,
    },
  });
  try {
    flushSync();
    await tick();
    await tick();
    const input = target.querySelector<HTMLTextAreaElement>('[aria-label="Edit canvas text"]')!;
    expect(input).not.toBeNull();
    expect(input.value).toBe('Hidden body');
    input.value = 'Configured before opening';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }),
    );
    flushSync();
    expect(literalTextTarget(session.document, 'body-text')?.value).toBe(
      'Configured before opening',
    );
  } finally {
    await unmount(canvas);
    target.remove();
    bounds.mockRestore();
  }
});
