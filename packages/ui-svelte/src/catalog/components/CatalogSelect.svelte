<script lang="ts">
  /**
   * B1 catalog wrapper (single-value mode): the catalog Select (bits-ui
   * Select parts styled by catalog.css — `data-select-trigger`), the same
   * surface as the showcase reference (frozen fixture select-valid.json).
   * `options` is the array-typed reference-only prop; `value` is
   * controlled string state; `valueChange` emits the new value. Portals
   * render through bits-ui's configured portal target (ControlScope root).
   */
  import { Select } from 'bits-ui';
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
  const selectedLabel = $derived(
    options.find((option) => option.value === value)?.label ?? 'Choose an option',
  );
</script>

<span data-testid="catalog-select" style="display: inline-block; min-width: 220px">
  <Select.Root
    type="single"
    {value}
    {disabled}
    onValueChange={(next) => {
      if (typeof next === 'string') io?.emit('valueChange', next);
    }}
  >
    <Select.Trigger>
      <span>{selectedLabel}</span>
    </Select.Trigger>
    <Select.Portal>
      <Select.Content sideOffset={6} align="start" collisionPadding={16}>
        {#each options as option (option.value)}
          <Select.Item {...option}>{option.label}</Select.Item>
        {/each}
      </Select.Content>
    </Select.Portal>
  </Select.Root>
</span>
