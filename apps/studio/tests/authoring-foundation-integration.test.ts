// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { canonicalUiDocument, type UiDocument, type UiValue } from '@victframework/ui';
import { EditorBridge } from '@victframework/ui-editor';
import { parseGraph, applyGraphPatch } from '@victframework/ui-flow-svelte';
import { foundationExample, FOUNDATION_EPOCH } from '../src/lib/designer/foundation-examples.js';
import { compileScreen, designerCatalogs, screenIssues } from '../src/lib/designer/application.js';
import { screenPlacementIssues } from '../src/lib/designer/placement.js';
import { screenStore } from '../src/lib/designer/storage.js';
import {
  applyAgentProposal,
  documentCursor,
  prepareAgentEdit,
  type AgentEdit,
} from '../src/lib/designer/agent-edits.js';
import { agentContext } from '../src/lib/designer/agent-reads.js';
import { graphStateDocument } from '../src/lib/designer/graph-authoring.js';
import FoundationConsumer from './fixtures/FoundationConsumer.svelte';

let consumer: ReturnType<typeof mount> | undefined;
afterEach(async () => {
  if (consumer) await unmount(consumer);
  consumer = undefined;
  document.body.innerHTML = '';
  localStorage.clear();
  vi.unstubAllGlobals();
});
const settle = async () => {
  flushSync();
  await new Promise((resolve) => setTimeout(resolve, 25));
  flushSync();
};
function bridgeFor(source: UiDocument) {
  return new EditorBridge({
    catalogs: designerCatalogs,
    validateDocument: screenPlacementIssues,
    store: screenStore(localStorage, source.id),
    initial: { document: source, storedRevision: 'r1' },
  });
}
function agentApply(bridge: EditorBridge, operations: AgentEdit['operations']) {
  const cursor = documentCursor(bridge.document, bridge.getSnapshot().revision, FOUNDATION_EPOCH);
  const edit = {
    expectedRevision: cursor.revision,
    reason: 'Agent integration change',
    operations,
  };
  const prepared = prepareAgentEdit(bridge.document, cursor, edit, crypto.randomUUID());
  if (!prepared.ok)
    throw Error(`${prepared.code}: ${prepared.message}; ${JSON.stringify(prepared.diagnostics)}`);
  const result = applyAgentProposal(
    bridge,
    { proposalId: crypto.randomUUID(), cursor, edit, resultDigest: prepared.digest },
    FOUNDATION_EPOCH,
    false,
  );
  expect(result).toMatchObject({ ok: true });
  return result;
}
function graph(source: UiDocument) {
  const parsed = parseGraph(String(source.localState.graph?.initial));
  if (!parsed.ok) throw Error(JSON.stringify(parsed.issues));
  return parsed.graph;
}

