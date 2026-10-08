<script lang="ts">
  import { AspectRatio } from '../aspect-ratio.js';
  import type { UiSvelteComponentProps } from '../../document/extensions.js';
  let { props, io, presentation }: UiSvelteComponentProps = $props();
</script>

<AspectRatio.Root {...presentation?.target('root')} ratio={typeof props.ratio === 'number' && props.ratio > 0 ? props.ratio : 1}>
  {@render io?.slots?.content?.()}
</AspectRatio.Root>
