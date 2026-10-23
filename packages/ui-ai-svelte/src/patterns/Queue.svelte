<script lang="ts">
  import TraceSteps from './TraceSteps.svelte';
  import type {Step} from './types.js';
  let {steps}:{steps:readonly Step[]}=$props();
</script>
<TraceSteps title="To do" steps={steps.filter(s=>s.status!=='done')}/>
<TraceSteps title="Completed" steps={steps.filter(s=>s.status==='done')} open={false}/>
