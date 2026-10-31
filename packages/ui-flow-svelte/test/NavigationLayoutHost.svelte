<script lang="ts">
 import {setContext} from 'svelte';
 import FlowNavigation from '../src/FlowNavigation.svelte';
 import {FLOW_COORDINATE_UNITS} from '../src/flow-coordinate-frame.js';
 import {navigationFrame} from './navigation-layout-state.svelte.js';
 let {settled}:{settled:()=>void}=$props();
 setContext(FLOW_COORDINATE_UNITS,navigationFrame);
</script>
<FlowNavigation initialFit initialNodeIds={['crop','grade','caption']} onInitialFit={settled}/>
<input aria-label="fit-draft" value="Unsaved layout draft"/>
