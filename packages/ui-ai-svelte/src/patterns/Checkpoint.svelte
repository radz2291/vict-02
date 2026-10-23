<script lang="ts">
  import * as Marker from '../upstream/ui/marker/index.js';
  import {Button} from '../upstream/ui/button/index.js';
  import { FlagIcon as Flag } from "@lucide/svelte";
  let {label, onRestore}:{label:string;onRestore?:()=>void}=$props();
</script>
<Marker.Root><Marker.Icon><Flag/></Marker.Icon><Marker.Content>{label}</Marker.Content><Button variant="outline" size="sm" disabled={!onRestore} onclick={onRestore}>Restore checkpoint</Button></Marker.Root>
