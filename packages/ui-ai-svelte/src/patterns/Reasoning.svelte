<script lang="ts">
  import CircleCheck from '@lucide/svelte/icons/circle-check';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import * as Trace from '../upstream/ui/trace/index.js';
  import Markdown from '../upstream/markdown/markdown.svelte';

  // Text must be a host-approved public summary, never inferred hidden reasoning.
  let { text, running = false, title, duration, open, markdown = true, showIcon = false }: {
    text: string; running?: boolean; title?: string; duration?: number; open?: boolean;
    markdown?: boolean; showIcon?: boolean;
  } = $props();
  let readerOpen = $state<boolean>();
</script>

{#snippet line()}
  <Trace.Line status={running ? 'running' : undefined}>
    {#if showIcon || duration !== undefined}
      <Trace.Icon>{#if running}<LoaderCircle class="animate-spin" />{:else}<CircleCheck />{/if}</Trace.Icon>
    {/if}
    <Trace.Title>{title ?? (running ? 'Thinking' : 'Thought')}</Trace.Title>
    {#if !running && duration !== undefined}<Trace.Description>{duration}s</Trace.Description>{/if}
  </Trace.Line>
{/snippet}

<Trace.Root>
  {#if text.length === 0}{@render line()}
  {:else}
    <Trace.Collapsible open={readerOpen ?? open ?? running} onOpenChange={value => readerOpen = value}>
      <Trace.CollapsibleTrigger>{@render line()}</Trace.CollapsibleTrigger>
      <Trace.CollapsibleContent class={markdown ? undefined : 'whitespace-pre-wrap'}>
        {#if markdown}<Markdown content={text} />{:else}{text}{/if}
      </Trace.CollapsibleContent>
    </Trace.Collapsible>
  {/if}
</Trace.Root>
