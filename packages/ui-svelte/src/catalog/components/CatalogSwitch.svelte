<script lang="ts">
  /** B1 catalog wrapper: bits-ui Switch (S-scalar boolean loop). */
  import { Switch } from 'bits-ui';
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

<label class="vict-catalog-field" data-testid="catalog-switch">
  <Switch.Root
    {checked}
    {disabled}
    onCheckedChange={(next) => io?.emit('checkedChange', next === true)}
    class="vict-catalog-switch"
  />
  <span>{label}</span>
</label>
