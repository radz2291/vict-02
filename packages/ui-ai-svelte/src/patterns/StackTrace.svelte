<script lang="ts">
  import Terminal from '@lucide/svelte/icons/terminal';
  import CircleX from '@lucide/svelte/icons/circle-x';
  import FileCode from '@lucide/svelte/icons/file-code';
  import Layers from '@lucide/svelte/icons/layers';
  import * as Trace from '../upstream/ui/trace/index.js';

  type Frame = { text: string; name?: string; file?: string; line?: number; column?: number; internal: boolean };
  let { title, frames, open = true, summaryIcon = 'terminal', onFrameSelect }: {
    title?: string;
    frames: string;
    open?: boolean;
    summaryIcon?: 'terminal' | 'error';
    /** The host owns file navigation. Without a callback, frames are informational. */
    onFrameSelect?: (frame: Frame) => void;
  } = $props();
  let readerOpen = $state<boolean>();
  const stack = $derived.by(() => {
    const [error = '', ...lines] = frames.split('\n').map((line) => line.trim());
    const parsed: Frame[] = lines.filter(Boolean).map((text) => {
      const match = text.match(/^at (.+) \((.+):(\d+):(\d+)\)$/);
      return { text, name: match?.[1], file: match?.[2], line: match?.[3] ? Number(match[3]) : undefined,
        column: match?.[4] ? Number(match[4]) : undefined, internal: text.includes('node_modules') || text.includes('node:') };
    });
    return { error, app: parsed.filter((frame) => !frame.internal), internal: parsed.filter((frame) => frame.internal) };
  });
</script>

{#snippet frameLine(frame: Frame)}
  <Trace.Line>
    <Trace.Icon><FileCode /></Trace.Icon>
    <Trace.Title>{frame.file ? `${frame.name} in ${frame.file}:${frame.line}` : frame.text}</Trace.Title>
  </Trace.Line>
{/snippet}

<Trace.Root>
  <Trace.Collapsible open={readerOpen ?? open} onOpenChange={(value) => readerOpen = value}>
    <Trace.CollapsibleTrigger>
      <Trace.Line status="error"><Trace.Icon>{#if summaryIcon === 'error'}<CircleX />{:else}<Terminal />{/if}</Trace.Icon><Trace.Title>{title ?? `Failed: ${stack.error}`}</Trace.Title></Trace.Line>
    </Trace.CollapsibleTrigger>
    <Trace.CollapsibleContent class="flex flex-col gap-2">
      <p class="font-mono text-xs text-destructive">{stack.error}</p>
      <Trace.Root>
        {#each stack.app as frame, index (index)}
          {#if onFrameSelect && frame.file}
            <button type="button" onclick={() => onFrameSelect?.(frame)}>{@render frameLine(frame)}</button>
          {:else}{@render frameLine(frame)}{/if}
        {/each}
        {#if stack.internal.length > 0}
          <Trace.Collapsible>
            <Trace.CollapsibleTrigger>
              <Trace.Line><Trace.Icon><Layers /></Trace.Icon><Trace.Title>{stack.internal.length} framework frames</Trace.Title></Trace.Line>
            </Trace.CollapsibleTrigger>
            <Trace.CollapsibleContent>
              <ol class="flex flex-col gap-1 overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
                {#each stack.internal as frame, index (index)}<li class="whitespace-nowrap">{frame.text}</li>{/each}
              </ol>
            </Trace.CollapsibleContent>
          </Trace.Collapsible>
        {/if}
      </Trace.Root>
    </Trace.CollapsibleContent>
  </Trace.Collapsible>
</Trace.Root>
