<script lang="ts">
  import { onDestroy } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';
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
  // Closing the parent portal destroys its submenu. Keep the declared value
  // closed so reopening the parent starts from its own menu, not a stale layer.
  onDestroy(() => { if (open) io?.emit('openChange', false); });
  let triggerRef = $state<HTMLDivElement | null>(null);
  let contentRef = $state<HTMLDivElement | null>(null);
  // Side-by-side menus cannot fit the shared minimum widths on a phone.
  // Let the public floating layer place the submenu vertically and shift it
  // within the viewport while retaining the library's submenu keyboard model.
  const narrow = new MediaQuery('(max-width: 600px)', false);
</script>

<DropdownMenu.Sub bind:open onOpenChange={(next) => io?.emit('openChange', next)}>
  <DropdownMenu.SubTrigger {...presentation?.target('root')} disabled={props.disabled === true} textValue={String(props.label ?? '')} bind:ref={triggerRef}>
    {#if io?.slots?.trigger}{@render io.slots.trigger()}{:else}{String(props.label ?? '')}{/if}
  </DropdownMenu.SubTrigger>
  <CatalogPortal {open} {presentation}><DropdownMenu.SubContent {...presentation?.target('content')} bind:ref={contentRef} side={narrow.current ? 'bottom' : 'right'} sideOffset={6} collisionPadding={16}>
  {@render io?.slots?.items?.()}
</DropdownMenu.SubContent></CatalogPortal>
</DropdownMenu.Sub>
