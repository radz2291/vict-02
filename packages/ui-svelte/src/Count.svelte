<script lang="ts">
  /**
   * The `count` role: a live, definition-driven aggregate of a declared
   * view. The renderer presents the view datum's `total`; the number is
   * never computed in the UI — the host's view loader supplies it through
   * the same declared-view read path as tables and charts.
   */
  interface Props {
    surfaceId: string;
    label?: string;
    value: number;
  }
  let { surfaceId, label = 'Records', value }: Props = $props();
</script>

<p class="vict-count" data-surface={surfaceId} data-testid="count-value">
  <span class="vict-count__label">{label}</span>
  <span class="vict-count__value" aria-live="polite">{value}</span>
</p>
