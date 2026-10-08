/**
 * VERIFICATION PROBE (not a candidate test): minimal reproduction of the
 * B1 dialog controlled-loop leak — state writes land, bits-ui reports
 * data-state="closed", but the portaled dialog content stays mounted.
 * Candidate: 098b84e3 + verification-branch delivery repairs.
 */
import { describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { compileUiDocument, defaultSemanticElementCatalog, type UiDocument } from '@victframework/ui';
import DocumentHost from '../src/document/DocumentHost.svelte';
import { b1CatalogDescriptors } from '../src/catalog/components/descriptors.js';
import { b1CatalogImplementations } from '../src/catalog/components/implementations.js';

const shellDocument: UiDocument = {
  schema: 'vict.ui-document@1',
  id: 'probe.shell',
  revision: 'r1',
  root: 'shell',
  componentDefinitions: {},
  styleSources: {},
  tokens: {},
  conditions: {},
  assets: {},
  localState: {
    assignOpen: { key: 'assignOpen', type: 'boolean', initial: false },
    reviewer: { key: 'reviewer', type: 'string', initial: '' },
  },
  nodes: {
    shell: {
      kind: 'component',
      id: 'shell',
      definitionId: 'vict.catalog.appshell',
      props: {
        title: { type: 'literal', value: 'Review queue' },
        navigation: { type: 'ref', path: 'view.shellNavigation' },
        path: { type: 'ref', path: 'view.path' },
        navigationMode: { type: 'ref', path: 'view.navigationMode' },
        navigationAt: { type: 'ref', path: 'view.navigationAt' },
      },
      slots: { content: { name: 'content', children: ['trigger'] } },
    },
    trigger: {
      kind: 'component',
      id: 'trigger',
      definitionId: 'vict.catalog.dialog',
      props: {
        title: { type: 'literal', value: 'assignment' },
        open: { type: 'ref', path: 'state.assignOpen' },
      },
      outputs: {
        openChange: { setState: { key: 'assignOpen', value: { type: 'ref', path: '$output' } } },
      },
      slots: {
        body: { name: 'body', children: ['bodyText'] },
      },
    },
    bodyText: { kind: 'text', id: 'bodyText', content: { type: 'literal', value: 'Reviewer assignment body' } } as never,
  },
};

describe('PROBE: dialog controlled loop (stale-callback/lifecycle evidence)', () => {
  it('opens from the trigger and closes through the state loop', () => {
    // happy-dom lacks matchMedia; the AppShell responsive effect needs it.
    if (typeof window.matchMedia !== 'function') {
      (window as unknown as { matchMedia: unknown }).matchMedia = (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        onchange: null,
        dispatchEvent: () => false,
      });
    }
    const compiled = compileUiDocument(shellDocument, defaultSemanticElementCatalog(), b1CatalogDescriptors, {
      actionIds: [],
      viewFields: {
        shellNavigation: 'array',
        path: 'string',
        navigationMode: 'string',
        navigationAt: 'string',
      },
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const target = document.createElement('div');
    document.body.appendChild(target);
    const diagnostics: { code: string; detail?: Record<string, unknown> }[] = [];
    const instance = mount(DocumentHost, {
      target,
      props: {
        plan: compiled.plan,
        extensionDescriptors: b1CatalogDescriptors,
        extensionImplementations: b1CatalogImplementations,
        localState: shellDocument.localState,
        view: {
          shellNavigation: [{ id: 'a', href: '/a', label: 'A' }],
          path: '/',
          navigationMode: 'sidebar',
          navigationAt: 'small',
        },
        dispatch: async () => ({ ok: true }),
        navigate: () => {},
        onRenderDiagnostic: (d: { code: string; detail?: Record<string, unknown> }) =>
          diagnostics.push(d as never),
      },
    });
    flushSync();
    console.log('PROBE rendered html:', target.innerHTML.slice(0, 600), '...diags:', JSON.stringify(diagnostics));
    const trigger = () =>
      Array.from(target.querySelectorAll('[data-dialog-trigger]')).find((t) =>
        (t.textContent || '').includes('Open assignment'),
      );
    expect(trigger(), 'assignment dialog trigger renders').toBeTruthy();
    // OPEN via the trigger
    (trigger() as HTMLButtonElement).click();
    flushSync();
    const openDialogs = () => document.querySelectorAll('[role=dialog]').length;
    const openCount = openDialogs();
    // CLOSE via the ✕ button (the controlled loop must flip state → prop)
    const close = document.querySelector('[role=dialog] [data-dialog-close]') as HTMLButtonElement | null;
    expect(close, 'close button exists').toBeTruthy();
    close?.click();
    flushSync();
    const afterClose = openDialogs();
    const statesAfter = Array.from(document.querySelectorAll('[role=dialog]')).map((d) =>
      d.getAttribute('data-state'),
    );
    console.log('PROBE open:', openCount, 'afterClose:', afterClose, 'states:', statesAfter, 'diagnostics:', JSON.stringify(diagnostics));
    // The governed behavior: the dialog must UNMOUNT (or at minimum the
    // visible layer must close). Record honestly either way.
    expect(afterClose).toBe(0);
    unmount(instance);
    target.remove();
  });
});
