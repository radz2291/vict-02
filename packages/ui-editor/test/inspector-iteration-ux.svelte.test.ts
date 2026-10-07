import { describe, it, expect } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import {
  UiEditSession,
  compileUiDocument,
  defaultSemanticElementCatalog,
  type UiDocument,
} from '@victframework/ui';
import type { TransactionDraft } from '../src/commands.js';
import Inspector from '../src/Inspector.svelte';
import InspectorControl from '../src/InspectorControl.svelte';
import Layers from '../src/Layers.svelte';
import { parsePanelColor } from '../src/color-ux.js';

const fixture: UiDocument = {
  schema: 'vict.ui-document@1',
  id: 'iteration',
  revision: '1',
  root: 'root',
  nodes: {
    root: { id: 'root', kind: 'element', tag: 'main', children: ['card'] },
    card: {
      id: 'card',
      kind: 'element',
      tag: 'article',
      children: ['copy'],
      localStyle: [{ property: 'padding-top', value: { type: 'text', value: '11px' } }],
      styleSources: ['shared'],
    },
    copy: {
      id: 'copy',
      kind: 'text',
      content: { type: 'literal', value: 'Find this distinctive card' },
    },
  },
  componentDefinitions: {},
  tokens: {},
  localState: {},
  assets: {},
  conditions: { narrow: { id: 'narrow', kind: 'media', query: '(max-width: 700px)' } },
  styleSources: {
    shared: {
      id: 'shared',
      declarations: [{ property: 'padding-left', value: { type: 'text', value: '7px' } }],
    },
  },
};
function button(target: HTMLElement, label: string) {
  const found = [...target.querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => b.textContent?.trim() === label || b.getAttribute('aria-label') === label,
  );
  expect(found).toBeDefined();
  found!.click();
  flushSync();
}

