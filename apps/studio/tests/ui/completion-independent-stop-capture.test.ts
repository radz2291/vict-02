// @vitest-environment happy-dom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, expect, it, vi } from 'vitest';
import AgentChat from '../../src/lib/designer/AgentChat.svelte';
import { newScreen } from '../../src/lib/designer/application.js';
import { documentCursor } from '../../src/lib/designer/agent-edits.js';
import type { CaptureResult } from '../../src/lib/designer/visual-observation.js';

let instance: ReturnType<typeof mount> | undefined;
let release: ((value: CaptureResult) => void) | undefined;
afterEach(async () => {
  release?.({ ok: false, code: 'STUDIO_CAPTURE_CANCELLED', message: 'Released test capture.' });
  release = undefined;
  if (instance) await unmount(instance);
  instance = undefined;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

it('independent challenge: Stop releases a stalled raster capture and fences its late upload', async () => {
  const source = newScreen('Pending capture', 'independent-pending-capture');
  const cursor = documentCursor(source, 'r1', crypto.randomUUID());
  const capture = vi.fn(() => new Promise<CaptureResult>(resolve => { release = resolve; }));
  const fetcher = vi.fn(async (url: unknown, init?: RequestInit) => {
    if (String(url).includes('/capture/')) return new Response('{}');
    if (init?.method === 'DELETE') return new Response('{}');
    if (init?.method === 'POST') return new Response(new ReadableStream({ start(controller) {
      const encoder = new TextEncoder();
      for (const event of [
        { type: 'started', runId: 'pending-capture', model: 'fixture/model' },
        { type: 'capture-request', captureId: 'pending-image', cursor },
      ]) controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
      init.signal?.addEventListener('abort', () => controller.error(new DOMException('Stopped', 'AbortError')), { once: true });
    } }));
    return new Response(JSON.stringify({ csrf: 'fixture', ready: true, model: 'fixture/model' }));
  });
  vi.stubGlobal('fetch', fetcher);
  instance = mount(AgentChat, { target: document.body, props: {
    screenLabel: 'Pending capture', selectionLabel: 'Screen', blocked: false,
    getContext: () => ({ document: source, cursor }),
    getCapture: capture,
    applyProposal: () => { throw Error('No proposal expected'); },
  } });
  await vi.waitFor(() => expect(document.body.textContent).toContain('Ready'));
  const input = document.querySelector<HTMLTextAreaElement>('textarea')!;
  input.value = 'Observe the current preview';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
  input.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await vi.waitFor(() => expect(capture).toHaveBeenCalledOnce());
  document.querySelector<HTMLButtonElement>('[data-testid="conversation-stop"]')!.click();
  await vi.waitFor(() => expect(document.querySelector('[data-testid="conversation-send"]')).not.toBeNull());
  expect(document.body.textContent).toContain('Stopped');
  release?.({ ok: false, code: 'STUDIO_CAPTURE_CANCELLED', message: 'Late test result.' });
  await new Promise(resolve => setTimeout(resolve, 20));
  expect(fetcher.mock.calls.some(([url]) => String(url).includes('/capture/'))).toBe(false);
});
