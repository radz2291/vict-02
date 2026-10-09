<script lang="ts">
  import { Toolbar } from '../toolbar.js';
  import type { UiSvelteComponentProps } from '../../document/extensions.js';
  import ActionFeedback from '../../ActionFeedback.svelte';
  let { props, io, presentation }: UiSvelteComponentProps = $props();
</script>

<Toolbar.Button {...presentation?.target('root')} disabled={props.disabled === true} aria-disabled={io?.action?.pending || undefined} aria-busy={io?.action?.pending || undefined} onclick={(event) => { if (io?.action?.pending) { event.preventDefault(); return; } io?.emit('press'); }}>
  {#if io?.slots?.content}{@render io.slots.content()}{:else}{typeof props.label === 'string' ? props.label : ''}{/if}
</Toolbar.Button>
<ActionFeedback feedback={io?.action?.feedback} />
