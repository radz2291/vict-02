<script lang="ts">
  import type { UiSvelteComponentProps } from '@victframework/ui-svelte';
  import Conversation from '../Conversation.svelte';
  import { parseTranscriptData, readChatData } from './chat-extension-data.js';
  let { props, io, presentation }: UiSvelteComponentProps = $props();
  const target = $derived(presentation?.target('root'));
  const parsed = $derived(readChatData(parseTranscriptData, props.data ?? '{"version":1,"messages":[]}'));
</script>
<div {...target} class={`${target?.class ?? ''} vict-ai`}>
  {#if parsed.error}<p role="alert">Invalid transcript data: {parsed.error}</p>{:else}
    <Conversation {presentation} messages={parsed.value ?? []} busy={props.busy === true}
      title={String(props.title ?? '')} description={String(props.description ?? '')}
      emptyMessage={String(props.emptyMessage ?? 'How can I help?')}
      inputLabel={String(props.inputLabel ?? 'Message')}
      inputPlaceholder={String(props.inputPlaceholder ?? 'Write a message.')}
      onStop={props.stopEnabled === true ? () => io?.emit('stop') : undefined}
      onReset={props.resetEnabled === true ? () => io?.emit('reset') : undefined}
      composer={io?.slots?.composer} footer={io?.slots?.footer}/>
  {/if}
</div>
