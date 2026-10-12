<script lang="ts">
  /** Round-5 probe fixture (finding F16): the accordion family's exposed
   * `label` prop must carry its intended effect — the accessible group name
   * on the accordion root — and stay absent when unset/empty. */
  import B2Accordion from '../src/catalog/components/B2Accordion.svelte';
  import B2AccordionItem from '../src/catalog/components/B2AccordionItem.svelte';
  import type { UiSvelteComponentIO } from '../src/document/extensions.js';

  let { label = undefined }: { label?: string } = $props();
</script>

{#snippet item()}
  <B2AccordionItem props={{ value: 'a', label: 'Section A' }} />
{/snippet}

<B2Accordion
  props={{ values: ['a'], label }}
  io={{ emit: () => {}, slots: { items: item } } as UiSvelteComponentIO}
/>
