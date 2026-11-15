<script lang="ts">
  import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
  import CircleXIcon from '@lucide/svelte/icons/circle-x';
  import CircleDashedIcon from '@lucide/svelte/icons/circle-dashed';
  import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
  import * as Trace from './upstream/ui/trace/index.js';
  import type { Snippet } from 'svelte';
  import type { ConversationActivity, ConversationActivityDensity } from './adapters.js';
  let { activity, density, action }: {
    activity: ConversationActivity; density?: ConversationActivityDensity; action?: Snippet;
  } = $props();
  const showPayload = $derived(density !== 'summary' && (activity.input || activity.result));
  const showStages = $derived(density !== 'summary' && activity.stages?.length && (!showPayload || density === 'full'));
  const status = $derived(activity.state === 'failed' ? 'error' : activity.state === 'completed' || activity.state === 'cancelled' ? undefined : activity.state);
  const labels = {pending:'Pending',running:'Running',completed:'Completed',failed:'Failed',cancelled:'Cancelled'};
</script>

{#snippet line()}
  <Trace.Line {status}>
    <Trace.Icon>{#if activity.state === 'running'}<LoaderCircleIcon class="animate-spin"/>{:else if activity.state === 'completed'}<CircleCheckIcon/>{:else if activity.state === 'failed'}<CircleXIcon/>{:else}<CircleDashedIcon/>{/if}</Trace.Icon>
    <Trace.Title>{activity.title}</Trace.Title>
    {#if density}<span class="tool-status">{labels[activity.state]}</span>{:else}<span class="vict-ai-sr">{activity.state}</span>{/if}
  </Trace.Line>
{/snippet}

<Trace.Root data-activity-id={activity.id} data-activity-state={activity.state}>
{#if density === 'summary' && !activity.detail && !action}
  {@render line()}
{:else}
<Trace.Collapsible>
  <Trace.CollapsibleTrigger>{@render line()}</Trace.CollapsibleTrigger>
  <Trace.CollapsibleContent>
    <div class="tool-evidence">
      {#if showPayload}
        {#each [{label:'Input',payload:activity.input},{label:'Result',payload:activity.result}] as section}
          <section aria-label={`Tool ${section.label.toLowerCase()}`}>
            <h4>{section.label}</h4>
            {#if section.payload}
              {#if section.payload.redacted || section.payload.truncated}<p class="evidence-note">{[section.payload.redacted?'Sensitive values redacted':undefined,section.payload.truncated?(section.payload.completeOriginalAvailable?'Preview only; complete sanitized exchange retained':'Content truncated'):undefined].filter(Boolean).join(' · ')}</p>{/if}
              {#if section.payload.unavailable}<p class="evidence-note">{section.payload.text}</p>{:else}<pre>{section.payload.text}</pre>{/if}
            {:else}<p class="evidence-note">{section.label==='Result' && (activity.state==='running'||activity.state==='pending')?'Waiting for result.':`${section.label} unavailable for this call.`}</p>{/if}
          </section>
        {/each}
      {/if}
      {#if showStages}
        <ol aria-label="Attempt receipts">{#each activity.stages ?? [] as stage (stage.id)}<li><span>{stage.title} · {stage.state}</span>{#if stage.detail}<pre>{stage.detail}</pre>{/if}</li>{/each}</ol>
      {:else if !showPayload && activity.detail}<p>{activity.detail}</p>
      {:else if !showPayload && density !== 'summary' && !action}<pre>{activity.title}</pre>{/if}
      {@render action?.()}
    </div>
  </Trace.CollapsibleContent>
</Trace.Collapsible>
{/if}
</Trace.Root>

<style>
  .tool-evidence{max-height:360px;overflow:auto;overscroll-behavior:contain;font:12px/1.5 system-ui,sans-serif;min-width:0}
  section+section{margin-top:12px}h4{font:inherit;font-weight:500;margin:0 0 6px}pre{font:11px/1.5 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere;margin:0}
  .evidence-note{font:12px/1.5 system-ui,sans-serif;color:var(--muted-foreground,#64748b);margin:0 0 6px}
  ol{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:10px}
  section+ol,ol+:global(*){margin-top:12px}
  .tool-status{font-size:.75rem;color:var(--muted-foreground,#64748b)}
  .vict-ai-sr{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
</style>
