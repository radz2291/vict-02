<script lang="ts">
  import type { UiSvelteComponentProps } from '@victframework/ui-svelte';
  import Message from '../patterns/Message.svelte';
  let { props, io, presentation }: UiSvelteComponentProps = $props();
  const target = $derived(presentation?.target('root'));
</script>
<div {...target} class={`${target?.class ?? ''} vict-ai`}>
  <Message {presentation} role={props.role === 'user' ? 'user' : 'assistant'} text={String(props.text ?? '')}
    copied={props.copied === true}
    feedback={props.feedback === 'like' || props.feedback === 'dislike' ? props.feedback : null}
    onCopy={props.copyEnabled === true ? () => io?.emit('copy') : undefined}
    onEdit={props.editEnabled === true ? () => io?.emit('edit') : undefined}
    onRetry={props.retryEnabled === true ? () => io?.emit('retry') : undefined}
    onFeedback={props.feedbackEnabled === true ? value => io?.emit('feedbackChange', value ?? '') : undefined}/>
</div>
