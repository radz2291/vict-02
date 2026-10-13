import { describe, expect, it } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import { UiEditSession, type UiDocument } from '@victframework/ui';
import Inspector from '../src/Inspector.svelte';
import Composer from '../src/Composer.svelte';
import { setStateInitial, type TransactionDraft } from '../src/commands.js';

const source: UiDocument = {
  schema: 'vict.ui-document@1',
  id: 'input-content',
  revision: '1',
  root: 'root',
  nodes: {
    root: { id: 'root', kind: 'element', tag: 'main', children: ['input'] },
    input: {
      id: 'input',
      kind: 'element',
      tag: 'input',
      children: [],
      attributes: {
        'aria-label': 'Message',
        placeholder: 'Your message',
        value: { type: 'ref', path: 'state.message' },
      },
      interactions: [
        {
          on: 'change',
          action: 'setState',
          key: 'message',
          value: { type: 'ref', path: 'state.message' },
        },
      ],
    },
  },
  componentDefinitions: {},
  styleSources: {},
  tokens: {},
  conditions: {},
  assets: {},
  localState: { message: { key: 'message', type: 'string', initial: 'Saved hello' } },
};
describe('input content and composition affordances', () => {
  it('edits saved starting state without replacing the input binding or runtime connection, with undo/redo', async () => {
    const session = UiEditSession.open({ document: source, storedRevision: '1' });
    const target = document.createElement('div');
    document.body.append(target);
    const inspector = mount(Inspector, {
      target,
      props: {
        document: source,
        selectedOccurrence: 'input-content|input',
        onApply: (draft: TransactionDraft) => {
          expect(
            session.applyTransaction({
              ...draft,
              expectedDocumentRevision: session.workingRevision,
            }).ok,
          ).toBe(true);
        },
      },
    });
    try {
      flushSync();
      expect(target.textContent).not.toContain('No direct text content');
      expect(target.querySelector('[aria-label="placeholder value"]')).not.toBeNull();
      const initial = target.querySelector<HTMLTextAreaElement>('[aria-label="Starting value"]')!;
      expect(initial.value).toBe('Saved hello');
      initial.value = 'Revised starting content';
      initial.dispatchEvent(new Event('input', { bubbles: true }));
      flushSync();
      [...target.querySelectorAll('button')]
        .find((button) => button.textContent === 'Apply starting value')!
        .click();
      flushSync();
      expect(session.document.localState.message?.initial).toBe('Revised starting content');
      expect(session.document.nodes.input).toEqual(source.nodes.input);
      expect(session.undo().ok).toBe(true);
      expect(session.document.localState.message?.initial).toBe('Saved hello');
      expect(session.redo().ok).toBe(true);
      expect(session.document.localState.message?.initial).toBe('Revised starting content');
    } finally {
      await unmount(inspector);
      target.remove();
    }
  });
  it('refuses invalid authored starting types atomically', () => {
    const session = UiEditSession.open({ document: source, storedRevision: '1' });
    expect(
      session.applyTransaction({
        ...setStateInitial({ requestId: 'bad-type', document: source, key: 'message', value: 123 }),
        expectedDocumentRevision: session.workingRevision,
      }).ok,
    ).toBe(false);
    expect(session.document).toEqual(source);
  });
  it('shows arrangement once while preserving insertion destinations', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    const composer = mount(Composer, {
      target,
      props: {
        document: source,
        selectedNodeId: 'input',
        recipes: [],
        showArrange: false,
        onApply: () => true,
      },
    });
    try {
      flushSync();
      expect(target.textContent).not.toContain('Arrange selection');
      expect(target.querySelector('[aria-label="Insert position"]')).not.toBeNull();
    } finally {
      await unmount(composer);
      target.remove();
    }
    const layerTarget = document.createElement('div');
    document.body.append(layerTarget);
    const arrangement = mount(Composer, {
      target: layerTarget,
      props: {
        document: source,
        selectedNodeId: 'input',
        recipes: [],
        showInsert: false,
        onApply: () => true,
      },
    });
    try {
      flushSync();
      expect(layerTarget.textContent).toContain('Arrange selection');
      expect(layerTarget.querySelector('[aria-label="Insert position"]')).toBeNull();
    } finally {
      await unmount(arrangement);
      layerTarget.remove();
    }
  });
});
