import { createRawSnippet, flushSync, mount, tick, unmount } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UiConversationMessage } from '@victframework/ui';
import Conversation from '../src/Conversation.svelte';

let instance: ReturnType<typeof mount> | undefined;
afterEach(async () => {
  if (instance) await unmount(instance);
  instance = undefined;
  document.body.innerHTML = '';
});

function render(multiline = false, followUpdates = false, customBody = false) {
  const state = new SvelteMap<string, readonly UiConversationMessage[]>([['messages', []]]);
  const send = vi.fn(async () => ({ ok: false, message: 'Retry after reconnecting.' }));
  instance = mount(Conversation, {
    target: document.body,
    props: {
      surfaceId: 'composer-test',
      emptyMessage: 'Empty',
      inputLabel: 'Message',
      multiline,
      followUpdates,
      onSend: send,
      get messages() {
        return state.get('messages')!;
      },
      ...(customBody
        ? {
            messageBody: createRawSnippet(() => ({
              render: () => '<strong>Formatted reply</strong>',
            })),
          }
        : {}),
    },
  });
  flushSync();
  const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>('[name="message"]')!;
  const type = (text: string) => {
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
  };
  return { state, send, input, type };
}

describe('Conversation optional composer and streamed content', () => {
  it('keeps the default single-line, escaped message contract', () => {
    const app = render();
    app.state.set('messages', [
      { author: 'Agent', participant: 'assistant', text: '<strong>literal</strong>' },
    ]);
    flushSync();
    expect(app.input.tagName).toBe('INPUT');
    expect(document.querySelector('.vict-conversation-body')?.textContent).toBe(
      '<strong>literal</strong>',
    );
    expect(document.querySelector('.vict-conversation-body strong')).toBeNull();
  });

  it('supports multiline drafts, Shift+Enter and IME without accidentally sending', async () => {
    const app = render(true, true);
    app.type('First line\nSecond line');
    expect(app.input.tagName).toBe('TEXTAREA');
    for (const options of [{ shiftKey: true }, { isComposing: true }]) {
      app.input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...options }),
      );
      expect(app.send).not.toHaveBeenCalled();
    }
    app.input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    await vi.waitFor(() => expect(app.send).toHaveBeenCalledWith('First line\nSecond line'));
    expect(app.input.value).toBe('First line\nSecond line');
    await vi.waitFor(() =>
      expect(document.querySelector('[role="alert"]')?.textContent).toContain(
        'Retry after reconnecting.',
      ),
    );
  });

  it('uses a custom message snippet only when supplied', () => {
    const app = render(true, true, true);
    app.state.set('messages', [{ author: 'Agent', participant: 'assistant', text: 'source' }]);
    flushSync();
    expect(document.querySelector('.vict-conversation-body strong')?.textContent).toBe(
      'Formatted reply',
    );
  });

  it('follows streamed deltas but respects a reader who scrolls up', async () => {
    const app = render(true, true);
    const feed = document.querySelector<HTMLElement>('[data-testid="conversation-feed"]')!;
    let height = 500;
    Object.defineProperties(feed, {
      scrollHeight: { get: () => height },
      clientHeight: { value: 100 },
    });
    app.state.set('messages', [{ author: 'Agent', participant: 'assistant', text: 'Start' }]);
    flushSync();
    await tick();
    await tick();
    expect(feed.scrollTop).toBe(500);
    height = 600;
    app.state.set('messages', [
      { author: 'Agent', participant: 'assistant', text: 'Start and continue' },
    ]);
    flushSync();
    await tick();
    await tick();
    expect(feed.scrollTop).toBe(600);
    feed.scrollTop = 0;
    feed.dispatchEvent(new Event('scroll'));
    app.state.set('messages', [
      { author: 'Agent', participant: 'assistant', text: 'Start and continue further' },
    ]);
    flushSync();
    await tick();
    await tick();
    expect(feed.scrollTop).toBe(0);
  });
});
