<script lang="ts">
  import Tool from './Tool.svelte';
  let {title='Tool failed', frames}:{title?:string;frames:string}=$props();
</script>
<Tool {title} output={frames} status="error" open/>
