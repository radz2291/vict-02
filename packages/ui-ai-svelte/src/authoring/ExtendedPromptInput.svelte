<script lang="ts">
  import type { UiSvelteComponentProps } from '@victframework/ui-svelte';
  import PromptInput from '../patterns/PromptInput.svelte';
  import { parseAttachmentData, readChatData } from './chat-extension-data.js';
  let { props, io, presentation }: UiSvelteComponentProps = $props();
  const target = $derived(presentation?.target('root'));
  const parsed = $derived(readChatData(parseAttachmentData, props.data ?? '{"version":1,"attachments":[]}'));
</script>
<div {...target} class={`${target?.class ?? ''} vict-ai`}>
  {#if parsed.error}<p role="alert">Invalid attachment data: {parsed.error}</p>{:else}
    <PromptInput {presentation}
      bind:value={() => String(props.value ?? ''), (next: string) => io?.emit('valueChange', next)}
      label={String(props.label ?? 'Message')} placeholder={String(props.placeholder ?? 'Write a message.')}
      busy={props.busy === true} attachments={parsed.value ?? []}
      onSend={props.sendEnabled === true ? text => io?.emit('send', text) : undefined}
      onStop={props.stopEnabled === true ? () => io?.emit('stop') : undefined}
      onAttach={props.attachEnabled === true ? () => io?.emit('attach') : undefined}
      onRemoveAttachment={props.removeAttachmentEnabled === true ? id => io?.emit('removeAttachment', id) : undefined}
      footer={io?.slots?.footer}/>
  {/if}
</div>
