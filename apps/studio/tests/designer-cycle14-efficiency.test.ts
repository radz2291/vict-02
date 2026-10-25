import { expect,it } from 'vitest';
import { captureDeliverySafeSnapshot } from '../../../packages/mastra/src/delivery-snapshot.js';
import { newScreen } from '../src/lib/designer/application.js';
import { agentContext,documentCursor } from '../src/lib/designer/agent-edits.js';
import { createTurnMetrics,createContractKnowledge,createObservationLedger } from '../src/lib/designer/agent-progress.js';
import { screenRecipes } from '../src/lib/designer/recipes.js';
import { createDeterministicOfflineModel,OFFLINE_MODEL_IDENTITY } from '@victframework/mastra';
import { openAgentRun,validateAgentStart,STUDIO_AGENT_PROTOCOL,type StudioAgentEvent } from '../src/lib/server/designer-agent.js';
const source=newScreen('Discovery fixture','cycle14-efficiency');
const cursor=documentCursor(source,'r1',crypto.randomUUID());
const components=[{id:'vict.catalog.tabs',revision:'1'}];
const read=(input:Record<string,unknown>)=>agentContext(source,cursor,undefined,{section:'contracts',components,limit:1,...input});
type Body={id:string;revision:string;digest:string;bodyIdentity:string;contractJson:string;offset:number;totalCharacters:number;nextOffset:number|null;unchanged?:true};

it('losslessly reconstructs stable projected bodies, rejects a projection switch/missing identity/outside offset, and preserves the source',()=>{
 const before=JSON.stringify(source);
 for(const includeExamples of [false,true]){
  const first=read({includeExamples});expect(first.ok).toBe(true);
  const item=(first.items as Body[])[0];expect(item.nextOffset).not.toBeNull();
  const key=`${item.id}@${item.revision}`,expectedBodyIdentities={[key]:item.bodyIdentity};
  expect(read({components:[{id:item.id,revision:item.revision}],includeExamples:!includeExamples,offset:item.nextOffset,expectedBodyIdentities})).toMatchObject({ok:false,code:'STUDIO_AGENT_CONTRACT_BODY_INVALIDATED'});
  expect(read({components:[{id:item.id,revision:item.revision}],includeExamples,offset:item.nextOffset})).toMatchObject({ok:false,code:'STUDIO_AGENT_CONTRACT_BODY_INVALIDATED'});
  expect(read({components:[{id:item.id,revision:item.revision}],includeExamples,offset:item.totalCharacters,expectedBodyIdentities})).toMatchObject({ok:false,code:'STUDIO_AGENT_CONTRACT_BODY_INVALIDATED'});
  let joined=item.contractJson,offset=item.nextOffset;
  while(offset!==null){const result=read({components:[{id:item.id,revision:item.revision}],includeExamples,offset,expectedBodyIdentities});expect(result.ok).toBe(true);expect(captureDeliverySafeSnapshot(result).ok).toBe(true);const body=(result.items as Body[]).find(body=>body.id===item.id)!;expect(body.bodyIdentity).toBe(item.bodyIdentity);joined+=body.contractJson;offset=body.nextOffset;}
  const contract=JSON.parse(joined);expect(contract.descriptor.id).toBe(item.id);expect(contract.preparation).toHaveProperty('hostRequirements');
  if(includeExamples)expect(contract).toHaveProperty('seed');else expect(contract).not.toHaveProperty('seed');
 }
 expect(JSON.stringify(source)).toBe(before);
});

