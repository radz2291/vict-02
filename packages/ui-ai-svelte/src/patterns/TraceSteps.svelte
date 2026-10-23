<script lang="ts">
  import * as Trace from '../upstream/ui/trace/index.js';
  import { CircleIcon as Circle } from "@lucide/svelte";
  import { CircleCheckIcon as CircleCheck } from "@lucide/svelte";
  import { CircleDotIcon as CircleDot } from "@lucide/svelte";
  import type { Step } from './types.js';
  let {title, description, steps, open = true}: {title:string;description?:string;steps:readonly Step[];open?:boolean} = $props();
</script>
<Trace.Root>
  <Trace.Collapsible {open}>
    <Trace.CollapsibleTrigger><Trace.Line><Trace.Icon><CircleDot /></Trace.Icon><Trace.Title>{title}</Trace.Title><Trace.Description>{steps.filter(s=>s.status==='done').length} of {steps.length} done</Trace.Description></Trace.Line></Trace.CollapsibleTrigger>
    <Trace.CollapsibleContent>
      {#if description}<p>{description}</p>{/if}
      <Trace.Root>
        {#each steps as step (step.id)}
          {#if step.detail}
            <Trace.Collapsible>
              <Trace.CollapsibleTrigger><Trace.Line status={step.status==='done'?undefined:step.status}><Trace.Icon>{#if step.status==='done'}<CircleCheck />{:else if step.status==='running'}<CircleDot />{:else}<Circle />{/if}</Trace.Icon><Trace.Title>{step.title}</Trace.Title></Trace.Line></Trace.CollapsibleTrigger>
              <Trace.CollapsibleContent>{step.detail}</Trace.CollapsibleContent>
            </Trace.Collapsible>
          {:else}
            <Trace.Line status={step.status==='done'?undefined:step.status}><Trace.Icon>{#if step.status==='done'}<CircleCheck />{:else if step.status==='running'}<CircleDot />{:else}<Circle />{/if}</Trace.Icon><Trace.Title>{step.title}</Trace.Title></Trace.Line>
          {/if}
        {/each}
      </Trace.Root>
    </Trace.CollapsibleContent>
  </Trace.Collapsible>
</Trace.Root>
