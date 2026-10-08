<script lang="ts">
  import { Toolbar } from '../toolbar.js';
  import type { UiSvelteComponentProps } from '../../document/extensions.js';
  let { props, io, presentation }: UiSvelteComponentProps = $props();
</script>

<Toolbar.Root {...presentation?.target('root')} orientation={props.orientation === 'vertical' ? 'vertical' : 'horizontal'} loop={props.loop !== false} aria-label={typeof props.label === 'string' ? props.label : 'Tools'}>
  {@render io?.slots?.tools?.()}
</Toolbar.Root>
