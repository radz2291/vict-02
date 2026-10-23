<script lang="ts">
  import Tool from './Tool.svelte';
  let {command, output, status}:{command:string;output:string;status?:'running'|'pending'|'error'}=$props();
</script>
<Tool title={command} input={command} {output} {status} open/>
