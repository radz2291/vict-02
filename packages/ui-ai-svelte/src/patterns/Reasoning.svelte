<script lang="ts">
  import * as Trace from '../upstream/ui/trace/index.js';
  import Brain from '@lucide/svelte/icons/brain';
  import Markdown from '../upstream/markdown/markdown.svelte';
  let {text, running=false, title='Reasoning summary'}:{text:string;running?:boolean;title?:string}=$props();
</script>
<Trace.Root><Trace.Collapsible><Trace.CollapsibleTrigger><Trace.Line status={running?'running':undefined}><Trace.Icon><Brain/></Trace.Icon><Trace.Title>{title}</Trace.Title></Trace.Line></Trace.CollapsibleTrigger><Trace.CollapsibleContent><Markdown content={text}/></Trace.CollapsibleContent></Trace.Collapsible></Trace.Root>
