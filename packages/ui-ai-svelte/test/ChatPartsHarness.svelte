<script lang="ts">
  import { setContext } from 'svelte';
  import { UI_PORTAL_TARGET, type UiComponentPresentation } from '@victframework/ui-svelte';
  import ExtendedMessage from '../src/authoring/ExtendedMessage.svelte';
  import ExtendedPromptInput from '../src/authoring/ExtendedPromptInput.svelte';
  import Transcript from '../src/authoring/Transcript.svelte';
  let outlet = $state<HTMLDivElement>();
  setContext(UI_PORTAL_TARGET, () => outlet);
  const scope = (occ:string): UiComponentPresentation => ({ scopeClass:'chat-scope', target:name=>({ class:`part-${name}`, style:name==='copy'?'background-color:rgb(10, 20, 30)':name==='attachments'?'border-width:3px':undefined,'data-ui-owner':'chat-a','data-ui-occ':occ,'data-ui-part':name }) });
  const presentation=scope('chat-message');
</script>
{#snippet footer()}<span>Authored composer footer</span>{/snippet}
<section data-ui-owner-root="chat-a"><div bind:this={outlet} data-testid="chat-outlet"></div>
  <ExtendedMessage {presentation} nodeId="message" occurrenceKey="message" props={{role:'assistant',text:'Supplied response',copyEnabled:true}} io={{emit:()=>{}}}/>
  <ExtendedPromptInput presentation={scope('chat-prompt')} nodeId="prompt" occurrenceKey="prompt" props={{data:'{"version":1,"attachments":[{"id":"file","name":"file.txt"}]}',attachEnabled:true,removeAttachmentEnabled:true}} io={{emit:()=>{},slots:{footer}}}/>
  <Transcript presentation={scope('chat-transcript')} nodeId="transcript" occurrenceKey="transcript" props={{title:'Observed conversation',description:'Supplied public data',resetEnabled:true,data:'{"version":1,"messages":[{"id":"reply","role":"assistant","text":"Observed answer","events":[{"id":"call","kind":"activity","activity":{"id":"read","title":"Read source","state":"completed"}},{"id":"answer","kind":"text","text":"Observed answer"}]}]}'}} io={{emit:()=>{},slots:{footer}}}/>
</section>
<section data-ui-owner-root="chat-b"><input aria-label="Other app input"/></section>
