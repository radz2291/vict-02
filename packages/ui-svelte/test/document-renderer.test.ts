import { describe, expect, it } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import {
  compileUiDocument,
  defaultSemanticElementCatalog,
  type UiDocument,
  type UiRenderPlan,
} from '@victframework/ui';
import DocumentHost from '../src/document/DocumentHost.svelte';

function inspectionDetail(): UiDocument {
  return {
    schema: 'vict.ui-document@1',
    id: 'doc.detail',
    revision: '1',
    root: 'n.root',
    nodes: {
      'n.root': {
        kind: 'element',
        id: 'n.root',
        tag: 'section',
        classes: ['detail'],
        children: ['n.title', 'n.status', 'n.list', 'n.approve'],
      },
      'n.title': {
        kind: 'text',
        id: 'n.title',
        content: { type: 'expression', expression: { type: 'ref', path: 'record.title' } },
      },
      'n.status': {
        kind: 'element',
        id: 'n.status',
        tag: 'span',
        attributes: { 'data-status': { type: 'ref', path: 'record.status' } },
        children: ['n.statusText'],
      },
      'n.statusText': {
        kind: 'text',
        id: 'n.statusText',
        content: { type: 'expression', expression: { type: 'ref', path: 'record.status' } },
      },
      'n.list': {
        kind: 'element',
        id: 'n.list',
        tag: 'ul',
        children: ['n.findings'],
      },
      'n.findings': {
        kind: 'repeat',
        id: 'n.findings',
        collection: { type: 'ref', path: 'view.findings' },
        key: { type: 'ref', path: 'repeat.finding.description' },
        itemName: 'finding',
        templateRoot: 'n.findingItem',
      },
      'n.findingItem': {
        kind: 'element',
        id: 'n.findingItem',
        tag: 'li',
        children: ['n.findingText'],
      },
      'n.findingText': {
        kind: 'text',
        id: 'n.findingText',
        content: {
          type: 'expression',
          expression: {
            type: 'conditionalValue',
            when: {
              type: 'compare',
              op: 'eq',
              left: { type: 'ref', path: 'repeat.finding.severity' },
              right: { type: 'literal', value: 'high' },
            },
            then: {
              type: 'op',
              name: 'concat',
              args: [
                { type: 'literal', value: 'HIGH: ' },
                { type: 'ref', path: 'repeat.finding.description' },
              ],
            },
            otherwise: { type: 'ref', path: 'repeat.finding.description' },
          },
        },
      },
      'n.approve': {
        kind: 'element',
        id: 'n.approve',
        tag: 'button',
        attributes: { type: 'button', 'aria-label': 'Approve inspection' },
        interactions: [{ on: 'click', action: 'invokeAction', actionId: 'inspection.approve' }],
        children: ['n.approveLabel'],
      },
      'n.approveLabel': {
        kind: 'text',
        id: 'n.approveLabel',
        content: { type: 'literal', value: 'Approve' },
      },
    },
    componentDefinitions: {},
    styleSources: {},
    tokens: { 'space.gap': { id: 'space.gap', value: '12px' } },
    conditions: {},
    assets: {},
    localState: { expanded: { key: 'expanded', type: 'boolean', initial: false } },
  };
}

function mountPlan(
  plan: UiRenderPlan,
  handlers: {
    dispatch?: (actionId: string, input?: unknown) => Promise<unknown>;
    navigate?: (routeId: string, params?: Record<string, unknown>) => void;
    view?: Readonly<Record<string, unknown>>;
    onRenderDiagnostic?: (diagnostic: {
      code: string;
      message: string;
      detail?: Record<string, unknown>;
    }) => void;
  },
): { target: HTMLDivElement; instance: ReturnType<typeof mount> } {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const instance = mount(DocumentHost, {
    target,
    props: {
      plan,
      view: handlers.view ?? {
        findings: [
          { description: 'Seal wear', severity: 'high' },
          { description: 'Label fade', severity: 'low' },
        ],
      },
      ...(handlers.onRenderDiagnostic !== undefined
        ? { onRenderDiagnostic: handlers.onRenderDiagnostic }
        : {}),
      record: { title: 'Inspection 42', status: 'submitted' },
      dispatch: handlers.dispatch ?? (async () => ({ ok: true })),
      navigate: handlers.navigate ?? (() => undefined),
    },
  });
  flushSync();
  return { target, instance };
}

