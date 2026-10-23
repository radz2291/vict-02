<script lang="ts">
  import type { Snippet } from 'svelte';
  import * as InputGroup from '../upstream/ui/input-group/index.js';
  import * as Attachment from '../upstream/ui/attachment/index.js';
  let { value = $bindable(''), label = 'Message', placeholder = 'Write a message…', busy = false,
    onSend, onStop, attachments = [], onRemoveAttachment, footer,
    form = $bindable(), input = $bindable(null),
  }: {
    value?: string; label?: string; placeholder?: string; busy?: boolean;
    onSend?: (text: string) => void; onStop?: () => void;
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
          <Attachment.Root><Attachment.Content><Attachment.Title>{file.name}</Attachment.Title></Attachment.Content>
            <Attachment.Actions><Attachment.Action aria-label={`Remove ${file.name}`} disabled={!onRemoveAttachment} onclick={() => onRemoveAttachment?.(file.id)}>×</Attachment.Action></Attachment.Actions>
          </Attachment.Root>
        {/each}
      </Attachment.Group></InputGroup.Addon>
    {/if}
    <InputGroup.Textarea bind:value bind:ref={input} aria-label={label} {placeholder} name="message" class="vict-conversation-textarea"
      data-testid="conversation-input" rows={2} maxlength={6000} title="Enter to send. Shift+Enter for a new line."
      onkeydown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); if (!busy) form?.requestSubmit(); } }}/>
    <InputGroup.Addon align="block-end" class="vict-conversation-input-row">
      {@render footer?.()}
      {#if busy && onStop}<InputGroup.Button type="button" data-testid="conversation-stop" aria-label="Stop" onclick={onStop}>Stop</InputGroup.Button>
      {:else}<InputGroup.Button type="submit" data-testid="conversation-send" disabled={busy || !onSend || !value.trim()}>Send</InputGroup.Button>{/if}
    </InputGroup.Addon>
  </InputGroup.Root>
</form>
<style>.vict-conversation-input{flex:none;margin:0;padding:8px 10px;min-width:0;border:0;display:block}</style>
