<script lang="ts">
  import { StatusBadge, type UiSvelteExtensionProps } from '@victframework/ui-svelte';
  let { props }: UiSvelteExtensionProps = $props();
  const tone = $derived(props.tone === 'danger' ? 'danger' : props.tone === 'success' ? 'success' : props.tone === 'warning' ? 'warning' : props.tone === 'info' ? 'info' : 'neutral');
</script>
<StatusBadge value={String(props.value ?? '')} {tone} />
