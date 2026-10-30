/** Explicit opt-in real-provider fixture. Never uses browser-saved owner source. */
import { it,expect } from 'vitest';
import { readFileSync,mkdirSync,writeFileSync,appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { screenRecipes } from '../src/lib/designer/recipes.js';
import { EditorBridge } from '@victframework/ui-editor';
import { newScreen,designerCatalogs } from '../src/lib/designer/application.js';
import { documentCursor,prepareAgentEdit,applyAgentProposal,agentCoverage } from '../src/lib/designer/agent-edits.js';
import { validateAgentStart,openAgentRun,acknowledgeAgentEdit,cancelAgentRun,type StudioAgentEvent } from '../src/lib/server/designer-agent.js';
import { refuseVisualCapture } from '../src/lib/server/designer-visual.js';
import { screenStore } from '../src/lib/designer/storage.js';
const live=process.env.STUDIO_AGENT_LIVE==='1';
it.skipIf(!live)('real configured provider reads a large mixed source, recovers from a requested invalid property, and authors independent fields',async()=>{
 const home=process.env.USERPROFILE!;
 // Same explicit existing launcher boundary: credentials stay in this test process.
 const auth=JSON.parse(readFileSync(process.env.STUDIO_AGENT_AUTH_FILE??join(home,'.pi/agent/auth.json'),'utf8'));
 const models=JSON.parse(readFileSync(process.env.STUDIO_AGENT_MODELS_FILE??join(home,'.pi/agent/models.json'),'utf8'));
 if(!process.env.ZAI_API_KEY)process.env.ZAI_API_KEY=auth.zai.key;
 process.env.STUDIO_AGENT_MODEL='zai/glm-5.3-flash';
 if(!process.env.STUDIO_AGENT_BASE_URL)process.env.STUDIO_AGENT_BASE_URL=models.providers['zai-key1'].baseUrl;
 let document=newScreen('Synthetic mixed recovery fixture','live-completion');
 const initialCursor=documentCursor(document,'r1',crypto.randomUUID());
 const recipes=['button','checkbox','switch','dialog','select','slider','toggle','accordion','tabs','progress','popover','separator'];
 const seeded=prepareAgentEdit(document,initialCursor,{expectedRevision:'r1',reason:'Synthetic mixed source',operations:recipes.map((recipe,index)=>({op:'add',recipe,nodeId:`existing-${index}`,parentId:'screen'}))},'seed');
 if(!seeded.ok)throw Error(JSON.stringify(seeded));document=seeded.document;
 const nodes={...document.nodes};const ids:string[]=[];
 for(let index=0;index<200;index++){const id=`retained-${index}`;ids.push(id);nodes[id]={kind:'text',id,content:{type:'literal',value:`Retained synthetic content ${index}`}};}
 const root=nodes.screen;if(root.kind!=='element')throw Error('Fixture root');nodes.screen={...root,children:[...root.children,...ids]};document={...document,nodes};
 const data=new Map<string,string>();const store=screenStore({getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)},document.id);
 const bridge=new EditorBridge({catalogs:designerCatalogs,store,initial:{document,storedRevision:'r1'}});
 const epoch=crypto.randomUUID();const cursor=documentCursor(document,bridge.getSnapshot().revision,epoch);
 const prompt='This is an explicitly authorized recovery test on disposable synthetic source. First read the current overview, then read source node retained-199 to prove targeted reading beyond the old large-screen limit. Then intentionally make exactly one invalid bind operation on existing-0 using prop recoveryProbe and literal true so the real canonical validator gives you an actionable refusal. Correct the mistake and continue without asking permission. Preserve all existing nodes. Add a section with exactly two labeled independently wired text inputs live-email and live-name, and a labeled checkbox live-consent with independent boolean state. Use fresh source IDs and label Email, Name, Consent. Ensure any new declared local state is independent. Read coverage for input and checkbox. Do not claim visual or interaction verification: this fixture has no browser image or human interaction. Finish with a concise factual report of confirmed edits and remaining unverified behavior.';
 const start=validateAgentStart({prompt,document,cursor,history:[]});if(!start.ok)throw Error(start.message);
 const events:StudioAgentEvent[]=[];const owner=`live-completion-${crypto.randomUUID()}`;let runId='';const began=Date.now();
 const directory='../../docs/studio/cycle-1-3/completion-evidence';mkdirSync(directory,{recursive:true});const incremental=join(directory,`authoring-live-${Date.now()}.jsonl`);
 const opened=openAgentRun(owner,start.value,event=>{events.push(event);if(event.type!=='text')appendFileSync(incremental,JSON.stringify(event)+'\n');if(event.type==='started')runId=event.runId;if(event.type==='proposal')acknowledgeAgentEdit(owner,runId,event.proposal.proposalId,applyAgentProposal(bridge,event.proposal,epoch,false));if(event.type==='capture-request')refuseVisualCapture(owner,event.captureId,'STUDIO_CAPTURE_UNAVAILABLE');});if(!opened.ok)throw Error(opened.code);
 const timer=setTimeout(()=>cancelAgentRun(owner,opened.runId,'deadline'),600000);
 try{await opened.finished;}finally{clearTimeout(timer);const directory='../../docs/studio/cycle-1-3/completion-evidence';mkdirSync(directory,{recursive:true});writeFileSync(join(directory,`authoring-real-provider-${Date.now()}.json`),JSON.stringify({kind:'real-provider synthetic canonical acknowledgement harness; no actual browser interaction',model:process.env.STUDIO_AGENT_MODEL,elapsedMs:Date.now()-began,initialNodes:Object.keys(document.nodes).length,finalNodes:Object.keys(bridge.document.nodes).length,events,coverage:agentCoverage(bridge.document,['input','checkbox']),finalStateKeys:Object.keys(bridge.document.localState),finalDocument:bridge.document},null,2));}
 expect(events.some(event=>event.type==='tool-event'&&event.kind==='observation'&&event.details?.includes('retained-199'))).toBe(true);
 expect(events.some(event=>event.type==='tool-event'&&event.kind==='validation-refused'&&event.details?.includes('recoveryProbe'))).toBe(true);
 expect(events.some(event=>event.type==='tool-event'&&event.kind==='committed')).toBe(true);
 expect(events.at(-1)).toMatchObject({type:'done',status:'completed',verification:'source-only',unresolvedTools:[]});
 for(const id of ['live-email','live-name']){const node=bridge.document.nodes[id];expect(node?.kind).toBe('element');if(node?.kind!=='element')throw Error('Missing field');expect(node.attributes?.value).toMatchObject({type:'ref'});expect(node.interactions?.some(interaction=>interaction.on==='change')).toBe(true);}
 expect(bridge.document.nodes['retained-199']).toEqual(document.nodes['retained-199']);
 if(process.env.STUDIO_AGENT_LIVE_ALL==='1') {
  const requested=screenRecipes.map(recipe=>recipe.id);const rounds:unknown[]=[];
  for(let attempt=0;attempt<4 && agentCoverage(bridge.document,requested).missing.length;attempt++) {
   const before=agentCoverage(bridge.document,requested);const beforeNodes=Object.keys(bridge.document.nodes).length;
   const currentCursor=documentCursor(bridge.document,bridge.getSnapshot().revision,epoch);
   const request=`Can you showcase all components you have in one intentional landing page? This is an isolated synthetic all-83-recipe completion test. Continue from CURRENT source; preserve existing meaningful components and independent fields. Existing retained-* synthetic text may be removed to make an intentional layout. Required palette recipes: ${requested.join(', ')}. Source coverage still missing: ${before.missing.join(', ')}. Read discovery as needed, group components into intentional labeled sections, use compatible slots for context-owned parts, replace unchanged seed placeholders when authoring custom content, preserve strict types and use independent fields. Record requested recipe IDs with coverage queries of at most30 IDs. Reuse already present matching components and do not replay committed edits. Never claim actual appearance or interactions were checked: this harness only acknowledges source edits. If a turn limit is reached, report confirmed progress and remaining work truthfully.`;
   const parsed=validateAgentStart({prompt:request,document:bridge.document,cursor:currentCursor,history:[]});if(!parsed.ok)throw Error(parsed.message);
   const roundEvents:StudioAgentEvent[]=[];let roundId='';const roundOwner=`${owner}-all-${attempt}`;const at=Date.now();
   const next=openAgentRun(roundOwner,parsed.value,event=>{roundEvents.push(event);if(event.type!=='text')appendFileSync(incremental,JSON.stringify({attempt,...event})+'\n');if(event.type==='started')roundId=event.runId;if(event.type==='proposal')acknowledgeAgentEdit(roundOwner,roundId,event.proposal.proposalId,applyAgentProposal(bridge,event.proposal,epoch,false));if(event.type==='capture-request')refuseVisualCapture(roundOwner,event.captureId,'STUDIO_CAPTURE_UNAVAILABLE');});if(!next.ok)throw Error(next.code);
   const stop=setTimeout(()=>cancelAgentRun(roundOwner,next.runId,'deadline'),480000);try{await next.finished;}finally{clearTimeout(stop);}
   const after=agentCoverage(bridge.document,requested);rounds.push({attempt,before,after,beforeNodes,afterNodes:Object.keys(bridge.document.nodes).length,elapsedMs:Date.now()-at,events:roundEvents});
   const directory='../../docs/studio/cycle-1-3/completion-evidence';mkdirSync(directory,{recursive:true});writeFileSync(join(directory,`authoring-all83-round-${attempt}-${Date.now()}.json`),JSON.stringify({kind:'real-provider all-83-recipe task with bounded continuation; source receipt harness, no browser interaction or visual proof',model:process.env.STUDIO_AGENT_MODEL,rounds,finalDocument:bridge.document},null,2));
   if(after.missing.length>=before.missing.length && !roundEvents.some(event=>event.type==='tool-event'&&event.kind==='committed'))break;
  }
  expect(agentCoverage(bridge.document,requested).missing).toEqual([]);
 }
 expect(bridge.save().ok).toBe(true);expect(bridge.save().ok).toBe(true);expect(bridge.reopen().ok).toBe(true);expect(bridge.document.nodes['live-email']).toBeDefined();
},process.env.STUDIO_AGENT_LIVE_ALL==='1'?2640000:660000);
