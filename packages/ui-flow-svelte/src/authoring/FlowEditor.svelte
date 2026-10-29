<script lang="ts">
  import type { UiSvelteComponentProps } from '@victframework/ui-svelte';
  import { getContext } from 'svelte';
  import { GRAPH_EDITOR_HOST, type GraphEditorHost } from '../editor/host.js';
  import type { GraphDocument } from '../editor/model.js';
  import GraphSurface from '../editor/GraphSurface.svelte';
  let { props, io, presentation, nodeId, occurrenceKey }: UiSvelteComponentProps =
    $props();
  const host = getContext<GraphEditorHost | undefined>(GRAPH_EDITOR_HOST);
  const history = $derived(host?.historyFor({ nodeId, occurrenceKey }));
  const viewState=$derived(host?.presentationFor?.({nodeId,occurrenceKey}));
  const validate = $derived(
    host?.validate
      ? (graph: GraphDocument) => host.validate!({ nodeId, occurrenceKey }, graph)
      : undefined,
  );
</script>
<GraphSurface {presentation} graph={String(props.graph??'')} label={String(props.label??'Node editor')} height={typeof props.height==='number'?props.height:600} readOnly={props.readOnly===true} {history} {validate} {viewState} ongraphchange={value=>io?.emit('graphChange',value)} onselectionchange={value=>io?.emit('selectionChange',JSON.stringify(value))}/>
