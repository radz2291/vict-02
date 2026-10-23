<script lang="ts">
  import TerminalIcon from '@lucide/svelte/icons/terminal';
  import * as Trace from '../upstream/ui/trace/index.js';
  import * as CodeBlock from '../upstream/ui/code-block/index.js';

  let { command, output, status, exitCode, open }: {
    command: string;
    output: string;
    status?: 'running' | 'pending' | 'error';
    exitCode?: number;
    open?: boolean;
  } = $props();
  let readerOpen = $state<boolean>();
  const failed = $derived(status !== 'running' && (status === 'error' || (exitCode !== undefined && exitCode !== 0)));
  const traceStatus = $derived(failed ? 'error' : status);
  const title = $derived(failed
    ? exitCode !== undefined && exitCode !== 0 ? `${command} exited with code ${exitCode}` : `Failed to run ${command}`
    : `${status === 'running' ? 'Running' : status === 'pending' ? 'Queued' : 'Ran'} ${command}`);
</script>

{#snippet summary()}
  <Trace.Line status={traceStatus}>
    <Trace.Icon><TerminalIcon /></Trace.Icon>
    <Trace.Title>{title}</Trace.Title>
  </Trace.Line>
{/snippet}

<Trace.Root>
  {#if output.length > 0}
    <Trace.Collapsible open={readerOpen ?? open ?? (failed || status === 'running')} onOpenChange={(value) => readerOpen = value}>
      <Trace.CollapsibleTrigger>{@render summary()}</Trace.CollapsibleTrigger>
      <Trace.CollapsibleContent>
        <CodeBlock.Root size="sm"><CodeBlock.Content code={output} wrap class="max-h-64" /></CodeBlock.Root>
      </Trace.CollapsibleContent>
    </Trace.Collapsible>
  {:else}
    {@render summary()}
  {/if}
</Trace.Root>
