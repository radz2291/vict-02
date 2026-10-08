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
  import CatalogPortal from './CatalogPortal.svelte';
  import CatalogPart from './CatalogPart.svelte';
  import CatalogSelectOption from './CatalogSelectOption.svelte';
  import type { UiSvelteComponentIO, UiComponentPresentation } from '../../document/extensions.js';

  interface Props {
    readonly props: Readonly<Record<string, unknown>>;
    readonly io?: UiSvelteComponentIO;
    readonly presentation?: UiComponentPresentation;
  }
  let { props, io, presentation }: Props = $props();
  const options = $derived(
    Array.isArray(props.options)
      ? (props.options as readonly { value?: unknown; label?: unknown }[]).map((option) => ({
          value: String(option?.value ?? ''),
          label: String(option?.label ?? option?.value ?? ''),
        }))
      : [],
  );
  let value = $derived(typeof props.value === 'string' ? props.value : '');
  let open = $state(false);
  let triggerRef = $state<HTMLButtonElement | null>(null);
  let contentRef = $state<HTMLDivElement | null>(null);
  const disabled = $derived(props.disabled === true);
  const selectedLabel = $derived(
    options.find((option) => option.value === value)?.label ?? 'Choose an option',
  );
</script>

<span data-testid="catalog-select" style="display: inline-block; min-width: 220px">
  <Select.Root
    type="single"
    bind:value
    bind:open
    {disabled}
    onValueChange={(next) => {
      if (typeof next === 'string') io?.emit('valueChange', next);
    }}
  >
    <Select.Trigger {...presentation?.target('root')} bind:ref={triggerRef}>
      {#snippet child({ props: attributes })}
        <CatalogPart as="button" {attributes} bind:ref={triggerRef}><span>{selectedLabel}</span></CatalogPart>
      {/snippet}
    </Select.Trigger>
    <CatalogPortal {open} {presentation}>
      <Select.Content {...presentation?.target('content')} bind:ref={contentRef} sideOffset={6} align="start" collisionPadding={16}>
        {#snippet child({ props: attributes, wrapperProps })}
          <div {...wrapperProps}>
            <CatalogPart as="div" {attributes} bind:ref={contentRef}>
              {@render io?.slots?.items?.()}
              {#each options as option (option.value)}
                <CatalogSelectOption {...option} />
              {/each}
            </CatalogPart>
          </div>
        {/snippet}
      </Select.Content>
    </CatalogPortal>
  </Select.Root>
</span>
