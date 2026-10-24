import { describe, it, expect } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import {
  compileUiDocument,
  createUiAuthoringRegistry,
  defaultSemanticElementCatalog,
  type UiDocument,
} from '@victframework/ui';
import DocumentHost from '../../ui-svelte/src/document/DocumentHost.svelte';
import { aiAuthoringPackage } from '../src/authoring/knowledge.js';
import { aiAuthoringDescriptors } from '../src/authoring/descriptors.js';
import { aiAuthoringImplementations } from '../src/authoring/implementations.js';

function conversation(): UiDocument {
  const seed = aiAuthoringPackage.registrations[0]!.seed!;
  return {
    schema: 'vict.ui-document@1',
    id: 'ai-proof',
    revision: '1',
    root: seed.root,
    nodes: Object.fromEntries(seed.nodes.map((node) => [node.id, node])),
    componentDefinitions: {},
    styleSources: {},
    tokens: {},
    conditions: {},
    assets: {},
    localState: seed.localState ?? {},
  };
}
async function settle() {
  flushSync();
  await new Promise((resolve) => setTimeout(resolve, 10));
  flushSync();
}
describe('authored AI conversation', () => {
  it('owns valid machine-readable contracts and canonical examples', () => {
    const registry = createUiAuthoringRegistry([aiAuthoringPackage], aiAuthoringImplementations, { requireCompatibility: true });
    expect(registry.issues).toEqual([]);
    for (const registration of aiAuthoringPackage.registrations)
      for (const seed of registration.examples ?? []) {
        const doc = {
          ...conversation(),
          root: seed.root,
          nodes: Object.fromEntries(seed.nodes.map((node) => [node.id, node])),
          localState: seed.localState ?? {},
        };
        expect(
          compileUiDocument(doc, defaultSemanticElementCatalog(), aiAuthoringDescriptors).ok,
        ).toBe(true);
      }
  });
  it('renders actual message/composer slots and emits controlled changes/send without clearing or provider execution', async () => {
    const doc = conversation();
    const prompt = doc.nodes.prompt!;
    if (prompt.kind !== 'component') throw new Error('prompt seed');
    const source: UiDocument = {
      ...doc,
      nodes: {
        ...doc.nodes,
        prompt: { ...prompt, outputs: { ...prompt.outputs, send: { setState: { key: 'sent' } } } },
      },
      localState: { ...doc.localState, sent: { key: 'sent', type: 'string', initial: '' } },
    };
    const compiled = compileUiDocument(
      source,
      defaultSemanticElementCatalog(),
      aiAuthoringDescriptors,
    );
    expect(compiled.ok, JSON.stringify(compiled)).toBe(true);
    if (!compiled.ok) return;
    const target = document.createElement('div');
    document.body.append(target);
    const actions: string[] = [],
      changes: [string, unknown][] = [];
    const instance = mount(DocumentHost, {
      target,
      props: {
        plan: compiled.plan,
        extensionDescriptors: aiAuthoringDescriptors,
        extensionImplementations: aiAuthoringImplementations,
        localState: source.localState,
        dispatch: async (id: string) => {
          actions.push(id);
        },
        navigate: () => {},
        onStateChange: (key: string, value: unknown) => changes.push([key, value]),
      },
    });
    await settle();
    expect(target.querySelector('[role="log"]')?.textContent).toContain('How can I help?');
    const input = target.querySelector('textarea')!;
    input.value = '  Hello authored chat  ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    expect(changes).toContainEqual(['message', '  Hello authored chat  ']);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle();
    expect(changes).toContainEqual(['sent', 'Hello authored chat']);
    expect(input.value).toBe('  Hello authored chat  ');
    expect(actions).toEqual([]);
    expect(target.querySelector('form')?.closest('[data-ui-node]')?.getAttribute('data-ui-node')).toBe('prompt');
    await unmount(instance);
    target.remove();
  });
  it('emits stop intent only while busy and leaves controlled text intact', async () => {
    const doc = conversation(),
      prompt = doc.nodes.prompt!;
    if (prompt.kind !== 'component') throw new Error('prompt seed');
    const source: UiDocument = {
      ...doc,
      nodes: {
        ...doc.nodes,
        prompt: {
          ...prompt,
          props: { ...prompt.props, busy: { type: 'literal', value: true } },
          outputs: { ...prompt.outputs, stop: { invokeAction: { actionId: 'host.stop' } } },
        },
      },
    };
    const compiled = compileUiDocument(
      source,
      defaultSemanticElementCatalog(),
      aiAuthoringDescriptors,
    );
    if (!compiled.ok) throw new Error(JSON.stringify(compiled));
    const root = compiled.plan.structure[0];
    expect(root?.kind).toBe('extension');
    if (root?.kind === 'extension')
      expect(root.slots?.composer?.[0]).toMatchObject({
        outputBindings: { stop: { invokeAction: { actionId: 'host.stop' } } },
      });
    const target = document.createElement('div'),
      actions: string[] = [],
      diagnostics: unknown[] = [];
    document.body.append(target);
    const instance = mount(DocumentHost, {
      target,
      props: {
        plan: compiled.plan,
        extensionDescriptors: aiAuthoringDescriptors,
        extensionImplementations: aiAuthoringImplementations,
        localState: source.localState,
        dispatch: async (id: string) => {
          actions.push(id);
        },
        navigate: () => {},
        onRenderDiagnostic: (diagnostic: unknown) => diagnostics.push(diagnostic),
      },
    });
    await settle();
    expect(target.querySelector('button[aria-label="Send"]')).toBeNull();
    target
      .querySelector('button[aria-label="Stop"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    expect({ actions, diagnostics }).toEqual({ actions: ['host.stop'], diagnostics: [] });
    await unmount(instance);
    target.remove();
  });
});
