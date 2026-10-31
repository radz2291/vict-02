<script lang="ts">
 import {untrack} from 'svelte';
 import {useSvelteFlow,useStore,useViewportInitialized} from '@xyflow/svelte';
 import type {FlowCoordinateState} from './flow-coordinate-frame.js';
 let {frame}:{frame:FlowCoordinateState}=$props();
 const {setViewport}=useSvelteFlow();
 // These two actions are documented public advanced APIs. Do not access the
 // private panZoom engine, context keys or any global store.
 const {setMinZoom,setMaxZoom}=useStore();
 const initialized=useViewportInitialized();
 $effect(()=>{
  if(!initialized.current)return;
  const scale=frame.scale,min=frame.minZoom,max=frame.maxZoom;
  untrack(()=>{
   setMinZoom(min*scale);setMaxZoom(max*scale);
   // This pin's viewport binding updates rendered/store state, but changing
   // units also needs the public setter to synchronize its native gesture frame.
   void setViewport({...frame.viewport});
  });
 });
</script>
