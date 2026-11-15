<script lang="ts">
  import { onMount } from 'svelte';
  import { Conversation, type ConversationActivityDensity, type ConversationMessage } from '@victframework/ui-ai-svelte';
  import { Button, Feedback } from '@victframework/ui-svelte';
  let density = $state<ConversationActivityDensity>('full');
  let completed = $state(false);
  let reviewed = $state('');
  let destination = $state('');
  const messages = $derived<ConversationMessage[]>([
    { id: 'request', role: 'user', text: 'Research the approved topic.' },
    { id: 'turn', role: 'assistant', text: completed ? 'Research is complete.' : '', events: [
      { id: 'research', kind: 'activity', activity: {
        id: 'research-invocation', title: completed ? 'Ran Research' : 'Running Research',
        state: completed ? 'completed' : 'running',
        detail: 'Authorized specialist request.',
        input: { text: 'Approved topic only' },
        result: completed ? { text: 'Permitted result', redacted: true } : undefined,
        stages: [{ id: 'start', title: 'Dispatch receipt', state: completed ? 'completed' : 'running', detail: 'Invocation receipt' }],
      } },
      ...(completed ? [{ id: 'answer', kind: 'text' as const, text: 'Research is complete.' }] : []),
    ] },
  ]);
  onMount(() => {
    const settle = () => { completed = true; };
    window.addEventListener('proof-settle-tool',settle);
    return () => window.removeEventListener('proof-settle-tool',settle);
  });
</script>

<Button label="Summary" onclick={() => density = 'summary'} />
<Button label="Full trace" onclick={() => density = 'full'} />
<div style="height:570px">
  <Conversation {messages} activityDensity={density}>
    {#snippet composer()}{/snippet}
    {#snippet turnAttachment(message)}
      {#if message.id === 'turn'}
        <section aria-label="Memory card"><Feedback message="Saved memory from this turn." /></section>
        <section aria-label="Float card"><Button label="Review standing directive" onclick={() => reviewed = 'Float opened'} /></section>
      {/if}
    {/snippet}
    {#snippet activityAction(_message, activity)}
      {#if activity.id === 'research-invocation'}
        <Button label="Open Research Run" onclick={() => destination = 'Research Run'} />
      {/if}
    {/snippet}
  </Conversation>
</div>
<p role="status">{reviewed} {destination}</p>
<div style="height:200px">
  <Conversation messages={[{id:'legacy',role:'assistant',text:'Existing Conversation text',activity:[
    {id:'legacy-tool',title:'Legacy tool',state:'completed',input:{text:'Legacy retained input'}},
  ]}]}/>
</div>
