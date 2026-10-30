import {expect,it} from 'vitest';
import {emptyGraphV2,applyGraphOperationsV2,parseGraphV2,emptyGraph} from '@victframework/ui-flow-svelte';
import {newScreen} from '../src/lib/designer/application.js';
import {authoredGraphVersion,graphStateDocument,patchAuthoredGraph} from '../src/lib/designer/graph-authoring.js';
import {graphEditShapeValid} from '../src/lib/designer/graph-edit-schema.js';
import {agentEditSchema} from '../src/lib/designer/agent-edits.js';
import type {UiDocument} from '@victframework/ui';

function source():UiDocument{
  const result=applyGraphOperationsV2(emptyGraphV2(),[
    {type:'defineNodeType',definition:{id:'settings',label:'Settings',parameters:{weights:{type:'numberList',default:[20]}},ports:[]}},
    {type:'addNode',nodeType:'settings',id:'one'},
  ]);
  if(!result.ok)throw Error(JSON.stringify(result));
  const document=newScreen('Typed authoring','typed-authoring');
  return {...document,
   nodes:{...document.nodes,workspace:{kind:'component',id:'workspace',definitionId:'vict.flow.workspace',revision:'2',props:{graph:{type:'ref',path:'state.graph'}},outputs:{graphChange:{setState:{key:'graph'}}}}},
   localState:{...document.localState,graph:{key:'graph',type:'string',initial:JSON.stringify(result.graph)}},
  };
}
it('patches typed parameters through exact Studio source persistence and rejects the wrong graph grammar',()=>{
  const original=source(),before=JSON.stringify(original);
  const result=patchAuthoredGraph(original,'workspace',[{type:'setParameter',nodeId:'one',key:'weights',value:[45,55]}],1);
  expect(result.ok).toBe(true);if(!result.ok)throw Error(result.message);
  const parsed=parseGraphV2(String(result.document.localState.graph.initial));
  expect(parsed.ok).toBe(true);if(parsed.ok)expect(parsed.graph.nodes[0]!.values.weights).toEqual([45,55]);
  expect(JSON.stringify(original)).toBe(before);
  expect(patchAuthoredGraph(original,'workspace',[{type:'setField',nodeId:'one',fieldId:'weights',value:45}],1).ok).toBe(false);
  expect(graphStateDocument(original,'graph',JSON.stringify(emptyGraph()))).toBeUndefined();
  const legacy={...original,nodes:{...original.nodes,workspace:{...original.nodes.workspace,revision:undefined}}};
  expect(authoredGraphVersion(legacy.nodes.workspace)).toBe(1);
  expect(graphStateDocument(legacy,'graph',original.localState.graph.initial)).toBeUndefined();
});
it('guards read-only consumers of the same persistent graph state and closed public operation alternatives',()=>{
  const initial=source();
  const original:UiDocument={...initial,nodes:{...initial.nodes,reader:{kind:'component',id:'reader',definitionId:'vict.flow.workspace',revision:'1',props:{graph:{type:'ref',path:'state.graph'},readOnly:{type:'literal',value:true}}}}};
  expect(graphStateDocument(original,'graph',original.localState.graph.initial)).toBeUndefined();
  expect(graphEditShapeValid([{type:'setParameter',nodeId:'one',key:'weights',value:[30]}])).toBe(true);
  expect(graphEditShapeValid([{type:'defineNodeType',definition:{id:'x',label:'X',parameters:{title:{type:'string',default:''}},ports:[]}}])).toBe(true);
  expect(graphEditShapeValid([{type:'setParameter',nodeId:'one',key:'weights',value:[30],surprise:true}])).toBe(false);
  expect(graphEditShapeValid([{type:'setParameter',nodeId:'one',key:'weights',value:[30]},{type:'setField',nodeId:'one',fieldId:'text',value:''}])).toBe(false);
  expect(agentEditSchema.safeParse({expectedRevision:'1',reason:'invalid shape',operations:[{op:'editGraph',nodeId:'workspace',expectedGraphRevision:0,changes:[{type:'addNode',label:'wrong shape'}]}]}).success).toBe(false);
});
