<script lang="ts">
  import type { UiSvelteComponentProps } from '@victframework/ui-svelte';
  import PromptInput from '../patterns/PromptInput.svelte';
  let { props, io, presentation }: UiSvelteComponentProps = $props();
  const target = $derived(presentation?.target('root'));
</script>

<div {...target} class={`${target?.class ?? ''} vict-ai`}>
  <PromptInput
    bind:value={() => String(props.value ?? ''), (next: string) => io?.emit('valueChange', next)}
    label={String(props.label ?? 'Message')}
    placeholder={String(props.placeholder ?? 'Write a message…')}
    busy={props.busy === true}
    onSend={(text) => io?.emit('send', text)}
    onStop={() => io?.emit('stop')}
  />
</div>
