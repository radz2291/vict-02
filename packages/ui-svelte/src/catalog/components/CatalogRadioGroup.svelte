<script lang="ts">
  /** B1 catalog wrapper: bits-ui RadioGroup (S-scalar string selection). */
  import { RadioGroup } from 'bits-ui';
  import type { UiSvelteComponentIO } from '../../document/extensions.js';

  interface Props {
    readonly props: Readonly<Record<string, unknown>>;
    readonly io?: UiSvelteComponentIO;
  }
  let { props, io }: Props = $props();
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

<div
  class="vict-catalog-radio"
  role="radiogroup"
  aria-label={typeof props.label === 'string' ? props.label : undefined}
  data-testid="catalog-radio-group"
>
  {#each options as option (option.value)}
    <label class="vict-catalog-field">
      <RadioGroup.Root
        {value}
        {disabled}
        onValueChange={(next) => io?.emit('valueChange', next)}
        name=""
      >
        <RadioGroup.Item value={option.value} class="vict-catalog-radio-item" />
      </RadioGroup.Root>
      <span>{option.label}</span>
    </label>
  {/each}
</div>
