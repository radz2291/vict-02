<script lang="ts">
  /**
   * B1 catalog wrapper: the catalog RadioGroup (bits-ui RadioGroup parts
   * styled by catalog.css, showcase reference markup — `vict-control-row`
   * labels per item). S-scalar string selection: `value` in,
   * `valueChange` out.
   */
  import { RadioGroup } from 'bits-ui';
  import type { UiSvelteComponentIO, UiComponentPresentation } from '../../document/extensions.js';

  interface Props {
    readonly props: Readonly<Record<string, unknown>>;
    readonly io?: UiSvelteComponentIO;
    readonly presentation?: UiComponentPresentation;
  }
  let { props, io, presentation }: Props = $props();
  const label = $derived(typeof props.label === 'string' ? props.label : '');
  const options = $derived(
    Array.isArray(props.options)
      ? (props.options as readonly { value?: unknown; label?: unknown }[]).map((option) => ({
          value: String(option?.value ?? ''),
          label: String(option?.label ?? option?.value ?? ''),
        }))
      : [],
  );
  const value = $derived(typeof props.value === 'string' ? props.value : '');
  const disabled = $derived(props.disabled === true);
</script>

<div data-testid="catalog-radio-group" style="display: inline-block">
  {#if label !== ''}<span class="vict-control-label">{label}</span>{/if}
  <RadioGroup.Root
    {...presentation?.target('root')}
    {value}
    {disabled}
    onValueChange={(next) => {
      if (typeof next === 'string') io?.emit('valueChange', next);
    }}
    aria-label={label || undefined}
  >
    {#each options as option (option.value)}
      <label class="vict-control-row">
        <RadioGroup.Item value={option.value} />
        <span>{option.label}</span>
      </label>
    {/each}
  </RadioGroup.Root>
</div>
