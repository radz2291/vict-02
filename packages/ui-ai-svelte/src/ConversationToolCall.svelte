<script lang="ts">
  import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
  import CircleXIcon from '@lucide/svelte/icons/circle-x';
  import CircleDashedIcon from '@lucide/svelte/icons/circle-dashed';
  import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
  import * as Trace from './upstream/ui/trace/index.js';
  import type { ConversationActivity } from './adapters.js';
  let { activity }: { activity: ConversationActivity } = $props();
</script>

<Trace.Root><Trace.Collapsible>
  <Trace.CollapsibleTrigger><Trace.Line status={activity.state === 'failed' ? 'error' : activity.state === 'completed' || activity.state === 'cancelled' ? undefined : activity.state}>
    <Trace.Icon>{#if activity.state === 'running'}<LoaderCircleIcon class="animate-spin"/>{:else if activity.state === 'completed'}<CircleCheckIcon/>{:else if activity.state === 'failed'}<CircleXIcon/>{:else}<CircleDashedIcon/>{/if}</Trace.Icon>
    <Trace.Title>{activity.title}</Trace.Title><span class="vict-ai-sr">{activity.state}</span>
  </Trace.Line></Trace.CollapsibleTrigger>
  <Trace.CollapsibleContent>
    <div class="tool-evidence">
      {#if activity.input || activity.result}
        {#each [{label:'Input',payload:activity.input},{label:'Result',payload:activity.result}] as section}
          <section aria-label={`Tool ${section.label.toLowerCase()}`}>
            <h4>{section.label}</h4>
            {#if section.payload}
              {#if section.payload.redacted || section.payload.truncated}<p class="evidence-note">{[section.payload.redacted?'Sensitive values redacted':undefined,section.payload.truncated?'Content truncated':undefined].filter(Boolean).join(' · ')}</p>{/if}
              {#if section.payload.unavailable}<p class="evidence-note">{section.payload.text}</p>{:else}<pre>{section.payload.text}</pre>{/if}
            {:else}<p class="evidence-note">{section.label==='Result' && (activity.state==='running'||activity.state==='pending')?'Waiting for result.':`${section.label} unavailable for this call.`}</p>{/if}
          </section>
        {/each}
      {:else if activity.stages?.length}
        <ol aria-label="Attempt receipts">{#each activity.stages as stage (stage.id)}<li><span>{stage.title} · {stage.state}</span>{#if stage.detail}<pre>{stage.detail}</pre>{/if}</li>{/each}</ol>
      {:else}<pre>{activity.detail ?? activity.title}</pre>{/if}
    </div>
  </Trace.CollapsibleContent>
</Trace.Collapsible></Trace.Root>

<style>
  .tool-evidence{max-height:360px;overflow:auto;overscroll-behavior:contain;font:12px/1.5 system-ui,sans-serif;min-width:0}
  section+section{margin-top:12px}h4{font:inherit;font-weight:500;margin:0 0 6px}pre{font:11px/1.5 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere;margin:0}
  .evidence-note{font:12px/1.5 system-ui,sans-serif;color:var(--muted-foreground,#64748b);margin:0 0 6px}
  ol{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:10px}
  .vict-ai-sr{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
</style>
