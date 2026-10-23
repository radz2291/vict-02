<script lang="ts">
  import * as Trace from '../upstream/ui/trace/index.js';
  import { GlobeIcon as Globe } from "@lucide/svelte";
  import {safeExternalUrl} from '../upstream/markdown/safe-url.js';
  import type {Citation} from './types.js';
  let {sources}:{sources:readonly Citation[]}=$props();
</script>
<Trace.Root><Trace.Collapsible><Trace.CollapsibleTrigger><Trace.Line><Trace.Icon><Globe/></Trace.Icon><Trace.Title>{sources.length} sources</Trace.Title></Trace.Line></Trace.CollapsibleTrigger><Trace.CollapsibleContent><Trace.Root>{#each sources as source (source.id)}{@const href=safeExternalUrl(source.url)}{#if href}<a {href} target="_blank" rel="noopener noreferrer"><Trace.Line><Trace.Icon><Globe/></Trace.Icon><Trace.Title>{source.title}</Trace.Title></Trace.Line></a>{:else}<Trace.Line><Trace.Title>{source.title}</Trace.Title></Trace.Line>{/if}{/each}</Trace.Root></Trace.CollapsibleContent></Trace.Collapsible></Trace.Root>
