<script lang="ts">
  import { tick, type Snippet } from 'svelte';
  import type { UiConversationMessage } from '@victframework/ui';
  interface Props {
    surfaceId: string;
    messages: readonly UiConversationMessage[];
    emptyMessage: string;
    inputLabel: string;
    inputPlaceholder?: string;
    multiline?: boolean;
    followUpdates?: boolean;
    messageBody?: Snippet<[UiConversationMessage]>;
    onSend: (text: string) => Promise<boolean | { ok: boolean; message?: string; dataStale?: boolean }>;
  }
  let { surfaceId, messages, emptyMessage, inputLabel, inputPlaceholder = '', multiline = false, followUpdates = false, messageBody, onSend }: Props = $props();
  let draft = $state('');
  let sending = $state(false);
  let sendError = $state('');
  let sendStale = $state(false);
  let feedElement: HTMLDivElement;
  let following = true;
  let previousMessageCount: number | undefined;
  let previousTail: string | undefined;
  $effect(() => {
    const tail = followUpdates ? messages.at(-1)?.text : undefined;
    const changed = previousMessageCount !== undefined &&
      (messages.length > previousMessageCount || (followUpdates && tail !== previousTail));
    previousMessageCount = messages.length;
    previousTail = tail;
    if (!changed) return;
    void tick().then(() => {
      if (following && feedElement) feedElement.scrollTop = feedElement.scrollHeight;
    });
  });
  let inputElement = $state<HTMLInputElement | HTMLTextAreaElement>();
  function composerKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    if (!sending && draft.trim()) formElement?.requestSubmit();
  }
  let formElement: HTMLFormElement;

  async function send(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const text = draft.trim();
    if (text === '' || sending) return;
    const restoreFocus = formElement?.contains(document.activeElement) ?? false;
    following = true;
    sending = true;
    sendError = '';
    sendStale = false;
    try {
      const result = await onSend(text);
      const ok = typeof result === 'boolean' ? result : result.ok;
      if (ok && draft.trim() === text) draft = '';
      if (!ok) sendError = (typeof result === 'object' ? result.message : undefined) ?? 'Your message was not sent. Your draft is still here. Try again.';
      // The send SUCCEEDED but the refreshed transcript could not be
      // loaded: a distinct stale note, never a send failure.
      sendStale = ok === true && typeof result === 'object' && result.dataStale === true;
    } catch {
      sendError = 'Your message was not sent. Your draft is still here. Try again.';
    } finally {
      sending = false;
      if (restoreFocus && (formElement?.contains(document.activeElement) || document.activeElement === document.body)) {
        inputElement?.focus();
      }
    }
  }
</script>

<section class="vict-conversation-panel" data-surface={surfaceId}>
  <!-- The feed is a contained scroll region (max-height + overflow): it must
       stay keyboard-scrollable (axe scrollable-region-focusable) and named.
       The app-declared composer label (compiler-required, non-empty) keeps
       the region name distinct when a screen shows several conversations. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="vict-conversation" bind:this={feedElement} onscroll={() => { following = feedElement.scrollHeight - feedElement.scrollTop - feedElement.clientHeight < 64; }} data-testid="conversation-feed" role="region" aria-label={`Messages — ${inputLabel}`} aria-live="polite" tabindex="0">
    {#if messages.length === 0}
      <p class="vict-state" data-state="empty">{emptyMessage}</p>
    {:else}
      {#each messages as message, index (index)}
        <article class="vict-conversation-message"
          class:vict-conversation-message--user={message.participant === 'user'}
          class:vict-conversation-message--assistant={message.participant === 'assistant'}
          data-testid="conversation-message" data-participant={message.participant}>
          <p class="vict-conversation-meta"><span class="vict-avatar" aria-hidden="true">{message.author.slice(0, 1)}</span>{message.author}<span class="vict-message-role">{message.participant}</span></p>
          {#if messageBody}
            <div class="vict-conversation-body">{@render messageBody(message)}</div>
          {:else}
            <p class="vict-conversation-body">{message.text}</p>
          {/if}
        </article>
      {/each}
    {/if}
  </div>
  <form class="vict-conversation-input" aria-busy={sending} bind:this={formElement} onsubmit={(event) => void send(event)}>
    <label class="vict-field-label" for="vict-conversation-input-{surfaceId}">{inputLabel}</label>
    <div class="vict-conversation-input-row">
      {#if multiline}
        <textarea class="vict-input vict-conversation-textarea" id="vict-conversation-input-{surfaceId}" data-testid="conversation-input"
          name="message" rows="2" maxlength="6000" autocomplete="off" placeholder={inputPlaceholder}
          title="Enter to send. Shift+Enter for a new line." onkeydown={composerKeydown}
          bind:value={draft} bind:this={inputElement}></textarea>
      {:else}
        <input class="vict-input" id="vict-conversation-input-{surfaceId}" data-testid="conversation-input"
          name="message" autocomplete="off" placeholder={inputPlaceholder} bind:value={draft} bind:this={inputElement} />
      {/if}
      <button class="vict-btn" type="submit" data-testid="conversation-send" disabled={sending || draft.trim() === ''}>
        {sending ? 'Sending…' : 'Send'}
      </button>
    </div>
    <p class="vict-send-error" role="alert" aria-atomic="true">{sendError}</p>
    {#if sendStale}
      <p class="vict-action-stale" role="status" aria-atomic="true" data-testid="conversation-stale">
        Sent, but the latest messages could not be loaded. This view may be out of date.
      </p>
    {/if}
  </form>
</section>
