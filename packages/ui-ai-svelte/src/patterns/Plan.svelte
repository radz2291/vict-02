<script lang="ts">
  import type { UiComponentPresentation } from '@victframework/ui-svelte';
  import Route from '@lucide/svelte/icons/route';
  import Circle from '@lucide/svelte/icons/circle';
  import CircleCheck from '@lucide/svelte/icons/circle-check';
  import CircleDot from '@lucide/svelte/icons/circle-dot';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import * as Trace from '../upstream/ui/trace/index.js';
  import type { Step } from './types.js';

  let { presentation, title, steps, description, open = true }: {
    presentation?: UiComponentPresentation;
    title: string; steps: readonly Step[]; description?: string; open?: boolean;
  } = $props();
  let readerOpen = $state<boolean>();
  const status = $derived(steps.some(step => step.status === 'error') ? 'error'
    : steps.some(step => step.status === 'running') ? 'running' : undefined);
</script>

<Trace.Root>
  <Trace.Collapsible open={readerOpen ?? open} onOpenChange={value => readerOpen = value}>
    <Trace.CollapsibleTrigger {...presentation?.target('disclosure')}>
      <Trace.Line {...presentation?.target('row')} {status}>
        <Trace.Icon {...presentation?.target('icon')}><Route /></Trace.Icon>
        <Trace.Title {...presentation?.target('title')}>{title}</Trace.Title>
        <Trace.Description {...presentation?.target('metadata')}>{steps.filter(step => step.status === 'done').length} of {steps.length} done</Trace.Description>
      </Trace.Line>
    </Trace.CollapsibleTrigger>
    <Trace.CollapsibleContent {...presentation?.target('body')} class={`flex flex-col gap-3 ${presentation?.target('body').class ?? ''}`}>
      {#if description}<p class="whitespace-pre-wrap">{description}</p>{/if}
      <Trace.Root>
        {#each steps as step (step.id)}
          {#snippet line()}
            <Trace.Line {...presentation?.target('row')} status={step.status === 'done' ? undefined : step.status}>
              <Trace.Icon {...presentation?.target('icon')}>
                {#if step.status === 'done'}<CircleCheck />
                {:else if step.status === 'running'}<CircleDot />
                {:else if step.status === 'error'}<CircleAlert />
                {:else}<Circle />{/if}
              </Trace.Icon>
              <Trace.Title {...presentation?.target('title')}>{step.title}</Trace.Title>
            </Trace.Line>
          {/snippet}
          {#if step.detail}
            <Trace.Collapsible><Trace.CollapsibleTrigger {...presentation?.target('disclosure')}>{@render line()}</Trace.CollapsibleTrigger><Trace.CollapsibleContent {...presentation?.target('body')} class={`whitespace-pre-wrap ${presentation?.target('body').class ?? ''}`}>{step.detail}</Trace.CollapsibleContent></Trace.Collapsible>
          {:else}{@render line()}{/if}
        {/each}
      </Trace.Root>
    </Trace.CollapsibleContent>
  </Trace.Collapsible>
</Trace.Root>
