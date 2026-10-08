<script lang="ts">
  import { Avatar } from '../avatar.js';
  import type { UiSvelteComponentProps } from '../../document/extensions.js';
  let { props, io, presentation }: UiSvelteComponentProps = $props();
</script>

<Avatar.Root {...presentation?.target('root')} delayMs={typeof props.delayMs === 'number' ? Math.max(0, props.delayMs) : 0}>
  <Avatar.Image {...presentation?.target('image')} src={typeof props.src === 'string' ? props.src : ''} alt={typeof props.alt === 'string' ? props.alt : ''} />
  <Avatar.Fallback {...presentation?.target('fallback')}>
    {#if io?.slots?.fallback}{@render io.slots.fallback()}{:else}{typeof props.fallback === 'string' ? props.fallback : ''}{/if}
  </Avatar.Fallback>
</Avatar.Root>
