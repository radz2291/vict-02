<script lang="ts">
  import { Menubar } from '../menubar.js';
  import CatalogPortal from './CatalogPortal.svelte';
  import { catalogMenuOpenFocus, catalogFocusReturn } from './focus-return.js';
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
  const focusContent = catalogMenuOpenFocus(() => contentRef);
  const restoreTrigger = catalogFocusReturn(() => triggerRef);
</script>

<Menubar.Menu {value} onOpenChange={(next) => io?.emit('openChange', next)}>
  <Menubar.Trigger {...presentation?.target('root')} disabled={props.disabled === true} bind:ref={triggerRef}>
    {#if io?.slots?.trigger}{@render io.slots.trigger()}{:else}{String(props.label ?? '')}{/if}
  </Menubar.Trigger>
  <CatalogPortal {open} {presentation}><Menubar.Content {...presentation?.target('content')} bind:ref={contentRef} strategy="fixed" sideOffset={6} collisionPadding={16} onOpenAutoFocus={focusContent} onCloseAutoFocus={restoreTrigger}>
  {@render io?.slots?.items?.()}
</Menubar.Content></CatalogPortal>
</Menubar.Menu>
