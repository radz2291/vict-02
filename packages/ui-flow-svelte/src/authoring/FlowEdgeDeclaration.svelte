<script lang="ts">
  import { getContext } from 'svelte';
  import type { UiSvelteComponentProps } from '@victframework/ui-svelte';
  import { FLOW_AUTHORING_CONTEXT, type FlowAuthoringContext } from './context.js';
  let { props, nodeId, occurrenceKey, presentation }: UiSvelteComponentProps = $props();
  const context = getContext<FlowAuthoringContext | undefined>(FLOW_AUTHORING_CONTEXT);
  $effect(() => context?.register({ kind: 'edge', id: String(props.id ?? ''), label: String(props.label ?? ''),
    source: String(props.source ?? ''), destination: String(props.target ?? ''),
    nodeId, occurrenceKey, target: presentation?.target('root') ?? { class: '' } }));
</script>
{#if !context}<p {...presentation?.target('root')} role="alert" data-ui-flow-diagnostic="UI_FLOW_CONTEXT_REQUIRED">Flow edge unavailable: place this declaration in a Flow canvas edges slot. Source: {nodeId} ({occurrenceKey}).</p>{/if}
