<script lang="ts">
  import { getContext } from 'svelte';
  import type { UiSvelteComponentProps } from '@victframework/ui-svelte';
  import { FLOW_AUTHORING_CONTEXT, type FlowAuthoringContext } from './context.js';
  let { props, nodeId, occurrenceKey, presentation }: UiSvelteComponentProps = $props();
  const context = getContext<FlowAuthoringContext | undefined>(FLOW_AUTHORING_CONTEXT);
  $effect(() => context?.register({ kind: 'node', id: String(props.id ?? ''), label: String(props.label ?? ''),
    x: typeof props.x === 'number' ? props.x : NaN, y: typeof props.y === 'number' ? props.y : NaN,
    nodeId, occurrenceKey, target: presentation?.target('root') ?? { class: '' } }));
</script>
{#if !context}<p {...presentation?.target('root')} role="alert" data-ui-flow-diagnostic="UI_FLOW_CONTEXT_REQUIRED">Flow node unavailable: place this declaration in a Flow canvas nodes slot. Source: {nodeId} ({occurrenceKey}).</p>{/if}
