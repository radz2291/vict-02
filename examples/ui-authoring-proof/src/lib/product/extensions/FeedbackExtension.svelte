<script lang="ts">
  import { Feedback, type UiSvelteExtensionProps } from '@victframework/ui-svelte';
  let { props }: UiSvelteExtensionProps = $props();
  const kind = $derived(props.kind === 'error' ? 'error' : props.kind === 'denied' ? 'denied' : 'status');
</script>
<div tabindex="-1" data-feedback-focus><Feedback message={String(props.message ?? '')} {kind} /></div>
