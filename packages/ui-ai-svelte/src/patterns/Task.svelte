<script lang="ts">
  import CircleCheck from '@lucide/svelte/icons/circle-check';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import * as Trace from '../upstream/ui/trace/index.js';
  import type { Step } from './types.js';

  let { title, steps, description, open }: {
    title: string; steps: readonly Step[]; description?: string; open?: boolean;
  } = $props();
  let readerOpen = $state<boolean>();
  // A Task reports observed activity. Future work belongs to Plan or Queue.
  const observed = $derived(steps.filter(step => step.status !== 'pending'));
  const status = $derived(observed.some(step => step.status === 'error') ? 'error'
    : observed.some(step => step.status === 'running') ? 'running' : undefined);
</script>

<Trace.Root>
  <Trace.Collapsible open={readerOpen ?? open ?? status === 'running'} onOpenChange={value => readerOpen = value}>
    <Trace.CollapsibleTrigger>
      <Trace.Line {status}>
        <Trace.Icon>
          {#if status === 'running'}<LoaderCircle class="animate-spin" />
          {:else if status === 'error'}<CircleAlert />
          {:else}<CircleCheck />{/if}
        </Trace.Icon>
        <Trace.Title>{title}</Trace.Title>
      </Trace.Line>
    </Trace.CollapsibleTrigger>
    <Trace.CollapsibleContent class="flex flex-col gap-3">
      {#if description}<p class="whitespace-pre-wrap">{description}</p>{/if}
      <Trace.Root>
        {#each observed as step (step.id)}
          {#if step.detail}
            <Trace.Collapsible>
              <Trace.CollapsibleTrigger><Trace.Line status={step.status === 'done' ? undefined : step.status}><Trace.Title>{step.title}</Trace.Title></Trace.Line></Trace.CollapsibleTrigger>
              <Trace.CollapsibleContent class="whitespace-pre-wrap">{step.detail}</Trace.CollapsibleContent>
            </Trace.Collapsible>
          {:else}<Trace.Line status={step.status === 'done' ? undefined : step.status}><Trace.Title>{step.title}</Trace.Title></Trace.Line>{/if}
        {/each}
      </Trace.Root>
    </Trace.CollapsibleContent>
  </Trace.Collapsible>
</Trace.Root>
