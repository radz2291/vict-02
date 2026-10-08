<script lang="ts">
  import { Collapsible } from '../collapsible.js';
  import type { UiSvelteComponentProps } from '../../document/extensions.js';
  let { props, io, presentation }: UiSvelteComponentProps = $props();
  let open = $derived(props.open === true);
</script>

<Collapsible.Root {...presentation?.target('root')} bind:open onOpenChange={(next) => io?.emit('openChange', next)} disabled={props.disabled === true}>
  <Collapsible.Trigger {...presentation?.target('trigger')}>
    {#if io?.slots?.trigger}{@render io.slots.trigger()}{:else}{typeof props.label === 'string' ? props.label : 'Details'}{/if}
  </Collapsible.Trigger>
  <Collapsible.Content {...presentation?.target('content')}>{@render io?.slots?.content?.()}</Collapsible.Content>
</Collapsible.Root>
