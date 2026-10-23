<script lang="ts">
  import type { Snippet } from 'svelte';
  import * as InputGroup from '../upstream/ui/input-group/index.js';
  import * as Attachment from '../upstream/ui/attachment/index.js';
  import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
  import SquareIcon from '@lucide/svelte/icons/square';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import FileTextIcon from '@lucide/svelte/icons/file-text';
  import XIcon from '@lucide/svelte/icons/x';
  let { value = $bindable(''), label = 'Message', placeholder = 'Write a message…', busy = false,
    onSend, onStop, onAttach, attachments = [], onRemoveAttachment, footer,
    form = $bindable(), input = $bindable(null),
  }: {
    value?: string; label?: string; placeholder?: string; busy?: boolean;
    onSend?: (text: string) => void; onStop?: () => void;
    onAttach?: () => void;
    attachments?: readonly { id: string; name: string }[];
    onRemoveAttachment?: (id: string) => void; footer?: Snippet;
    form?: HTMLFormElement; input?: HTMLTextAreaElement | null;
  } = $props();
  function submit(event: SubmitEvent) { event.preventDefault(); if (!busy && value.trim()) onSend?.(value.trim()); }
</script>
<form class="vict-conversation-input" bind:this={form} onsubmit={submit} aria-busy={busy}>
  <InputGroup.Root class="vict-ai-composer">
    {#if attachments.length}
      <InputGroup.Addon align="block-start"><Attachment.Group>
        {#each attachments as file (file.id)}
          <Attachment.Root size="sm"><Attachment.Media><FileTextIcon/></Attachment.Media><Attachment.Content><Attachment.Title>{file.name}</Attachment.Title></Attachment.Content>
            <Attachment.Actions><Attachment.Action aria-label={`Remove ${file.name}`} disabled={!onRemoveAttachment} onclick={() => onRemoveAttachment?.(file.id)}><XIcon/></Attachment.Action></Attachment.Actions>
          </Attachment.Root>
        {/each}
      </Attachment.Group></InputGroup.Addon>
    {/if}
    <InputGroup.Textarea bind:value bind:ref={input} aria-label={label} {placeholder} name="message" class="vict-conversation-textarea"
      data-testid="conversation-input" rows={2} maxlength={6000} title="Enter to send. Shift+Enter for a new line."
      onkeydown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); if (!busy) form?.requestSubmit(); } }}/>
    <InputGroup.Addon align="block-end" class="vict-conversation-input-row flex-wrap">
      {#if onAttach}<InputGroup.Button type="button" size="icon-sm" variant="outline" class="rounded-full" aria-label="Attach files" onclick={onAttach}><PlusIcon aria-hidden="true"/></InputGroup.Button>{/if}
      {@render footer?.()}
      {#if busy && onStop}<InputGroup.Button type="button" size="icon-sm" variant="default" class="ml-auto rounded-full" data-testid="conversation-stop" aria-label="Stop" onclick={onStop}><SquareIcon aria-hidden="true"/><span class="sr-only">Stop</span></InputGroup.Button>
      {:else}<InputGroup.Button type="submit" size="icon-sm" variant="default" class="ml-auto rounded-full" data-testid="conversation-send" aria-label="Send" disabled={busy || !onSend || !value.trim()}><ArrowUpIcon aria-hidden="true"/><span class="sr-only">Send</span></InputGroup.Button>{/if}
    </InputGroup.Addon>
  </InputGroup.Root>
</form>
<style>.vict-conversation-input{flex:none;margin:0;padding:8px 10px;min-width:0;border:0;display:block}</style>
