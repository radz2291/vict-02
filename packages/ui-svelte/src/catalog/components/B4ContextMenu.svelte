<script lang="ts">
  import { ContextMenu } from '../context-menu.js';
  import CatalogPortal from './CatalogPortal.svelte';
  import type { UiSvelteComponentIO, UiComponentPresentation } from '../../document/extensions.js';
  let { props, io, presentation }: {
    props: Readonly<Record<string, unknown>>;
    io?: UiSvelteComponentIO;
    presentation?: UiComponentPresentation;
  } = $props();
  const authoredOpen = $derived(props.open === true);
  let open = $derived(authoredOpen);
  $effect(() => { if (open !== authoredOpen) io?.emit('openChange', open); });
  let triggerRef = $state<HTMLDivElement | null>(null);
  let contentRef = $state<HTMLDivElement | null>(null);
</script>

<ContextMenu.Root bind:open onOpenChange={(next) => io?.emit('openChange', next)}>
  <ContextMenu.Trigger {...presentation?.target('root')} disabled={props.disabled === true} bind:ref={triggerRef}>
    {#if io?.slots?.trigger}{@render io.slots.trigger()}{:else}{String(props.label ?? '')}{/if}
  </ContextMenu.Trigger>
  <CatalogPortal {open} {presentation}>
    <ContextMenu.Content {...presentation?.target('content')} bind:ref={contentRef} sideOffset={6} collisionPadding={16}>
  {@render io?.slots?.items?.()}
</ContextMenu.Content>
  </CatalogPortal>
</ContextMenu.Root>
