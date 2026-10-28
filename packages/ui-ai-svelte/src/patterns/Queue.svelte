<script lang="ts">
  import type { UiComponentPresentation } from '@victframework/ui-svelte';
  import Circle from '@lucide/svelte/icons/circle';
  import CircleCheck from '@lucide/svelte/icons/circle-check';
  import CircleDot from '@lucide/svelte/icons/circle-dot';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import ListTodo from '@lucide/svelte/icons/list-todo';
  import ListChecks from '@lucide/svelte/icons/list-checks';
  import * as Trace from '../upstream/ui/trace/index.js';
  import type { Step } from './types.js';

  let { presentation, steps, completedOpen = true }: {
    presentation?: UiComponentPresentation; steps: readonly Step[]; completedOpen?: boolean } = $props();
  let readerOpen = $state<Record<string, boolean>>({});
  const groups = $derived([
    { id: 'todo', steps: steps.filter(step => step.status !== 'done') },
    { id: 'completed', steps: steps.filter(step => step.status === 'done') },
  ]);
</script>

<Trace.Root>
  {#each groups as group (group.id)}
    {#if group.steps.length}
      <Trace.Collapsible open={readerOpen[group.id] ?? (group.id === 'todo' || completedOpen)} onOpenChange={value => readerOpen[group.id] = value}>
        <Trace.CollapsibleTrigger {...presentation?.target('disclosure')}>
          <Trace.Line {...presentation?.target('row')}>
            <Trace.Icon {...presentation?.target('icon')}>{#if group.id === 'todo'}<ListTodo />{:else}<ListChecks />{/if}</Trace.Icon>
            <Trace.Title {...presentation?.target('title')}>{group.steps.length} {group.id === 'todo' ? 'to do' : 'completed'}</Trace.Title>
          </Trace.Line>
        </Trace.CollapsibleTrigger>
        <Trace.CollapsibleContent {...presentation?.target('body')}>
          <Trace.Root>
            {#each group.steps as step (step.id)}
              {#snippet line()}
                <Trace.Line {...presentation?.target('row')} status={step.status === 'running' || step.status === 'error' ? step.status : undefined}>
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
    {/if}
  {/each}
</Trace.Root>
