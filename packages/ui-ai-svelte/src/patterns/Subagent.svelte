<script lang="ts">
  import type { UiComponentPresentation } from '@victframework/ui-svelte';
  import CircleCheck from '@lucide/svelte/icons/circle-check';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import Circle from '@lucide/svelte/icons/circle';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import * as Trace from '../upstream/ui/trace/index.js';
  import * as CodeBlock from '../upstream/ui/code-block/index.js';
  import Markdown from '../upstream/markdown/markdown.svelte';
  import { Badge } from '../upstream/ui/badge/index.js';
  import type { Step } from './types.js';

  let { presentation, title, steps, result, state: activityState = 'completed', duration, model, tools = [], description, open = true }: {
    presentation?: UiComponentPresentation;
    title: string; steps: readonly (Step & { code?: string })[]; result?: string; state?: string;
    duration?: number; model?: string; tools?: readonly string[]; description?: string; open?: boolean;
  } = $props();
  let readerOpen = $state<boolean>();
  const status = $derived(activityState === 'running' ? 'running' : ['error', 'failed'].includes(activityState) ? 'error' : activityState === 'pending' ? 'pending' : undefined);
  const hasContent = $derived(steps.length > 0 || !!result || !!description || !!model || tools.length > 0);
</script>

{#snippet icon(value: Step['status'])}
  {#if value === 'running'}<LoaderCircle class="animate-spin" />
  {:else if value === 'error'}<CircleAlert />
  {:else if value === 'pending'}<Circle />
  {:else}<CircleCheck />{/if}
{/snippet}
{#snippet line()}
  <Trace.Line {...presentation?.target('row')} {status}>
    <Trace.Icon {...presentation?.target('icon')}>{@render icon(status)}</Trace.Icon><Trace.Title {...presentation?.target('title')}>{title}</Trace.Title>
    {#if duration !== undefined}<Trace.Description {...presentation?.target('metadata')}>{duration}s</Trace.Description>{/if}
  </Trace.Line>
{/snippet}

<Trace.Root>
  {#if !hasContent}{@render line()}
  {:else}
    <Trace.Collapsible open={readerOpen ?? open} onOpenChange={value => readerOpen = value}>
      <Trace.CollapsibleTrigger {...presentation?.target('disclosure')}>{@render line()}</Trace.CollapsibleTrigger>
      <Trace.CollapsibleContent {...presentation?.target('body')} class={`flex flex-col gap-3 ${presentation?.target('body').class ?? ''}`}>
        {#if model || tools.length}
          <div class="flex flex-wrap gap-1.5">
            {#if model}<Badge {...presentation?.target('badge')} variant="secondary">{model}</Badge>{/if}
            {#each tools as tool, index (index)}<Badge {...presentation?.target('badge')} variant="outline" class={`font-mono ${presentation?.target('badge').class ?? ''}`}>{tool}</Badge>{/each}
          </div>
        {/if}
        {#if description}<p class="whitespace-pre-wrap">{description}</p>{/if}
        <Trace.Root>
          {#each steps as step (step.id)}
            {#snippet stepLine()}
              <Trace.Line {...presentation?.target('row')} status={step.status === 'done' ? undefined : step.status}>
                <Trace.Icon {...presentation?.target('icon')}>{@render icon(step.status)}</Trace.Icon><Trace.Title {...presentation?.target('title')}>{step.title}</Trace.Title>
              </Trace.Line>
            {/snippet}
            {#if step.detail || step.code !== undefined}
              <Trace.Collapsible>
                <Trace.CollapsibleTrigger {...presentation?.target('disclosure')}>{@render stepLine()}</Trace.CollapsibleTrigger>
                <Trace.CollapsibleContent {...presentation?.target('body')} class={`flex flex-col gap-3 ${presentation?.target('body').class ?? ''}`}>
                  {#if step.detail}<p class="whitespace-pre-wrap">{step.detail}</p>{/if}
                  {#if step.code !== undefined}<CodeBlock.Root size="sm"><CodeBlock.Content {...presentation?.target('code')} code={step.code} wrap class={`max-h-64 ${presentation?.target('code').class ?? ''}`} /></CodeBlock.Root>{/if}
                </Trace.CollapsibleContent>
              </Trace.Collapsible>
            {:else}{@render stepLine()}{/if}
          {/each}
        </Trace.Root>
        {#if result}<div {...presentation?.target('result')}><Markdown content={result} /></div>{/if}
      </Trace.CollapsibleContent>
    </Trace.Collapsible>
  {/if}
</Trace.Root>
