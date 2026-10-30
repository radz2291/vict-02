import {describe,it,expect} from 'vitest';
import {defineContract} from '@victframework/contracts';
import {createInMemoryAgentControlStores} from '@victframework/runtime';
import {AgentTurnService} from '@victframework/control';
import type {CapabilityDefinition} from '@victframework/sdk';
import {bridgeCapabilityToolToMastra,runWithBridgeTurnScope,type CapabilityBridgeDeps} from '../src/tool-bridge.js';
import {captureInputValidationFeedbackPolicy,inputValidationFeedback,type InputValidationFeedbackPolicy} from '../src/input-validation-feedback.js';
const SECRET='secret-canary-never-model';
const policy:InputValidationFeedbackPolicy={fields:['section','operations','op'],expectedHints:['Choose a supported section.'],format:issues=>({code:'VICT_TOOL_INPUT_INVALID',issues:issues.length?issues.map(issue=>({...issue,expected:'Choose a supported section.'})):[{path:['section'],rule:'invalid_union',expected:'Choose a supported section.'}]})};
function tool(parse:()=>unknown,optIn=true){let invoked=0,intents=0;const input=defineContract({id:'test.feedback-input',revision:'1',descriptiveJsonSchema:{type:'object',properties:{section:{type:'string'}},required:['section'],additionalProperties:false},parse:parse as never});const cap={id:'test.feedback',revision:'1',effect:'read',input,output:defineContract({id:'test.out',revision:'1',parse:value=>({ok:true,value})}),invoke:async()=>{invoked++;return {};}} as CapabilityDefinition;
 const deps={resolveCapability:()=>cap,invoke:async()=>{invoked++;return {};},recordInvocationIntent:async()=>{intents++;throw Error('must not record');},...(optIn?{inputValidationFeedback:()=>policy}:{})} as unknown as CapabilityBridgeDeps;
 const result=bridgeCapabilityToolToMastra({capabilities:[{id:cap.id,revision:cap.revision}]} as never,cap,deps) as {inputSchema:{'~standard':{validate:(value:unknown)=>{issues?:{message:string}[]}}};execute:(value:unknown,ctx:unknown)=>Promise<unknown>};return {result,counts:()=>({invoked,intents})};}
