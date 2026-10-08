<script lang="ts">
  import { Menubar } from '../menubar.js';
  import CatalogPart from './CatalogPart.svelte';
  import type { UiSvelteComponentIO, UiComponentPresentation } from '../../document/extensions.js';
  let { props, io, presentation }: {
    props: Readonly<Record<string, unknown>>;
    io?: UiSvelteComponentIO;
    presentation?: UiComponentPresentation;
  } = $props();
  import { setContext } from 'svelte';
  import { B4_MENUBAR_VALUE, type B4MenubarValue } from './B4MenuContext.js';
  let value = $derived(String(props.value ?? ''));
  let ref = $state<HTMLDivElement | null>(null);
  setContext<B4MenubarValue>(B4_MENUBAR_VALUE, () => value);
</script>

<Menubar.Root {...presentation?.target('root')} bind:ref bind:value loop={props.loop !== false} onValueChange={(next) => io?.emit('valueChange', next)}>
  {#snippet child({ props: attributes })}<CatalogPart as="div" {attributes} bind:ref>{@render io?.slots?.menus?.()}</CatalogPart>{/snippet}
</Menubar.Root>
