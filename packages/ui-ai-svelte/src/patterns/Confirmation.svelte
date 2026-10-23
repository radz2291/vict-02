<script lang="ts">
  import * as Item from '../upstream/ui/item/index.js';
  import {Button} from '../upstream/ui/button/index.js';
  import { ShieldIcon as Shield } from "@lucide/svelte";
  let {title, description, onDecision, pending=false}:{title:string;description:string;onDecision?:(approved:boolean)=>void;pending?:boolean}=$props();
</script>
<Item.Root variant="outline" size="sm"><Item.Media variant="icon"><Shield/></Item.Media><Item.Content><Item.Title>{title}</Item.Title><Item.Description>{description}</Item.Description></Item.Content><Item.Actions><Button size="sm" variant="outline" disabled={!onDecision||pending} onclick={()=>onDecision?.(false)}>Deny</Button><Button size="sm" disabled={!onDecision||pending} onclick={()=>onDecision?.(true)}>Approve</Button></Item.Actions></Item.Root>
