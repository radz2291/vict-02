<script lang="ts">
  import CircleCheck from '@lucide/svelte/icons/circle-check';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import Circle from '@lucide/svelte/icons/circle';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import Globe from '@lucide/svelte/icons/globe';
  import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
  import * as Trace from '../upstream/ui/trace/index.js';
  import * as CodeBlock from '../upstream/ui/code-block/index.js';
  import { Badge } from '../upstream/ui/badge/index.js';
  import { safeExternalUrl } from '../upstream/markdown/safe-url.js';
  import type { Step } from './types.js';

  type Activity = Step & {
    open?: boolean;
    code?: string;
    badges?: readonly string[];
    links?: readonly { title: string; url: string }[];
  };
  let { title, steps, description, open }: {
    title: string; steps: readonly Activity[]; description?: string; open?: boolean;
  } = $props();
  let readerOpen = $state<boolean>();
  let stepOpen = $state<Record<string, boolean>>({});
  const status = $derived(steps.some(step => step.status === 'running') ? 'running'
    : steps.some(step => step.status === 'error') ? 'error' : steps.some(step => step.status === 'pending') ? 'pending' : undefined);
</script>

{#snippet icon(state: Step['status'])}
  {#if state === 'running'}<LoaderCircle class="animate-spin" />
  {:else if state === 'error'}<CircleAlert />
  {:else if state === 'pending'}<Circle />
  {:else}<CircleCheck />{/if}
{/snippet}

<Trace.Root>
  <Trace.Collapsible open={readerOpen ?? open ?? status === 'running'} onOpenChange={value => readerOpen = value}>
    <Trace.CollapsibleTrigger>
      <Trace.Line {status}>
        <Trace.Icon>{@render icon(status)}</Trace.Icon>
        <Trace.Title>{title}</Trace.Title>
      </Trace.Line>
    </Trace.CollapsibleTrigger>
    <Trace.CollapsibleContent class="flex flex-col gap-3">
      {#if description}<p class="whitespace-pre-wrap">{description}</p>{/if}
      <Trace.Root>
        {#each steps as step (step.id)}
          {#snippet line()}
            <Trace.Line status={step.status === 'done' ? undefined : step.status}>
              <Trace.Icon>{@render icon(step.status)}</Trace.Icon>
              <Trace.Title>{step.title}</Trace.Title>
            </Trace.Line>
          {/snippet}
          {#if step.detail || step.code !== undefined || step.badges?.length || step.links?.length}
            <Trace.Collapsible open={stepOpen[step.id] ?? step.open ?? step.code !== undefined} onOpenChange={value => stepOpen[step.id] = value}>
              <Trace.CollapsibleTrigger>{@render line()}</Trace.CollapsibleTrigger>
              <Trace.CollapsibleContent class="flex flex-col gap-3">
                {#if step.detail}<p class="whitespace-pre-wrap">{step.detail}</p>{/if}
                {#if step.code !== undefined}
                  <CodeBlock.Root size="sm" variant={step.status === 'error' ? 'destructive' : 'default'}>
                    <CodeBlock.Content code={step.code} wrap class="max-h-64" />
                  </CodeBlock.Root>
                {/if}
                {#if step.badges?.length}
                  <div class="flex flex-wrap gap-1.5">{#each step.badges as badge, index (index)}<Badge variant="secondary" class="font-mono">{badge}</Badge>{/each}</div>
                {/if}
                {#if step.links?.length}
                  <Trace.Root>
                    {#each step.links as link, index (index)}
                      {@const href = safeExternalUrl(link.url)}
                      {#if href}
                        <a {href} target="_blank" rel="noopener noreferrer">
                          <Trace.Line><Trace.Icon><Globe /></Trace.Icon><Trace.Title>{link.title}<span class="sr-only"> (opens in a new tab)</span></Trace.Title><Trace.Icon><ArrowUpRight /></Trace.Icon></Trace.Line>
                        </a>
                      {:else}<Trace.Line><Trace.Title>{link.title}</Trace.Title></Trace.Line>{/if}
                    {/each}
                  </Trace.Root>
                {/if}
              </Trace.CollapsibleContent>
            </Trace.Collapsible>
          {:else}{@render line()}{/if}
        {/each}
      </Trace.Root>
    </Trace.CollapsibleContent>
  </Trace.Collapsible>
</Trace.Root>
