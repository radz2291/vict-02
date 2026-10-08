<script lang="ts">
  import { ContextMenu } from '../context-menu.js';
  import CatalogPart from './CatalogPart.svelte';
  import CatalogPortal from './CatalogPortal.svelte';
  import type { UiSvelteComponentIO, UiComponentPresentation } from '../../document/extensions.js';
  let { props, io, presentation }: {
    props: Readonly<Record<string, unknown>>;
    io?: UiSvelteComponentIO;
    presentation?: UiComponentPresentation;
  } = $props();
  let open = $derived(props.open === true);
  let triggerRef = $state<HTMLDivElement | null>(null);
  let contentRef = $state<HTMLDivElement | null>(null);
</script>

<ContextMenu.Root bind:open onOpenChange={(next) => io?.emit('openChange', next)}>
  <ContextMenu.Trigger {...presentation?.target('root')} disabled={props.disabled === true} bind:ref={triggerRef}>
    {#snippet child({ props: attributes })}
      <CatalogPart as="div" {attributes} bind:ref={triggerRef}>
        {#if io?.slots?.trigger}{@render io.slots.trigger()}{:else}{String(props.label ?? '')}{/if}
      </CatalogPart>
    {/snippet}
  </ContextMenu.Trigger>
  <CatalogPortal {open} {presentation}>
    <ContextMenu.Content {...presentation?.target('content')} bind:ref={contentRef} sideOffset={6} collisionPadding={16}>
  {#snippet child({ props: attributes, wrapperProps })}
    <div {...wrapperProps}><CatalogPart as="div" {attributes} bind:ref={contentRef}>
      {@render io?.slots?.items?.()}
    </CatalogPart></div>
  {/snippet}
</ContextMenu.Content>
  </CatalogPortal>
</ContextMenu.Root>
