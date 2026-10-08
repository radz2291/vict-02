<script lang="ts">
  import { NavigationMenu } from '../navigation-menu.js';
  import type { UiSvelteComponentIO, UiComponentPresentation } from '../../document/extensions.js';
  let { props, io, presentation }: {
    props: Readonly<Record<string, unknown>>;
    io?: UiSvelteComponentIO;
    presentation?: UiComponentPresentation;
  } = $props();
  let value = $derived(String(props.value ?? ''));
</script>

<NavigationMenu.Root {...presentation?.target('root')} bind:value orientation={props.orientation === 'vertical' ? 'vertical' : 'horizontal'} onValueChange={(next) => io?.emit('valueChange', next)}>
  <NavigationMenu.List>{@render io?.slots?.items?.()}</NavigationMenu.List>
</NavigationMenu.Root>
