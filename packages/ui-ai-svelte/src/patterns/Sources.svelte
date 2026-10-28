<script lang="ts">
  import type { UiComponentPresentation } from '@victframework/ui-svelte';
  import * as Trace from '../upstream/ui/trace/index.js';
  import Globe from '@lucide/svelte/icons/globe';
  import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
  import { safeExternalUrl } from '../upstream/markdown/safe-url.js';
  import type { Citation } from './types.js';

  let { presentation, sources, open = $bindable(true) }: {
    presentation?: UiComponentPresentation;
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
    <Trace.CollapsibleTrigger {...presentation?.target('disclosure')}>
      <Trace.Line {...presentation?.target('row')}>
        <Trace.Icon {...presentation?.target('icon')}><Globe /></Trace.Icon>
        <Trace.Title {...presentation?.target('title')}>Used {unique.length} sources</Trace.Title>
      </Trace.Line>
    </Trace.CollapsibleTrigger>
    <Trace.CollapsibleContent {...presentation?.target('body')}>
      <Trace.Root>
        {#each unique as source (source.id)}
          {@const href = safeExternalUrl(source.url)}
          {#if href}
            <a {...presentation?.target('source')} {href} target="_blank" rel="noopener noreferrer">
              <Trace.Line {...presentation?.target('row')}>
                <Trace.Title {...presentation?.target('title')}>
                  {title(source, href)}
                  <span class="sr-only"> (opens in a new tab)</span>
                </Trace.Title>
                <Trace.Icon {...presentation?.target('icon')}><ArrowUpRight /></Trace.Icon>
              </Trace.Line>
            </a>
          {:else}
            <Trace.Line {...presentation?.target('row')}><Trace.Title {...presentation?.target('title')}>{title(source, href)}</Trace.Title></Trace.Line>
          {/if}
        {/each}
      </Trace.Root>
    </Trace.CollapsibleContent>
  </Trace.Collapsible>
</Trace.Root>
