<script lang="ts">
 import {portProbe} from './port-projection-independent-probe.js';
 let props=$props();
 $effect(()=>{portProbe.current=props;});
</script>
<div data-independent-engine-probe></div>
