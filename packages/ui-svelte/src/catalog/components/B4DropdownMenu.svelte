<script lang="ts">
  import { DropdownMenu } from '../dropdown-menu.js';
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
  let triggerRef = $state<HTMLButtonElement | null>(null);
  let contentRef = $state<HTMLDivElement | null>(null);
</script>

<DropdownMenu.Root bind:open onOpenChange={(next) => io?.emit('openChange', next)}>
  <DropdownMenu.Trigger {...presentation?.target('root')} disabled={props.disabled === true} bind:ref={triggerRef}>
    {#if io?.slots?.trigger}{@render io.slots.trigger()}{:else}{String(props.label ?? '')}{/if}
  </DropdownMenu.Trigger>
  <CatalogPortal {open} {presentation}>
    <DropdownMenu.Content {...presentation?.target('content')} bind:ref={contentRef} sideOffset={6} collisionPadding={16}>
  {@render io?.slots?.items?.()}
</DropdownMenu.Content>
  </CatalogPortal>
</DropdownMenu.Root>