describe('Inspector iteration: atomic spacing, color fidelity and Layers search', () => {
  it('linked side edits use one history step and preserve attached/conditional sources', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    const session = UiEditSession.open({ document: fixture, storedRevision: '1' });
    const drafts: TransactionDraft[] = [];
    const instance = mount(Inspector, {
      target,
      props: {
        document: fixture,
        selectedOccurrence: 'iteration|card',
        styleConditions: [{ id: 'narrow', label: 'Narrow' }],
        onApply: (draft: TransactionDraft) => {
          drafts.push(draft);
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
      button(target, 'Style');
      button(target, 'Link padding sides');
      const input = target.querySelector<HTMLInputElement>('[aria-label="padding top"]')!;
      input.value = '28';
      input.dispatchEvent(new Event('change', { bubbles: true }));
      flushSync();
      expect(drafts).toHaveLength(1);
      expect(drafts[0]!.commands).toHaveLength(4);
      expect(
        session.document.nodes.card?.localStyle
          ?.filter((d) => d.property.startsWith('padding-'))
          .map((d) => d.value),
      ).toEqual(Array(4).fill({ type: 'text', value: '28px' }));
      expect(session.document.styleSources.shared).toEqual(fixture.styleSources.shared);
      expect(session.undo().ok).toBe(true);
      expect(session.document.nodes.card?.localStyle).toEqual(fixture.nodes.card?.localStyle);
      const condition = target.querySelector<HTMLSelectElement>('[aria-label="Style target"]')!;
      condition.value = 'narrow';
      condition.dispatchEvent(new Event('change', { bubbles: true }));
      flushSync();
      button(target, 'Link padding sides'); // New destination has independent ephemeral linking.
      const conditional = target.querySelector<HTMLInputElement>('[aria-label="padding top"]')!;
      conditional.value = '2rem';
      conditional.dispatchEvent(new Event('change', { bubbles: true }));
      flushSync();
      expect(drafts[1]!.commands).toHaveLength(4);
      expect(session.document.styleSources['src.card.narrow.plain']?.declarations).toHaveLength(4);
      expect(session.document.nodes.card?.localStyle).toEqual(fixture.nodes.card?.localStyle);
      expect(session.undo().ok).toBe(true);
    } finally {
      await unmount(instance);
      target.remove();
    }
  });
  it('transparent and alpha colors retain faithful channels and picker changes preserve opacity', async () => {
    expect(parsePanelColor('transparent')).toMatchObject({ hex: '#000000', alpha: 0 });
    expect(parsePanelColor('#1234')).toMatchObject({ hex: '#112233', alpha: 68 / 255 });
    expect(parsePanelColor('rgb(100% 0% 50% / 25%)')).toMatchObject({
      hex: '#ff0080',
      alpha: 0.25,
    });
    expect(parsePanelColor('unresolved')).toBeUndefined();
    const target = document.createElement('div');
    document.body.append(target);
    const changes: string[] = [];
    const instance = mount(InspectorControl, {
      target,
      props: {
        label: 'Background',
        kind: 'color',
        value: 'rgba(10, 20, 30, .5)',
        onChange: (v: string) => changes.push(v),
        onReset: () => {},
      },
    });
    try {
      flushSync();
      expect(changes).toEqual([]);
      expect(target.querySelector<HTMLElement>('.swatch span')?.style.background).toContain('0.5');
      const picker = target.querySelector<HTMLInputElement>('[aria-label="Background picker"]')!;
      picker.value = '#ff0000';
      picker.dispatchEvent(new Event('change', { bubbles: true }));
      expect(changes[0]).toBe('rgba(255, 0, 0, 0.5)');
      const alpha = target.querySelector<HTMLInputElement>('[aria-label="Background opacity"]')!;
      alpha.value = '25';
      alpha.dispatchEvent(new Event('change', { bubbles: true }));
      expect(changes[1]).toBe('rgba(10, 20, 30, 0.25)');
    } finally {
      await unmount(instance);
      target.remove();
    }
  });
  it('bare numbers commit with px on both editor paths; expressions stay textual', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    const changes: string[] = [];
    // Expression display value -> textual editor path.
    const instance = mount(InspectorControl, {
      target,
      props: {
        label: 'Text size',
        kind: 'number',
        value: 'clamp(34px, 5vw, 56px)',
        onChange: (v: string) => changes.push(v),
        onReset: () => {},
      },
    });
    try {
      flushSync();
      const textual = target.querySelector<HTMLInputElement>('[aria-label="Text size"]')!;
      expect(textual.type).toBe('text');
      textual.value = '61';
      textual.dispatchEvent(new Event('input', { bubbles: true }));
      textual.dispatchEvent(new Event('change', { bubbles: true }));
      expect(changes[0]).toBe('61px');
      // Typing a bare number must not flip the field to the numeric editor
      // mid-typing (keystroke loss): the branch keys on the committed value.
      textual.value = '6';
      textual.dispatchEvent(new Event('input', { bubbles: true }));
      flushSync();
      const stillTextual = target.querySelector<HTMLInputElement>('[aria-label="Text size"]');
      expect(stillTextual).toBeDefined();
      expect(stillTextual!.type).toBe('text');
      expect(changes.length).toBe(1);
      textual.value = 'calc(1em + 2px)';
      textual.dispatchEvent(new Event('input', { bubbles: true }));
      textual.dispatchEvent(new Event('change', { bubbles: true }));
      expect(changes[1]).toBe('calc(1em + 2px)');
    } finally {
      await unmount(instance);
      target.remove();
    }
    // Unitized authored value -> numeric editor path keeps/derives px.
    const target2 = document.createElement('div');
    document.body.append(target2);
    const changes2: string[] = [];
    const instance2 = mount(InspectorControl, {
      target: target2,
      props: {
        label: 'Text size',
        kind: 'number',
        value: '56px',
        onChange: (v: string) => changes2.push(v),
        onReset: () => {},
      },
    });
    try {
      flushSync();
      const numericInput = target2.querySelector<HTMLInputElement>('[aria-label="Text size"]')!;
      expect(numericInput.type).toBe('number');
      numericInput.value = '61';
      numericInput.dispatchEvent(new Event('change', { bubbles: true }));
      expect(changes2[0]).toBe('61px');
    } finally {
      await unmount(instance2);
      target2.remove();
    }
  });
  it('search exposes matching content with ancestors and selects the exact source occurrence', async () => {
    const compiled = compileUiDocument(fixture, defaultSemanticElementCatalog());
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const target = document.createElement('div');
    document.body.append(target);
    const selections: string[] = [];
    const instance = mount(Layers, {
      target,
      props: {
        plan: compiled.plan,
        document: fixture,
        onSelect: (key: string) => selections.push(key),
      },
    });
    try {
      flushSync();
      const search = target.querySelector<HTMLInputElement>('[aria-label="Search layers"]')!;
      search.value = 'distinctive';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      flushSync();
      expect(target.querySelector('[data-key="iteration|root"]')).not.toBeNull();
      const text = target.querySelector<HTMLButtonElement>('[data-key="iteration|copy"]')!;
      expect(text).not.toBeNull();
      text.click();
      flushSync();
      expect(selections).toEqual(['iteration|copy']);
      search.value = 'no such content';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      flushSync();
      expect(target.querySelectorAll('[role=treeitem]')).toHaveLength(0);
      expect(target.textContent).toContain('No matching elements');
      button(target, 'Clear layers search');
      expect(target.querySelector('[data-key="iteration|card"]')).not.toBeNull();
      expect(fixture.nodes.copy).toEqual({
        id: 'copy',
        kind: 'text',
        content: { type: 'literal', value: 'Find this distinctive card' },
      });
    } finally {
      await unmount(instance);
      target.remove();
    }
  });
});
