<script lang="ts">
  import type { UiComponentPresentation } from '@victframework/ui-svelte';
  import CircleCheck from '@lucide/svelte/icons/circle-check';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import * as Trace from '../upstream/ui/trace/index.js';
  import type { Step } from './types.js';

  let { presentation, title, steps, description, open }: {
    presentation?: UiComponentPresentation;
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
    <Trace.CollapsibleTrigger {...presentation?.target('disclosure')}>
      <Trace.Line {...presentation?.target('row')} {status}>
        <Trace.Icon {...presentation?.target('icon')}>
          {#if status === 'running'}<LoaderCircle class="animate-spin" />
          {:else if status === 'error'}<CircleAlert />
          {:else}<CircleCheck />{/if}
        </Trace.Icon>
        <Trace.Title {...presentation?.target('title')}>{title}</Trace.Title>
      </Trace.Line>
    </Trace.CollapsibleTrigger>
    <Trace.CollapsibleContent {...presentation?.target('body')} class={`flex flex-col gap-3 ${presentation?.target('body').class ?? ''}`}>
      {#if description}<p class="whitespace-pre-wrap">{description}</p>{/if}
      <Trace.Root>
        {#each observed as step (step.id)}
          {#if step.detail}
            <Trace.Collapsible>
              <Trace.CollapsibleTrigger {...presentation?.target('disclosure')}><Trace.Line {...presentation?.target('row')} status={step.status === 'done' ? undefined : step.status}><Trace.Title {...presentation?.target('title')}>{step.title}</Trace.Title></Trace.Line></Trace.CollapsibleTrigger>
              <Trace.CollapsibleContent {...presentation?.target('body')} class={`whitespace-pre-wrap ${presentation?.target('body').class ?? ''}`}>{step.detail}</Trace.CollapsibleContent>
            </Trace.Collapsible>
          {:else}<Trace.Line {...presentation?.target('row')} status={step.status === 'done' ? undefined : step.status}><Trace.Title {...presentation?.target('title')}>{step.title}</Trace.Title></Trace.Line>{/if}
        {/each}
      </Trace.Root>
    </Trace.CollapsibleContent>
  </Trace.Collapsible>
</Trace.Root>
