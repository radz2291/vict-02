<script lang="ts">
  import { Select } from 'bits-ui';
  import CatalogPart from './CatalogPart.svelte';
  let { value, label }: { value: string; label: string } = $props();
  let ref = $state<HTMLDivElement | null>(null);
</script>

<Select.Item {value} {label} bind:ref>
  {#snippet child({ props })}
    <CatalogPart as="div" attributes={props} bind:ref>{label}</CatalogPart>
  {/snippet}
</Select.Item>
