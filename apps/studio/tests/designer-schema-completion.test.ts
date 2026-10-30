import { expect, it } from 'vitest';
import Ajv from 'ajv';
import { editPresentation } from '../src/lib/server/designer-agent.js';
import { agentEditSchema, documentCursor, prepareAgentEdit } from '../src/lib/designer/agent-edits.js';
import { newScreen } from '../src/lib/designer/application.js';
const validatePresentation = new Ajv({ allErrors: true }).compile(editPresentation);
const edit = (operation: unknown) => ({ expectedRevision: 'r1', reason: 'Independent schema challenge', operations: [operation] });

it('builder regression for independent IV-C6: provider expression schema rejects the same forbidden fields as authoritative input', () => {
  const invalid = edit({ op: 'bind', nodeId: 'control', prop: 'checked', expression: { type: 'ref', path: 'state.accepted', value: true } });
  expect(agentEditSchema.safeParse(invalid).success).toBe(false);
  expect(validatePresentation(invalid)).toBe(false);
});

it('builder regression for independent IV-C6: provider prop lists reject mixed types accepted by neither canonical list shape', () => {
  const invalid = edit({ op: 'modify', nodeId: 'control', props: { value: ['one', 2] } });
  expect(agentEditSchema.safeParse(invalid).success).toBe(false);
  expect(validatePresentation(invalid)).toBe(false);
});

it('builder regression for independent IV-C6: malformed expression refusal includes a recoverable expected shape', () => {
  const document = newScreen('Schema refusal', 'independent-schema-refusal');
  const cursor = documentCursor(document, 'r1', crypto.randomUUID());
  const result = prepareAgentEdit(document, cursor, edit({ op: 'bind', nodeId: 'control', prop: 'checked', expression: true }), 'schema-challenge');
  expect(result).toMatchObject({ ok: false, code: 'STUDIO_AGENT_INVALID_EDIT', diagnostics: [expect.objectContaining({ operation: 0, path: 'operations.0.expression' })] });
  expect(JSON.stringify(result)).toContain('literal');
  expect(JSON.stringify(result)).toContain('ref');
});

it('keeps valid expression/list branches and rejects the same bounded closed-shape challenges',()=>{
 for(const operation of [
  {op:'bind',nodeId:'control',prop:'checked',expression:{type:'literal',value:false}},
  {op:'bind',nodeId:'control',prop:'checked',expression:{type:'ref',path:'state.accepted'}},
  {op:'modify',nodeId:'control',props:{options:['one','two'],value:[1,2]}},
  {op:'modify',nodeId:'control',props:{value:[]}},
  {op:'connect',nodeId:'control',output:'checkedChange',binding:{setState:{key:'accepted'}}},
 ]){expect(agentEditSchema.safeParse(edit(operation)).success).toBe(true);expect(validatePresentation(edit(operation))).toBe(true);}
 for(const operation of [
  {op:'bind',nodeId:'control',prop:'checked',expression:{type:'literal',value:true,path:'state.accepted'}},
  {op:'bind',nodeId:'control',prop:'checked',expression:{type:'ref',path:''}},
  {op:'modify',nodeId:'control',props:{value:Array(101).fill(1)}},
  {op:'modify',nodeId:'control',props:{value:[{id:'one'}]}},
  {op:'connect',nodeId:'control',output:'checkedChange',binding:{setState:{key:'accepted'},invokeAction:{actionId:'demo.submit'}}},
 ]){expect(agentEditSchema.safeParse(edit(operation)).success).toBe(false);expect(validatePresentation(edit(operation))).toBe(false);}
});
