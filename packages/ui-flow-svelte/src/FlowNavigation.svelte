<script lang="ts">
  import { untrack, onDestroy, getContext } from 'svelte';
  import {FLOW_COORDINATE_UNITS,type FlowCoordinateUnits} from './flow-coordinate-frame.js';
  import { useSvelteFlow, useNodes, useViewportInitialized, useStore } from '@xyflow/svelte';
  let { request, ids = [], initialFit = false, initialNodeIds, onInitialFit }: { request?: object; ids?: string[]; initialFit?: boolean; initialNodeIds?: string[]; onInitialFit?: () => void } = $props();
  const { fitView } = useSvelteFlow();
  const coordinates=getContext<FlowCoordinateUnits|undefined>(FLOW_COORDINATE_UNITS);
  const nodes = useNodes(), viewport = useViewportInitialized();
  // Documented advanced public fields, read only and scoped to this provider.
  // fitView consumes these dimensions; it must not fit the preceding unit frame.
  const layout=coordinates?useStore():undefined;
  function layoutKey(){
    if(!coordinates)return 'ordinary';
    const width=layout?.width??0,height=layout?.height??0;
    const expectedWidth=coordinates.expectedWidth??0,expectedHeight=coordinates.expectedHeight??0;
    // clientWidth/clientHeight are integer CSS pixels. Allow their one-pixel
    // quantization, not a stale logical-sized wrapper before counter-scaling.
    if(!(width>0&&height>0&&expectedWidth>0&&expectedHeight>0)||Math.abs(width-expectedWidth)>1||Math.abs(height-expectedHeight)>1)return;
    return JSON.stringify([coordinates.scale,width,height,expectedWidth,expectedHeight]);
  }
  let initialSettled = false;
  let initialInFlight = $state(false);
  let failedReadiness: string | undefined;
  let viewportWasReady = false, readinessEpoch = 0;
  let alive = true;
  onDestroy(() => { alive = false; });
  function settleInitial() {
    if (initialSettled) return;
    initialSettled = true;
    onInitialFit?.();
  }
  async function fitInitial(readiness: string,layoutAtRequest:string) {
    try {
      const scale=coordinates?.scale??1;
      if (await fitView({minZoom:.15*scale,maxZoom:1.1*scale,padding:.2})) {
        // A queued public fit can complete after its containing frame changes.
        // Only the current initial layout may settle; otherwise retry once ready.
        if (alive&&layoutKey()===layoutAtRequest) settleInitial();
      } else failedReadiness = readiness;
    } catch {
      failedReadiness = readiness;
    } finally {
      if (alive) initialInFlight = false;
    }
  }
  $effect(() => {
    if (!initialFit || initialSettled) return;
    if (!viewport.current) { viewportWasReady = false; return; }
    if (!viewportWasReady) { readinessEpoch++; viewportWasReady = true; }
    const readyLayout=layoutKey();if(readyLayout===undefined)return;
    if (initialInFlight) return;
    const current = nodes.current;
    if (initialNodeIds && (current.length !== initialNodeIds.length || initialNodeIds.some(id=>!current.some(node=>node.id===id)))) return;
    // The upstream queued fit can resolve from the first node's internals update.
    // Wait for every card, including its controls, before fitting the initial graph.
    if (current.some(node => !node.measured?.width || !node.measured?.height)) return;
    if (!current.length) { untrack(settleInitial); return; }
    const readiness = JSON.stringify([readinessEpoch,readyLayout,current.map(node=>[node.id,node.measured?.width,node.measured?.height])]);
    // A failed fit is retried only after a genuine readiness/measurement change,
    // never on its own promise settlement or an unrelated source/position update.
    if (failedReadiness === readiness) return;
    initialInFlight = true;
    untrack(() => { void fitInitial(readiness,readyLayout); });
  });
  $effect(() => {
    if (!request) return;
    const targets = untrack(() => ids);
    // fitView reads and writes the Flow store. Only the explicit request is a
    // dependency; tracking store geometry here would continuously refit itself.
    untrack(() => { const scale=coordinates?.scale??1;void fitView({ nodes: targets.length ? targets.map(id => ({ id })) : undefined, minZoom: .35*scale, maxZoom: 1.1*scale, duration: 200, padding: .2 }).then(ok=>{
      if(alive&&ok&&initialFit)settleInitial();
    }).catch(()=>{ /* An explicit later navigation request can recover. */ }); });
  });
</script>
