<script lang="ts">
  import TraceSteps from './TraceSteps.svelte';
  import * as CodeBlock from '../upstream/ui/code-block/index.js';
  import type {Step} from './types.js';
  let {title='Test results', suites, output}:{title?:string;suites:readonly Step[];output?:string}=$props();
</script>
<TraceSteps {title} steps={suites}/>{#if output}<CodeBlock.Root size="sm"><CodeBlock.Content code={output} wrap/></CodeBlock.Root>{/if}
