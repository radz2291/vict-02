// @vitest-environment happy-dom
import { mount, unmount, tick } from 'svelte';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('$app/navigation', () => ({ beforeNavigate: () => {} }));
import Designer from '../../src/lib/designer/Designer.svelte';
import { openStudioMenu,workspaceControl } from './studio-menu.js';

let instance: ReturnType<typeof mount> | undefined;
afterEach(async () => {
  if (instance) await unmount(instance);
  instance = undefined;
  document.body.innerHTML = '';
  localStorage.clear();
  vi.unstubAllGlobals();
});
async function visibility(label: string) {
  const item=workspaceControl(label);
  expect(item).toBeDefined();
  item!.click();
  await tick();
}
it('keeps draft, feed and an active turn mounted through hiding; the single composer action stops', async () => {
  const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
    if (init?.method === 'DELETE') return new Response('{}');
    if (init?.method === 'POST')
      return new Response(
        new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            for (const event of [
              { type: 'started', runId: 'controls-run', model: 'fixture/model' },
              { type: 'text', delta: 'Working on your screen.' },
            ])
              controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
            init.signal?.addEventListener(
              'abort',
              () => controller.error(new DOMException('Stopped', 'AbortError')),
              { once: true },
            );
          },
        }),
      );
    return new Response(JSON.stringify({ csrf: 'fixture', ready: true, model: 'fixture/model' }));
  });
  vi.stubGlobal('fetch', fetcher);
  instance = mount(Designer, { target: document.body });
  await vi.waitFor(() =>
    expect(document.querySelector('.agent-status')?.textContent).toContain('Ready'),
  );
  await visibility('Show chat');
  const panel = document.querySelector('.agent-panel')!;
  const chat = document.querySelector('.agent-chat')!;
  const input = document.querySelector<HTMLTextAreaElement>('[data-testid="conversation-input"]')!;
  const beforeCanvas = document.querySelector('.design-frame')!.innerHTML;
  input.value = 'Create a landing page';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await tick();
  await visibility('Hide chat');
  expect(panel.hasAttribute('hidden')).toBe(true);
  expect(document.querySelector('.agent-chat')).toBe(chat);
  expect(document.querySelector('[data-testid="conversation-input"]')).toBe(input);
  expect(input.value).toBe('Create a landing page');
  expect(document.querySelector('.design-frame')!.innerHTML).toBe(beforeCanvas);
  await visibility('Show chat');
  expect(panel.hasAttribute('hidden')).toBe(false);
  expect(chat.querySelector('h2')).toBeNull();
  expect(chat.getAttribute('aria-label')).toBe('Chat');
  expect(document.body.textContent).not.toContain('Studio agent');
  expect(chat.querySelector('.agent-context')).toBeNull();
  expect(chat.querySelector('.agent-footer .agent-status')).not.toBeNull();
  expect(chat.querySelector('.agent-footer [aria-label="Chat details"]')).not.toBeNull();
  input.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await vi.waitFor(() => expect(chat.textContent).toContain('Working on your screen.'));
  expect(chat.querySelector('[data-testid="conversation-send"]')).toBeNull();
  expect(chat.querySelectorAll('.vict-conversation-input-row button')).toHaveLength(1);
  expect(chat.querySelector('.agent-status')?.textContent).toContain('Working…');
  const feed = chat.querySelector('.vict-conversation')!;
  await visibility('Hide chat');
  expect(panel.hasAttribute('hidden')).toBe(true);
  expect(chat.querySelector('.vict-conversation')).toBe(feed);
  expect(chat.textContent).toContain('Working on your screen.');
  expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(0);
  await visibility('Show chat');
  const stop = chat.querySelector<HTMLButtonElement>('.vict-conversation-input-row [data-testid="conversation-stop"]')!;
  expect(stop).not.toBeNull();
  stop.click();
  await vi.waitFor(() => expect(chat.querySelector('[data-testid="conversation-stop"]')).toBeNull());
  expect(chat.querySelector('[data-testid="conversation-send"]')).not.toBeNull();
  expect(chat.querySelector('.agent-status')?.textContent).toContain('Stopped');
  expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(1);
  expect(document.querySelector('.design-frame')!.innerHTML).toBe(beforeCanvas);
});
