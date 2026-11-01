<script lang="ts">
  import type {ComponentProps} from 'svelte';
  import {StructureRelationEdge} from '@victframework/ui-structure-svelte';
  let props:ComponentProps<typeof StructureRelationEdge>=$props();
</script>
<StructureRelationEdge {...props}/>
