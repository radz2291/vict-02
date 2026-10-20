import { describe, expect, it } from 'vitest';
import { mount, unmount, flushSync, tick } from 'svelte';
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

it('gives contextual properties one category at a time and leaves state definitions to the document', async () => {
  const target = document.createElement('div');
  document.body.append(target);
  const editor = mount(Inspector, {
    target,
    props: {
      contextual: true,
      section: 'Style',
      document: source,
      selectedOccurrence: 'input-content|input',
      onApply: () => {},
    },
  });
  try {
    flushSync();
    expect(target.querySelector('[aria-label="value source"]')).not.toBeNull();
    expect(target.querySelector('[aria-label="placeholder value"]')).toBeNull();
    expect(target.querySelector('[aria-label="Inspector sections"]')).toBeNull();
    const categories = target.querySelector('[role="tablist"][aria-label="Format categories"]')!;
    const buttons = [...categories.querySelectorAll<HTMLButtonElement>('button')];
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Content',
      'Text',
      'Fill',
      'Spacing',
      'Layout',
      'Rules',
    ]);
    const text = buttons.find((button) => button.textContent === 'Text')!;
    text.click();
    flushSync();
    expect(target.querySelector('[aria-label="Font family"]')).not.toBeNull();
    expect(target.querySelector('[aria-label="Text size"]')).not.toBeNull();
    text.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    await tick();
    expect(document.activeElement).toBe(buttons[0]);
    const inputPages = target.querySelector('[aria-label="Input content pages"]')!;
    [...inputPages.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent === 'Placeholder')!
      .click();
    flushSync();
    expect(target.querySelector('[aria-label="placeholder value"]')).not.toBeNull();
    expect(target.querySelector('[aria-label="value source"]')).toBeNull();
    expect(target.querySelector('[aria-label="Starting value"]')).toBeNull();
    expect(target.querySelector('details')).toBeNull();
    expect(target.textContent).not.toContain('Advanced · source & declarations');
  } finally {
    await unmount(editor);
    target.remove();
  }
});

it('uses non-expanding text pages with exclusive controls and undoable edits', async () => {
  const literal: UiDocument = {
    ...source,
    nodes: {
      root: { id: 'root', kind: 'element', tag: 'main', children: ['title'] },
      title: {
        id: 'title',
        kind: 'element',
        tag: 'h1',
        children: ['copy'],
        localStyle: [{ property: 'font-weight', value: { type: 'text', value: '600' } }],
      },
      copy: { id: 'copy', kind: 'text', content: { type: 'literal', value: 'Simple text' } },
    },
  };
  const session = UiEditSession.open({ document: literal, storedRevision: '1' });
  const target = document.createElement('div');
  document.body.append(target);
  const editor = mount(Inspector, {
    target,
    props: {
      contextual: true,
      section: 'Style',
      document: literal,
      selectedOccurrence: 'input-content|title',
      onApply: (draft: TransactionDraft) => {
        expect(
          session.applyTransaction({ ...draft, expectedDocumentRevision: session.workingRevision })
            .ok,
        ).toBe(true);
      },
    },
  });
  try {
    flushSync();
    const categories = target.querySelector('[aria-label="Format categories"]')!;
    expect([...categories.querySelectorAll('[role=tab]')].map((tab) => tab.textContent)).toEqual([
      'Text',
      'Fill',
      'Spacing',
      'Layout',
      'Rules',
    ]);
    const pages = target.querySelector('[aria-label="Text pages"]')!;
    expect([...pages.querySelectorAll('[role=tab]')].map((tab) => tab.textContent)).toEqual([
      'Content',
      'Font',
      'Paragraph',
    ]);
    expect(target.querySelector('details')).toBeNull();
    expect(target.querySelector('[aria-label="Text content"]')).toBeNull();
    expect(target.querySelectorAll('[aria-label="Text size"]')).toHaveLength(1);
    const weight = target.querySelector<HTMLSelectElement>('[aria-label="Weight"]')!;
    weight.value = '400';
    weight.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();
    expect(session.document.nodes.title?.localStyle).toContainEqual({
      property: 'font-weight',
      value: { type: 'text', value: '400' },
    });
    expect(session.undo().ok).toBe(true);
    expect(session.document.nodes).toEqual(literal.nodes);
    const page = (name: string) =>
      [...pages.querySelectorAll<HTMLButtonElement>('button')].find(
        (button) => button.textContent === name,
      )!;
    page('Paragraph').click();
    flushSync();
    expect(target.querySelector('[aria-label="Text size"]')).toBeNull();
    const spacing = target.querySelector<HTMLInputElement>('[aria-label="Letter spacing"]')!;
    spacing.value = '2';
    spacing.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();
    expect(session.document.nodes.title?.localStyle).toContainEqual({
      property: 'letter-spacing',
      value: { type: 'text', value: '2px' },
    });
    expect(session.undo().ok).toBe(true);
    page('Content').click();
    flushSync();
    const content = target.querySelector<HTMLTextAreaElement>('[aria-label="Text content"]')!;
    expect(content.value).toBe('Simple text');
    const unchangedRevision = session.workingRevision;
    content.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }),
    );
    flushSync();
    expect(session.workingRevision).toBe(unchangedRevision);
    content.value = 'A toolbar draft';
    content.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    expect(session.document.nodes).toEqual(literal.nodes);
    expect(page('Font').disabled).toBe(true);
    page('Content').click();
    flushSync();
    expect(content.closest('[hidden]')).not.toBeNull();
    expect(content.value).toBe('A toolbar draft');
    page('Content').click();
    flushSync();
    expect(content.closest('[hidden]')).toBeNull();
    expect(
      [...categories.querySelectorAll<HTMLButtonElement>('button')].find(
        (button) => button.textContent === 'Fill',
      )?.disabled,
    ).toBe(true);
    content.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    flushSync();
    expect(content.value).toBe('Simple text');
    expect(page('Font').disabled).toBe(false);
    content.value = 'Edited in the toolbar';
    content.dispatchEvent(new Event('input', { bubbles: true }));
    content.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }),
    );
    flushSync();
    expect(session.document.nodes.copy).toMatchObject({
      content: { value: 'Edited in the toolbar' },
    });
    expect(session.undo().ok).toBe(true);
    expect(session.document.nodes).toEqual(literal.nodes);
    [...categories.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent === 'Rules')!
      .click();
    flushSync();
    expect(target.querySelector('[aria-label="Style target"]')).not.toBeNull();
    expect(target.querySelector('details')).toBeNull();
    [...target.querySelectorAll<HTMLButtonElement>('[role=tab]')]
      .find((button) => button.textContent === 'Values & reset')!
      .click();
    flushSync();
    expect(target.querySelector('[aria-label="Setting details"]')).not.toBeNull();
  } finally {
    await unmount(editor);
    target.remove();
  }
});

