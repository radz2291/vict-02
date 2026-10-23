<script lang="ts">
  import * as Trace from '../upstream/ui/trace/index.js';
  import * as CodeBlock from '../upstream/ui/code-block/index.js';
  import { TerminalIcon as Terminal } from "@lucide/svelte";
  let {title, input, output, status, open=false}: {title:string;input?:string;output?:string;status?:'running'|'pending'|'error';open?:boolean}=$props();
</script>
<Trace.Root><Trace.Collapsible {open}>
  <Trace.CollapsibleTrigger><Trace.Line {status}><Trace.Icon><Terminal /></Trace.Icon><Trace.Title>{title}</Trace.Title></Trace.Line></Trace.CollapsibleTrigger>
  <Trace.CollapsibleContent>
    {#if input}<CodeBlock.Root size="sm"><CodeBlock.Header><CodeBlock.Title>Input</CodeBlock.Title><CodeBlock.Actions><CodeBlock.CopyButton value={input}/></CodeBlock.Actions></CodeBlock.Header><CodeBlock.Content code={input} wrap /></CodeBlock.Root>{/if}
    {#if output !== undefined}<CodeBlock.Root size="sm"><CodeBlock.Header><CodeBlock.Title>Output</CodeBlock.Title><CodeBlock.Actions><CodeBlock.CopyButton value={output}/></CodeBlock.Actions></CodeBlock.Header><CodeBlock.Content code={output} wrap /></CodeBlock.Root>{/if}
  </Trace.CollapsibleContent>
</Trace.Collapsible></Trace.Root>
