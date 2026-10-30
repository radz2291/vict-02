<script lang="ts">
  import { onDestroy, tick, type Snippet } from 'svelte';
  import CopyIcon from '@lucide/svelte/icons/copy';
  import CheckIcon from '@lucide/svelte/icons/check';
  import RotateCwIcon from '@lucide/svelte/icons/rotate-cw';
  import * as Message from './upstream/ui/message/index.js';
  import * as Bubble from './upstream/ui/bubble/index.js';
  import PromptInput from './patterns/PromptInput.svelte';
  import * as MessageScroller from './upstream/ui/message-scroller/index.js';
  import ConversationToolCall from './ConversationToolCall.svelte';
  import * as Trace from './upstream/ui/trace/index.js';
  import MessageAction from './MessageAction.svelte';
  import Markdown from './upstream/markdown/markdown.svelte';
  import type { ConversationMessage, SendResult, SendAccepted } from './adapters.js';
  import type { UiComponentPresentation } from '@victframework/ui-svelte';

  let { messages, busy = false, onSend, onStop, emptyMessage = 'How can I help?',
    inputLabel = 'Message', inputPlaceholder = 'Write a message…', footer,
    title, description, onReset, composer, presentation,
  }: {
    messages: readonly ConversationMessage[];
    busy?: boolean;
    onSend?: (text: string, accepted?: SendAccepted) => Promise<SendResult>;
    onStop?: () => void;
    emptyMessage?: string;
    inputLabel?: string;
    inputPlaceholder?: string;
    footer?: Snippet;
    /** Optional app-authored controlled composer; transport stays with its host. */
    composer?: Snippet;
    /** Optional canonical parts and popup scope for authored transcripts. */
    presentation?: UiComponentPresentation;
    title?: string;
    description?: string;
    onReset?: () => void;
  } = $props();
  let draft = $state('');
  let sending = $state(false);
  let error = $state('');
  let copyStatus = $state('');
  let copiedMessageId = $state<string | null>(null);
  let activityOpen = $state<Record<string, boolean>>({});
  let copyReset: ReturnType<typeof setTimeout> | undefined;
  let form = $state<HTMLFormElement>();
  let input = $state<HTMLTextAreaElement | null>(null);
  const pending = $derived(busy || sending);
  const composerPresentation = $derived(presentation ? {...presentation,target:(name:string)=>presentation!.target(({surface:'composer-surface',field:'composer-field',actions:'composer-actions'} as Record<string,string>)[name] ?? name)} : undefined);
  onDestroy(() => clearTimeout(copyReset));

  async function submit(text: string) {
    if (!text || pending || !onSend) return;
    sending = true; error = '';
    const hadFocus = form?.contains(document.activeElement);
    let accepted = false;
    const admit = () => {
      if (accepted) return;
      accepted = true;
      if (draft.trim() === text) draft = '';
    };
    try {
      const result = await onSend(text, admit);
      const ok = typeof result === 'boolean' ? result : result.ok;
      if (ok && !accepted && draft.trim() === text) draft = '';
      if (!ok) error = (typeof result === 'object' && result.message) || 'Message not sent. Your draft is still here.';
    } catch { error = accepted ? 'The response was interrupted. Your sent message remains in the conversation.' : 'Message not sent. Your draft is still here. Try again.'; }
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

{#snippet publicTimeline(message: ConversationMessage)}
  <div {...presentation?.target('timeline')} class={`vict-ai-timeline ${presentation?.target('timeline').class ?? ''}`} aria-label="Conversation timeline">
    {#each message.events ?? [] as event (event.id)}
      <div data-event-kind={event.kind} data-event-id={event.id}>
        {#if event.kind === 'text'}
          <div {...presentation?.target('message-text')} class={`vict-ai-markdown ${presentation?.target('message-text').class ?? ''}`}><Markdown content={event.text}/></div>
        {:else if event.kind === 'activity'}
          <div {...presentation?.target('activity')}><ConversationToolCall activity={event.activity}/></div>
        {:else}
          <p {...presentation?.target('event-summary')} class={`vict-ai-event-summary ${presentation?.target('event-summary').class ?? ''}`}>{event.text}</p>
        {/if}
      </div>
    {/each}
  </div>
{/snippet}

{#snippet composerBody()}
  {#if composer}{@render composer()}{:else}<PromptInput presentation={composerPresentation} bind:value={draft} bind:form bind:input label={inputLabel} placeholder={inputPlaceholder} busy={pending} onSend={onSend ? (text) => void submit(text) : undefined} {onStop}/>{/if}
{/snippet}

<!-- Composition derived from the pinned shadcn-svelte AI Chat/Prompt Input/Tool patterns.
     VICT owns only callbacks and honest lifecycle state; there is no tutorial transport. -->
<section {...presentation?.target('surface')} class={`vict-ai vict-ai-conversation ${presentation?.target('surface').class ?? ''}`} aria-label="Conversation">
  {#if title || description || onReset}
    <div {...presentation?.target('header')} class={`flex items-start justify-between gap-4 px-6 pb-2 pt-6 ${presentation?.target('header').class ?? ''}`}>
      <div class="flex flex-col gap-1">
        {#if title}<div {...presentation?.target('heading')} class={`font-medium ${presentation?.target('heading').class ?? ''}`}>{title}</div>{/if}
        {#if description}<div {...presentation?.target('description')} class={`text-sm text-muted-foreground ${presentation?.target('description').class ?? ''}`}>{description}</div>{/if}
      </div>
      {#if onReset && !busy}<MessageAction {presentation} part="reset" label="Reset conversation" onclick={onReset}><RotateCwIcon aria-hidden="true"/></MessageAction>{/if}
    </div>
  {/if}
  <MessageScroller.Provider>
    <MessageScroller.Root class="vict-ai-feed-root">
      <MessageScroller.Viewport class="vict-conversation" data-testid="conversation-feed" role="region" aria-label={`Messages — ${inputLabel}`} tabindex={0}>
        <MessageScroller.Content {...presentation?.target('messages')} class={`vict-ai-messages ${presentation?.target('messages').class ?? ''}`} aria-busy={busy}>
          {#if !messages.length}<p class="vict-ai-empty">{emptyMessage}</p>{/if}
          {#each messages as message (message.id)}
            <MessageScroller.Item messageId={message.id} scrollAnchor={message.role === 'user'}>
              <Message.Root {...presentation?.target('message')} align={message.role === 'user' ? 'end' : 'start'} data-testid="conversation-message" data-participant={message.role}>
                <Message.Content {...presentation?.target('message-content')} class={`gap-2 ${presentation?.target('message-content').class ?? ''}`}>
                  <span class="vict-ai-sr">{message.author ?? (message.role === 'user' ? 'You' : 'Assistant')}</span>
                  {#if message.role === 'user'}
                    <Bubble.Root align="end" variant="muted"><Bubble.Content><span {...presentation?.target('message-text')} class={`vict-ai-user-text ${presentation?.target('message-text').class ?? ''}`}>{message.text}</span></Bubble.Content></Bubble.Root>
                  {:else}
                    {#if message.events}
                      {#if message.hostTurn}
                        {#if message.hostTurn.evidenceSummary}
                          <div aria-label="Host evidence summary"><p class="vict-ai-event-summary">Host evidence summary</p><p role="status">{message.hostTurn.evidenceSummary}</p></div>
                        {:else}<p class="vict-ai-event-summary" role="status">{message.hostTurn.statusText}</p>{/if}
                        <Trace.Root><Trace.Collapsible open={activityOpen[message.id] ?? false} onOpenChange={(open) => activityOpen = {...activityOpen, [message.id]: open}}>
                          <Trace.CollapsibleTrigger>{message.hostTurn.evidenceSummary ? 'Original AI assessment and tool details' : 'Public activity and tool details'}</Trace.CollapsibleTrigger>
                          <!-- Keep originals mounted through lifecycle transitions. A host
                               summary never changes model text or focused transcript links. -->
                          <Trace.CollapsibleContent forceMount hidden={!activityOpen[message.id]}>
                            {#if message.hostTurn.evidenceSummary}<p class="vict-ai-event-summary">Original AI assessment — claims not independently verified. Tool receipts separately record confirmed effects and capture limits.</p>{/if}
                            {@render publicTimeline(message)}
                          </Trace.CollapsibleContent>
                        </Trace.Collapsible></Trace.Root>
                        {#if message.hostTurn.evidenceSummary}
                          {#if message.hostTurn.state === 'completed' && !message.hostTurn.finalTextEventIds.length}<p class="vict-ai-event-summary">No terminal AI response received.</p>{/if}
                        {:else if message.hostTurn.state === 'completed'}
                          {@const finalEvents = message.events.filter(event => event.kind === 'text' && event.text.trim().length > 0 && message.hostTurn!.finalTextEventIds.includes(event.id))}
                          {#if finalEvents.length}
                            <div aria-label="Terminal response">{#each finalEvents as event (event.id)}{#if event.kind === 'text'}<div {...presentation?.target('message-text')} class={`vict-ai-markdown ${presentation?.target('message-text').class ?? ''}`}><Markdown content={event.text}/></div>{/if}{/each}</div>
                          {:else}<p class="vict-ai-event-summary">No final response received. Inspect the public activity and confirmed receipts.</p>{/if}
                        {:else if message.hostTurn.state !== 'running'}
                          <p class="vict-ai-event-summary">No successful final response. Public notes and tool receipts remain in details.</p>
                        {/if}
                      {:else}{@render publicTimeline(message)}{/if}
                    {:else}
                    {#if message.activity?.length}
                      <div {...presentation?.target('timeline')} aria-label="Tool activity">
                        {#each message.activity as activity (activity.id)}
                          <div {...presentation?.target('activity')}><ConversationToolCall {activity}/></div>
                        {/each}
                      </div>
                    {/if}
                    <div {...presentation?.target('message-text')} class={`vict-ai-markdown ${presentation?.target('message-text').class ?? ''}`}><Markdown content={message.text}/></div>
                    {/if}
                  {/if}
                  {#if message.text && !(busy && message === messages.at(-1))}
                    <Message.Footer class={message.role === 'user' ? undefined : 'px-0'}>
                      <MessageAction {presentation} part="copy" label="Copy message" hint={copiedMessageId === message.id ? 'Copied' : 'Copy message'}
                        action="copy" copied={copiedMessageId === message.id} onclick={() => void copy(message)}>
                        {#if copiedMessageId === message.id}<CheckIcon aria-hidden="true"/>{:else}<CopyIcon aria-hidden="true"/>{/if}
                      </MessageAction>
                    </Message.Footer>
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
  {#if presentation}<div {...presentation.target('composer')} style={`flex:none;min-width:0;${presentation.target('composer').style ?? ''}`}>{@render composerBody()}</div>{:else}{@render composerBody()}{/if}
  {#if error}<p class="vict-ai-error" role="alert">{error}</p>{/if}
  {#if footer}{#if presentation}<div {...presentation.target('footer')}>{@render footer()}</div>{:else}{@render footer()}{/if}{/if}
  <span {...presentation?.target('status')} class={`vict-ai-sr ${presentation?.target('status').class ?? ''}`} role="status">{copyStatus}</span>
</section>

<style>
  .vict-ai-conversation{display:flex;flex-direction:column;min-height:0;height:100%;min-width:0;font:14px/1.5 system-ui,sans-serif;color:var(--foreground,#172033)}
  .vict-ai-conversation :global(.vict-ai-feed-root){flex:1;min-height:0}
  .vict-ai-conversation :global(.vict-ai-messages){gap:22px;padding:18px 14px}
  .vict-ai-conversation :global(.vict-conversation){overflow:auto;min-height:0;height:100%;max-height:none;display:block;gap:0;padding:0;outline-offset:-3px}
  .vict-ai-conversation :global(.vict-ai-composer){border:1px solid var(--border,#d6dce5);border-radius:12px;background:var(--background,#fff)}
  .vict-ai-conversation :global(textarea){width:100%;min-height:64px;max-height:160px;overflow:auto;padding:10px 12px;field-sizing:content;font:inherit}
  .vict-ai-conversation.vict-ai :global(.vict-conversation-input-row){justify-content:flex-end;padding:4px 8px 8px}
  .vict-ai-user-text{white-space:pre-wrap;overflow-wrap:anywhere}
  .vict-ai-markdown{min-width:0;overflow-wrap:anywhere}
  .vict-ai-timeline{display:flex;flex-direction:column;gap:10px;min-width:0;width:100%}
  .vict-ai-event-summary{font-size:12px;color:var(--muted-foreground,#64748b);margin:0;overflow-wrap:anywhere}
  .vict-ai-markdown :global(pre){max-width:100%;overflow:auto}
  .vict-ai-empty{color:var(--muted-foreground,#64748b);margin:auto;text-align:center;padding:20px}
  .vict-ai-error{color:var(--destructive,#b42318);font-size:12px;margin:6px 0}
  .vict-ai-sr{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
</style>
