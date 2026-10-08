<script lang="ts">
  import { ToggleGroup } from '../toggle-group.js';
  import type { UiSvelteComponentIO, UiComponentPresentation } from '../../document/extensions.js';
  let { props, io, presentation }: { props: Readonly<Record<string, unknown>>; io?: UiSvelteComponentIO; presentation?: UiComponentPresentation } = $props();
</script>
<ToggleGroup.Item value={String(props.value ?? '')}  disabled={props.disabled === true} {...presentation?.target('root')}>
  {@render io?.slots?.content?.()}{#if !io?.slots?.content}{String(props.label ?? props.value ?? '')}{/if}
</ToggleGroup.Item>