it('never reuses guidance as examples and caches only contiguous complete contract bodies, without accepting inventory/source digests',()=>{
 const first=read({});const item=(first.items as Body[])[0],key=`${item.id}@${item.revision}`;
 const selected=[{id:item.id,revision:item.revision}];
 const knownDigests={[key]:item.digest},knownBodyIdentities={[key]:item.bodyIdentity};
 const examples=read({components:selected,includeExamples:true,knownDigests,knownBodyIdentities});
 expect((examples.items as Body[])[0].unchanged).not.toBe(true);
 const knowledge=createContractKnowledge();
 knowledge.retain({items:[{id:item.id,revision:item.revision,digest:item.digest}]});
 expect(knowledge.reusable(knownDigests)).toEqual({});
 knowledge.retain(first);expect(knowledge.reusable(knownDigests)).toEqual({});
 let offset=item.nextOffset;
 while(offset!==null){const page=read({components:selected,offset,expectedBodyIdentities:knownBodyIdentities});knowledge.retain(page);offset=(page.items as Body[]).find(body=>body.id===item.id)!.nextOffset;}
 expect(knowledge.reusable(knownDigests,knownBodyIdentities)).toEqual(knownDigests);
 expect(knowledge.reusable(knownDigests,{[key]:'wrong-projection'})).toEqual({});
 expect(read({components:selected,knownDigests})).toMatchObject({items:expect.arrayContaining([expect.objectContaining({id:item.id,unchanged:true,bodyIdentity:item.bodyIdentity})])});
 // A forged suffix/terminal page cannot stand in for the omitted beginning.
 const gap=createContractKnowledge();gap.retain({items:[{...item,offset:item.totalCharacters-1,contractJson:'}'}]});expect(gap.reusable(knownDigests)).toEqual({});
});

it('advertises actual seed styles and host obligations before recipe construction without altering defaults',()=>{
 for(const recipeId of ['section','row','text','rhea-field','rhea-card']){
  const recipe=screenRecipes.find(item=>item.id===recipeId);expect(recipe,recipeId).toBeDefined();if(!recipe)throw Error(recipeId);
  const before=JSON.stringify(recipe.create('example'));
  const result=agentContext(source,cursor,undefined,{section:'palette',query:recipeId,limit:20});
  expect(captureDeliverySafeSnapshot(result).ok).toBe(true);
  const item=(result.items as {id:string;preparation:{seedStyles:unknown;patternHostRequirements:string[]}}[]).find(item=>item.id===recipeId)!;
  const root=recipe.create('example')[0];expect(item.preparation.seedStyles).toEqual(root&&'localStyle'in root?root.localStyle??[]:[]);
  expect(item.preparation.patternHostRequirements).toBeInstanceOf(Array);
  expect(JSON.stringify(recipe.create('example'))).toBe(before);
 }
});

it('separates overlapping tool sum/union/outside time and categories, and deduplicates settlements and acknowledged cleanup receipts',()=>{
 let now=0;const metrics=createTurnMetrics(()=>now);
 now=20;metrics.classify('a','knowledge');metrics.start('a','studio_screen_read');metrics.start('a','studio_screen_read');
 now=30;metrics.start('b','studio_screen_edit');
 now=50;metrics.finish('a','studio_screen_read',true);metrics.finish('a','studio_screen_read',true);
 now=60;metrics.edit(15,'construction');metrics.edit(15,'construction');metrics.finish('b','studio_screen_edit',true);
 now=80;metrics.start('c','studio_screen_edit');now=90;metrics.edit(5,'cleanup');metrics.finish('c','studio_screen_edit',true);
 now=100;expect(metrics.snapshot()).toMatchObject({elapsedMs:100,toolCalls:3,completedCalls:3,toolElapsedMs:70,toolActiveMs:50,outsideToolMs:50,confirmedEdits:2,firstEditMs:60,acknowledgementMs:20,categories:{knowledge:1,source:0,edit:2,observe:0,other:0}});
 // A live overlapping attempt contributes to active union, not a completed duration.
 metrics.start('d','studio_screen_observe');now=120;expect(metrics.snapshot()).toMatchObject({toolElapsedMs:70,toolActiveMs:70,outsideToolMs:50});
});

