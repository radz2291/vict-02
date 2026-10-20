import { expect, it } from 'vitest';
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
