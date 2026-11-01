<script lang="ts">
  import type {UiSvelteComponentProps} from '@victframework/ui-svelte';
  import GraphPortRow from './GraphPortRow.svelte';
  let {props,...rest}:UiSvelteComponentProps=$props();
</script>
<GraphPortRow props={{...props,showType:props.showType??false}} {...rest}/>
