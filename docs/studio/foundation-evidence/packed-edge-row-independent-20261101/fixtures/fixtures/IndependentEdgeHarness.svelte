<script lang="ts">
  import { setContext } from 'svelte';
  import { GraphWorkspaceV3, GraphEdgeSettings, GRAPH_EDITOR_HOST_V2, type GraphWorkspaceContext, type GraphEditorHostV2 } from '@victframework/ui-flow-svelte';
  import type { UiScopedSlotFrame } from '@victframework/ui-svelte';
  import Context from './IndependentEdgeContext.svelte';
  import Controls from './IndependentEdgeControls.svelte';
  let { initial, emit, expose, frame, host }: { initial: string; emit: (name: string, value: unknown) => void; expose: (context: GraphWorkspaceContext) => void; frame: (target: string, value: UiScopedSlotFrame) => void; host?: GraphEditorHostV2 } = $props();
  let source = $state(initial);
  if (host) setContext(GRAPH_EDITOR_HOST_V2, host);
  export function replace(value: string) { source = value; }
</script>
{#snippet canvas(value: UiScopedSlotFrame)}<Controls frame={value} target="canvas" expose={frame}/>{/snippet}
{#snippet selection(value: UiScopedSlotFrame)}<Controls frame={value} target="selection" expose={frame}/>{/snippet}
{#snippet content(_value: UiScopedSlotFrame)}
  <Context {expose}/>
  <GraphEdgeSettings props={{target:'canvas'}} io={{emit, scopedSlots:{content:canvas}}}/>
  <GraphEdgeSettings props={{target:'selection'}} io={{emit, scopedSlots:{content:selection}}}/>
{/snippet}
<GraphWorkspaceV3 props={{graph:source}} io={{emit,scopedSlots:{content}}} nodeId="independent-workspace" occurrenceKey="independent-occurrence"/>
