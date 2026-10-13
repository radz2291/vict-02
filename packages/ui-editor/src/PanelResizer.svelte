<script lang="ts">
  let { label, value, min = 180, max = 420, reverse = false, onChange }: {
    label: string; value: number; min?: number; max?: number; reverse?: boolean; onChange: (value: number) => void;
  } = $props();
  let dragging = $state(false);
  let startX = 0, startValue = 0;
  const set = (next: number) => onChange(Math.round(Math.max(min, Math.min(max, next))));
  function keyboard(event: KeyboardEvent) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') set(min);
    else if (event.key === 'End') set(max);
    else set(value + (event.key === 'ArrowRight' ? 16 : -16) * (reverse ? -1 : 1));
  }
</script>
<!-- ARIA window splitter: focusable separator with a value and arrow keys. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_no_noninteractive_tabindex -->
<div class="resizer" class:dragging role="separator" aria-orientation="vertical" aria-label={label}
  aria-valuenow={value} aria-valuemin={min} aria-valuemax={max} tabindex="0" onkeydown={keyboard}
  onpointerdown={event => { event.preventDefault(); event.currentTarget.focus(); startX = event.clientX; startValue = value; dragging = true; event.currentTarget.setPointerCapture(event.pointerId); }}
  onpointermove={event => { if (dragging) set(startValue + (event.clientX - startX) * (reverse ? -1 : 1)); }}
  onpointerup={event => { dragging = false; event.currentTarget.releasePointerCapture(event.pointerId); }} onlostpointercapture={() => dragging = false}>
  <span></span>
</div>
<style>
  .resizer {cursor:col-resize;display:flex;justify-content:center;align-items:center;touch-action:none;background:#f4f6f9;outline-offset:-2px;}
  span {width:2px;height:28px;border-radius:4px;background:#cbd4e4;}
  .resizer:hover,.resizer.dragging {background:#e5ebfb;} .resizer:focus-visible{outline:2px solid #5269bd;}
</style>
