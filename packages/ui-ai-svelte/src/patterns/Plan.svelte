<script lang="ts">
  import Route from '@lucide/svelte/icons/route';
  import Circle from '@lucide/svelte/icons/circle';
  import CircleCheck from '@lucide/svelte/icons/circle-check';
  import CircleDot from '@lucide/svelte/icons/circle-dot';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import * as Trace from '../upstream/ui/trace/index.js';
  import type { Step } from './types.js';

  let { title, steps, description, open = true }: {
    title: string; steps: readonly Step[]; description?: string; open?: boolean;
  } = $props();
  let readerOpen = $state<boolean>();
  const status = $derived(steps.some(step => step.status === 'error') ? 'error'
    : steps.some(step => step.status === 'running') ? 'running' : undefined);
</script>

<Trace.Root>
  <Trace.Collapsible open={readerOpen ?? open} onOpenChange={value => readerOpen = value}>
    <Trace.CollapsibleTrigger>
      <Trace.Line {status}>
        <Trace.Icon><Route /></Trace.Icon>
        <Trace.Title>{title}</Trace.Title>
        <Trace.Description>{steps.filter(step => step.status === 'done').length} of {steps.length} done</Trace.Description>
      </Trace.Line>
    </Trace.CollapsibleTrigger>
    <Trace.CollapsibleContent class="flex flex-col gap-3">
      {#if description}<p class="whitespace-pre-wrap">{description}</p>{/if}
      <Trace.Root>
        {#each steps as step (step.id)}
          {#snippet line()}
            <Trace.Line status={step.status === 'done' ? undefined : step.status}>
              <Trace.Icon>
                {#if step.status === 'done'}<CircleCheck />
                {:else if step.status === 'running'}<CircleDot />
                {:else if step.status === 'error'}<CircleAlert />
                {:else}<Circle />{/if}
              </Trace.Icon>
              <Trace.Title>{step.title}</Trace.Title>
            </Trace.Line>
          {/snippet}
          {#if step.detail}
            <Trace.Collapsible><Trace.CollapsibleTrigger>{@render line()}</Trace.CollapsibleTrigger><Trace.CollapsibleContent class="whitespace-pre-wrap">{step.detail}</Trace.CollapsibleContent></Trace.Collapsible>
          {:else}{@render line()}{/if}
        {/each}
      </Trace.Root>
    </Trace.CollapsibleContent>
  </Trace.Collapsible>
</Trace.Root>