it('does not union visual regions across source identities or imply runtime, offscreen or interaction verification',()=>{
 const ledger=createObservationLedger();
 const region={cursor,capturedAt:'2026-10-25T00:00:00.000Z',imageDigest:'a'.repeat(64),image:{width:500,height:300,sourceWidth:500,sourceHeight:5000,offsetLeft:0,offsetTop:2200,cropped:true},viewport:{width:500,height:300,scrollLeft:0,scrollTop:2200,devicePixelRatio:1},preview:{mode:'design' as const,fingerprint:'b'.repeat(64)}};
 ledger.record(region);expect(ledger.snapshot(cursor)).toMatchObject({currentSourceObservations:1,interactionsVerified:false,regions:[{image:{offsetTop:2200},currentSource:true}]});
 expect(ledger.snapshot({...cursor,revision:'r1#1'}).currentSourceObservations).toBe(0);
 expect(ledger.snapshot({...cursor,epoch:crypto.randomUUID()}).currentSourceObservations).toBe(0);
 expect(ledger.snapshot(cursor).scope).toContain('does not establish current runtime');
});

it('enforces completed knowledge and delivers measured progress through the actual pinned executor (offline model, no provider/design quality claim)',async()=>{
 const selected=[{id:'vict.catalog.button',revision:'1'}];
 expect(STUDIO_AGENT_PROTOCOL).toEqual({readCapabilityRevision:'2',readInputRevision:'3',instructionsRevision:'3',profileRevision:'2'});
 const full=agentContext(source,cursor,undefined,{section:'contracts',components:selected,limit:20});
 const body=(full.items as Body[]).find(item=>item.id===selected[0].id)!;
 expect((body as Body&{bodyComplete:boolean}).bodyComplete).toBe(true);
 const knownDigests={[`${body.id}@${body.revision}`]:body.digest};
 const parsed=validateAgentStart({prompt:'Read selected button contract',document:source,cursor,history:[]});if(!parsed.ok)throw Error(parsed.message);
 const input=JSON.stringify({request:parsed.value.prompt,untrusted_history:[],untrusted_screen:agentContext(source,cursor)});
 const model=createDeterministicOfflineModel({script:{[input]:{kind:'tool-chain',calls:[
  {toolName:'studio_screen_read',args:{section:'contracts',components:selected,limit:1}},
  {toolName:'studio_screen_read',args:{section:'contracts',components:selected,limit:20,knownDigests}},
  {toolName:'studio_screen_read',args:{section:'contracts',components:selected,limit:20,knownDigests}},
 ],thenText:'Read completed; no design completion claimed.'}}});
 const events:StudioAgentEvent[]=[],prompts:unknown[]=[];
 const opened=openAgentRun('cycle14-complete-knowledge',parsed.value,event=>events.push(event),{model:OFFLINE_MODEL_IDENTITY,modelFactory:()=>({...model,doStream:async(options:Parameters<typeof model.doStream>[0])=>{prompts.push(options.prompt);return model.doStream(options);}})});
 if(!opened.ok)throw Error(opened.code);await opened.finished;
 const results:Record<string,unknown>[]=[];
 function visit(value:unknown,depth=0):void{if(depth>18)return;if(typeof value==='string'&&/^(?:\{|\[)/.test(value)){try{visit(JSON.parse(value),depth+1);}catch{}return;}if(Array.isArray(value)){value.forEach(item=>visit(item,depth+1));return;}if(value&&typeof value==='object'){if('turnProgress'in value&&'items'in value)results.push(value as Record<string,unknown>);Object.values(value).forEach(item=>visit(item,depth+1));}}
 visit(prompts);
 expect(results.some(result=>(result.items as {bodyComplete?:boolean}[]).some(item=>item.bodyComplete))).toBe(true);
 expect(results.some(result=>(result.items as {unchanged?:boolean}[]).some(item=>item.unchanged))).toBe(true);
 expect(results.every(result=>!!result.turnProgress)).toBe(true);
 expect(results.some(result=>((result.turnProgress as {retainedKnowledge:{complete:unknown[]}}).retainedKnowledge.complete.length>0))).toBe(true);
 expect(events.at(-1)).toMatchObject({type:'done',status:'completed',applied:0,metrics:{toolCalls:3,confirmedEdits:0,categories:{knowledge:3,source:0,edit:0,observe:0}},visualEvidence:{currentSourceObservations:0,regions:[],interactionsVerified:false}});
},120000);
