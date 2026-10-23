<script lang="ts">
  import TraceSteps from './TraceSteps.svelte';
  import Markdown from '../upstream/markdown/markdown.svelte';
  import {Badge} from '../upstream/ui/badge/index.js';
  import type {Step} from './types.js';
  let {title, steps, result, state='completed'}:{title:string;steps:readonly Step[];result?:string;state?:string}=$props();
</script>
<Badge variant="outline">{state}</Badge><TraceSteps {title} {steps}/>{#if result}<Markdown content={result}/>{/if}
