<script lang="ts">
  import { NavigationMenu } from 'bits-ui';
  import type { UiSvelteComponentIO, UiComponentPresentation } from '../../document/extensions.js';
  let { props, io, presentation }: {
    props: Readonly<Record<string, unknown>>;
    io?: UiSvelteComponentIO;
    presentation?: UiComponentPresentation;
  } = $props();
</script>

<NavigationMenu.Link {...presentation?.target('root')} href={String(props.href ?? '')} active={props.active === true} onSelect={() => io?.emit('activate')}>
  {#if io?.slots?.content}{@render io.slots.content()}{:else}{String(props.label ?? '')}{/if}
</NavigationMenu.Link>
