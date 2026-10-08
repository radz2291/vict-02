<script lang="ts">
  import { DropdownMenu } from 'bits-ui';
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

<DropdownMenu.Sub bind:open onOpenChange={(next) => io?.emit('openChange', next)}>
  <DropdownMenu.SubTrigger {...presentation?.target('root')} disabled={props.disabled === true} textValue={String(props.label ?? '')} bind:ref={triggerRef}>
    {#snippet child({ props: attributes })}
      <CatalogPart as="div" {attributes} bind:ref={triggerRef}>
        {#if io?.slots?.trigger}{@render io.slots.trigger()}{:else}{String(props.label ?? '')}{/if}
      </CatalogPart>
    {/snippet}
  </DropdownMenu.SubTrigger>
  <CatalogPortal {open} {presentation}><DropdownMenu.SubContent {...presentation?.target('content')} bind:ref={contentRef} sideOffset={6} collisionPadding={16}>
  {#snippet child({ props: attributes, wrapperProps })}
    <div {...wrapperProps}><CatalogPart as="div" {attributes} bind:ref={contentRef}>
      {@render io?.slots?.items?.()}
    </CatalogPart></div>
  {/snippet}
</DropdownMenu.SubContent></CatalogPortal>
</DropdownMenu.Sub>
