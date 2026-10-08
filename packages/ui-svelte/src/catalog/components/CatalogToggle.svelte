<script lang="ts">
  /**
   * B1 catalog wrapper: the catalog Toggle (bits-ui Toggle part styled by
   * catalog.css `[data-toggle-root]`, showcase reference markup).
   * S-scalar pressed loop: `pressed` in, `pressedChange` out.
   */
  import { Toggle } from 'bits-ui';
  import type { UiSvelteComponentIO, UiComponentPresentation } from '../../document/extensions.js';

  interface Props {
    readonly props: Readonly<Record<string, unknown>>;
    readonly io?: UiSvelteComponentIO;
    readonly presentation?: UiComponentPresentation;
  }
  let { props, io, presentation }: Props = $props();
  const label = $derived(typeof props.label === 'string' ? props.label : '');
  const pressed = $derived(props.pressed === true);
  const disabled = $derived(props.disabled === true);
</script>

<span data-testid="catalog-toggle" style="display: inline-block">
  <Toggle.Root
    {...presentation?.target('root')}
    {pressed}
    {disabled}
    onPressedChange={(next) => io?.emit('pressedChange', next === true)}
    aria-label={label || undefined}
  >
    {label}
  </Toggle.Root>
</span>
