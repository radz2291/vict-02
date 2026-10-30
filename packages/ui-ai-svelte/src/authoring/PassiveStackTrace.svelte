<script lang="ts">
  import type { UiSvelteComponentProps } from '@victframework/ui-svelte';
  import PublicPattern from './PublicPattern.svelte';
  let props: UiSvelteComponentProps = $props();
</script>
<PublicPattern {...props} kind="stack-trace" />
