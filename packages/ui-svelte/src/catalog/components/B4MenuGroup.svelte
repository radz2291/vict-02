<script lang="ts">
  import { getContext } from 'svelte';
  import { OWNED_MENU_CONTEXT, type OwnedMenuContext } from '../../owned-menu.js';
  import { DropdownMenu } from '../dropdown-menu.js';
  import CatalogPart from './CatalogPart.svelte';
  import type { UiSvelteComponentIO, UiComponentPresentation } from '../../document/extensions.js';
  let { props, io, presentation }: {
    props: Readonly<Record<string, unknown>>;
    io?: UiSvelteComponentIO;
    presentation?: UiComponentPresentation;
  } = $props();
  let ref = $state<HTMLDivElement | null>(null);

  const ownedMenu = getContext<OwnedMenuContext | undefined>(OWNED_MENU_CONTEXT);
  const headingId=$props.id();
  const hasHeading=$derived(!!io?.slots?.heading||String(props.label??'')!=='');
</script>

{#if ownedMenu?.owned}
  <div {...presentation?.target('root')} bind:this={ref} role="group" data-dropdown-menu-group aria-labelledby={hasHeading?headingId:undefined}>
    {#if hasHeading}<div id={headingId} data-dropdown-menu-group-heading>{#if io?.slots?.heading}{@render io.slots.heading()}{:else}{String(props.label??'')}{/if}</div>{/if}
    {@render io?.slots?.items?.()}
  </div>
{:else}
<DropdownMenu.Group {...presentation?.target('root')} bind:ref>
  {#snippet child({ props: attributes })}<CatalogPart as="div" {attributes} bind:ref>
    <DropdownMenu.GroupHeading>{#if io?.slots?.heading}{@render io.slots.heading()}{:else}{String(props.label ?? '')}{/if}</DropdownMenu.GroupHeading>
    {@render io?.slots?.items?.()}
  </CatalogPart>{/snippet}
</DropdownMenu.Group>
{/if}
