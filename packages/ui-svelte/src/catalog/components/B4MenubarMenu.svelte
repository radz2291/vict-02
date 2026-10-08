<script lang="ts">
  import { Menubar } from 'bits-ui';
  import CatalogPart from './CatalogPart.svelte';
  import CatalogPortal from './CatalogPortal.svelte';
  import type { UiSvelteComponentIO, UiComponentPresentation } from '../../document/extensions.js';
  let { props, io, presentation }: {
    props: Readonly<Record<string, unknown>>;
    io?: UiSvelteComponentIO;
    presentation?: UiComponentPresentation;
  } = $props();
  import { getContext } from 'svelte';
  import { B4_MENUBAR_VALUE, type B4MenubarValue } from './B4MenuContext.js';
  const activeMenu = getContext<B4MenubarValue>(B4_MENUBAR_VALUE);
  const value = $derived(String(props.value ?? ''));
  const open = $derived(activeMenu?.() === value);
  let triggerRef = $state<HTMLButtonElement | null>(null);
  let contentRef = $state<HTMLDivElement | null>(null);
</script>

<Menubar.Menu {value} onOpenChange={(next) => io?.emit('openChange', next)}>
  <Menubar.Trigger {...presentation?.target('root')} disabled={props.disabled === true} bind:ref={triggerRef}>
    {#snippet child({ props: attributes })}<CatalogPart as="button" {attributes} bind:ref={triggerRef}>
      {#if io?.slots?.trigger}{@render io.slots.trigger()}{:else}{String(props.label ?? '')}{/if}
    </CatalogPart>{/snippet}
  </Menubar.Trigger>
  <CatalogPortal {open} {presentation}><Menubar.Content {...presentation?.target('content')} bind:ref={contentRef} sideOffset={6} collisionPadding={16}>
  {#snippet child({ props: attributes, wrapperProps })}
    <div {...wrapperProps}><CatalogPart as="div" {attributes} bind:ref={contentRef}>
      {@render io?.slots?.items?.()}
    </CatalogPart></div>
  {/snippet}
</Menubar.Content></CatalogPortal>
</Menubar.Menu>
