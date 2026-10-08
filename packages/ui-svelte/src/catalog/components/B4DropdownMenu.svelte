<script lang="ts">
  import { DropdownMenu } from '../dropdown-menu.js';
  import CatalogPart from './CatalogPart.svelte';
  import CatalogPortal from './CatalogPortal.svelte';
  import type { UiSvelteComponentIO, UiComponentPresentation } from '../../document/extensions.js';
  let { props, io, presentation }: {
    props: Readonly<Record<string, unknown>>;
    io?: UiSvelteComponentIO;
    presentation?: UiComponentPresentation;
  } = $props();
  let open = $derived(props.open === true);
  let triggerRef = $state<HTMLButtonElement | null>(null);
  let contentRef = $state<HTMLDivElement | null>(null);
</script>

<DropdownMenu.Root bind:open onOpenChange={(next) => io?.emit('openChange', next)}>
  <DropdownMenu.Trigger {...presentation?.target('root')} disabled={props.disabled === true} bind:ref={triggerRef}>
    {#snippet child({ props: attributes })}
      <CatalogPart as="button" {attributes} bind:ref={triggerRef}>
        {#if io?.slots?.trigger}{@render io.slots.trigger()}{:else}{String(props.label ?? '')}{/if}
      </CatalogPart>
    {/snippet}
  </DropdownMenu.Trigger>
  <CatalogPortal {open} {presentation}>
    <DropdownMenu.Content {...presentation?.target('content')} bind:ref={contentRef} sideOffset={6} collisionPadding={16}>
  {#snippet child({ props: attributes, wrapperProps })}
    <div {...wrapperProps}><CatalogPart as="div" {attributes} bind:ref={contentRef}>
      {@render io?.slots?.items?.()}
    </CatalogPart></div>
  {/snippet}
</DropdownMenu.Content>
  </CatalogPortal>
</DropdownMenu.Root>
