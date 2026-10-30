<script lang="ts">
  import CopyIcon from '@lucide/svelte/icons/copy';
  import CheckIcon from '@lucide/svelte/icons/check';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import ThumbsUpIcon from '@lucide/svelte/icons/thumbs-up';
  import ThumbsDownIcon from '@lucide/svelte/icons/thumbs-down';
  import RefreshCcwIcon from '@lucide/svelte/icons/refresh-ccw';
  import * as Message from '../upstream/ui/message/index.js';
  import * as Bubble from '../upstream/ui/bubble/index.js';
  import MessageAction from '../MessageAction.svelte';
  import Markdown from '../upstream/markdown/markdown.svelte';
  import type { UiComponentPresentation } from '@victframework/ui-svelte';
  let { role, text, onCopy, copied = false, onEdit, onRetry, feedback = null, onFeedback, presentation }: {
    presentation?: UiComponentPresentation;
    role: 'user' | 'assistant'; text: string; onCopy?: () => void; copied?: boolean;
    onEdit?: () => void; onRetry?: () => void; feedback?: 'like' | 'dislike' | null;
    onFeedback?: (value: 'like' | 'dislike' | null) => void;
  } = $props();
</script>

<Message.Root align={role === 'user' ? 'end' : 'start'}>
  <Message.Content {...presentation?.target('content')} class={`gap-2 ${presentation?.target('content').class ?? ''}`}>
    {#if role === 'user'}
      <Bubble.Root align="end" variant="muted"><Bubble.Content {...presentation?.target('bubble')}>{#if presentation?.target('text')['data-ui-part']}<span {...presentation.target('text')}>{text}</span>{:else}{text}{/if}</Bubble.Content></Bubble.Root>
    {:else if presentation?.target('bubble')['data-ui-part']}
      <div {...presentation.target('bubble')}><div {...presentation.target('text')}><Markdown content={text}/></div></div>
    {:else if presentation?.target('text')['data-ui-part']}<div {...presentation.target('text')}><Markdown content={text}/></div>{:else}<Markdown content={text}/>{/if}
    {#if onCopy || onEdit || onRetry || onFeedback}
      <Message.Footer {...presentation?.target('actions')} class={`${role === 'user' ? '' : 'px-0'} ${presentation?.target('actions').class ?? ''}`}>
        {#if onCopy}
          <MessageAction {presentation} part="copy" label="Copy message" hint={copied ? 'Copied' : 'Copy message'} action="copy" {copied} onclick={onCopy}>
            {#if copied}<CheckIcon aria-hidden="true"/>{:else}<CopyIcon aria-hidden="true"/>{/if}
          </MessageAction>
        {/if}
        {#if role === 'user' && onEdit}<MessageAction {presentation} part="edit" label="Edit message" onclick={onEdit}><PencilIcon aria-hidden="true"/></MessageAction>{/if}
        {#if role === 'assistant' && onFeedback}
          <MessageAction {presentation} part="feedback-like" label="Good response" pressed={feedback === 'like'} onclick={() => onFeedback?.(feedback === 'like' ? null : 'like')}><ThumbsUpIcon class={feedback === 'like' ? 'fill-current' : undefined} aria-hidden="true"/></MessageAction>
          <MessageAction {presentation} part="feedback-dislike" label="Bad response" pressed={feedback === 'dislike'} onclick={() => onFeedback?.(feedback === 'dislike' ? null : 'dislike')}><ThumbsDownIcon class={feedback === 'dislike' ? 'fill-current' : undefined} aria-hidden="true"/></MessageAction>
        {/if}
        {#if role === 'assistant' && onRetry}<MessageAction {presentation} part="retry" label="Retry response" onclick={onRetry}><RefreshCcwIcon aria-hidden="true"/></MessageAction>{/if}
      </Message.Footer>
    {/if}
  </Message.Content>
</Message.Root>
