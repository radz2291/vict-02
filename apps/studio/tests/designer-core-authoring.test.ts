import { describe,it,expect } from 'vitest';
import { EditorBridge } from '@victframework/ui-editor';
import { canonicalUiDocument } from '@victframework/ui';
import { agentContext,agentCoverage } from '../src/lib/designer/agent-reads.js';
import { documentCursor,prepareAgentEdit,applyAgentProposal,type AgentEdit } from '../src/lib/designer/agent-edits.js';
import { newScreen,designerCatalogs,compileScreen } from '../src/lib/designer/application.js';
import { installedAuthoringRegistry } from '../src/lib/designer/authoring.js';
import { screenPlacementIssues } from '../src/lib/designer/placement.js';
import { screenStore } from '../src/lib/designer/storage.js';

function setup(){
  const records=new Map<string,string>();const storage={getItem:(key:string)=>records.get(key)??null,setItem:(key:string,value:string)=>{records.set(key,value);}};
  const document=newScreen('Core authoring','core-integration');
  const bridge=new EditorBridge({catalogs:designerCatalogs,validateDocument:screenPlacementIssues,store:screenStore(storage,document.id),initial:{document,storedRevision:'r1'}});
  return bridge;
}
function edit(bridge:EditorBridge,operations:AgentEdit['operations']){
  const cursor=documentCursor(bridge.document,bridge.getSnapshot().revision,'epoch');
  const request={expectedRevision:cursor.revision,reason:'Core authoring integration',operations};
  const proposalId=crypto.randomUUID();const prepared=prepareAgentEdit(bridge.document,cursor,request,proposalId);
  if(!prepared.ok)throw Error(JSON.stringify(prepared));
  expect(applyAgentProposal(bridge,{proposalId,cursor,edit:request,resultDigest:prepared.digest},'epoch',false).ok).toBe(true);
}
describe('shared registered authoring integration',()=>{
  it('installs exact package registrations, selective contracts and uniform native discovery',()=>{
    expect(installedAuthoringRegistry.issues).toEqual([]);
    const bridge=setup(),cursor=documentCursor(bridge.document,bridge.getSnapshot().revision,'epoch');
    const families=agentContext(bridge.document,cursor,undefined,{section:'families',limit:20});
    expect(JSON.stringify(families)).toContain('general');expect(JSON.stringify(families)).toContain('flow');
    const selected=agentContext(bridge.document,cursor,undefined,{section:'contracts',components:[{id:'vict.ai.message',revision:'1'}],limit:20});
    const items=selected.items as {id:string;revision:string;digest:string;contractJson?:string}[];
    expect(items.some(item=>item.id==='vict.ai.message'&&item.contractJson?.includes('presentation'))).toBe(true);
    const known=Object.fromEntries(items.map(item=>[`${item.id}@${item.revision}`,item.digest]));
    const reused=agentContext(bridge.document,cursor,undefined,{section:'contracts',components:[{id:'vict.ai.message',revision:'1'}],knownDigests:known,limit:20});
    expect((reused.items as {unchanged?:boolean}[]).every(item=>item.unchanged)).toBe(true);
    expect(agentContext(bridge.document,cursor,undefined,{section:'component',recipe:'row'})).toMatchObject({kind:'native-recipe',recipe:'row'});
    expect(agentContext(bridge.document,cursor,undefined,{section:'elements',tag:'h6'})).toMatchObject({element:{tag:'h6'}});
  });
  it('authors typed state, a native text reference and responsive token styling through one history and persistence',()=>{
    const bridge=setup();const before=canonicalUiDocument(bridge.document).contentDigest;
    edit(bridge,[
      {op:'declareState',key:'date',type:'isoDate',initial:'2026-10-24'},
      {op:'declareState',key:'time',type:'isoTime',initial:'09:30'},
      {op:'declareState',key:'tags',type:'stringList',initial:['one','two']},
      {op:'declareState',key:'range',type:'numberList',initial:[25]},
      {op:'declareState',key:'title',type:'string',initial:'Source bound title'},
      {op:'insert',kind:'element',tag:'article',nodeId:'article',parentId:'screen'},
      {op:'insert',kind:'element',tag:'h6',nodeId:'heading-six',parentId:'article',text:'Small heading'},
      {op:'insert',kind:'text',nodeId:'bound-title',parentId:'article',expression:{type:'ref',path:'state.title'}},
      {op:'declareToken',id:'accent',value:'#334155'},
      {op:'declareCondition',id:'core-compact',kind:'media',query:'(max-width: 600px)'},
      {op:'style',nodeId:'article',property:'color',value:{type:'token',id:'accent'}},
      {op:'style',nodeId:'article',property:'padding',value:{type:'text',value:'12px'},conditionId:'core-compact'},
      {op:'insert',kind:'component',componentId:'vict.catalog.date-field',revision:'1',nodeId:'date-control',parentId:'article'},
      {op:'bind',nodeId:'date-control',prop:'value',expression:{type:'ref',path:'state.date'}},
      {op:'connect',nodeId:'date-control',output:'valueChange',binding:{setState:{key:'date'}}},
    ]);
    expect(compileScreen(bridge.document).ok).toBe(true);
    const after=canonicalUiDocument(bridge.document).contentDigest;expect(after).not.toBe(before);
    expect(bridge.undo().ok).toBe(true);expect(canonicalUiDocument(bridge.document).contentDigest).toBe(before);
    expect(bridge.redo().ok).toBe(true);expect(canonicalUiDocument(bridge.document).contentDigest).toBe(after);
    expect(bridge.save().ok).toBe(true);const saved=JSON.parse(JSON.stringify(bridge.document));
    expect(bridge.reopen().ok).toBe(true);expect(bridge.document).toEqual(saved);
    const cursor=documentCursor(bridge.document,bridge.getSnapshot().revision,'epoch');
    expect(prepareAgentEdit(bridge.document,cursor,{expectedRevision:cursor.revision,reason:'Invalid date',operations:[{op:'declareState',key:'invalid',type:'isoDate',initial:'2026-02-30'}]},'bad')).toMatchObject({ok:false,code:'STUDIO_AGENT_STATE_TYPE',diagnostics:[{expected:'isoDate'}]});
    expect(bridge.document).toEqual(saved);
  });
  it('preserves canonical target and expected/actual diagnostics and excludes orphan source from coverage',()=>{
    const bridge=setup();edit(bridge,[{op:'insert',kind:'component',componentId:'vict.catalog.checkbox',revision:'1',nodeId:'check',parentId:'screen'}]);
    const cursor=documentCursor(bridge.document,bridge.getSnapshot().revision,'epoch');
    const refusal=prepareAgentEdit(bridge.document,cursor,{expectedRevision:cursor.revision,reason:'Invalid binding',operations:[{op:'bind',nodeId:'check',prop:'checked',expression:{type:'literal',value:'wrong'}}]},'bad-type');
    expect(refusal).toMatchObject({ok:false,code:'STUDIO_AGENT_VALIDATION'});
    expect(JSON.stringify(refusal)).toContain('check');expect(JSON.stringify(refusal)).toContain('boolean');expect(JSON.stringify(refusal)).toContain('string');
    const orphan={...bridge.document,nodes:{...bridge.document.nodes,orphan:{kind:'component' as const,id:'orphan',definitionId:'vict.ai.message',revision:'1'}}};
    expect(agentCoverage(orphan,['vict.ai.message']).missing).toEqual(['vict.ai.message']);
  });
});
