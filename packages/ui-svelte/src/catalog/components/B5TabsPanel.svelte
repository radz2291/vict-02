<script lang="ts">
  import { Tabs } from '../tabs.js';
  import type { UiSvelteComponentProps } from '../../document/extensions.js';
  let { props, io, presentation }: UiSvelteComponentProps = $props();
</script>

<Tabs.Content {...presentation?.target('root')} value={typeof props.value === 'string' ? props.value : ''}>
  {@render io?.slots?.content?.()}
</Tabs.Content>
