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
  it.each([true, false])('keeps one action during a pending send (cancellable: %s)', async (cancellable) => {
    let finish!: (ok: boolean) => void;
    const pending = new Promise<boolean>((resolve) => { finish = resolve; });
    const send = vi.fn(() => pending);
    const stop = vi.fn(() => finish(true));
    instance = mount(Conversation, { target: document.body, props: {
      surfaceId: 'stop-test', messages: [], emptyMessage: 'Empty', inputLabel: 'Message',
      multiline: true, onSend: send, ...(cancellable ? { onStop: stop } : {}),
    }});
    const input = document.querySelector<HTMLTextAreaElement>('[name="message"]')!;
    input.value = 'Build a form';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    document.querySelector<HTMLButtonElement>('[data-testid="conversation-send"]')!.click();
    await tick();
    const actions = document.querySelectorAll<HTMLButtonElement>('.vict-conversation-input-row button');
    expect(actions).toHaveLength(1);
    expect(actions[0].textContent?.trim()).toBe(cancellable ? 'Stop' : 'Sending…');
    expect(actions[0].disabled).toBe(!cancellable);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(send).toHaveBeenCalledTimes(1);
    // Editing the next draft during a turn must survive cancellation/completion.
    input.value = 'Then change the heading';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    if (cancellable) actions[0].click(); else finish(true);
    await vi.waitFor(() => expect(document.querySelector('[data-testid="conversation-stop"]')).toBeNull());
    await vi.waitFor(() => expect(document.querySelector<HTMLButtonElement>('[data-testid="conversation-send"]')?.disabled).toBe(false));
    expect(stop).toHaveBeenCalledTimes(cancellable ? 1 : 0);
    expect(send).toHaveBeenCalledTimes(1);
    expect(input.value).toBe('Then change the heading');
  });

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
