<script lang="ts">
  import { flowGestureClasses, guardFlowGestures } from '../flow-gesture-boundary.js';
  const gestureId = $props.id();
  const gestureClasses = flowGestureClasses(gestureId);
  import { setContext } from 'svelte';
  import {createHandleProjection} from '../handle-projection.js';
  const handles=createHandleProjection(gestureId);
  import { SvelteFlow, SvelteFlowProvider, Background, Controls, MiniMap, type Node, type Edge } from '@xyflow/svelte';
  import type { UiSvelteComponentProps } from '@victframework/ui-svelte';
  import { FLOW_AUTHORING_CONTEXT, createFlowAuthoringContext, type FlowProjection } from './context.js';
  import FlowVisibleNode from './FlowVisibleNode.svelte';
  import FlowCoordinateFrame from '../FlowCoordinateFrame.svelte';
  import FlowCoordinateSync from '../FlowCoordinateSync.svelte';
  import FlowNavigation from '../FlowNavigation.svelte';
  import FlowVisibleEdge from './FlowVisibleEdge.svelte';
  let { props, io, presentation }: UiSvelteComponentProps = $props();
  let projection = $state<FlowProjection>({ nodes: [], edges: [], diagnostics: [] });
  setContext(FLOW_AUTHORING_CONTEXT, createFlowAuthoringContext(value => { projection = value; }));
  const nodeTypes = { authored: FlowVisibleNode };
  const edgeTypes = { authored: FlowVisibleEdge };
  const nodes = $derived<Node[]>(projection.nodes.map(entry => ({ id: entry.id, type: 'authored', position: { x: entry.x!, y: entry.y! }, data: { declaration: entry,projectHandle:handles.id }, draggable: false, connectable: false, deletable: false })));
  const edges = $derived<Edge[]>(projection.edges.map(entry => ({ id: entry.id, type: 'authored', source: entry.source!, target: entry.destination!,sourceHandle:handles.id(entry.source!,'output'),targetHandle:handles.id(entry.destination!,'input'), data: { declaration: entry }, deletable: false })));
  const height = $derived(typeof props.height === 'number' && Number.isFinite(props.height) ? Math.max(160, props.height) : 360);
</script>
<section use:guardFlowGestures={gestureClasses} {...presentation?.target('root')} aria-label={String(props.label ?? 'Flow diagram')}>
  <div class="vict-authored-flow-surface" style:height={`${height}px`}>
    <FlowCoordinateFrame>{#snippet children(frame)}
    <SvelteFlowProvider><SvelteFlow bind:viewport={frame.viewport} minZoom={0.5*frame.scale} maxZoom={2*frame.scale} {...gestureClasses} {nodes} {edges} {nodeTypes} {edgeTypes} nodesDraggable={false} nodesConnectable={false}
      elementsSelectable={true} deleteKey={null} fitView={false}>
      <FlowCoordinateSync {frame}/><FlowNavigation initialFit={nodes.length>0} initialNodeIds={nodes.map(node=>node.id)} initialFitOptions={{minZoom:.5,maxZoom:2,padding:.1}}/>{#if props.background !== false}<Background />{/if}
      {#if props.controls !== false}<Controls showLock={false} />{/if}
      {#if props.minimap === true}<MiniMap pannable zoomable />{/if}
    </SvelteFlow></SvelteFlowProvider>
    {/snippet}</FlowCoordinateFrame>
  </div>
  {@render io?.slots?.nodes?.()}
  {@render io?.slots?.edges?.()}
  {#each projection.diagnostics as diagnostic}
    <p role="alert" data-ui-flow-diagnostic={diagnostic.code} data-ui-flow-source={diagnostic.nodeId}>{diagnostic.message} Source: {diagnostic.nodeId} ({diagnostic.occurrenceKey}).</p>
  {/each}
</section>
<style>.vict-authored-flow-surface { width: 100%; min-width: 0; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; }</style>
