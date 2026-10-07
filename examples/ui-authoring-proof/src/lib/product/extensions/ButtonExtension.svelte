<script lang="ts">
  import { Button, type UiSvelteExtensionProps } from '@victframework/ui-svelte';
  let { props }: UiSvelteExtensionProps = $props();
  const variant = $derived(props.variant === 'danger' ? 'danger' : props.variant === 'secondary' ? 'secondary' : 'primary');
</script>
<Button label={String(props.label ?? '')} type="submit" {variant} disabled={props.disabled === true} />
