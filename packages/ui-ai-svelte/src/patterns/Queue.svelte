<script lang="ts">
  import Circle from '@lucide/svelte/icons/circle';
  import CircleCheck from '@lucide/svelte/icons/circle-check';
  import CircleDot from '@lucide/svelte/icons/circle-dot';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import ListTodo from '@lucide/svelte/icons/list-todo';
  import ListChecks from '@lucide/svelte/icons/list-checks';
  import * as Trace from '../upstream/ui/trace/index.js';
  import type { Step } from './types.js';

  let { steps, completedOpen = true }: { steps: readonly Step[]; completedOpen?: boolean } = $props();
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
        <Trace.CollapsibleTrigger>
          <Trace.Line>
            <Trace.Icon>{#if group.id === 'todo'}<ListTodo />{:else}<ListChecks />{/if}</Trace.Icon>
            <Trace.Title>{group.steps.length} {group.id === 'todo' ? 'to do' : 'completed'}</Trace.Title>
          </Trace.Line>
        </Trace.CollapsibleTrigger>
        <Trace.CollapsibleContent>
          <Trace.Root>
            {#each group.steps as step (step.id)}
              {#snippet line()}
                <Trace.Line status={step.status === 'running' || step.status === 'error' ? step.status : undefined}>
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
    {/if}
  {/each}
</Trace.Root>
