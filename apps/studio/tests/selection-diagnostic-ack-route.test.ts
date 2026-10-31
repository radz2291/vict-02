import {beforeEach,expect,it,vi} from 'vitest';
const acknowledge=vi.hoisted(()=>vi.fn());
vi.mock('../src/lib/server/designer-agent.js',()=>({acknowledgeAgentEdit:acknowledge}));
import {POST} from '../src/routes/api/designer-agent/ack/+server.js';
import {canonicalEditFailure} from '../src/lib/designer/agent-edits.js';
beforeEach(()=>{acknowledge.mockReset();acknowledge.mockReturnValue(true);});
const runId=crypto.randomUUID(),proposalId=crypto.randomUUID();
function request(receipt:unknown,owner:string|null='owner',csrf='nonce',extra:Record<string,unknown>={}){
  return POST({request:new Request('http://localhost/api/designer-agent/ack',{method:'POST',headers:{'content-type':'application/json','x-vict-csrf':csrf},body:JSON.stringify({runId,proposalId,receipt,...extra})}),locals:{session:owner?{sessionId:owner,csrfToken:'nonce',actorLabel:'Owner'}:null}} as never);
}
it('admits a genuine complete canonical diagnostic failure beyond old limits and delegates exact owner/proposal identity',async()=>{
  const leaves=Array.from({length:40},(_,index)=>({code:`CAUSE_${index}`,message:'Cause '+'界'.repeat(1000),nodeId:'source-node',path:'state.'+'p'.repeat(1000),expected:'string',actual:'number',detail:{reference:'r'.repeat(900)}}));
  const receipt=canonicalEditFailure([{code:'UI_EDIT_VALIDATION_FAILED',message:'Compiler envelope',commandIndex:2,diagnostics:leaves}],3);
  const response=await request(receipt);expect(response.status).toBe(200);expect(acknowledge).toHaveBeenCalledWith('owner',runId,proposalId,receipt);expect(receipt.diagnostics).toHaveLength(40);expect(receipt.message.length).toBeGreaterThan(500);
});
it('rejects private/unknown/nested payloads and malformed identities before the authoritative acknowledgement boundary',async()=>{
  const base={ok:false,code:'STUDIO_AGENT_VALIDATION',message:'Public diagnostic',diagnostics:[{code:'PUBLIC',path:'nodes.source',message:'Public',expected:'string',actual:42,supportedProps:['value']}]};
  for(const receipt of [
    {...base,privateReasoning:'private'},
    {...base,diagnostics:[{...base.diagnostics[0],privateReasoning:'private'}]},
    {...base,diagnostics:[{...base.diagnostics[0],actual:{secret:'private'}}]},
    {...base,diagnostics:[{...base.diagnostics[0],supportedProps:['value',{privateReasoning:'private'}]}]},
    {...base,code:'UNDECLARED_CODE'},
  ])expect((await request(receipt)).status).toBe(400);
  expect((await request(base,'owner','nonce',{runId:'invalid'})).status).toBe(400);expect(acknowledge).not.toHaveBeenCalled();
});
it('retains authentication/CSRF and delegated owner/pending proposal refusal semantics without truncating receipts',async()=>{
  const receipt={ok:false,code:'STUDIO_AGENT_VALIDATION',message:'Full '+'界'.repeat(5000),diagnosticsTruncated:true,diagnostics:[{path:'document',message:'Safety-limited cyclic input'}]};
  expect((await request(receipt,null)).status).toBe(401);expect((await request(receipt,'owner','incorrect')).status).toBe(403);expect(acknowledge).not.toHaveBeenCalled();
  acknowledge.mockReturnValue(false);expect((await request(receipt,'foreign-owner')).status).toBe(409);expect(acknowledge).toHaveBeenLastCalledWith('foreign-owner',runId,proposalId,receipt);
  acknowledge.mockReturnValue(true);const success={ok:true,revision:'revision-'+ 'r'.repeat(1000),digest:'digest-'+ 'd'.repeat(1000)};expect((await request(success)).status).toBe(200);expect(acknowledge).toHaveBeenLastCalledWith('owner',runId,proposalId,success);
});
