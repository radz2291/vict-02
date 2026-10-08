<script lang="ts">
  import { Tabs } from '../tabs.js';
  import type { UiSvelteComponentProps } from '../../document/extensions.js';
  let { props, io, presentation }: UiSvelteComponentProps = $props();
</script>

<Tabs.Trigger {...presentation?.target('root')} value={typeof props.value === 'string' ? props.value : ''} disabled={props.disabled === true}>
  {#if io?.slots?.content}{@render io.slots.content()}{:else}{typeof props.label === 'string' ? props.label : ''}{/if}
</Tabs.Trigger>
