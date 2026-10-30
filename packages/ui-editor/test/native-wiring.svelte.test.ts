import { flushSync, mount, tick, unmount } from 'svelte';
import { expect, it } from 'vitest';
import { UiEditSession, compileUiDocument, defaultSemanticElementCatalog, type UiDocument } from '@victframework/ui';
import DocumentHost from '../../ui-svelte/src/document/DocumentHost.svelte';
import { wireNativeInput } from '../src/commands.js';
import { nativeSource } from './native-wiring-fixture.js';

it('renders initial and changed native textarea/select values from actual helper-generated state bindings', async () => {
  const session = UiEditSession.open({ document: nativeSource(), storedRevision: '1' });
  for (const [nodeId, initial] of [['note', 'Starting note'], ['choice', 'second']] as const) {
    const draft = wireNativeInput({ requestId: nodeId, document: session.document, nodeId, key: nodeId, initial });
    const applied = session.applyTransaction({ ...draft, expectedDocumentRevision: session.workingRevision });
    expect(applied.ok, JSON.stringify(applied)).toBe(true);
  }
  const source: UiDocument = { ...session.document, nodes: { ...session.document.nodes,
    'note-copy': { kind: 'text', id: 'note-copy', content: { type: 'expression', expression: { type: 'ref', path: 'state.note' } } },
    'choice-copy': { kind: 'text', id: 'choice-copy', content: { type: 'expression', expression: { type: 'ref', path: 'state.choice' } } },
  } };
  const compiled = compileUiDocument(source, defaultSemanticElementCatalog());
  expect(compiled.ok).toBe(true); if (!compiled.ok) return;
  const target = document.createElement('div'); document.body.append(target);
  const changed: Array<[string, unknown]> = [];
  const instance = mount(DocumentHost, { target, props: { plan: compiled.plan, localState: source.localState,
    dispatch: async () => undefined, navigate: () => undefined, onStateChange: (key: string, value: unknown) => changed.push([key, value]) } });
  try {
    flushSync(); await tick(); flushSync();
    const note = target.querySelector('textarea')!;
    const choice = target.querySelector('select')!;
    expect(note.value).toBe('Starting note');
    // The value is applied before the recursively mounted options settle.
    expect(choice.options.length).toBe(2); expect(choice.selectedIndex).toBe(1); expect(choice.value).toBe('second');
    note.value = 'A changed\nmultiline note'; note.dispatchEvent(new Event('input', { bubbles: true }));
    choice.value = 'first'; choice.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync(); await tick();
    expect(changed).toContainEqual(['note', 'A changed\nmultiline note']);
    expect(changed).toContainEqual(['choice', 'first']);
    expect(target.textContent).toContain('A changed\nmultiline note');
    expect(target.querySelector('[data-ui-node="choice-copy"]')?.textContent).toBe('first');
    expect(note.value).toBe('A changed\nmultiline note'); expect(choice.value).toBe('first');
  } finally { await unmount(instance); target.remove(); }
});
