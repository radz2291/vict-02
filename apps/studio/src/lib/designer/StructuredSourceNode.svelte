<script lang="ts">
  import type {ComponentProps} from 'svelte';
  import {StructureSourceNode} from '@victframework/ui-structure-svelte';
  let props:ComponentProps<typeof StructureSourceNode>=$props();
</script>
<StructureSourceNode {...props}/>
