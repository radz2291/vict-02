import {expect,it} from 'vitest';
import {authoringContractBody,type UiDocument} from '@victframework/ui';
import {authoringContractBundle,authoringIndex} from '../../../packages/ui/src/authoring.js';
import {newScreen,screenApplication} from '../src/lib/designer/application.js';
import {agentEditSchema,documentCursor,prepareAgentEdit} from '../src/lib/designer/agent-edits.js';
import {agentContext,agentReadSchema} from '../src/lib/designer/agent-reads.js';
import {readKnowledgePage,projectComponentContract} from '../src/lib/designer/agent-knowledge-read.js';
import {installedAuthoringRegistry} from '../src/lib/designer/authoring.js';
import {prepareSourceImport} from '../src/lib/designer/source-import.js';
import {graphLexicalOwners} from '../src/lib/designer/graph-authoring.js';

function largeSource():UiDocument {
  const base=newScreen('Large source','large-source');
  const children=Array.from({length:501},(_,i)=>`text-${i}`);
  return {...base,root:'large-root',nodes:{...base.nodes,
    'large-root':{kind:'element',id:'large-root',tag:'main',children},
    ...Object.fromEntries(children.map(id=>[id,{kind:'text',id,content:{type:'literal',value:'x'.repeat(500)}}])),
  }};
}
it('edits and imports valid sources beyond500nodes/200kchars with more than40 operations atomically',async()=>{
  const source=largeSource(),before=JSON.stringify(source),cursor=documentCursor(source,'r1','limit-probe');
  expect(before.length).toBeGreaterThan(200000);expect(Object.keys(source.nodes).length).toBeGreaterThan(500);
  const operations=Array.from({length:51},(_,i)=>({op:'declareState',key:`state-${i}`,type:'boolean',initial:false}));
  const payload={expectedRevision:cursor.revision,reason:'Large valid transaction',operations};
  expect(agentEditSchema.safeParse(payload).success).toBe(true);
  const accepted=prepareAgentEdit(source,cursor,payload,'large-edit');expect(accepted.ok,JSON.stringify(accepted)).toBe(true);
  const invalid=prepareAgentEdit(source,cursor,{...payload,operations:[...operations,{op:'bind',nodeId:'missing',prop:'value',expression:{type:'literal',value:'bad'}}]},'invalid-large-edit');
  expect(invalid.ok).toBe(false);expect(JSON.stringify(source)).toBe(before);
  const imported=await prepareSourceImport(JSON.stringify({application:screenApplication(source),uiDocuments:[{document:source}]}));
  expect(imported.ok,JSON.stringify(imported)).toBe(true);if(imported.ok)expect(imported.document).toEqual(source);
});
it('pages long source past200k without truncation and retains exact source cursor',()=>{
  const base=newScreen('Long declaration','long-declaration');
  const source={...base,localState:{...base.localState,long:{key:'long',type:'string' as const,initial:'x'.repeat(250001)}}},cursor=documentCursor(source,'r1','long');
  let offset:number|null=0,text='';
  while(offset!==null){
    const result=agentContext(source,cursor,undefined,{section:'state',stateKey:'long',offset,limit:20});
    expect(result.expectedRevision).toBe(cursor.revision);expect(result.offset).toBe(text.length);
    text+=result.sourceJson as string;offset=result.nextOffset as number|null;
  }
  expect(JSON.parse(text)).toEqual(source.localState.long);
  expect(agentReadSchema.safeParse({section:'state',stateKey:'long',offset:200001}).success).toBe(true);
  expect(agentReadSchema.safeParse({offset:Number.MAX_SAFE_INTEGER+1}).success).toBe(false);
});
it('admits large literal values, expression trees, scope declarations and style collections while retaining semantic checks',()=>{
  const source=largeSource(),cursor=documentCursor(source,'r1','literal-limits');
  const operations=[
    {op:'declareState',key:'long-list',type:'stringList',initial:Array.from({length:101},()=> 'x'.repeat(4001))},
    {op:'bindText',nodeId:'text-0',expression:{type:'boolean',op:'and',terms:Array.from({length:101},()=>({type:'literal',value:true}))}},
    {op:'defineStyleSource',id:'many-styles',declarations:Array.from({length:21},()=>({property:'color',value:{type:'text',value:'red'}}))},
  ];
  const payload={expectedRevision:cursor.revision,reason:'Content is not a quota',operations};
  expect(agentEditSchema.safeParse(payload).success).toBe(true);
  expect(prepareAgentEdit(source,cursor,payload,'literal-content').ok).toBe(true);
  const bad={...payload,operations:[{op:'bindText',nodeId:'text-0',expression:{type:'boolean',op:'not',terms:[{type:'literal',value:12}]}}]};
  expect(prepareAgentEdit(source,cursor,bad,'invalid-term-type').ok).toBe(false);
  const largeScope={op:'slotScope',nodeId:'workspace',slot:'body',scope:{schema:'vict.ui-slot-scope@1',props:Array.from({length:101},(_,i)=>({name:`p${i}`,type:'string'})),outputs:Array.from({length:101},(_,i)=>({name:`o${i}`,payload:'string'}))}};
  expect(agentEditSchema.safeParse({...payload,operations:[largeScope]}).success).toBe(true);
});
it('reads whole large knowledge bodies through scalar pages and admits oversized singleton legacy bundles',()=>{
  const original=installedAuthoringRegistry.contracts.find(c=>c.descriptor.id==='vict.flow.workspace'&&c.descriptor.revision==='2')!;
  const contract={...original,guidance:['x'.repeat(250001)],digest:'large-fixture-digest'};
  const registry={...installedAuthoringRegistry,contracts:[contract]};
  let result=readKnowledgePage(registry,{kind:'component',key:'vict.flow.workspace@2'}),text='';
  while(true){
    expect(result.ok).toBe(true);if(!('items' in result)||!result.items.length)throw Error('missing page');
    const page=result.items[0]!;if(!('contractJson' in page))throw Error('missing text');
    expect(page.offset).toBe(text.length);text+=page.contractJson;
    if(!('nextCursor' in result)||result.nextCursor===null)break;
    result=readKnowledgePage(registry,{cursor:result.nextCursor});
  }
  expect(JSON.parse(text)).toEqual(projectComponentContract(authoringContractBody(contract)));
  const bundle=authoringContractBundle(registry,{requested:[{id:contract.descriptor.id,revision:'2'}]});
  expect(bundle.items.some(item=>item.id===contract.descriptor.id&&'contract' in item)).toBe(true);
  expect(authoringIndex(registry,{offset:200001}).offset).toBe(200001);
});

it('fully inspects large flat source ownership without traversal quotas and fails closed on cycles',()=>{
  const base=newScreen('Ownership traversal','ownership-traversal'),ids=Array.from({length:16400},(_,i)=>`n${i}`);
  const source:UiDocument={...base,root:'many',nodes:{many:{kind:'element',id:'many',tag:'main',children:ids},...Object.fromEntries(ids.map(id=>[id,{kind:'text',id,content:{type:'literal',value:''}}]))}};
  const owners=graphLexicalOwners(source);expect(owners.complete).toBe(true);expect(owners.get(ids.at(-1)!)).toEqual([{kind:'document'}]);
  const cyclic:UiDocument={...source,nodes:{...source.nodes,many:{kind:'element',id:'many',tag:'main',children:['many']}}};
  const rejected=graphLexicalOwners(cyclic);expect(rejected.complete).toBe(false);expect(rejected.size).toBe(0);
});
