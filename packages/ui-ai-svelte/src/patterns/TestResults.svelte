<script lang="ts">
  import Check from '@lucide/svelte/icons/check';
  import X from '@lucide/svelte/icons/x';
  import CircleDashed from '@lucide/svelte/icons/circle-dashed';
  import Circle from '@lucide/svelte/icons/circle';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import FileCode from '@lucide/svelte/icons/file-code';
  import FlaskConical from '@lucide/svelte/icons/flask-conical';
  import * as Trace from '../upstream/ui/trace/index.js';
  import * as CodeBlock from '../upstream/ui/code-block/index.js';
  import type { Step } from './types.js';

  type Test = { id: string; name: string; status: 'passed' | 'failed' | 'skipped'; error?: string };
  type Suite = { id: string; name: string; tests: readonly Test[] };
  let { title, suites = [], testSuites, output, open, running = false, errorsOpen = true }: {
    title?: string;
    /** Legacy public activity remains accepted without reclassifying pending work as skipped. */
    suites?: readonly Step[];
    testSuites?: readonly Suite[];
    output?: string;
    open?: boolean;
    running?: boolean;
    errorsOpen?: boolean;
  } = $props();
  let readerOpen = $state<boolean>();
  let suiteOpen = $state<Record<string, boolean>>({});
  let testOpen = $state<Record<string, boolean>>({});
  const tests = $derived(testSuites?.flatMap((suite) => suite.tests) ?? []);
  const failed = $derived(testSuites ? tests.some((test) => test.status === 'failed') : suites.some((step) => step.status === 'error'));
  const active = $derived(running || (!testSuites && suites.some((step) => step.status === 'running')));
  const summary = $derived(title ?? (active ? 'Running tests' : testSuites ? `Ran ${counts(tests)}` : 'Test results'));

  function counts(items: readonly Test[]) {
    const failures = items.filter((test) => test.status === 'failed').length;
    const skipped = items.filter((test) => test.status === 'skipped').length;
    return [`${items.length} tests`, failures > 0 && `${failures} failed`, skipped > 0 && `${skipped} skipped`].filter(Boolean).join(', ');
  }
</script>

{#snippet testRow(test: Test, key: string)}
  {#if test.status === 'failed'}
    <Trace.Collapsible open={testOpen[key] ?? errorsOpen} onOpenChange={value => testOpen[key] = value}>
      <Trace.CollapsibleTrigger>
        <Trace.Line status="error"><Trace.Icon><X /></Trace.Icon><Trace.Title>{test.name}</Trace.Title></Trace.Line>
      </Trace.CollapsibleTrigger>
      <Trace.CollapsibleContent>
        <CodeBlock.Root size="sm"><CodeBlock.Content code={test.error ?? ''} wrap class="max-h-64" /></CodeBlock.Root>
      </Trace.CollapsibleContent>
    </Trace.Collapsible>
  {:else}
    <Trace.Line>
      <Trace.Icon>{#if test.status === 'skipped'}<CircleDashed />{:else}<Check />{/if}</Trace.Icon>
      <Trace.Title>{test.status === 'skipped' ? `Skipped ${test.name}` : test.name}</Trace.Title>
    </Trace.Line>
  {/if}
{/snippet}

{#snippet legacyRow(step: Step)}
  <Trace.Line status={step.status === 'running' || step.status === 'error' || step.status === 'pending' ? step.status : undefined}>
    <Trace.Icon>
      {#if step.status === 'error'}<X />{:else if step.status === 'running'}<LoaderCircle class="animate-spin" />{:else if step.status === 'done'}<Check />{:else}<Circle />{/if}
    </Trace.Icon>
    <Trace.Title>{step.title}</Trace.Title>
  </Trace.Line>
{/snippet}

{#snippet summaryLine()}
  <Trace.Line status={active ? 'running' : failed ? 'error' : undefined}>
    <Trace.Icon><FlaskConical /></Trace.Icon><Trace.Title>{summary}</Trace.Title>
  </Trace.Line>
{/snippet}

<Trace.Root>
  {#if active}
    {@render summaryLine()}
  {:else}
  <Trace.Collapsible open={readerOpen ?? open ?? failed} onOpenChange={(value) => readerOpen = value}>
    <Trace.CollapsibleTrigger>{@render summaryLine()}</Trace.CollapsibleTrigger>
    <Trace.CollapsibleContent class="flex flex-col gap-3">
      <Trace.Root>
        {#if testSuites}
          {#each testSuites as suite (suite.id)}
            {@const suiteFailed = suite.tests.some((test) => test.status === 'failed')}
            <Trace.Collapsible open={suiteOpen[suite.id] ?? suiteFailed} onOpenChange={(value) => suiteOpen = { ...suiteOpen, [suite.id]: value }}>
              <Trace.CollapsibleTrigger>
                <Trace.Line status={suiteFailed ? 'error' : undefined}>
                  <Trace.Icon><FileCode /></Trace.Icon><Trace.Title>{suite.name}, {counts(suite.tests)}</Trace.Title>
                </Trace.Line>
              </Trace.CollapsibleTrigger>
              <Trace.CollapsibleContent>
                <Trace.Root>{#each suite.tests as test (test.id)}{@render testRow(test, JSON.stringify([suite.id, test.id]))}{/each}</Trace.Root>
              </Trace.CollapsibleContent>
            </Trace.Collapsible>
          {/each}
        {:else}
          {#each suites as step (step.id)}
            {#if step.detail}
              <Trace.Collapsible>
                <Trace.CollapsibleTrigger>{@render legacyRow(step)}</Trace.CollapsibleTrigger>
                <Trace.CollapsibleContent>
                  <CodeBlock.Root size="sm"><CodeBlock.Content code={step.detail} wrap class="max-h-64" /></CodeBlock.Root>
                </Trace.CollapsibleContent>
              </Trace.Collapsible>
            {:else}{@render legacyRow(step)}{/if}
          {/each}
        {/if}
      </Trace.Root>
      {#if output}<CodeBlock.Root size="sm"><CodeBlock.Content code={output} wrap class="max-h-64" /></CodeBlock.Root>{/if}
    </Trace.CollapsibleContent>
  </Trace.Collapsible>
  {/if}
</Trace.Root>
