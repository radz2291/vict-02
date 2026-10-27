<script lang="ts">
  import type { UiSvelteComponentProps } from '@victframework/ui-svelte';
  import Message from '../patterns/Message.svelte';
  let { props, presentation }: UiSvelteComponentProps = $props();
  const target = $derived(presentation?.target('root'));
</script>
<div {...target} class={`${target?.class ?? ''} vict-ai`}>
  <Message role={props.role === 'user' ? 'user' : 'assistant'} text={String(props.text ?? '')} {presentation} />
</div>
