<script lang="ts">
  import { Accordion } from 'bits-ui';
  import type { UiSvelteComponentIO, UiComponentPresentation } from '../../document/extensions.js';
  let { props, io, presentation }: { props: Readonly<Record<string, unknown>>; io?: UiSvelteComponentIO; presentation?: UiComponentPresentation } = $props();
</script>
<Accordion.Item value={String(props.value ?? '')}  disabled={props.disabled === true} {...presentation?.target('root')}>
  <Accordion.Header><Accordion.Trigger>{@render io?.slots?.trigger?.()}{#if !io?.slots?.trigger}{String(props.label ?? '')}{/if}</Accordion.Trigger></Accordion.Header>
  <Accordion.Content>{@render io?.slots?.content?.()}</Accordion.Content>
</Accordion.Item>
