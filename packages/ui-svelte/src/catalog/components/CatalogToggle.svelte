<script lang="ts">
  /** B1 catalog wrapper: bits-ui Toggle (S-scalar pressed loop). */
  import { Toggle } from 'bits-ui';
  import type { UiSvelteComponentIO } from '../../document/extensions.js';

  interface Props {
    readonly props: Readonly<Record<string, unknown>>;
    readonly io?: UiSvelteComponentIO;
  }
  let { props, io }: Props = $props();
  const label = $derived(typeof props.label === 'string' ? props.label : '');
  const pressed = $derived(props.pressed === true);
  const disabled = $derived(props.disabled === true);
</script>

<Toggle.Root
  {pressed}
  {disabled}
  onPressedChange={(next) => io?.emit('pressedChange', next === true)}
  class="vict-btn"
  data-testid="catalog-toggle"
>{label}</Toggle.Root>
