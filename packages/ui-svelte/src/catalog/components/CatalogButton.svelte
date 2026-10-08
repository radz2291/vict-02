<script lang="ts">
  /**
   * B1 catalog wrapper: the PUBLIC Button adapted to the component-ABI IO
   * contract (frozen fixture button-action.json). Emit-only authority: the
   * wrapper receives `io` and nothing else — no dispatcher, no application
   * data. Loading/disabled are authored props driven by state reactively.
   * Rendering is the PUBLIC Button (vict-btn presentation from styles.css)
   * — no wrapper styling of its own.
   */
  import ActionFeedback from '../../ActionFeedback.svelte';
  import Button from '../../Button.svelte';
  import type { UiSvelteComponentIO, UiComponentPresentation } from '../../document/extensions.js';

  interface Props {
    readonly props: Readonly<Record<string, unknown>>;
    readonly io?: UiSvelteComponentIO;
    readonly presentation?: UiComponentPresentation;
  }
  let { props, io, presentation }: Props = $props();
  const label = $derived(typeof props.label === 'string' ? props.label : '');
  const disabled = $derived(props.disabled === true);
  const loading = $derived(props.loading === true || io?.action?.pending === true);
</script>

<span data-testid="catalog-button" style="display: inline-flex; align-items: center; gap: 8px">
  <Button presentation={presentation?.target('root')} busy={loading} label={loading ? 'Working...' : label}
    disabled={disabled || loading} onclick={() => io?.emit('press')} />
  <ActionFeedback feedback={io?.action?.feedback} />
</span>
