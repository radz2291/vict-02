<script lang="ts">
  import type { UiSvelteComponentProps } from '@victframework/ui-svelte';
  import Reasoning from '../patterns/Reasoning.svelte';
  import ChainOfThought from '../patterns/ChainOfThought.svelte';
  import Tool from '../patterns/Tool.svelte';
  import Plan from '../patterns/Plan.svelte';
  import Task from '../patterns/Task.svelte';
  import Queue from '../patterns/Queue.svelte';
  import Terminal from '../patterns/Terminal.svelte';
  import TestResults from '../patterns/TestResults.svelte';
  import StackTrace from '../patterns/StackTrace.svelte';
  import Subagent from '../patterns/Subagent.svelte';
  import Context from '../patterns/Context.svelte';
  import Sources from '../patterns/Sources.svelte';
  import InlineCitation from '../patterns/InlineCitation.svelte';
  import FileTree from '../patterns/FileTree.svelte';
  import Markdown from '../upstream/markdown/markdown.svelte';
  import { parsePublicPatternData, validatePublicPatternScalars, type PublicPatternKind } from './passive-data.js';
  let { props, io, presentation, kind }: UiSvelteComponentProps & {kind: PublicPatternKind} = $props();
  const root = $derived(presentation?.target('root'));
  const content = $derived(presentation?.target('content'));
  const data = $derived(parsePublicPatternData(kind, props.data));
  const scalarError = $derived(validatePublicPatternScalars(kind, props));
  const text = (name: string, fallback = ''): string => typeof props[name] === 'string' ? props[name] as string : fallback;
  const flag = (name: string): boolean => props[name] === true;
  const number = (name: string): number | undefined => typeof props[name] === 'number' && Number.isFinite(props[name]) ? props[name] as number : undefined;
  const phase = $derived(['running', 'pending', 'error'].includes(text('status')) ? text('status') as 'running' | 'pending' | 'error' : undefined);
  const toolState = $derived(['running', 'pending', 'completed', 'error', 'denied'].includes(text('state')) ? text('state') as 'running' | 'pending' | 'completed' | 'error' | 'denied' : undefined);
</script>

<div {...root} class={`${root?.class ?? ''} vict-ai`}>
  <div {...content}>
    {#if scalarError}
      <p role="alert">Invalid {kind} presentation metadata: {scalarError}</p>
    {:else if !data.ok}
      <p role="alert">Invalid {kind} presentation data: {data.error}</p>
    {:else if kind === 'reasoning'}
      <Reasoning {presentation} text={text('text')} title={text('title', 'Public summary')} running={flag('running')} duration={number('duration')} open={flag('open')} markdown={flag('markdown')} showIcon={flag('showIcon')} />
    {:else if kind === 'chain-of-thought'}
      <ChainOfThought {presentation} title={text('title', 'Public execution steps')} steps={data.value.steps ?? []} description={text('description')} open={flag('open')} />
    {:else if kind === 'tool'}
      <Tool {presentation} title={text('title', 'Tool call')} input={text('input')} output={text('output')} error={text('error')} status={phase} state={toolState} open={flag('open')} details={flag('details')}
        onOpenOutput={flag('allowOpenOutput') ? () => io?.emit('openOutput') : undefined}
        approval={flag('allowDecision') ? {title: text('approvalTitle', 'Decision requested'), description: text('approvalDescription'), onDecision: approved => io?.emit('decision', approved)} : undefined} />
    {:else if kind === 'plan'}
      <Plan {presentation} title={text('title', 'Proposed work')} steps={data.value.steps ?? []} description={text('description')} open={flag('open')} />
    {:else if kind === 'task'}
      <Task {presentation} title={text('title', 'Observed activity')} steps={data.value.steps ?? []} description={text('description')} open={flag('open')} />
    {:else if kind === 'queue'}
      <Queue {presentation} steps={data.value.steps ?? []} completedOpen={flag('completedOpen')} />
    {:else if kind === 'terminal'}
      <Terminal {presentation} command={text('command')} output={text('output')} status={phase} exitCode={number('exitCode')} open={flag('open')} />
    {:else if kind === 'test-results'}
      <TestResults {presentation} title={text('title') || undefined} testSuites={data.value.testSuites ?? []} output={text('output')} running={flag('running')} open={flag('open')} errorsOpen={flag('errorsOpen')} />
    {:else if kind === 'stack-trace'}
      <StackTrace {presentation} title={text('title') || undefined} frames={text('frames')} open={flag('open')} summaryIcon={text('summaryIcon') === 'error' ? 'error' : 'terminal'} onFrameSelect={flag('allowSelect') ? frame => io?.emit('frameSelect', JSON.stringify(frame)) : undefined} />
    {:else if kind === 'subagent'}
      <Subagent {presentation} title={text('title', 'Observed child run')} steps={data.value.steps ?? []} tools={data.value.tools ?? []} result={text('result')} state={text('state', 'pending')} duration={number('duration')} model={text('model')} description={text('description')} open={flag('open')} />
    {:else if kind === 'context'}
      <Context used={number('used') ?? 0} limit={number('limit') ?? 0} breakdown={data.value.breakdown ?? []} {presentation} />
    {:else if kind === 'sources'}
      <Sources {presentation} sources={data.value.sources ?? []} open={flag('open')} />
    {:else if kind === 'inline-citation' && data.value.source}
      <InlineCitation source={data.value.source} {presentation} />
    {:else if kind === 'file-tree'}
      <FileTree {presentation} nodes={data.value.nodes ?? []} selected={text('selected')} onSelect={flag('allowSelect') ? path => io?.emit('select', path) : undefined} />
    {:else if kind === 'markdown'}
      <Markdown content={text('text')} />
    {/if}
  </div>
</div>
