<script lang="ts">
  /**
   * Test fixture implementing the checkbox component-ABI contract: the
   * controlled loop (checked prop in → checkedChange emit out), plus
   * emission paths used by the delivery tests (undeclared output, wrong
   * payload type). It receives ONLY the IO contract (§3.4 emit-only
   * authority).
   */
  import type { UiSvelteComponentIO, UiSvelteComponentProps } from '../src/document/extensions.js';

  let { props, io }: UiSvelteComponentProps = $props();
  const checked = $derived(props.checked === true);
</script>

<label>
  <input
    type="checkbox"
    checked={checked}
    data-testid="fixture-checkbox"
    onchange={(event) => {
      const next = (event.currentTarget as HTMLInputElement).checked;
      io?.emit('checkedChange', next);
    }}
  />
  <span>{String(props.label ?? '')}</span>
</label>
<button
  type="button"
  data-testid="fixture-ghost"
  onclick={() => io?.emit('ghost', true)}
></button>
<button
  type="button"
  data-testid="fixture-wrong-payload"
  onclick={() => io?.emit('checkedChange', ['a', 'b'])}
></button>
