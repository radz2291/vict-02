<script lang="ts">
  import { ScrollArea } from '../scroll-area.js';
  import type { UiSvelteComponentProps } from '../../document/extensions.js';
  let { props, io, presentation }: UiSvelteComponentProps = $props();
  const type = $derived(props.type === 'scroll' || props.type === 'auto' || props.type === 'always' ? props.type : 'hover');
</script>

<ScrollArea.Root {...presentation?.target('root')} type={type} dir={props.direction === 'rtl' ? 'rtl' : 'ltr'} scrollHideDelay={typeof props.hideDelay === 'number' ? Math.max(0, props.hideDelay) : 600}>
  <ScrollArea.Viewport {...presentation?.target('viewport')}>{@render io?.slots?.content?.()}</ScrollArea.Viewport>
  <ScrollArea.Scrollbar orientation="vertical"><ScrollArea.Thumb /></ScrollArea.Scrollbar>
  {#if props.horizontal === true}<ScrollArea.Scrollbar orientation="horizontal"><ScrollArea.Thumb /></ScrollArea.Scrollbar>{/if}
  <ScrollArea.Corner />
</ScrollArea.Root>
