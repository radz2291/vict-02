<script lang="ts">
  import {Button} from '../upstream/ui/button/index.js';
  let {text,onSelect}:{text:string;onSelect?:(text:string)=>void}=$props();
</script>
<Button variant="outline" size="sm" disabled={!onSelect} onclick={()=>onSelect?.(text)}>{text}</Button>
