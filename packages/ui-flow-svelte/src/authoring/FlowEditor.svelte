<script lang="ts">
  import type { UiSvelteComponentProps } from '@victframework/ui-svelte';
  import { getContext } from 'svelte';
  import { GRAPH_EDITOR_HOST, GRAPH_EDITOR_HOST_V2,type GraphEditorHost,type GraphEditorHostV2,type GraphAuthoringDisposition } from '../editor/host.js';
  import {GRAPH_BODY,type GraphBodyContext} from '../composition/context.js';
  import type { GraphDocument } from '../editor/model.js';
  import GraphSurface from '../editor/GraphSurface.svelte';
  let { props, io, presentation, nodeId, occurrenceKey }: UiSvelteComponentProps =
    $props();
  const legacyHost = getContext<GraphEditorHost | undefined>(GRAPH_EDITOR_HOST);
  const occurrenceHost=getContext<GraphEditorHostV2|undefined>(GRAPH_EDITOR_HOST_V2);
  const host=occurrenceHost??legacyHost;
  const parentBody=getContext<GraphBodyContext|undefined>(GRAPH_BODY);
  const identity=$derived({nodeId,occurrenceKey,occurrenceRoute:parentBody?.occurrenceRoute??[]});
  const disposition=$derived.by(():GraphAuthoringDisposition|undefined=>{try{return occurrenceHost?.authoringFor(identity);}catch{return {kind:'refused',message:'Graph source ownership is unavailable; authoring is refused.'};}});
  const history = $derived(occurrenceHost?(disposition?.kind==='source'?disposition.history:undefined):legacyHost?.historyFor(identity));
  const viewState=$derived(host?.presentationFor?.({nodeId,occurrenceKey}));
  const validate = $derived(
    host?.validate
      ? (graph: GraphDocument) => host.validate!({ nodeId, occurrenceKey }, graph)
      : undefined,
  );
</script>
{#if disposition?.kind==='refused'}<p role="alert">{disposition.message}</p>{/if}
<GraphSurface {presentation} graph={String(props.graph??'')} label={String(props.label??'Node editor')} height={typeof props.height==='number'?props.height:600} readOnly={props.readOnly===true||disposition?.kind==='refused'} {history} {validate} {viewState} ongraphchange={value=>io?.emit('graphChange',value)} onselectionchange={value=>io?.emit('selectionChange',JSON.stringify(value))}/>
