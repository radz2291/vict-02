<script lang="ts">
  import { NavigationMenu } from '../navigation-menu.js';
  import CatalogPart from './CatalogPart.svelte';
  import type { UiSvelteComponentIO, UiComponentPresentation } from '../../document/extensions.js';
  let { props, io, presentation }: {
    props: Readonly<Record<string, unknown>>;
    io?: UiSvelteComponentIO;
    presentation?: UiComponentPresentation;
  } = $props();
  let triggerRef = $state<HTMLButtonElement | null>(null);
</script>

<NavigationMenu.Item value={String(props.value ?? '')} openOnHover={props.openOnHover !== false}>
  <NavigationMenu.Trigger {...presentation?.target('root')} bind:ref={triggerRef} disabled={props.disabled === true}>
    {#snippet child({ props: attributes })}<CatalogPart as="button" {attributes} bind:ref={triggerRef}>{#if io?.slots?.trigger}{@render io.slots.trigger()}{:else}{String(props.label ?? '')}{/if}</CatalogPart>{/snippet}
  </NavigationMenu.Trigger>
  <NavigationMenu.Content {...presentation?.target('content')}>{@render io?.slots?.content?.()}</NavigationMenu.Content>
</NavigationMenu.Item>
