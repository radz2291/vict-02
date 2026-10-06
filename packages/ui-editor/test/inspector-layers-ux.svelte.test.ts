import type { TransactionDraft } from '../src/commands.js';
import { describe, it, expect } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import {
  compileUiDocument,
  defaultSemanticElementCatalog,
  UiEditSession,
  type UiDocument,
} from '@victframework/ui';
import Inspector from '../src/Inspector.svelte';
import Layers from '../src/Layers.svelte';

const fixture: UiDocument = {
  schema: 'vict.ui-document@1',
  id: 'ux',
  revision: '1',
  root: 'root',
  nodes: {
    root: {
      id: 'root',
      kind: 'element',
      tag: 'main',
      children: ['title', 'a', 'b'],
      localStyle: [{ property: 'color', value: { type: 'text', value: 'navy' } }],
    },
    title: { id: 'title', kind: 'element', tag: 'h1', children: ['text'] },
    text: { id: 'text', kind: 'text', content: { type: 'literal', value: 'A useful heading' } },
    a: { id: 'a', kind: 'component', definitionId: 'card' },
    b: { id: 'b', kind: 'component', definitionId: 'card' },
    card: { id: 'card', kind: 'element', tag: 'article', children: ['copy'] },
    copy: { id: 'copy', kind: 'text', content: { type: 'literal', value: 'Shared card' } },
  },
  componentDefinitions: { card: { id: 'card', revision: '1', root: 'card', props: [], slots: {} } },
  styleSources: {},
  tokens: {},
  conditions: {},
  localState: {},
  assets: {},
};

function click(target: HTMLElement, label: string) {
  [...target.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)?.click();
  flushSync();
}

describe('Inspector / Layers UX semantic regressions', () => {
  it('reconnecting navigation preserves the existing canonical parameter bindings', async () => {
    const documentWithRoute: UiDocument = {
      ...fixture,
      nodes: {
        ...fixture.nodes,
        title: {
          ...fixture.nodes.title!,
          interactions: [
            {
              on: 'click',
              action: 'navigate',
              routeId: 'route.a',
              params: { id: { type: 'literal', value: 'keep-param' } },
            },
          ],
        },
      },
    };
    const target = document.createElement('div');
    document.body.append(target);
    const session = UiEditSession.open({ document: documentWithRoute, storedRevision: '1' });
    const inspector = mount(Inspector, {
      target,
      props: {
        document: documentWithRoute,
        selectedOccurrence: 'ux|title',
        knownRouteIds: ['route.a', 'route.b'],
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
      click(target, 'Behavior');
      const route = target.querySelector<HTMLSelectElement>('[aria-label="Route id"]')!;
      route.value = 'route.b';
      route.dispatchEvent(new Event('change', { bubbles: true }));
      flushSync();
      click(target, 'Connect navigation');
      expect(session.document.nodes.title?.interactions).toEqual([
        {
          on: 'click',
          action: 'navigate',
          routeId: 'route.b',
          params: { id: { type: 'literal', value: 'keep-param' } },
        },
      ]);
    } finally {
      await unmount(inspector);
      target.remove();
    }
  });
  it('text selection styles its source container through the session and reset retains inherited source', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    const session = UiEditSession.open({ document: fixture, storedRevision: '1' });
    let commands: readonly unknown[] = [];
    const inspector = mount(Inspector, {
      target,
      props: {
        document: fixture,
        selectedOccurrence: 'ux|text',
        readEffective: () => 'navy',
        onApply: (draft: TransactionDraft) => {
          commands = draft.commands;
          const outcome = session.applyTransaction({
            ...draft,
            expectedDocumentRevision: session.workingRevision,
          });
          expect(outcome.ok).toBe(true);
        },
      },
    });
    try {
      flushSync();
      click(target, 'Style');
      click(target, 'Override Text color');
      expect(commands).toEqual([
        {
          op: 'setStyleDeclaration',
          nodeId: 'title',
          property: 'color',
          value: { type: 'text', value: 'navy' },
        },
      ]);
      expect(session.document.nodes.root?.localStyle).toEqual(fixture.nodes.root?.localStyle);
      expect(target.textContent).toContain('Inheritable property');
      expect(session.undo().ok).toBe(true);
      expect(session.document.nodes.title?.localStyle).toBeUndefined();
    } finally {
      await unmount(inspector);
      target.remove();
    }
  });

  it('selection reveals a collapsed component without a reactive loop and keeps exact occurrence identity', async () => {
    const compiled = compileUiDocument(fixture, defaultSemanticElementCatalog());
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const selected: string[] = [];
    const target = document.createElement('div');
    document.body.append(target);
    const layers = mount(Layers, {
      target,
      props: {
        plan: compiled.plan,
        document: fixture,
        selectedOccurrence: 'ux|card|a@card',
        onSelect: (key: string) => selected.push(key),
      },
    });
    try {
      flushSync();
      const item = target.querySelector<HTMLButtonElement>('[data-key="ux|card|a@card"]');
      expect(item).not.toBeNull();
      expect(item?.getAttribute('aria-selected')).toBe('true');
      item?.click();
      flushSync();
      expect(selected).toEqual(['ux|card|a@card']);
      expect(
        [...target.querySelectorAll('[role=treeitem]')].filter(
          (e) => e.getAttribute('tabindex') === '0',
        ),
      ).toHaveLength(1);
      const collapse = target.querySelector<HTMLButtonElement>('[aria-label="Collapse Component"]');
      expect(collapse).not.toBeNull();
      collapse?.click();
      flushSync();
      const visibleTabStops = [...target.querySelectorAll('[role=treeitem]')].filter(
        (e) => e.getAttribute('tabindex') === '0',
      );
      expect(visibleTabStops).toHaveLength(1);
      expect(visibleTabStops[0]?.getAttribute('data-key')).toBe('ux|a');
    } finally {
      await unmount(layers);
      target.remove();
    }
  });

  it('instance scope disables shared text replacement while targeting only the wrapper for styling', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    const applied: unknown[] = [];
    const inspector = mount(Inspector, {
      target,
      props: {
        document: fixture,
        selectedOccurrence: 'ux|card|a@card',
        readEffective: () => 'navy',
        onApply: (draft: TransactionDraft) => applied.push(...draft.commands),
      },
    });
    try {
      flushSync();
      const scope = target.querySelector<HTMLSelectElement>('[aria-label="Edits apply to"]')!;
      scope.value = 'instance';
      scope.dispatchEvent(new Event('change', { bubbles: true }));
      flushSync();
      expect(
        [...target.querySelectorAll('button')].find((b) => b.textContent === 'Apply text')
          ?.disabled,
      ).toBe(true);
      click(target, 'Style');
      click(target, 'Override Text color');
      expect(applied).toEqual([
        {
          op: 'setStyleDeclaration',
          nodeId: 'a',
          property: 'color',
          value: { type: 'text', value: 'navy' },
        },
      ]);
    } finally {
      await unmount(inspector);
      target.remove();
    }
  });
});