describe('DocumentHost (the one renderer)', () => {
  const plan = compileUiDocument(inspectionDetail(), defaultSemanticElementCatalog(), [], {
    viewFields: {
      title: 'string',
      status: 'string',
      findings: 'array',
      'findings.severity': 'string',
      'findings.description': 'string',
    },
  });

  it('renders the compiled plan: bindings, attributes, repeats and occurrence provenance', () => {
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const { target, instance } = mountPlan(plan.plan, {});
    try {
      const root = target.querySelector('[data-ui-document="doc.detail"]');
      expect(root).not.toBeNull();
      // record binding rendered
      expect(target.textContent).toContain('Inspection 42');
      // attribute binding rendered
      const status = target.querySelector('[data-ui-node="n.status"]');
      expect(status?.getAttribute('data-status')).toBe('submitted');
      // repeat rendered two rows with occurrence keys carrying record keys
      const items = [...target.querySelectorAll('[data-ui-node="n.findingItem"]')];
      expect(items).toHaveLength(2);
      const occKeys = items.map((item) => item.getAttribute('data-ui-occ') ?? '');
      expect(occKeys[0]).toContain('Seal wear');
      expect(occKeys[1]).toContain('Label fade');
      // conditional expression with op
      expect(items[0]?.textContent).toContain('HIGH: Seal wear');
      expect(items[1]?.textContent).toContain('Label fade');
      expect(items[1]?.textContent).not.toContain('HIGH');
      // occurrence keys unique across repeats
      expect(new Set(occKeys).size).toBe(2);
    } finally {
      unmount(instance);
      target.remove();
    }
  });

  it('interaction click dispatches the declared action through the boundary', async () => {
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const dispatched: { actionId: string; input: unknown }[] = [];
    const { target, instance } = mountPlan(plan.plan, {
      dispatch: async (actionId, input) => {
        dispatched.push({ actionId, input });
        return { ok: true };
      },
    });
    try {
      const button = target.querySelector('[data-ui-node="n.approve"]') as HTMLButtonElement;
      expect(button).not.toBeNull();
      button.click();
      await Promise.resolve();
      flushSync();
      expect(dispatched).toEqual([{ actionId: 'inspection.approve', input: {} }]);
    } finally {
      unmount(instance);
      target.remove();
    }
  });

  it('scopes style rules under the root class and emits the token layer', () => {
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const { target, instance } = mountPlan(plan.plan, {});
    try {
      const style = target.ownerDocument.querySelector('style[data-ui-style]');
      expect(style?.textContent).toContain('--ui-token-space_gap: 12px');
      expect(style?.textContent).toContain('.uv-root-doc_detail-1');
    } finally {
      unmount(instance);
      target.remove();
    }
  });

  it('U2-02: duplicate repeat keys keep unique occurrence identities and are reported', () => {
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const diagnostics: { code: string; message: string; detail?: Record<string, unknown> }[] = [];
    const { target, instance } = mountPlan(plan.plan, {
      view: {
        findings: [
          { description: 'Seal wear', severity: 'high' },
          { description: 'Seal wear', severity: 'low' },
          { description: 'Label fade', severity: 'low' },
        ],
      },
      onRenderDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });
    try {
      const items = [...target.querySelectorAll('[data-ui-node="n.findingItem"]')];
      expect(items).toHaveLength(3);
      const occKeys = items.map((item) => item.getAttribute('data-ui-occ') ?? '');
      // every record keeps a UNIQUE occurrence identity
      expect(new Set(occKeys).size).toBe(3);
      // the FIRST duplicate-key record keeps the canonical key; the later one is made unique
      expect(occKeys[0]).toContain('Seal wear');
      expect(occKeys[0]).not.toContain('#dup');
      expect(occKeys[1]).toContain('Seal wear#dup1');
      // and the collision is REPORTED, not silent
      expect(diagnostics.some((d) => d.code === 'UI_RENDER_DUPLICATE_KEY')).toBe(true);
    } finally {
      unmount(instance);
      target.remove();
    }
  });
});
