<script lang="ts">
  /**
   * B1 catalog wrapper (single-value mode): the PUBLIC Select adapted to
   * the IO contract (frozen fixture select-valid.json). `options` is the
   * array-typed reference-only prop (typed view-field reference); `value`
   * is controlled string state; `valueChange` emits the new value.
   */
  import Select from '../../Select.svelte';
  import type { UiSelectOption } from '@victframework/ui';
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
      : ([] as UiSelectOption[]),
  );
  const value = $derived(typeof props.value === 'string' ? props.value : '');
  const disabled = $derived(props.disabled === true);
</script>

<Select
  name=""
  {value}
  {options}
  {disabled}
  onChange={(next) => io?.emit('valueChange', next)}
  data-testid="catalog-select"
/>
