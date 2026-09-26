<script lang="ts">
  import { tick } from 'svelte';
  import type { UiConversationMessage } from '@victframework/ui';
  interface Props {
    surfaceId: string;
    messages: readonly UiConversationMessage[];
    emptyMessage: string;
    inputLabel: string;
    inputPlaceholder?: string;
    onSend: (text: string) => Promise<boolean | { ok: boolean; message?: string }>;
  }
  let { surfaceId, messages, emptyMessage, inputLabel, inputPlaceholder = '', onSend }: Props = $props();
  let draft = $state('');
  let sending = $state(false);
  let sendError = $state('');
  let feedElement: HTMLDivElement;
  let following = true;
  let previousMessageCount: number | undefined;
  $effect(() => {
    const appended = previousMessageCount !== undefined && messages.length > previousMessageCount;
    previousMessageCount = messages.length;
    if (!appended) return;
    void tick().then(() => {
      if (following && feedElement) feedElement.scrollTop = feedElement.scrollHeight;
    });
  });
  let inputElement: HTMLInputElement;
  let formElement: HTMLFormElement;

  async function send(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const text = draft.trim();
    if (text === '' || sending) return;
    const restoreFocus = formElement?.contains(document.activeElement) ?? false;
    following = true;
    sending = true;
    sendError = '';
    try {
      const result = await onSend(text);
      const ok = typeof result === 'boolean' ? result : result.ok;
      if (ok && draft.trim() === text) draft = '';
      if (!ok) sendError = (typeof result === 'object' ? result.message : undefined) ?? 'Your message was not sent. Your draft is still here. Try again.';
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
          <p class="vict-conversation-body">{message.text}</p>
        </article>
      {/each}
    {/if}
  </div>
  <form class="vict-conversation-input" aria-busy={sending} bind:this={formElement} onsubmit={(event) => void send(event)}>
    <label class="vict-field-label" for="vict-conversation-input-{surfaceId}">{inputLabel}</label>
    <div class="vict-conversation-input-row">
      <input class="vict-input" id="vict-conversation-input-{surfaceId}" data-testid="conversation-input"
        name="message" autocomplete="off" placeholder={inputPlaceholder} bind:value={draft} bind:this={inputElement} />
      <button class="vict-btn" type="submit" data-testid="conversation-send" disabled={sending || draft.trim() === ''}>
        {sending ? 'Sending…' : 'Send'}
      </button>
    </div>
    <p class="vict-send-error" role="alert" aria-atomic="true">{sendError}</p>
  </form>
</section>
