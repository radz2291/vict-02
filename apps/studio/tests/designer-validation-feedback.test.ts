import {describe,it,expect} from 'vitest';
import {studioValidationRejection,studioContractValidationIssues,createStudioInputValidationFeedback} from '../src/lib/server/designer-validation-feedback.js';
import {agentReadSchema} from '../src/lib/designer/agent-reads.js';
const secret='secret-parser-canary';
describe('Studio pre-invocation repair feedback',()=>{
 it('resolves trusted referenced read types without echoing parser expected types or values',()=>{
  const result=studioValidationRejection('studio.screen.read',[
   {code:'invalid_type',path:['components'],expected:secret,received:secret},
   {code:'invalid_type',path:['includeExamples'],expected:secret},
   {code:'invalid_type',path:['offset'],expected:secret},
   {code:'invalid_type',path:['components',0,'revision'],expected:secret},
  ] as never);
  expect(result.issues.map(issue=>issue.expected)).toEqual([expect.stringContaining('JSON array'),expect.stringContaining('JSON boolean true or false'),expect.stringContaining('JSON integer number'),expect.stringContaining('JSON string')]);
  expect(JSON.stringify(result)).not.toContain(secret);
 });
 it('keeps strict array, boolean and integer admission unchanged',()=>{
  for(const input of [{section:'contracts',components:'[]'},{section:'contracts',includeExamples:'true'},{section:'registry',registry:'dataContracts',offset:'3600'},{section:'registry',registry:'dataContracts',offset:null}])expect(agentReadSchema.safeParse(input).success).toBe(false);
  expect(agentReadSchema.safeParse({section:'contracts',components:[{id:'vict.flow.workspace',revision:'2'}],includeExamples:true,offset:0}).success).toBe(true);
 });
 it('gives an invalid read union a trusted section discriminant hint without message or value echo',()=>{
  const issues=[{code:'invalid_union',path:[],message:secret,received:secret}] as const;
  const result=studioValidationRejection('studio.screen.read',issues);expect(result.code).toBe('VICT_TOOL_INPUT_INVALID');expect(result.issues[0]?.path).toEqual(['section']);expect(result.issues[0]?.expected).toContain('section: overview|nodes|source');expect(JSON.stringify(result)).not.toContain(secret);
 });
 it('keeps edit operation indexes and known fields while dropping dynamic payload paths',()=>{
  const result=studioValidationRejection('studio.screen.edit',[{code:'invalid_type',path:['operations',0,'scope']},{code:'custom',path:['operations',1,secret]}]);expect(result.issues).toHaveLength(1);expect(result.issues[0]?.path).toEqual(['operations',0,'scope']);expect(result.issues[0]?.expected).toContain('vict.ui-slot-scope@1');expect(JSON.stringify(result)).not.toContain(secret);
 });
 it('uses fixed neutral messages and static capability opt-in only',()=>{
  expect(studioContractValidationIssues([{code:'unrecognized_keys',path:['section'],message:secret} as never])).toEqual([{code:'unknown_field',path:'section',message:'Input does not match its declared contract.'}]);const resolver=createStudioInputValidationFeedback([{id:'studio.screen.read',revision:'5'}]);expect(resolver('unrelated.capability','1')).toBeUndefined();expect(resolver('studio.screen.read','old')).toBeUndefined();expect(resolver('studio.screen.read','5')).toBeDefined();
 });
});
