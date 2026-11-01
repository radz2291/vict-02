<script lang="ts">
  import type {ComponentProps} from 'svelte';
  import {StructureExplorer} from '@victframework/ui-structure-svelte';
  import {studioStructurePresentation} from './structure.js';
  let props:ComponentProps<typeof StructureExplorer>=$props();
</script>
<StructureExplorer {...props} context={{...props.context,presentation:{...studioStructurePresentation,...props.context?.presentation}}}/>
