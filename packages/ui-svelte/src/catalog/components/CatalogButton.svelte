<script lang="ts">
  /**
   * B1 catalog wrapper: the PUBLIC Button adapted to the component-ABI IO
   * contract (frozen fixture button-action.json). Emit-only authority: the
   * wrapper receives `io` and nothing else — no dispatcher, no application
   * data. Loading/disabled are authored props driven by state reactively.
   */
  import Button from '../../Button.svelte';
  import type { UiSvelteComponentIO } from '../../document/extensions.js';

  interface Props {
    readonly props: Readonly<Record<string, unknown>>;
    readonly io?: UiSvelteComponentIO;
  }
  let { props, io }: Props = $props();
  const label = $derived(typeof props.label === 'string' ? props.label : '');
  const disabled = $derived(props.disabled === true);
  const loading = $derived(props.loading === true);
</script>

<Button
  {label}
  variant={typeof props.variant === 'string' ? (props.variant as 'primary' | 'secondary' | 'danger') : 'primary'}
  disabled={disabled || loading}
  data-testid="catalog-button"
  onclick={() => io?.emit('press')}
/>
{#if loading}<span class="vict-catalog-loading" role="status">Working…</span>{/if}
