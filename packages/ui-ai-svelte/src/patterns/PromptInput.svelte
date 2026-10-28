<script lang="ts">
  import type { Snippet } from 'svelte';
  import * as InputGroup from '../upstream/ui/input-group/index.js';
  import * as Attachment from '../upstream/ui/attachment/index.js';
  import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
  import SquareIcon from '@lucide/svelte/icons/square';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import FileTextIcon from '@lucide/svelte/icons/file-text';
  import XIcon from '@lucide/svelte/icons/x';
  import type { UiComponentPresentation } from '@victframework/ui-svelte';
  let { value = $bindable(''), label = 'Message', placeholder = 'Write a message…', busy = false,
    onSend, onStop, onAttach, attachments = [], onRemoveAttachment, footer,
    form = $bindable(), input = $bindable(null), presentation,
  }: {
    value?: string; label?: string; placeholder?: string; busy?: boolean;
    onSend?: (text: string) => void; onStop?: () => void;
    onAttach?: () => void;
    attachments?: readonly { id: string; name: string }[];
    onRemoveAttachment?: (id: string) => void; footer?: Snippet;
    form?: HTMLFormElement; input?: HTMLTextAreaElement | null;
    presentation?: UiComponentPresentation;
  } = $props();
  function submit(event: SubmitEvent) { event.preventDefault(); if (!busy && value.trim()) onSend?.(value.trim()); }
</script>
<form class="vict-conversation-input" bind:this={form} onsubmit={submit} aria-busy={busy}>
  <InputGroup.Root {...presentation?.target('surface')} class={`vict-ai-composer ${presentation?.target('surface').class ?? ''}`}>
    {#if attachments.length}
      <InputGroup.Addon align="block-start"><Attachment.Group {...presentation?.target('attachments')}>
        {#each attachments as file (file.id)}
          <Attachment.Root {...presentation?.target('attachment')} size="sm"><Attachment.Media><FileTextIcon/></Attachment.Media><Attachment.Content><Attachment.Title>{file.name}</Attachment.Title></Attachment.Content>
            <Attachment.Actions><Attachment.Action {...presentation?.target('attachment-remove')} aria-label={`Remove ${file.name}`} disabled={!onRemoveAttachment} onclick={() => onRemoveAttachment?.(file.id)}><XIcon/></Attachment.Action></Attachment.Actions>
          </Attachment.Root>
        {/each}
      </Attachment.Group></InputGroup.Addon>
    {/if}
    <InputGroup.Textarea {...presentation?.target('field')} bind:value bind:ref={input} aria-label={label} {placeholder} name="message" class={`vict-conversation-textarea ${presentation?.target('field').class ?? ''}`}
      data-testid="conversation-input" rows={2} maxlength={6000} title="Enter to send. Shift+Enter for a new line."
      onkeydown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); if (!busy) form?.requestSubmit(); } }}/>
    <InputGroup.Addon {...presentation?.target('actions')} align="block-end" class={`vict-conversation-input-row flex-wrap ${presentation?.target('actions').class ?? ''}`}>
      {#if onAttach}<InputGroup.Button {...presentation?.target('attach')} type="button" size="icon-sm" variant="outline" class={`rounded-full ${presentation?.target('attach').class ?? ''}`} aria-label="Attach files" onclick={onAttach}><PlusIcon aria-hidden="true"/></InputGroup.Button>{/if}
      {#if footer}<span {...presentation?.target('footer')}>{@render footer()}</span>{/if}
      {#if busy && onStop}<InputGroup.Button {...presentation?.target('stop')} type="button" size="icon-sm" variant="default" class={`ml-auto rounded-full ${presentation?.target('stop').class ?? ''}`} data-testid="conversation-stop" aria-label="Stop" onclick={onStop}><SquareIcon aria-hidden="true"/><span class="sr-only">Stop</span></InputGroup.Button>
      {:else}<InputGroup.Button {...presentation?.target('send')} type="submit" size="icon-sm" variant="default" class={`ml-auto rounded-full ${presentation?.target('send').class ?? ''}`} data-testid="conversation-send" aria-label="Send" disabled={busy || !onSend || !value.trim()}><ArrowUpIcon aria-hidden="true"/><span class="sr-only">Send</span></InputGroup.Button>{/if}
    </InputGroup.Addon>
  </InputGroup.Root>
</form>
<style>.vict-conversation-input{flex:none;margin:0;padding:8px 10px;min-width:0;border:0;display:block}</style>
