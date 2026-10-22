// @vitest-environment happy-dom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentChat from '../../src/lib/designer/AgentChat.svelte';
import { newScreen } from '../../src/lib/designer/application.js';
import { documentCursor } from '../../src/lib/designer/agent-edits.js';
let instance: ReturnType<typeof mount> | undefined;
afterEach(async () => {
  if (instance) await unmount(instance);
  instance = undefined;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});
describe('rejected Studio chat admission', () => {
  it.each([
    ['STUDIO_AGENT_BUSY', 'Another agent turn is still running'],
    ['STUDIO_AGENT_CAPACITY', 'The agent server is finishing other turns'],
  ])(
    'explains %s without blaming the provider and retains the unsent draft',
    async (code, expected) => {
      const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) =>
        init?.method === 'POST'
          ? new Response(
              JSON.stringify({ type: 'done', status: 'failed', code, applied: 0 }) + '\n',
              { headers: { 'content-type': 'application/x-ndjson' } },
            )
          : new Response(JSON.stringify({ csrf: 'test-nonce', ready: true, model: 'test/model' }), {
              headers: { 'content-type': 'application/json' },
            }),
      );
      vi.stubGlobal('fetch', fetcher);
      const source = newScreen('Chat admission', 'chat-admission');
      const cursor = documentCursor(source, 'r1#0', crypto.randomUUID());
      instance = mount(AgentChat, {
        target: document.body,
        props: {
          screenLabel: 'Chat admission',
          selectionLabel: 'Screen',
          blocked: false,
          getContext: () => ({ document: source, cursor }),
          applyProposal: () => {
            throw new Error('No proposal may arrive for a refused request');
          },
        },
      });
      await vi.waitFor(() =>
        expect(document.body.textContent).toContain('Ready to build with you.'),
      );
      const input = document.querySelector<HTMLInputElement>('[data-testid="conversation-input"]')!;
      input.value = 'Create a WhatsApp screen';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      flushSync();
      document
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await vi.waitFor(() =>
        expect(document.querySelector('[role="status"]')?.textContent).toContain(expected),
      );
      await vi.waitFor(() =>
        expect(document.querySelector('[role="alert"]')?.textContent).toContain(expected),
      );
      expect(input.value).toBe('Create a WhatsApp screen');
      expect(document.body.textContent).toContain('No edits were applied.');
      expect(document.body.textContent).not.toContain('Check the provider connection');
      expect(
        document.querySelector<HTMLButtonElement>('[data-testid="conversation-send"]')?.disabled,
      ).toBe(false);
    },
  );
});
