import {expect,it} from 'vitest';
import Ajv from 'ajv';
import {applyGraphOperationsV2,emptyGraphV2,parseGraphOperationsV2} from '@victframework/ui-flow-svelte';
import {capturePresentationSchema} from '@victframework/mastra';
import {agentEditSchema} from '../src/lib/designer/agent-edits.js';
import {editPresentation} from '../src/lib/designer/agent-edit-presentation.js';

it('keeps the exposed nested-route example executable under strict tool and graph operation schemas',()=>{
  const operation=editPresentation.$defs.editGraph.examples[0]!;
  const transaction={expectedRevision:'current-source-revision',reason:'Validate exposed generic nested operation',operations:[operation]};
  expect(agentEditSchema.safeParse(transaction).success).toBe(true);
  const validate=new Ajv({allErrors:true}).compile(editPresentation);
  expect(validate(transaction),JSON.stringify(validate.errors)).toBe(true);
  const parsed=parseGraphOperationsV2(operation.changes);
  if(!parsed.ok)throw Error(JSON.stringify(parsed));
  const result=applyGraphOperationsV2({...emptyGraphV2(),revision:operation.expectedGraphRevision},parsed.operations,operation.expectedGraphRevision);
  expect(result.ok,JSON.stringify(result)).toBe(true);
  expect(new TextEncoder().encode(JSON.stringify(editPresentation)).length).toBeLessThanOrEqual(32768);
  expect(()=>capturePresentationSchema(editPresentation,'Nested route metadata')).not.toThrow();
});
