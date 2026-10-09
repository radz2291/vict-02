<script lang="ts">
  /** Round-3a probe fixture: direct CatalogDateRangeField mount with a host
   * state channel exposed for controlled-synchronization assertions (the
   * Svelte 5 mount API has no $set; exports are the supported channel). */
  import CatalogDateRangeField from '../src/catalog/components/CatalogDateRangeField.svelte';
  import type { UiSvelteComponentIO } from '../src/document/extensions.js';

  let {
    emits,
    initial = { start: '2026-10-12', end: '2026-10-16' },
  }: {
    emits: { name: string; value: unknown }[];
    initial?: { start: string; end: string };
  } = $props();

  const io = {
    emit: (name: string, value: unknown) => {
      emits.push({ name, value });
    },
  } as unknown as UiSvelteComponentIO;

  let start = $state(initial.start);
  let end = $state(initial.end);

  export function setRange(next: { start: string; end: string }): void {
    start = next.start;
    end = next.end;
  }
</script>

<CatalogDateRangeField props={{ start, end, locale: 'en-GB' }} {io} presentation={undefined} />
