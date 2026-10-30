<script lang="ts">
  import { Button, type UiSvelteComponentProps } from '@victframework/ui-svelte';
  let { props, io, presentation }: UiSvelteComponentProps = $props();
</script>
<span class="nodrag nopan nowheel" data-project-control="approval">
  <Button label={String(props.label ?? 'Approve item')} disabled={props.disabled === true}
    presentation={presentation?.target('root')}
    onclick={() => io?.emit('approve', String(props.value ?? ''))}/>
</span>
