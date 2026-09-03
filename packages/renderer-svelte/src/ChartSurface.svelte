<script lang="ts">
  /**
   * The `chart` role: a renderer-owned SVG bar/line chart (OPEN-013
   * decision — no external chart library, no telemetry, no CDN, full
   * offline determinism) with an ACCESSIBLE textual summary and a data
   * table alternative.
   */
  import type { PlanSurface } from './logic.js';

  interface Props {
    surface: PlanSurface;
    rows: readonly Record<string, unknown>[];
  }

  let { surface, rows }: Props = $props();

  const xField = $derived(str(surface.xField));
  const yField = $derived(str(surface.yField));
  const kind = $derived(str(surface.kind) === 'line' ? 'line' : 'bar');

  function str(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  /** Aggregate rows: sum the numeric y per x value (deterministic order: first appearance). */
  const series = $derived.by(() => {
    const buckets = new Map<string, number>();
    for (const row of rows) {
      const x = String(row[xField] ?? '');
      const rawY = row[yField];
      const y = typeof rawY === 'number' && Number.isFinite(rawY) ? rawY : Number(rawY ?? 0) || 0;
      buckets.set(x, (buckets.get(x) ?? 0) + y);
    }
    return [...buckets.entries()].map(([label, value]) => ({ label, value }));
  });

  const maxValue = $derived(Math.max(1, ...series.map((point) => point.value)));

  // Chart geometry (responsive via viewBox; deterministic layout).
  const WIDTH = 640;
  const HEIGHT = 280;
  const PAD = { top: 16, right: 16, bottom: 40, left: 48 };
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const bars = $derived(
    series.map((point, index) => {
      const count = Math.max(1, series.length);
      const band = plotW / count;
      const barWidth = band * 0.6;
      const x = PAD.left + index * band + (band - barWidth) / 2;
      const h = (point.value / maxValue) * plotH;
      return { ...point, x, y: PAD.top + plotH - h, w: barWidth, h };
    }),
  );

  const linePath = $derived.by(() => {
    if (series.length === 0) {
      return '';
    }
    const step = plotW / Math.max(1, series.length - 1 || 1);
    const points = series.map((point, index) => {
      const x = PAD.left + (series.length === 1 ? plotW / 2 : index * step);
      const y = PAD.top + plotH - (point.value / maxValue) * plotH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M${points.join(' L')}`;
  });

  const gridLines = $derived([0, 0.25, 0.5, 0.75, 1].map((fraction) => ({
    y: PAD.top + plotH - fraction * plotH,
    label: Math.round(fraction * maxValue),
  })));
</script>

<figure class="vict-figure" data-surface={surface.id} role="img" aria-label={str(surface.summary)}>
  {#if typeof surface.title === 'string'}
    <figcaption>{surface.title}</figcaption>
  {/if}
  <svg
    class="vict-chart"
    viewBox="0 0 {WIDTH} {HEIGHT}"
    aria-hidden="true"
    data-testid="chart-svg"
  >
    {#each gridLines as line (line.y)}
      <line class="vict-chart-gridline" x1={PAD.left} x2={WIDTH - PAD.right} y1={line.y} y2={line.y} />
      <text x={PAD.left - 6} y={line.y + 4} text-anchor="end">{line.label}</text>
    {/each}
    {#if kind === 'bar'}
      {#each bars as bar (bar.label)}
        <rect class="vict-bar" x={bar.x} y={bar.y} width={bar.w} height={Math.max(bar.h, 1)} rx="2">
          <title>{bar.label}: {bar.value}</title>
        </rect>
        <text x={bar.x + bar.w / 2} y={HEIGHT - PAD.bottom + 16} text-anchor="middle">
          {bar.label}
        </text>
      {/each}
    {:else}
      <path d={linePath} fill="none" stroke="var(--vict-color-accent)" stroke-width="2.5" />
      {#each series as point, index (point.label)}
        {@const step = plotW / Math.max(1, series.length - 1 || 1)}
        <circle
          cx={PAD.left + (series.length === 1 ? plotW / 2 : index * step)}
          cy={PAD.top + plotH - (point.value / maxValue) * plotH}
          r="4"
          fill="var(--vict-color-accent)"
        >
          <title>{point.label}: {point.value}</title>
        </circle>
        <text
          x={PAD.left + (series.length === 1 ? plotW / 2 : index * step)}
          y={HEIGHT - PAD.bottom + 16}
          text-anchor="middle"
        >
          {point.label}
        </text>
      {/each}
    {/if}
  </svg>
  <details class="vict-chart-table">
    <summary>Data table</summary>
    <table class="vict-table">
      <thead>
        <tr>
          <th scope="col">{xField}</th>
          <th scope="col">{yField}</th>
        </tr>
      </thead>
      <tbody>
        {#each series as point (point.label)}
          <tr>
            <td>{point.label}</td>
            <td>{point.value}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </details>
</figure>

<style>
  .vict-figure {
    margin: 0;
    background: var(--vict-color-surface);
    border: 1px solid var(--vict-color-border);
    border-radius: var(--vict-radius-base);
    padding: calc(var(--vict-spacing-unit) * 3);
  }

  figcaption {
    font-weight: 600;
    margin-bottom: calc(var(--vict-spacing-unit) * 2);
  }

  .vict-chart-table {
    margin-top: calc(var(--vict-spacing-unit) * 2);
  }
</style>
