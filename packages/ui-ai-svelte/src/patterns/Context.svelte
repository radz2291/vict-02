<script lang="ts">
  import * as HoverCard from '../upstream/ui/hover-card/index.js';
  import {Progress} from '../upstream/ui/progress/index.js';
  import {Button} from '../upstream/ui/button/index.js';
  let {used, limit}:{used:number;limit:number}=$props();
  const percent=$derived(limit>0?Math.min(100,Math.max(0,Math.round(used/limit*100))):0);
</script>
<HoverCard.Root openDelay={10} closeDelay={100}><HoverCard.Trigger>{#snippet child({props})}<Button {...props} variant="outline" size="sm">{percent}% context</Button>{/snippet}</HoverCard.Trigger><HoverCard.Content class="flex w-64 flex-col gap-3"><p>{used} / {limit} tokens</p><Progress value={percent} aria-label="Context used"/></HoverCard.Content></HoverCard.Root>
