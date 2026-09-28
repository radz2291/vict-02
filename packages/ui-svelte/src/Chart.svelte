<script lang="ts">
  import type { UiChartPoint } from '@victframework/ui';
  interface Props {
    surfaceId?: string;
    title?: string;
    summary: string;
    kind: 'bar' | 'line';
    xLabel: string;
    yLabel: string;
    points: readonly UiChartPoint[];
  }
  let { surfaceId, title, summary, kind, xLabel, yLabel, points }: Props = $props();

  // Small, deterministic geometry for the current bar/line display contract.
  const WIDTH = 640;
  const HEIGHT = 280;
  const PAD = { top: 16, right: 16, bottom: 40, left: 48 };
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const maxValue = $derived(Math.max(1, ...points.map((point) => point.value)));
  const bars = $derived(points.map((point, index) => {
    const band = plotW / Math.max(1, points.length);
    const w = band * 0.6;
    const x = PAD.left + index * band + (band - w) / 2;
    const h = Math.max(0, point.value / maxValue) * plotH;
    return { ...point, x, y: PAD.top + plotH - h, w, h };
  }));
  const linePath = $derived(points.length === 0 ? '' : `M${points.map((point, index) => {
    const x = PAD.left + (points.length === 1 ? plotW / 2 : index * plotW / (points.length - 1));
    const y = PAD.top + plotH - Math.max(0, point.value / maxValue) * plotH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' L')}`);
  // Edge category labels would clip outside the viewBox with a centered
  // anchor (the first/last line points sit on the plot edges), so they
  // anchor inward instead. Pure label placement — geometry unchanged.
  function labelAnchor(index: number): 'start' | 'middle' | 'end' {
    if (points.length === 1) return 'middle';
    if (index === 0) return 'start';
    if (index === points.length - 1) return 'end';
    return 'middle';
  }
  const gridLines = $derived([0, 0.25, 0.5, 0.75, 1].map((fraction) => ({
    y: PAD.top + plotH - fraction * plotH,
    label: Math.round(fraction * maxValue),
  })));
</script>

<figure class="vict-figure" data-surface={surfaceId} aria-label={summary}>
  {#if title !== undefined}<figcaption>{title}</figcaption>{/if}
  <!-- The SVG is exposed AS a named image (role=img + the declared summary);
       the interactive "Data table" disclosure must stay OUTSIDE any img
       role, so it lives on the figure (a group), not inside a role=img.
       Glyph text inside the svg is presentational under role=img. -->
  <svg class="vict-chart" viewBox="0 0 {WIDTH} {HEIGHT}" role="img" aria-label={summary} data-testid="chart-svg">
    {#each gridLines as line (line.y)}
      <line class="vict-chart-gridline" x1={PAD.left} x2={WIDTH - PAD.right} y1={line.y} y2={line.y} />
      <text x={PAD.left - 6} y={line.y + 4} text-anchor="end">{line.label}</text>
    {/each}
    {#if kind === 'bar'}
      {#each bars as bar (bar.label)}
        <rect class="vict-bar" x={bar.x} y={bar.y} width={bar.w} height={Math.max(bar.h, 1)} rx="2">
          <title>{bar.label}: {bar.value}</title>
        </rect>
        <text x={bar.x + bar.w / 2} y={HEIGHT - PAD.bottom + 16} text-anchor="middle">{bar.label}</text>
      {/each}
    {:else}
      <path d={linePath} fill="none" stroke="var(--vict-color-accent, #3b5bdb)" stroke-width="2.5" />
      {#each points as point, index (point.label)}
        {@const x = PAD.left + (points.length === 1 ? plotW / 2 : index * plotW / (points.length - 1))}
        <circle cx={x} cy={PAD.top + plotH - Math.max(0, point.value / maxValue) * plotH} r="4" fill="var(--vict-color-accent, #3b5bdb)">
          <title>{point.label}: {point.value}</title>
        </circle>
        <text x={x} y={HEIGHT - PAD.bottom + 16} text-anchor={labelAnchor(index)}>{point.label}</text>
      {/each}
    {/if}
  </svg>
  <details class="vict-chart-table">
    <summary>Data table</summary>
    <table class="vict-data-table">
      <thead><tr><th scope="col">{xLabel}</th><th scope="col">{yLabel}</th></tr></thead>
      <tbody>{#each points as point (point.label)}<tr><td>{point.label}</td><td>{point.value}</td></tr>{/each}</tbody>
    </table>
  </details>
</figure>
