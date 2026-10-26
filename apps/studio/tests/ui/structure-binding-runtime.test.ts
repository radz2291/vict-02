// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { mount, unmount, tick, flushSync } from 'svelte';
import { DocumentHost } from '@victframework/ui-svelte';
import SourceDetails from '../../src/lib/designer/SourceDetails.svelte';
import { bindingFixture, compileFixture, styleFixture } from '../fixtures/structure-semantics.js';
import { structureId } from '../../src/lib/designer/structure.js';
let instance: ReturnType<typeof mount> | undefined;
afterEach(async () => {
  if (instance) await unmount(instance);
  instance = undefined;
  document.body.innerHTML = '';
});
it('a real native edit updates state and the second bound input, preserving authored source', async () => {
  const source = bindingFixture(),
    before = JSON.stringify(source),
    compiled = compileFixture(source);
  expect(compiled.ok).toBe(true);
  if (!compiled.ok) throw Error('compile');
  const change = vi.fn();
  instance = mount(DocumentHost, {
    target: document.body,
    props: {
      plan: compiled.plan,
      localState: source.localState,
      dispatch: async () => ({ ok: true }),
      navigate: () => {},
      onStateChange: change,
    },
  });
  flushSync();
  await tick();
  const inputs = document.querySelectorAll('input');
  expect(inputs[1]!.value).toBe(source.localState.message!.initial);
  inputs[0]!.value = 'Changed by user';
  inputs[0]!.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
  await tick();
  expect(change).toHaveBeenCalledWith('message', 'Changed by user');
  expect(inputs[1]!.value).toBe('Changed by user');
  expect(JSON.stringify(source)).toBe(before);
});
it('Selection shares directional labels and exposes framework warnings', async () => {
  const source = styleFixture(),
    invalidStyle = {
      ...source,
      conditions: {
        compact: {
          id: 'compact',
          kind: 'localState' as const,
          when: { type: 'ref' as const, path: 'state.accepted' },
        },
      },
    },
    compiled = compileFixture(invalidStyle);
  if (!compiled.ok) throw Error('compile');
  instance = mount(SourceDetails, {
    target: document.body,
    props: {
      document: invalidStyle,
      context: { plan: compiled.plan },
      selectedId: structureId(source.id, 'style', 'shared'),
      onClose: () => {},
      onSelect: () => {},
      onNavigate: () => {},
    },
  });
  flushSync();
  await tick();
  expect(document.body.textContent).toContain('Unsupported');
  expect(document.body.textContent).toContain('UI_DOC_UNSUPPORTED_FEATURE');
});
