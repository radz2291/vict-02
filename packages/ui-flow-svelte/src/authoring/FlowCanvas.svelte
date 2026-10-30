<script lang="ts">
  import { setContext } from 'svelte';
  import { SvelteFlow, Background, Controls, MiniMap, type Node, type Edge } from '@xyflow/svelte';
  import type { UiSvelteComponentProps } from '@victframework/ui-svelte';
  import { FLOW_AUTHORING_CONTEXT, createFlowAuthoringContext, type FlowProjection } from './context.js';
  import FlowVisibleNode from './FlowVisibleNode.svelte';
  import FlowVisibleEdge from './FlowVisibleEdge.svelte';
  let { props, io, presentation }: UiSvelteComponentProps = $props();
  let projection = $state<FlowProjection>({ nodes: [], edges: [], diagnostics: [] });
  setContext(FLOW_AUTHORING_CONTEXT, createFlowAuthoringContext(value => { projection = value; }));
  const nodeTypes = { authored: FlowVisibleNode };
  const edgeTypes = { authored: FlowVisibleEdge };
  const nodes = $derived<Node[]>(projection.nodes.map(entry => ({ id: entry.id, type: 'authored', position: { x: entry.x!, y: entry.y! }, data: { declaration: entry }, draggable: false, connectable: false, deletable: false })));
  const edges = $derived<Edge[]>(projection.edges.map(entry => ({ id: entry.id, type: 'authored', source: entry.source!, target: entry.destination!, data: { declaration: entry }, deletable: false })));
  const height = $derived(typeof props.height === 'number' && Number.isFinite(props.height) ? Math.max(160, props.height) : 360);
</script>
<section {...presentation?.target('root')} aria-label={String(props.label ?? 'Flow diagram')}>
  <div class="vict-authored-flow-surface" style:height={`${height}px`}>
    <SvelteFlow {nodes} {edges} {nodeTypes} {edgeTypes} nodesDraggable={false} nodesConnectable={false}
      elementsSelectable={true} deleteKey={null} fitView>
      {#if props.background !== false}<Background />{/if}
      {#if props.controls !== false}<Controls showLock={false} />{/if}
      {#if props.minimap === true}<MiniMap pannable zoomable />{/if}
    </SvelteFlow>
  </div>
  {@render io?.slots?.nodes?.()}
  {@render io?.slots?.edges?.()}
  {#each projection.diagnostics as diagnostic}
    <p role="alert" data-ui-flow-diagnostic={diagnostic.code} data-ui-flow-source={diagnostic.nodeId}>{diagnostic.message} Source: {diagnostic.nodeId} ({diagnostic.occurrenceKey}).</p>
  {/each}
</section>
<style>.vict-authored-flow-surface { width: 100%; min-width: 0; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; }</style>