describe('safe pre-invocation validation feedback',()=>{
 it('provides bounded actionable Standard Schema feedback and never invokes rejected calls',async()=>{
  const {result,counts}=tool(()=>({ok:false,issues:[{code:'invalid_union',path:'(root)',message:SECRET,received:SECRET,expected:SECRET}]}));
  const validation=result.inputSchema['~standard'].validate({section:SECRET});const text=JSON.stringify(validation);expect(text).toContain('VICT_TOOL_INPUT_INVALID');expect(text).not.toContain(SECRET);expect(text).not.toContain('toolCallId');
  const outcome=await result.execute({section:SECRET},{toolCallId:'not-an-invocation'});expect(JSON.stringify(outcome)).toContain('VICT_TOOL_INPUT_INVALID');expect(JSON.stringify(outcome)).not.toContain(SECRET);expect(counts()).toEqual({invoked:0,intents:0});
 });
 it('isolates concurrent validation and preserves real post-invocation outcomes after unrelated schema checks',async()=>{
  const stores=createInMemoryAgentControlStores();let serial=0,invoked=0,intents=0;
  const service=new AgentTurnService({stores,clock:()=>++serial,ids:{turnId:()=> 'turn-safe',streamId:()=> 'stream-safe',invocationId:()=>`inv-${++serial}`,approvalId:()=> 'approval',idempotencyKey:()=>`key-${++serial}`,cancelId:()=> 'cancel'}});
  const scope={turnId:'turn-safe',streamId:'stream-safe',actorId:'actor-safe',agentProfileVersion:'profile-safe',threadId:'thread-safe'};
  await stores.turns.createTurnIntent({...scope,activationVersion:undefined,applicationReleaseVersion:undefined,inputSummary:'safe test',status:'intent',createdAt:1,updatedAt:1,terminalAt:undefined,errorCode:undefined,traceId:undefined,victRunId:undefined,mastraRunId:undefined});await stores.turns.startTurn(scope.turnId,2);
  const expected={error:true,message:'Domain supplied outcome',validationErrors:{errors:['domain detail'],fields:{}}};
  const cap={id:'test.feedback',revision:'1',effect:'read',input:defineContract({id:'test.in',revision:'1',descriptiveJsonSchema:{type:'object',properties:{section:{type:'string'}},required:['section']},parse:(value:unknown)=>(value as {section?:string})?.section==='valid'?{ok:true as const,value}:{ok:false as const,issues:[{code:'invalid_union',path:'(root)',message:SECRET}]}}),output:defineContract({id:'test.out',revision:'1',parse:value=>({ok:true as const,value})}),invoke:async()=>expected} as CapabilityDefinition;
  const deps:CapabilityBridgeDeps={resolveCapability:()=>cap,inputValidationFeedback:()=>policy,invoke:async()=>{invoked++;await Promise.resolve();return expected;},recordInvocationIntent:input=>{intents++;return service.recordToolInvocationIntent(input);},claimInvocationRun:command=>stores.invocations.claimInvocationRun(command),settleInvocationRun:command=>stores.invocations.settleInvocationRun(command),settleInvocationPending:command=>stores.invocations.settleInvocationPending(command),reconcileAbandonedRun:command=>stores.invocations.reconcileAbandonedRun(command),requestApproval:input=>service.requestApproval(input),consumeApproval:binding=>service.consumeApproval(binding),updateInvocationStatus:command=>stores.invocations.updateInvocationStatus(command)};
  const wrapped=bridgeCapabilityToolToMastra({capabilities:[{id:cap.id,revision:cap.revision}]} as never,cap,deps) as ReturnType<typeof tool>['result'];
  wrapped.inputSchema['~standard'].validate({section:SECRET}); // Outside execution must not poison later calls.
  const execute=(section:string,id:string)=>runWithBridgeTurnScope(scope,()=>wrapped.execute({section},{toolCallId:id}));
  const [invalid,valid]=await Promise.all([execute(SECRET,'invalid'),execute('valid','valid-1')]);expect(JSON.stringify(invalid)).toContain('VICT_TOOL_INPUT_INVALID');expect(JSON.stringify(invalid)).not.toContain(SECRET);expect(valid).toEqual(expected);expect(invoked).toBe(1);expect(intents).toBe(1);
  expect(await execute('valid','valid-2')).toEqual(expected);expect(invoked).toBe(2);expect(intents).toBe(2);
 });
 it('preserves legacy generic rejection without explicit policy',()=>{const {result}=tool(()=>({ok:false,issues:[{code:'invalid_type',path:'section',message:SECRET}]}),false);expect(result.inputSchema['~standard'].validate({})).toEqual({issues:[{message:'vict-contract-rejected'}]});});
 it('does not read hostile parser getters or echo arbitrary paths/messages/expectations',()=>{
  let getters=0;const issue={code:'invalid_type',path:'section',get message(){getters++;throw Error(SECRET);},get received(){getters++;return SECRET;}};
  const captured=captureInputValidationFeedbackPolicy(policy)!;const text=inputValidationFeedback([issue,{code:SECRET,path:SECRET,message:SECRET}],captured)!;expect(text).not.toContain(SECRET);expect(getters).toBe(0);expect(JSON.parse(text)).toEqual({code:'VICT_TOOL_INPUT_INVALID',issues:[{path:['section'],rule:'invalid_type',expected:'Choose a supported section.'}]});
  const result={get ok(){getters++;throw Error(SECRET);}};const wrapped=tool(()=>result);expect(wrapped.result.inputSchema['~standard'].validate({})).toEqual({issues:[{message:'vict-contract-rejected'}]});expect(getters).toBe(0);
 });
 it('fails closed on throwing/hostile formatters and unapproved hints without echoing',()=>{
  let getters=0;for(const format of [()=>{throw Error(SECRET);},()=>({code:'VICT_TOOL_INPUT_INVALID',issues:[{path:['section'],rule:'invalid_type',expected:SECRET}]}),()=>({code:'VICT_TOOL_INPUT_INVALID',issues:[{path:['section'],rule:'invalid_type',received:SECRET}]}),()=>({get code(){getters++;throw Error(SECRET);},issues:[]})]){
    expect(inputValidationFeedback([{code:'invalid_type',path:'section'}],captureInputValidationFeedbackPolicy({...policy,format}))).toBeUndefined();
  }expect(getters).toBe(0);
 });
 it('limits structured issues, known field paths and predeclared expectations',()=>{
  const text=inputValidationFeedback(Array.from({length:10},()=>({code:'invalid_type',path:'operations.0.op',message:SECRET})),captureInputValidationFeedbackPolicy(policy))!;const result=JSON.parse(text);expect(result.issues).toHaveLength(5);expect(result.issues[0].path).toEqual(['operations',0,'op']);expect(text).not.toContain(SECRET);
 });
});
