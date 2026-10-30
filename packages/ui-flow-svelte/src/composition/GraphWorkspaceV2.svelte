<script lang="ts">
  import type {UiSvelteComponentProps} from '@victframework/ui-svelte';
  import GraphWorkspace from './GraphWorkspace.svelte';
  let supplied:UiSvelteComponentProps=$props();
</script>
<GraphWorkspace {...supplied} modelVersion={2}/>
