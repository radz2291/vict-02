<script lang="ts">
  import { Label } from '../label.js';
  import type { UiSvelteComponentProps } from '../../document/extensions.js';
  let { props, io, presentation }: UiSvelteComponentProps = $props();
</script>

<Label.Root {...presentation?.target('root')} for={typeof props.for === 'string' ? props.for : undefined}>
  {#if io?.slots?.content}{@render io.slots.content()}{:else}{typeof props.label === 'string' ? props.label : ''}{/if}
</Label.Root>
