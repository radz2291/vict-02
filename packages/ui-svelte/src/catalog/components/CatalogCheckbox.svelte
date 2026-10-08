<script lang="ts">
  /**
   * B1 catalog wrapper: the catalog Checkbox (bits-ui part styled by
   * catalog.css under `.vict-controls`) in the showcase reference markup —
   * `vict-control-row` label + bare `Checkbox.Root` (frozen fixture
   * checkbox-valid.json). Controlled boolean: `checked` flows in;
   * `checkedChange` emits out; the authored binding closes the loop.
   */
  import { Checkbox } from 'bits-ui';
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

<label {...presentation?.target('root')} class={['vict-control-row', presentation?.target('root').class ?? ''].join(' ')} data-testid="catalog-checkbox">
  <Checkbox.Root
    {checked}
    {disabled}
    onCheckedChange={(next) => io?.emit('checkedChange', next === true)}
  />
  <span>{label}</span>
</label>
