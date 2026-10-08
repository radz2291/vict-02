<script lang="ts">
  import { Progress } from '../progress.js';
  import { numeric } from './b3-values.js';
  import type { UiSvelteComponentProps } from '../../document/extensions.js';
  let { props, io, presentation }: UiSvelteComponentProps = $props();
  const value = $derived(numeric(props.value, 0));
  const min = $derived(numeric(props.min, 0));
  const max = $derived(numeric(props.max, 100));
  const percent = $derived(max > min ? Math.min(100, Math.max(0, (value - min) / (max - min) * 100)) : 0);
  const indeterminate = $derived(props.indeterminate === true);
</script>
<div>
  <span class="vict-control-label">{String(props.label ?? '')}</span>
  <Progress.Root {...presentation?.target('root')} value={indeterminate ? null : value} {min} {max} aria-label={String(props.label ?? 'Progress')}>
    <div class="vict-metric-fill" style={`--vict-value:${percent}%`}></div>
    {@render io?.slots?.content?.()}
  </Progress.Root>
  {@render io?.slots?.help?.()}
</div>
