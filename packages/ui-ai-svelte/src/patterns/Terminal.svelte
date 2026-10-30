<script lang="ts">
  import type { UiComponentPresentation } from '@victframework/ui-svelte';
  import TerminalIcon from '@lucide/svelte/icons/terminal';
  import * as Trace from '../upstream/ui/trace/index.js';
  import * as CodeBlock from '../upstream/ui/code-block/index.js';

  let { presentation, command, output, status, exitCode, open }: {
    presentation?: UiComponentPresentation;
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
  <Trace.Line {...presentation?.target('row')} status={traceStatus}>
    <Trace.Icon {...presentation?.target('icon')}><TerminalIcon /></Trace.Icon>
    <Trace.Title {...presentation?.target('title')}>{title}</Trace.Title>
  </Trace.Line>
{/snippet}

<Trace.Root>
  {#if output.length > 0}
    <Trace.Collapsible open={readerOpen ?? open ?? (failed || status === 'running')} onOpenChange={(value) => readerOpen = value}>
      <Trace.CollapsibleTrigger {...presentation?.target('disclosure')}>{@render summary()}</Trace.CollapsibleTrigger>
      <Trace.CollapsibleContent {...presentation?.target('body')}>
        <CodeBlock.Root size="sm"><CodeBlock.Content {...presentation?.target('code')} code={output} wrap class={`max-h-64 ${presentation?.target('code').class ?? ''}`} /></CodeBlock.Root>
      </Trace.CollapsibleContent>
    </Trace.Collapsible>
  {:else}
    {@render summary()}
  {/if}
</Trace.Root>
