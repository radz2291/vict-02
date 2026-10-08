<script lang="ts">
  /**
   * B1 catalog wrapper: the catalog Switch (bits-ui Switch parts styled by
   * catalog.css, showcase reference markup — `vict-control-row` label +
   * `Switch.Thumb`). S-scalar boolean loop: `checked` in, `checkedChange`
   * out.
   */
  import { Switch } from 'bits-ui';
  import type { UiSvelteComponentIO, UiComponentPresentation } from '../../document/extensions.js';

  interface Props {
    readonly props: Readonly<Record<string, unknown>>;
    readonly io?: UiSvelteComponentIO;
    readonly presentation?: UiComponentPresentation;
  }
  let { props, io, presentation }: Props = $props();
  const label = $derived(typeof props.label === 'string' ? props.label : '');
  const checked = $derived(props.checked === true);
  const disabled = $derived(props.disabled === true);
</script>

<label {...presentation?.target('root')} class={['vict-control-row', presentation?.target('root').class ?? ''].join(' ')} data-testid="catalog-switch">
  <Switch.Root
    {checked}
    {disabled}
    onCheckedChange={(next) => io?.emit('checkedChange', next === true)}
    ><Switch.Thumb /></Switch.Root
  >
  <span>{label}</span>
</label>
