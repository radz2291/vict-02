<script lang="ts">
  import AgentChat from '../../src/lib/designer/AgentChat.svelte';
  import { newScreen } from '../../src/lib/designer/application.js';
  import { documentCursor } from '../../src/lib/designer/agent-edits.js';
  const document = newScreen('Registration', 'layout-fixture');
  const cursor = documentCursor(document, 'r1#0', crypto.randomUUID());
</script>
<main class="studio-designer">
  <div class="fixture-label">UI layout fixture · simulated stream · no provider or saved-screen access</div>
  <div class="fixture-workspace">
    <AgentChat screenLabel="Registration" selectionLabel="Email" blocked={false} getContext={()=>({ document, cursor })} applyProposal={()=>{throw new Error('This fixture never proposes edits');}}/>
    <div class="fixture-canvas"><span>Canvas area</span></div>
  </div>
</main>
<style>
  :global(body){margin:0;font-family:Inter,system-ui,sans-serif}
  main{height:100dvh;display:flex;flex-direction:column;overflow:hidden}
  .fixture-label{padding:10px 14px;font-size:11px;background:#f7f8fa;border-bottom:1px solid #e0e5ee;color:#6e7c91}
  .fixture-workspace{flex:1;min-height:0;display:flex}
  .fixture-canvas{flex:1;min-width:0;display:grid;place-items:center;background:#f3f5f8;color:#a0a9b8;font-size:12px}
  @media(max-width:760px){.fixture-workspace{flex-direction:column}}
</style>
