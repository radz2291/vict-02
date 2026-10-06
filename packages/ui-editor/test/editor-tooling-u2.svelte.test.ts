/**
 * U2-04/U2-07 editor tooling: Inspector provenance + condition-target
 * styling; Layers occurrence tree selection. Mounted with the svelte
 * toolchain (renderer project).
 */
import { describe, expect, it } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import {
  compileUiDocument,
  defaultSemanticElementCatalog,
  UiEditSession,
  type UiDocument,
} from '@victframework/ui';
import type { TransactionDraft } from '../src/commands.js';
import Inspector from '../src/Inspector.svelte';
import Layers from '../src/Layers.svelte';

type WNode = { kind: string; id: string; [key: string]: unknown };

function fixtureDocument(): UiDocument {
  return {
    schema: 'vict.ui-document@1',
    id: 'doc.u2tool',
    revision: '1',
    root: 'n.root',
    nodes: {
      'n.root': {
        kind: 'element',
        id: 'n.root',
        tag: 'section',
        children: ['n.heading', 'n.card'],
      },
      'n.heading': {
        kind: 'text',
        id: 'n.heading',
        content: { type: 'literal', value: 'Welcome' },
      },
      'n.card': { kind: 'element', id: 'n.card', tag: 'article', children: ['n.cardTitle'] },
      'n.cardTitle': {
        kind: 'text',
        id: 'n.cardTitle',
        content: { type: 'literal', value: 'Card' },
      },
    } as Record<string, WNode>,
    componentDefinitions: {},
    styleSources: {},
    tokens: {},
    conditions: {
      'cond.narrow': { id: 'cond.narrow', kind: 'media', query: '(max-width: 700px)' },
    },
    assets: {},
    localState: {},
  } as unknown as UiDocument;
}

function makeSelection(occurrence: string): string {
  return occurrence;
}

describe('Inspector (U2-04)', () => {
  it('explains authored origin vs effective value and warns when editing a condition target', () => {
    const doc = fixtureDocument();
    const session = UiEditSession.open({ document: doc, storedRevision: '1' });
    const target = document.createElement('div');
    document.body.appendChild(target);
    let applied: { property: string; conditionId?: string } | undefined;
    const instance = mount(Inspector, {
      target,
      props: {
        document: session.state().working.document,
        selectedOccurrence: makeSelection('doc.u2tool|n.card'),
        onApply: (draft: TransactionDraft) => {
          const command = draft.commands[0];
          applied = command as { property: string; conditionId?: string };
        },
        styleConditions: [{ id: 'cond.narrow', label: 'Narrow (≤700px)' }],
        readEffective: (occurrence: string, property: string) =>
          occurrence === 'doc.u2tool|n.card' && property === 'color' ? 'rgb(0, 0, 0)' : undefined,
      },
    });
    try {
      flushSync();
      // provenance + effective value shown
      expect(target.textContent).toContain('n.card');
      expect(target.textContent).toContain('effective value');
      expect(target.textContent).toContain('rgb(0, 0, 0)');
      // base editing (default) goes to local style
      const applyBase = [...target.querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === 'Apply style',
      ) as HTMLButtonElement;
      applyBase.click();
      flushSync();
      expect(applied?.property).toBe('color');
      expect(applied?.conditionId).toBeUndefined();
      // switching the style target must not touch base source
      const select = target.querySelector('select[aria-label="Style target"]') as HTMLSelectElement;
      select.value = 'cond.narrow';
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
      flushSync();
      expect(target.textContent).toContain('base styling is NOT changed');
      applyBase.click();
      flushSync();
      expect(applied?.property).toBe('color');
      expect(applied?.conditionId).toBe('cond.narrow');
    } finally {
      unmount(instance);
      target.remove();
    }
  });

  it('shows component ownership and the shared-definition blast radius', () => {
    const doc = fixtureDocument();
    const writable = structuredClone(doc) as unknown as {
      nodes: Record<string, WNode>;
      componentDefinitions: Record<string, unknown>;
    };
    writable.componentDefinitions['def.card'] = {
      id: 'def.card',
      revision: '1',
      root: 'n.card',
      props: [],
      slots: {},
    };
    writable.nodes['n.instanceA'] = {
      kind: 'component',
      id: 'n.instanceA',
      definitionId: 'def.card',
    };
    writable.nodes['n.instanceB'] = {
      kind: 'component',
      id: 'n.instanceB',
      definitionId: 'def.card',
    };
    (writable.nodes['n.root'] as unknown as { children: string[] }).children = [
      'n.heading',
      'n.instanceA',
      'n.instanceB',
    ];
    const owned = structuredClone(writable) as { nodes: Record<string, WNode> };
    owned.nodes['n.cardHeading'] = {
      kind: 'text',
      id: 'n.cardHeading',
      content: { type: 'literal', value: 'Shared heading' },
    };
    (writable.nodes['n.card'] as unknown as { children: string[] }).children = ['n.cardHeading'];
    const target = document.createElement('div');
    document.body.appendChild(target);
    const instance = mount(Inspector, {
      target,
      props: {
        document: owned as unknown as UiDocument,
        // occurrence of the DEFINITION-OWNED text inside instance A
        selectedOccurrence: makeSelection('doc.u2tool|n.cardHeading|n.instanceA@def.card'),
        onApply: () => {},
      },
    });
    try {
      flushSync();
      expect(target.textContent).toContain('Inside component');
      expect(target.textContent).toContain('def.card');
      expect(target.textContent).toContain('SHARED definition');
      expect(target.textContent?.replace(/\s+/g, ' ')).toContain('2 instances update together');
    } finally {
      unmount(instance);
      target.remove();
    }
  });
});

describe('Layers (U2-07)', () => {
  it('lists the occurrence tree and emits exact occurrence keys on selection', () => {
    const doc = fixtureDocument();
    const compiled = compileUiDocument(doc, defaultSemanticElementCatalog());
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const selected: string[] = [];
    const target = document.createElement('div');
    document.body.appendChild(target);
    const instance = mount(Layers, {
      target,
      props: {
        plan: compiled.plan,
        onSelect: (occurrence: string) => selected.push(occurrence),
      },
    });
    try {
      flushSync();
      const buttons = [...target.querySelectorAll('button')];
      expect(buttons.length).toBeGreaterThanOrEqual(4);
      const heading = buttons.find((b) => b.textContent?.includes('“text”'));
      heading?.click();
      flushSync();
      expect(selected).toEqual(['doc.u2tool|n.heading']);
    } finally {
      unmount(instance);
      target.remove();
    }
  });
});
