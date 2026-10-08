<script lang="ts">
  import { Select } from 'bits-ui';
  import type { UiSvelteComponentIO, UiComponentPresentation } from '../../document/extensions.js';
  let { props, io, presentation }: { props: Readonly<Record<string, unknown>>; io?: UiSvelteComponentIO; presentation?: UiComponentPresentation } = $props();
</script>
<Select.Item value={String(props.value ?? '')} label={String(props.label ?? props.value ?? '')} disabled={props.disabled === true} {...presentation?.target('root')}>
  {@render io?.slots?.content?.()}{#if !io?.slots?.content}{String(props.label ?? props.value ?? '')}{/if}
</Select.Item>
