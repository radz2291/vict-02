<script lang="ts">
  import { untrack, onDestroy } from 'svelte';
  import { useSvelteFlow, useNodes, useViewportInitialized } from '@xyflow/svelte';
  let { request, ids = [], initialFit = false, initialNodeIds, onInitialFit }: { request?: object; ids?: string[]; initialFit?: boolean; initialNodeIds?: string[]; onInitialFit?: () => void } = $props();
  const { fitView } = useSvelteFlow();
  const nodes = useNodes(), viewport = useViewportInitialized();
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
  async function fitInitial(readiness: string) {
    try {
      if (await fitView({minZoom:.15,maxZoom:1.1,padding:.2})) {
        if (alive) settleInitial();
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
    if (initialInFlight) return;
    const current = nodes.current;
    if (initialNodeIds && (current.length !== initialNodeIds.length || initialNodeIds.some(id=>!current.some(node=>node.id===id)))) return;
    // The upstream queued fit can resolve from the first node's internals update.
    // Wait for every card, including its controls, before fitting the initial graph.
    if (current.some(node => !node.measured?.width || !node.measured?.height)) return;
    if (!current.length) { untrack(settleInitial); return; }
    const readiness = JSON.stringify([readinessEpoch,current.map(node=>[node.id,node.measured?.width,node.measured?.height])]);
    // A failed fit is retried only after a genuine readiness/measurement change,
    // never on its own promise settlement or an unrelated source/position update.
    if (failedReadiness === readiness) return;
    initialInFlight = true;
    untrack(() => { void fitInitial(readiness); });
  });
  $effect(() => {
    if (!request) return;
    const targets = untrack(() => ids);
    // fitView reads and writes the Flow store. Only the explicit request is a
    // dependency; tracking store geometry here would continuously refit itself.
    untrack(() => { void fitView({ nodes: targets.length ? targets.map(id => ({ id })) : undefined, minZoom: .35, maxZoom: 1.1, duration: 200, padding: .2 }).then(ok=>{
      if(alive&&ok&&initialFit)settleInitial();
    }).catch(()=>{ /* An explicit later navigation request can recover. */ }); });
  });
</script>
