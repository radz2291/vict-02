<script lang="ts">
  import CircleCheck from '@lucide/svelte/icons/circle-check';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import Circle from '@lucide/svelte/icons/circle';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import * as Trace from '../upstream/ui/trace/index.js';
  import * as CodeBlock from '../upstream/ui/code-block/index.js';
  import Markdown from '../upstream/markdown/markdown.svelte';
  import { Badge } from '../upstream/ui/badge/index.js';
  import type { Step } from './types.js';

  let { title, steps, result, state: activityState = 'completed', duration, model, tools = [], description, open = true }: {
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
  <Trace.Line {status}>
    <Trace.Icon>{@render icon(status)}</Trace.Icon><Trace.Title>{title}</Trace.Title>
    {#if duration !== undefined}<Trace.Description>{duration}s</Trace.Description>{/if}
  </Trace.Line>
{/snippet}

<Trace.Root>
  {#if !hasContent}{@render line()}
  {:else}
    <Trace.Collapsible open={readerOpen ?? open} onOpenChange={value => readerOpen = value}>
      <Trace.CollapsibleTrigger>{@render line()}</Trace.CollapsibleTrigger>
      <Trace.CollapsibleContent class="flex flex-col gap-3">
        {#if model || tools.length}
          <div class="flex flex-wrap gap-1.5">
            {#if model}<Badge variant="secondary">{model}</Badge>{/if}
            {#each tools as tool, index (index)}<Badge variant="outline" class="font-mono">{tool}</Badge>{/each}
          </div>
        {/if}
        {#if description}<p class="whitespace-pre-wrap">{description}</p>{/if}
        <Trace.Root>
          {#each steps as step (step.id)}
            {#snippet stepLine()}
              <Trace.Line status={step.status === 'done' ? undefined : step.status}>
                <Trace.Icon>{@render icon(step.status)}</Trace.Icon><Trace.Title>{step.title}</Trace.Title>
              </Trace.Line>
            {/snippet}
            {#if step.detail || step.code !== undefined}
              <Trace.Collapsible>
                <Trace.CollapsibleTrigger>{@render stepLine()}</Trace.CollapsibleTrigger>
                <Trace.CollapsibleContent class="flex flex-col gap-3">
                  {#if step.detail}<p class="whitespace-pre-wrap">{step.detail}</p>{/if}
                  {#if step.code !== undefined}<CodeBlock.Root size="sm"><CodeBlock.Content code={step.code} wrap class="max-h-64" /></CodeBlock.Root>{/if}
                </Trace.CollapsibleContent>
              </Trace.Collapsible>
            {:else}{@render stepLine()}{/if}
          {/each}
        </Trace.Root>
        {#if result}<Markdown content={result} />{/if}
      </Trace.CollapsibleContent>
    </Trace.Collapsible>
  {/if}
</Trace.Root>
