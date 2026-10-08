<script lang="ts">
  /**
   * B1 catalog wrapper: bits-ui Checkbox with VICT control styling (frozen
   * fixture checkbox-valid.json). Controlled boolean: `checked` flows in;
   * `checkedChange` emits out; the authored binding closes the loop.
   */
  import { Checkbox } from 'bits-ui';
  import type { UiSvelteComponentIO } from '../../document/extensions.js';

  interface Props {
    readonly props: Readonly<Record<string, unknown>>;
    readonly io?: UiSvelteComponentIO;
  }
  let { props, io }: Props = $props();
  const label = $derived(typeof props.label === 'string' ? props.label : '');
  const checked = $derived(props.checked === true);
  const disabled = $derived(props.disabled === true);
</script>

<label class="vict-catalog-field" data-testid="catalog-checkbox">
  <Checkbox.Root
    {checked}
    {disabled}
    onCheckedChange={(next) => io?.emit('checkedChange', next === true)}
    class="vict-catalog-check"
  />
  <span>{label}</span>
</label>
