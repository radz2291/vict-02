<script lang="ts">
  import type { UiComponentPresentation } from '@victframework/ui-svelte';
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
  let { presentation, title, steps, description, open }: {
    presentation?: UiComponentPresentation;
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
    <Trace.CollapsibleTrigger {...presentation?.target('disclosure')}>
      <Trace.Line {...presentation?.target('row')} {status}>
        <Trace.Icon {...presentation?.target('icon')}>{@render icon(status)}</Trace.Icon>
        <Trace.Title {...presentation?.target('title')}>{title}</Trace.Title>
      </Trace.Line>
    </Trace.CollapsibleTrigger>
    <Trace.CollapsibleContent {...presentation?.target('body')} class={`flex flex-col gap-3 ${presentation?.target('body').class ?? ''}`}>
      {#if description}<p class="whitespace-pre-wrap">{description}</p>{/if}
      <Trace.Root>
        {#each steps as step (step.id)}
          {#snippet line()}
            <Trace.Line {...presentation?.target('row')} status={step.status === 'done' ? undefined : step.status}>
              <Trace.Icon {...presentation?.target('icon')}>{@render icon(step.status)}</Trace.Icon>
              <Trace.Title {...presentation?.target('title')}>{step.title}</Trace.Title>
            </Trace.Line>
          {/snippet}
          {#if step.detail || step.code !== undefined || step.badges?.length || step.links?.length}
            <Trace.Collapsible open={stepOpen[step.id] ?? step.open ?? step.code !== undefined} onOpenChange={value => stepOpen[step.id] = value}>
              <Trace.CollapsibleTrigger {...presentation?.target('disclosure')}>{@render line()}</Trace.CollapsibleTrigger>
              <Trace.CollapsibleContent {...presentation?.target('body')} class={`flex flex-col gap-3 ${presentation?.target('body').class ?? ''}`}>
                {#if step.detail}<p class="whitespace-pre-wrap">{step.detail}</p>{/if}
                {#if step.code !== undefined}
                  <CodeBlock.Root size="sm" variant={step.status === 'error' ? 'destructive' : 'default'}>
                    <CodeBlock.Content {...presentation?.target('code')} code={step.code} wrap class={`max-h-64 ${presentation?.target('code').class ?? ''}`} />
                  </CodeBlock.Root>
                {/if}
                {#if step.badges?.length}
                  <div class="flex flex-wrap gap-1.5">{#each step.badges as badge, index (index)}<Badge {...presentation?.target('badge')} variant="secondary" class={`font-mono ${presentation?.target('badge').class ?? ''}`}>{badge}</Badge>{/each}</div>
                {/if}
                {#if step.links?.length}
                  <Trace.Root>
                    {#each step.links as link, index (index)}
                      {@const href = safeExternalUrl(link.url)}
                      {#if href}
                        <a {...presentation?.target('link')} {href} target="_blank" rel="noopener noreferrer">
                          <Trace.Line {...presentation?.target('row')}><Trace.Icon {...presentation?.target('icon')}><Globe /></Trace.Icon><Trace.Title {...presentation?.target('title')}>{link.title}<span class="sr-only"> (opens in a new tab)</span></Trace.Title><Trace.Icon {...presentation?.target('icon')}><ArrowUpRight /></Trace.Icon></Trace.Line>
                        </a>
                      {:else}<Trace.Line {...presentation?.target('row')}><Trace.Title {...presentation?.target('title')}>{link.title}</Trace.Title></Trace.Line>{/if}
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
