<script lang="ts">
  import type { UiSvelteComponentProps } from '@victframework/ui-svelte';
  let { props, io, presentation }: UiSvelteComponentProps = $props();
  const target = $derived(presentation?.target('root'));
</script>
<section {...target} class={`${target?.class ?? ''} vict-ai`} aria-label={String(props.label ?? 'Conversation')}>
  <div {...presentation?.target('surface')} class={`vict-authored-conversation ${presentation?.target('surface').class ?? ''}`}>
    <div {...presentation?.target('messages')} class={`vict-authored-messages ${presentation?.target('messages').class ?? ''}`} role="log" aria-label="Messages" aria-live="polite">{@render io?.slots?.messages?.()}</div>
    <div {...presentation?.target('composer')} class={`vict-authored-composer ${presentation?.target('composer').class ?? ''}`}>{@render io?.slots?.composer?.()}</div>
  </div>
</section>
<style>
  .vict-authored-conversation { display: flex; flex-direction: column; min-width: 0; border: 1px solid #d4d4d8; border-radius: 12px; background: var(--background, #fff); color: var(--foreground, #18181b); overflow: hidden; }
  .vict-authored-messages { display: flex; flex-direction: column; gap: 18px; padding: 20px; min-height: 120px; max-height: 560px; overflow-y: auto; }
  .vict-authored-composer { padding: 10px; border-top: 1px solid #e4e4e7; }
</style>
