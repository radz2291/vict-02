<script lang="ts">
  import { onDestroy, tick, type Snippet } from 'svelte';
  import CopyIcon from '@lucide/svelte/icons/copy';
  import CheckIcon from '@lucide/svelte/icons/check';
  import * as Message from './upstream/ui/message/index.js';
  import * as Bubble from './upstream/ui/bubble/index.js';
  import PromptInput from './patterns/PromptInput.svelte';
  import * as MessageScroller from './upstream/ui/message-scroller/index.js';
  import * as Trace from './upstream/ui/trace/index.js';
  import { Button } from './upstream/ui/button/index.js';
  import Markdown from './upstream/markdown/markdown.svelte';
  import type { ConversationMessage, SendResult } from './adapters.js';

  let { messages, busy = false, onSend, onStop, emptyMessage = 'How can I help?',
    inputLabel = 'Message', inputPlaceholder = 'Write a message…', footer,
  }: {
    messages: readonly ConversationMessage[];
    busy?: boolean;
    onSend: (text: string) => Promise<SendResult>;
    onStop?: () => void;
    emptyMessage?: string;
    inputLabel?: string;
    inputPlaceholder?: string;
    footer?: Snippet;
  } = $props();
  let draft = $state('');
  let sending = $state(false);
  let error = $state('');
  let copyStatus = $state('');
  let copiedMessageId = $state<string | null>(null);
  let copyReset: ReturnType<typeof setTimeout> | undefined;
  let form = $state<HTMLFormElement>();
  let input = $state<HTMLTextAreaElement | null>(null);
  const pending = $derived(busy || sending);
  onDestroy(() => clearTimeout(copyReset));

  async function submit(text: string) {
    if (!text || pending) return;
    sending = true; error = '';
    const hadFocus = form?.contains(document.activeElement);
    try {
      const result = await onSend(text);
      const ok = typeof result === 'boolean' ? result : result.ok;
      if (ok && draft.trim() === text) draft = '';
      if (!ok) error = (typeof result === 'object' && result.message) || 'Message not sent. Your draft is still here.';
    } catch { error = 'Message not sent. Your draft is still here. Try again.'; }
    finally {
      sending = false;
      await tick();
      if (hadFocus && (form?.contains(document.activeElement) || document.activeElement === document.body)) input?.focus();
    }
  }
  async function copy(message: ConversationMessage) {
    clearTimeout(copyReset);
    copiedMessageId = null;
    copyStatus = '';
    try {
      await navigator.clipboard.writeText(message.text);
      copiedMessageId = message.id;
      copyStatus = 'Message copied.';
      copyReset = setTimeout(() => { copiedMessageId = null; }, 2000);
    }
    catch { copyStatus = 'Copy unavailable. Select the message text to copy it.'; }
  }
</script>

<!-- Composition derived from the pinned shadcn-svelte AI Chat/Prompt Input/Tool patterns.
     VICT owns only callbacks and honest lifecycle state; there is no tutorial transport. -->