describe('representative applications through agent-facing authoring contracts', () => {
  it('authors fresh application identities with independent first-visit campaign scopes', () => {
    for (const id of ['example-first', 'example-second']) {
      const source = foundationExample('responsive', id);
      expect(source.id).toBe(id);
      expect(source.nodes.firstVisit).toMatchObject({
        kind: 'component',
        props: { applicationId: { type: 'literal', value: id } },
      });
    }
    expect(foundationExample('chat', 'chat-copy').id).toBe('chat-copy');
    expect(foundationExample('graph', 'graph-copy').id).toBe('graph-copy');
  });
  for (const kind of ['responsive', 'chat', 'graph'] as const)
    it(`${kind}: canonical compilation, mixed edits, undo/redo, save/reopen and stale refusal`, () => {
      const source = foundationExample(kind);
      expect(screenIssues(source)).toEqual([]);
      expect(compileScreen(source).ok).toBe(true);
      const bridge = bridgeFor(source),
        before = canonicalUiDocument(source).contentDigest;
      expect(
        bridge.apply({
          requestId: crypto.randomUUID(),
          reason: 'Manual authored spacing',
          commands: [
            {
              op: 'setStyleDeclaration',
              nodeId: 'screen',
              property: 'gap',
              value: { type: 'text', value: '18px' },
            },
          ],
        }).ok,
      ).toBe(true);
      const stale = documentCursor(
        bridge.document,
        bridge.getSnapshot().revision,
        FOUNDATION_EPOCH,
      );
      agentApply(bridge, [
        {
          op: 'insert',
          kind: 'element',
          nodeId: 'ownerNote',
          parentId: 'screen',
          tag: 'p',
          text: 'Agent and owner share canonical history.',
        },
      ]);
      const afterAgent = canonicalUiDocument(bridge.document).contentDigest;
      expect(bridge.undo().ok).toBe(true);
      expect(bridge.document.nodes.ownerNote).toBeUndefined();
      expect(bridge.redo().ok).toBe(true);
      expect(canonicalUiDocument(bridge.document).contentDigest).toBe(afterAgent);
      const refused = prepareAgentEdit(
        bridge.document,
        stale,
        {
          expectedRevision: stale.revision,
          reason: 'Stale request',
          operations: [{ op: 'remove', nodeId: 'ownerNote' }],
        },
        'stale',
      );
      expect(refused).toMatchObject({ ok: false, code: 'UI_DOC_STALE_REVISION' });
      expect(bridge.document.nodes.ownerNote).toBeDefined();
      const authoredBeforeSave = bridge.document;
      expect(bridge.save().ok).toBe(true);
      expect(bridge.getSnapshot().dirty).toBe(false);
      expect(bridge.document.revision).not.toBe(authoredBeforeSave.revision);
      expect(bridge.document).toEqual({
        ...authoredBeforeSave,
        revision: bridge.document.revision,
      });
      const savedDigest = canonicalUiDocument(bridge.document).contentDigest;
      expect(bridge.reopen().ok).toBe(true);
      expect(canonicalUiDocument(bridge.document).contentDigest).toBe(savedDigest);
      expect(afterAgent).not.toBe(before);
      const read = agentContext(
        bridge.document,
        documentCursor(bridge.document, bridge.getSnapshot().revision, FOUNDATION_EPOCH),
        undefined,
        { section: 'nodes', nodeId: 'ownerNote', scope: 'self' },
      );
      expect(read.items).toEqual([expect.objectContaining({ id: 'ownerNote' })]);
    });
  it('authors a larger graph incrementally without widening scalar tool payload limits', () => {
    const bridge = bridgeFor(foundationExample('graph'));
    const changes = Array.from({ length: 36 }, (_, index) => ({
      type: 'addNode',
      id: `research-${index}`,
      nodeType: 'research',
      position: { x: 40 + (index % 6) * 340, y: 440 + Math.floor(index / 6) * 360 },
    }));
    agentApply(bridge, [
      {
        op: 'editGraph',
        nodeId: 'graphEditor',
        expectedGraphRevision: graph(bridge.document).revision,
        changes,
      },
    ]);
    expect(graph(bridge.document).nodes).toHaveLength(38);
    expect(String(bridge.document.localState.graph.initial).length).toBeGreaterThan(4000);
    expect(compileScreen(bridge.document).ok).toBe(true);
    expect(bridge.save().ok).toBe(true);
    expect(bridge.reopen().ok).toBe(true);
    expect(graph(bridge.document).nodes).toHaveLength(38);
  });
  it('responsive fixture has actual filtering, carousel, accessible drawer and remembered first-visit dismissal', async () => {
    const source = foundationExample('responsive'),
      changes = vi.fn();
    consumer = mount(FoundationConsumer, {
      target: document.body,
      props: { source, onStateChange: changes },
    });
    await settle();
    expect(document.querySelector('[data-ui-node="brand"] svg')).toBeTruthy();
    expect(document.querySelector('[data-ui-node="menuIcon"] svg')).toBeTruthy();
    const search = document.querySelector<HTMLInputElement>('input[type=search]')!;
    expect(search).toBeTruthy();
    search.value = 'Harbour';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    expect(changes).toHaveBeenCalledWith('query', 'Harbour');
    expect(document.querySelector('[data-ui-node="notes"]')?.textContent).toContain(
      'Harbour sketch',
    );
    expect(document.querySelector('[data-ui-node="notes"]')?.textContent).not.toContain(
      'Forest walk',
    );
    const next = [...document.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      button.getAttribute('aria-label')?.includes('Next'),
    )!;
    expect(next).toBeTruthy();
    next.click();
    await settle();
    expect(changes).toHaveBeenCalledWith('slide', 1);
    const trigger = document.querySelector<HTMLButtonElement>(
      '[data-ui-node="drawer"][data-ui-part="trigger"]',
    )!;
    expect(trigger.getAttribute('aria-label')).toBe('Open journal navigation');
    trigger.focus();
    trigger.click();
    await settle();
    expect(document.querySelector('[role=dialog]')).toBeTruthy();
    const saved = [
      ...document.querySelectorAll<HTMLButtonElement>('[data-ui-node="navigation"] button'),
    ].find((button) => button.textContent === 'Saved')!;
    saved.click();
    await settle();
    expect(changes).toHaveBeenCalledWith('section', 'Saved');
    expect(document.querySelector('[data-ui-node="activeSection"]')?.textContent).toBe('Saved');
    document
      .querySelector('[role=dialog]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(changes).toHaveBeenCalledWith('menuOpen', false);
    expect(document.activeElement).toBe(trigger);
    const dismiss = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent === 'Remember welcome dismissal',
    )!;
    expect(dismiss).toBeTruthy();
    dismiss.click();
    await settle();
    await unmount(consumer);
    consumer = undefined;
    consumer = mount(FoundationConsumer, { target: document.body, props: { source } });
    await settle();
    expect(document.body.textContent).not.toContain(
      'Welcome. Your dismissal is remembered in this browser.',
    );
  });
  it('chat fixture uses exposed revision2 surfaces and sends only through declared local state wiring', async () => {
    const source = foundationExample('chat'),
      changes = vi.fn();
    consumer = mount(FoundationConsumer, {
      target: document.body,
      props: { source, onStateChange: changes },
    });
    await settle();
    const input = document.querySelector<HTMLTextAreaElement>('textarea')!;
    input.value = 'A locally authored message';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    const send = document.querySelector<HTMLButtonElement>(
      '[data-ui-node="composer"][data-ui-part="send"]',
    )!;
    expect(send).toBeTruthy();
    send.click();
    await settle();
    expect(changes).toHaveBeenCalledWith('sent', 'A locally authored message');
    expect(
      document.querySelector('[data-ui-node="message"][data-ui-part="text"]')?.textContent,
    ).toContain('A locally authored message');
    expect(
      document.querySelector('[data-ui-node="message"][data-ui-part="bubble"]')?.className,
    ).toMatch(/part-/);
  });
  it('rich graph manual and agent changes share canonical history and persist topology and real node parameters', async () => {
    const bridge = bridgeFor(foundationExample('graph'));
    const before = graph(bridge.document);
    consumer = mount(FoundationConsumer, {
      target: document.body,
      props: {
        source: bridge.document,
        onStateChange: (key: string, value: UiValue) => {
          const next = graphStateDocument(bridge.document, key, value);
          if (next && next !== bridge.document) {
            expect(
              bridge.apply({
                requestId: crypto.randomUUID(),
                reason: 'Manual graph parameter',
                commands: [{ op: 'replaceDocument', document: next }],
              }).ok,
            ).toBe(true);
            consumer?.updateSource(bridge.document);
          }
        },
        history: {
          historyFor: () => ({
            canUndo: () => bridge.getSnapshot().canUndo,
            canRedo: () => bridge.getSnapshot().canRedo,
            undo: () => {
              bridge.undo();
              consumer?.updateSource(bridge.document);
            },
            redo: () => {
              bridge.redo();
              consumer?.updateSource(bridge.document);
            },
          }),
        },
      },
    });
    await settle();
    const textarea = document.querySelector<HTMLTextAreaElement>(
      '[data-graph-node="observe"] [data-field="notes"] textarea',
    )!;
    expect(textarea).toBeTruthy();
    textarea.value = 'Observed manually';
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    expect(graph(bridge.document).nodes.find((node) => node.id === 'observe')?.values.notes).toBe(
      'Observed manually',
    );
    expect(graph(bridge.document).nodes.map((node) => node.position)).toEqual(
      before.nodes.map((node) => node.position),
    );
    const revision = graph(bridge.document).revision;
    agentApply(bridge, [
      {
        op: 'editGraph',
        nodeId: 'graphEditor',
        expectedGraphRevision: revision,
        changes: [
          { type: 'moveNodes', positions: { synthesise: { x: 640, y: 100 } } },
          { type: 'setField', nodeId: 'synthesise', fieldId: 'confidence', value: 75 },
        ],
      },
    ]);
    consumer.updateSource(bridge.document);
    await settle();
    expect(graph(bridge.document).nodes.find((node) => node.id === 'observe')?.values.notes).toBe(
      'Observed manually',
    );
    expect(
      graph(bridge.document).nodes.find((node) => node.id === 'synthesise')?.values.confidence,
    ).toBe(75);
    const undoButton = [
      ...document.querySelectorAll<HTMLButtonElement>('.graph-toolbar button'),
    ].find((button) => button.textContent === 'Undo')!;
    expect(undoButton.disabled).toBe(false);
    undoButton.click();
    await settle();
    expect(
      graph(bridge.document).nodes.find((node) => node.id === 'synthesise')?.values.confidence ??
        50,
    ).toBe(50);
    expect(graph(bridge.document).nodes.find((node) => node.id === 'observe')?.values.notes).toBe(
      'Observed manually',
    );
    expect(document.querySelector('[data-graph-node="synthesise"] output')?.textContent).toBe('50');
    const redoButton = [
      ...document.querySelectorAll<HTMLButtonElement>('.graph-toolbar button'),
    ].find((button) => button.textContent === 'Redo')!;
    expect(redoButton.disabled).toBe(false);
    redoButton.click();
    await settle();
    expect(bridge.save().ok).toBe(true);
    expect(bridge.reopen().ok).toBe(true);
    expect(graph(bridge.document).edges).toHaveLength(1);
    expect(
      graph(bridge.document).nodes.find((node) => node.id === 'synthesise')?.values.confidence,
    ).toBe(75);
    const unchanged = canonicalUiDocument(bridge.document).contentDigest;
    const invalid = applyGraphPatch(
      String(bridge.document.localState.graph.initial),
      [
        {
          type: 'connect',
          edge: {
            source: 'observe',
            sourcePort: 'missing',
            target: 'synthesise',
            targetPort: 'in',
          },
        },
      ],
      graph(bridge.document).revision,
    );
    expect(invalid.ok).toBe(false);
    const cursor = documentCursor(bridge.document, bridge.getSnapshot().revision, FOUNDATION_EPOCH);
    const refused = prepareAgentEdit(
      bridge.document,
      cursor,
      {
        expectedRevision: cursor.revision,
        reason: 'Atomic invalid graph edit',
        operations: [
          {
            op: 'style',
            nodeId: 'screen',
            property: 'color',
            value: { type: 'text', value: 'red' },
          },
          {
            op: 'editGraph',
            nodeId: 'graphEditor',
            expectedGraphRevision: graph(bridge.document).revision,
            changes: [
              {
                type: 'connect',
                edge: {
                  source: 'observe',
                  sourcePort: 'missing',
                  target: 'synthesise',
                  targetPort: 'in',
                },
              },
            ],
          },
        ],
      },
      'invalid-graph',
    );
    expect(refused).toMatchObject({ ok: false, code: 'STUDIO_AGENT_GRAPH_INVALID' });
    expect(canonicalUiDocument(bridge.document).contentDigest).toBe(unchanged);
  });
});
