<script lang="ts">
  import * as Trace from '../upstream/ui/trace/index.js';
  import Globe from '@lucide/svelte/icons/globe';
  import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
  import { safeExternalUrl } from '../upstream/markdown/safe-url.js';
  import type { Citation } from './types.js';

  let { sources, open = $bindable(true) }: {
    sources: readonly Citation[];
    open?: boolean;
  } = $props();
  const unique = $derived(sources.filter((source, index, all) =>
    all.findIndex(other => other.url === source.url) === index));
  function title(source: Citation, href: string | undefined) {
    if (source.title) return source.title;
    try { return href ? new URL(href).hostname.replace(/^www\./, '') : 'Unavailable source'; }
    catch { return 'Unavailable source'; }
  }
</script>

<Trace.Root>
  <Trace.Collapsible bind:open>
    <Trace.CollapsibleTrigger>
      <Trace.Line>
        <Trace.Icon><Globe /></Trace.Icon>
        <Trace.Title>Used {unique.length} sources</Trace.Title>
      </Trace.Line>
    </Trace.CollapsibleTrigger>
    <Trace.CollapsibleContent>
      <Trace.Root>
        {#each unique as source (source.id)}
          {@const href = safeExternalUrl(source.url)}
          {#if href}
            <a {href} target="_blank" rel="noopener noreferrer">
              <Trace.Line>
                <Trace.Title>
                  {title(source, href)}
                  <span class="sr-only"> (opens in a new tab)</span>
                </Trace.Title>
                <Trace.Icon><ArrowUpRight /></Trace.Icon>
              </Trace.Line>
            </a>
          {:else}
            <Trace.Line><Trace.Title>{title(source, href)}</Trace.Title></Trace.Line>
          {/if}
        {/each}
      </Trace.Root>
    </Trace.CollapsibleContent>
  </Trace.Collapsible>
</Trace.Root>
