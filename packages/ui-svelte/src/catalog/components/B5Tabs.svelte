<script lang="ts">
  import { Tabs } from '../tabs.js';
  import type { UiSvelteComponentProps } from '../../document/extensions.js';
  let { props, io, presentation }: UiSvelteComponentProps = $props();
  let value = $derived(typeof props.value === 'string' ? props.value : '');
</script>

<Tabs.Root {...presentation?.target('root')} bind:value onValueChange={(next) => io?.emit('valueChange', next)} disabled={props.disabled === true} orientation={props.orientation === 'vertical' ? 'vertical' : 'horizontal'} activationMode={props.activationMode === 'manual' ? 'manual' : 'automatic'} loop={props.loop === true}>
  <Tabs.List {...presentation?.target('list')} aria-label={typeof props.label === 'string' ? props.label : 'Sections'}>{@render io?.slots?.tabs?.()}</Tabs.List>
  {@render io?.slots?.panels?.()}
</Tabs.Root>
