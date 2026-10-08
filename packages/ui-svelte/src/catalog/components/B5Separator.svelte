<script lang="ts">
  import { Separator } from '../separator.js';
  import type { UiSvelteComponentProps } from '../../document/extensions.js';
  let { props, io, presentation }: UiSvelteComponentProps = $props();
</script>

<Separator.Root {...presentation?.target('root')} orientation={props.orientation === 'vertical' ? 'vertical' : 'horizontal'} decorative={props.decorative === true} />