it('retains rejected property drafts and locks context until cancellation', async () => {
  const target = document.createElement('div');
  document.body.append(target);
  let dirty = false;
  let attempts = 0;
  const editor = mount(Inspector, {
    target,
    props: {
      contextual: true,
      document: source,
      selectedOccurrence: 'input-content|input',
      onTextDraftChange: (next: boolean) => (dirty = next),
      onApply: () => {
        attempts++;
        return false;
      },
    },
  });
  try {
    flushSync();
    [...target.querySelectorAll<HTMLButtonElement>('[role=tab]')]
      .find((button) => button.textContent === 'Placeholder')!
      .click();
    flushSync();
    const input = target.querySelector<HTMLInputElement>('[aria-label="placeholder value"]')!;
    const original = input.value;
    input.value = 'Keep this draft';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    expect(dirty).toBe(true);
    expect(
      [...target.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(
        (button) => button.textContent === 'Text',
      )?.disabled,
    ).toBe(true);
    [...target.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent === 'Apply value')!
      .click();
    flushSync();
    expect(attempts).toBe(1);
    expect(dirty).toBe(true);
    expect(input.value).toBe('Keep this draft');
    [...target.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent === 'Cancel')!
      .click();
    flushSync();
    expect(dirty).toBe(false);
    expect(input.value).toBe(original);
    expect(target.querySelector('details')).toBeNull();
  } finally {
    await unmount(editor);
    target.remove();
  }
});

it('toggles categories, settings and text pages independently while keeping their contents mounted', async () => {
  const target = document.createElement('div');
  document.body.append(target);
  const editor = mount(Inspector, {
    target,
    props: {
      contextual: true,
      document: source,
      selectedOccurrence: 'input-content|input',
      onApply: () => true,
    },
  });
  try {
    flushSync();
    const tab = (name: string) =>
      [...target.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(
        (button) => button.textContent === name,
      )!;
    const content = tab('Content');
    content.click();
    flushSync();
    expect(content.getAttribute('aria-expanded')).toBe('false');
    expect(target.querySelector('[aria-label="value source"]')?.closest('[hidden]')).not.toBeNull();
    content.click();
    flushSync();
    expect(target.querySelector('[aria-label="value source"]')?.closest('[hidden]')).toBeNull();
    const value = tab('Value');
    value.click();
    flushSync();
    expect(value.getAttribute('aria-selected')).toBe('false');
    expect(target.querySelector('[aria-label="value source"]')?.closest('[hidden]')).not.toBeNull();
    value.click();
    flushSync();
    expect(target.querySelector('[aria-label="value source"]')?.closest('[hidden]')).toBeNull();
    tab('Text').click();
    flushSync();
    const font = tab('Font');
    font.click();
    flushSync();
    expect(target.querySelector('[aria-label="Font family"]')?.closest('[hidden]')).not.toBeNull();
    font.click();
    flushSync();
    expect(target.querySelector('[aria-label="Font family"]')?.closest('[hidden]')).toBeNull();
  } finally {
    await unmount(editor);
    target.remove();
  }
});
