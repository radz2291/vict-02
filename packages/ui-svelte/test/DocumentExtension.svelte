<script lang="ts">
  import type { UiSvelteExtensionProps } from '../src/document/extensions.js';
  let { props, occurrenceKey }: UiSvelteExtensionProps = $props();
</script>
<button type="submit" data-implementation-occ={occurrenceKey}>{String(props['label'])}</button>
