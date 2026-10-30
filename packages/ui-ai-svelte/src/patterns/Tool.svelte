<script lang="ts">
  import type { UiComponentPresentation } from '@victframework/ui-svelte';
  import Terminal from '@lucide/svelte/icons/terminal';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import * as Trace from '../upstream/ui/trace/index.js';
  import * as CodeBlock from '../upstream/ui/code-block/index.js';
  import Confirmation from './Confirmation.svelte';

  let { presentation, title, input, output, status, state: toolState, error, open, details = false, approval, onOpenOutput }: {
    presentation?: UiComponentPresentation;
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
  <Trace.Line {...presentation?.target('row')} status={traceStatus}>
    <Trace.Icon {...presentation?.target('icon')}><Terminal /></Trace.Icon>
    <Trace.Title {...presentation?.target('title')}>{title}</Trace.Title>
    {#if onOpenOutput && hasContent}<ChevronRight class="size-4 shrink-0" />{/if}
  </Trace.Line>
{/snippet}

{#if approval}
  <Confirmation {presentation} title={approval.title} description={approval.description ?? ''} onDecision={approval.onDecision} />
{:else}
  <Trace.Root>
    {#if hasContent && onOpenOutput}
      <button {...presentation?.target('output-action')} type="button" onclick={onOpenOutput}>{@render summary()}</button>
    {:else if hasContent}
      <Trace.Collapsible open={readerOpen ?? open ?? traceStatus === 'error'} onOpenChange={(value) => readerOpen = value}>
        <Trace.CollapsibleTrigger {...presentation?.target('disclosure')}>{@render summary()}</Trace.CollapsibleTrigger>
        <Trace.CollapsibleContent {...presentation?.target('body')} class={`flex flex-col gap-3 ${presentation?.target('body').class ?? ''}`}>
          {#if details && input !== undefined}
            <Trace.Collapsible>
              <Trace.CollapsibleTrigger {...presentation?.target('disclosure')}><Trace.Line {...presentation?.target('row')}><Trace.Title {...presentation?.target('title')}>Input</Trace.Title></Trace.Line></Trace.CollapsibleTrigger>
              <Trace.CollapsibleContent {...presentation?.target('body')}>
                <CodeBlock.Root size="sm"><CodeBlock.Content {...presentation?.target('code')} code={input} wrap class={`max-h-64 ${presentation?.target('code').class ?? ''}`} /></CodeBlock.Root>
              </Trace.CollapsibleContent>
            </Trace.Collapsible>
          {/if}
          {#if content !== undefined}
            <CodeBlock.Root size="sm"><CodeBlock.Content {...presentation?.target('code')} code={content} wrap class={`max-h-64 ${presentation?.target('code').class ?? ''}`} /></CodeBlock.Root>
          {/if}
        </Trace.CollapsibleContent>
      </Trace.Collapsible>
    {:else}
      {@render summary()}
    {/if}
  </Trace.Root>
{/if}
