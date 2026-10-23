<script lang="ts">
  import Terminal from '@lucide/svelte/icons/terminal';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import * as Trace from '../upstream/ui/trace/index.js';
  import * as CodeBlock from '../upstream/ui/code-block/index.js';
  import Confirmation from './Confirmation.svelte';

  let { title, input, output, status, state: toolState, error, open, details = false, approval, onOpenOutput }: {
    title: string;
    input?: string;
    output?: string;
    status?: 'running' | 'pending' | 'error';
    state?: 'running' | 'pending' | 'completed' | 'error' | 'denied';
    error?: string;
    open?: boolean;
    /** Optional input inspection; the primary upstream composition shows output only. */
    details?: boolean;
    approval?: { title: string; description?: string; onDecision: (approved: boolean) => void };
    /** Host-owned presentation panel; this callback does not execute a tool. */
    onOpenOutput?: () => void;
  } = $props();

  let readerOpen = $state<boolean>();
  const phase = $derived(toolState ?? status);
  const traceStatus = $derived(toolState === 'completed' || toolState === 'denied' ? undefined : toolState ?? status);
  const awaitingOutput = $derived(phase === 'running' || phase === 'pending' || phase === 'denied');
  const content = $derived(awaitingOutput ? undefined
    : phase === 'error' ? error ?? output
    : toolState === 'completed' ? output : output ?? error);
  const hasContent = $derived(!awaitingOutput && (content !== undefined || (details && input !== undefined)));
</script>

{#snippet summary()}
  <Trace.Line status={traceStatus}>
    <Trace.Icon><Terminal /></Trace.Icon>
    <Trace.Title>{title}</Trace.Title>
    {#if onOpenOutput && hasContent}<ChevronRight class="size-4 shrink-0" />{/if}
  </Trace.Line>
{/snippet}

{#if approval}
  <Confirmation title={approval.title} description={approval.description ?? ''} onDecision={approval.onDecision} />
{:else}
  <Trace.Root>
    {#if hasContent && onOpenOutput}
      <button type="button" onclick={onOpenOutput}>{@render summary()}</button>
    {:else if hasContent}
      <Trace.Collapsible open={readerOpen ?? open ?? traceStatus === 'error'} onOpenChange={(value) => readerOpen = value}>
        <Trace.CollapsibleTrigger>{@render summary()}</Trace.CollapsibleTrigger>
        <Trace.CollapsibleContent class="flex flex-col gap-3">
          {#if details && input !== undefined}
            <Trace.Collapsible>
              <Trace.CollapsibleTrigger><Trace.Line><Trace.Title>Input</Trace.Title></Trace.Line></Trace.CollapsibleTrigger>
              <Trace.CollapsibleContent>
                <CodeBlock.Root size="sm"><CodeBlock.Content code={input} wrap class="max-h-64" /></CodeBlock.Root>
              </Trace.CollapsibleContent>
            </Trace.Collapsible>
          {/if}
          {#if content !== undefined}
            <CodeBlock.Root size="sm"><CodeBlock.Content code={content} wrap class="max-h-64" /></CodeBlock.Root>
          {/if}
        </Trace.CollapsibleContent>
      </Trace.Collapsible>
    {:else}
      {@render summary()}
    {/if}
  </Trace.Root>
{/if}
