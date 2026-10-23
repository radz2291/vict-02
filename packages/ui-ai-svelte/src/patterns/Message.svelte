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
  let { role, text, onCopy, copied = false, onEdit, onRetry, feedback = null, onFeedback }: {
    role: 'user' | 'assistant'; text: string; onCopy?: () => void; copied?: boolean;
    onEdit?: () => void; onRetry?: () => void; feedback?: 'like' | 'dislike' | null;
    onFeedback?: (value: 'like' | 'dislike' | null) => void;
  } = $props();
</script>

<Message.Root align={role === 'user' ? 'end' : 'start'}>
  <Message.Content class="gap-2">
    {#if role === 'user'}
      <Bubble.Root align="end" variant="muted"><Bubble.Content>{text}</Bubble.Content></Bubble.Root>
    {:else}<Markdown content={text}/>{/if}
    {#if onCopy || onEdit || onRetry || onFeedback}
      <Message.Footer class={role === 'user' ? undefined : 'px-0'}>
        {#if onCopy}
          <MessageAction label="Copy message" hint={copied ? 'Copied' : 'Copy message'} action="copy" {copied} onclick={onCopy}>
            {#if copied}<CheckIcon aria-hidden="true"/>{:else}<CopyIcon aria-hidden="true"/>{/if}
          </MessageAction>
        {/if}
        {#if role === 'user' && onEdit}<MessageAction label="Edit message" onclick={onEdit}><PencilIcon aria-hidden="true"/></MessageAction>{/if}
        {#if role === 'assistant' && onFeedback}
          <MessageAction label="Good response" pressed={feedback === 'like'} onclick={() => onFeedback?.(feedback === 'like' ? null : 'like')}><ThumbsUpIcon class={feedback === 'like' ? 'fill-current' : undefined} aria-hidden="true"/></MessageAction>
          <MessageAction label="Bad response" pressed={feedback === 'dislike'} onclick={() => onFeedback?.(feedback === 'dislike' ? null : 'dislike')}><ThumbsDownIcon class={feedback === 'dislike' ? 'fill-current' : undefined} aria-hidden="true"/></MessageAction>
        {/if}
        {#if role === 'assistant' && onRetry}<MessageAction label="Retry response" onclick={onRetry}><RefreshCcwIcon aria-hidden="true"/></MessageAction>{/if}
      </Message.Footer>
    {/if}
  </Message.Content>
</Message.Root>
