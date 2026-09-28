<script lang="ts">
  interface Props {
    surfaceId?: string;
    content: string;
    tag?: string;
  }
  let { surfaceId, content, tag = 'p' }: Props = $props();
  // A caller cannot turn a text surface into arbitrary HTML or an injected tag.
  const tags = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
  const element = $derived(tags.has(tag) ? tag : 'p');
</script>

<svelte:element this={element} class="vict-text" data-surface={surfaceId}>{content}</svelte:element>