<section class="vict-ai vict-ai-conversation" aria-label="Conversation">
  <MessageScroller.Provider>
    <MessageScroller.Root class="vict-ai-feed-root">
      <MessageScroller.Viewport class="vict-conversation" data-testid="conversation-feed" role="region" aria-label={`Messages — ${inputLabel}`} tabindex={0}>
        <MessageScroller.Content class="vict-ai-messages" aria-busy={busy}>
          {#if !messages.length}<p class="vict-ai-empty">{emptyMessage}</p>{/if}
          {#each messages as message (message.id)}
            <MessageScroller.Item messageId={message.id} scrollAnchor={message.role === 'user'}>
              <Message.Root align={message.role === 'user' ? 'end' : 'start'} data-testid="conversation-message" data-participant={message.role}>
                <Message.Content>
                  <span class="vict-ai-author">{message.author ?? (message.role === 'user' ? 'You' : 'Assistant')}</span>
                  {#if message.role === 'user'}
                    <Bubble.Root align="end" variant="muted"><Bubble.Content><span class="vict-ai-user-text">{message.text}</span></Bubble.Content></Bubble.Root>
                  {:else}
                    {#if message.activity?.length}
                      <Trace.Root aria-label="Tool activity">
                        {#each message.activity as activity (activity.id)}
                          <Trace.Collapsible>
                            <Trace.CollapsibleTrigger><Trace.Line status={activity.state === 'completed' ? undefined : activity.state === 'failed' ? 'error' : activity.state}>
                              <Trace.Title>{activity.title}</Trace.Title><span class="vict-ai-activity-state">{activity.state}</span>
                            </Trace.Line></Trace.CollapsibleTrigger>
                            <Trace.CollapsibleContent>{activity.detail ?? activity.title}</Trace.CollapsibleContent>
                          </Trace.Collapsible>
                        {/each}
                      </Trace.Root>
                    {/if}
                    <div class="vict-ai-markdown"><Markdown content={message.text}/></div>
                    {#if message.text && !(busy && message === messages.at(-1))}
                      <Message.Footer>
                        <Button variant="ghost" size="icon" onclick={() => void copy(message)}
                          aria-label="Copy message" title={copiedMessageId === message.id ? 'Copied' : 'Copy message'}
                          data-copied={copiedMessageId === message.id || undefined}>
                          {#if copiedMessageId === message.id}<CheckIcon aria-hidden="true"/>{:else}<CopyIcon aria-hidden="true"/>{/if}
                        </Button>
                      </Message.Footer>
                    {/if}
                  {/if}
                </Message.Content>
              </Message.Root>
            </MessageScroller.Item>
          {/each}
        </MessageScroller.Content>
      </MessageScroller.Viewport>
      <MessageScroller.Button aria-label="Scroll to latest message" />
    </MessageScroller.Root>
  </MessageScroller.Provider>
  <PromptInput bind:value={draft} bind:form bind:input label={inputLabel} placeholder={inputPlaceholder} busy={pending} onSend={(text) => void submit(text)} {onStop}/>
  {#if error}<p class="vict-ai-error" role="alert">{error}</p>{/if}
  {#if footer}{@render footer()}{/if}
  <span class="vict-ai-sr" role="status">{copyStatus}</span>
</section>

<style>
  .vict-ai-conversation{display:flex;flex-direction:column;min-height:0;height:100%;min-width:0;font:14px/1.5 system-ui,sans-serif;color:var(--foreground,#172033)}
  .vict-ai-conversation :global(.vict-ai-feed-root){flex:1;min-height:0}
  .vict-ai-conversation :global(.vict-ai-messages){gap:22px;padding:18px 14px}
  .vict-ai-conversation :global(.vict-conversation){overflow:auto;min-height:0;height:100%;max-height:none;display:block;gap:0;padding:0;outline-offset:-3px}
  .vict-ai-conversation :global(.vict-ai-composer){border:1px solid var(--border,#d6dce5);border-radius:12px;background:var(--background,#fff)}
  .vict-ai-conversation :global(textarea){width:100%;min-height:64px;max-height:160px;overflow:auto;padding:10px 12px;field-sizing:content;font:inherit}
  .vict-ai-conversation.vict-ai :global(.vict-conversation-input-row){justify-content:flex-end;padding:4px 8px 8px}
  .vict-ai-author{display:block;font-size:11px;font-weight:600;color:var(--muted-foreground,#64748b);margin-bottom:5px}
  .vict-ai-user-text{white-space:pre-wrap;overflow-wrap:anywhere}
  .vict-ai-markdown{min-width:0;overflow-wrap:anywhere}
  .vict-ai-markdown :global(pre){max-width:100%;overflow:auto}
  .vict-ai-empty{color:var(--muted-foreground,#64748b);margin:auto;text-align:center;padding:20px}
  .vict-ai-error{color:var(--destructive,#b42318);font-size:12px;margin:6px 0}
  .vict-ai-activity-state{font-size:11px;margin-left:8px}
  .vict-ai-sr{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
</style>
