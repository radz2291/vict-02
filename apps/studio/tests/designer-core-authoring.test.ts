import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { EditorBridge } from '@victframework/ui-editor';
import { canonicalUiDocument } from '@victframework/ui';
import { agentContext,agentCoverage } from '../src/lib/designer/agent-reads.js';
import { documentCursor,prepareAgentEdit,applyAgentProposal,type AgentEdit } from '../src/lib/designer/agent-edits.js';
import { newScreen,designerCatalogs,compileScreen } from '../src/lib/designer/application.js';
import { installedAuthoringRegistry } from '../src/lib/designer/authoring.js';
import { screenPlacementIssues } from '../src/lib/designer/placement.js';
import { screenStore } from '../src/lib/designer/storage.js';
import { studioPreviewHost } from '../src/lib/designer/preview-host.js';

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

describe('precise list-prop admission diagnostics',()=>{
  const insertNav=(props:Record<string,string[]|number[]>)=>({op:'insert' as const,kind:'component' as const,nodeId:'main-nav',parentId:'screen',componentId:'vict.pattern.navigation',revision:'1',props});
  it('identifies the actual unknown icons prop instead of implying all literal lists are unsupported',()=>{
    // Actual responsive-agent trial tried icons on revision1, whose contract
    // declares items/values but not icons. Its generic list refusal hid that fact.
    const bridge=setup(),before=canonicalUiDocument(bridge.document).contentDigest;
    const cursor=documentCursor(bridge.document,bridge.getSnapshot().revision,'list-diagnostic');
    const result=prepareAgentEdit(bridge.document,cursor,{expectedRevision:cursor.revision,reason:'Actual responsive refusal regression',operations:[{op:'theme',role:'accent',value:'#0d9488'},insertNav({icons:['home','folder']})]},'unknown-icons');
    expect(result).toMatchObject({ok:false,code:'STUDIO_AGENT_VALIDATION',diagnostics:[{operation:1,nodeId:'main-nav',prop:'icons',path:'operations.1.props.icons',code:'UI_COMPONENT_PROP_UNKNOWN',expected:'declared property',actual:'stringList',supportedProps:expect.arrayContaining(['items','values'])}]});
    if(result.ok)throw Error('Unknown icons prop admitted');
    expect(result.diagnostics![0].supportedProps).not.toContain('icons');
    expect(canonicalUiDocument(bridge.document).contentDigest).toBe(before);
    expect(result).not.toHaveProperty('document');
  });
  const listTypeCases:{props:Record<string,string[]|number[]>;prop:string;expected:string;actual:string}[]=[{props:{items:[1,2]},prop:'items',expected:'stringList',actual:'numberList'},{props:{label:['one']},prop:'label',expected:'string',actual:'stringList'}];
  it.each(listTypeCases)('reports the declared type for a wrong list at $prop',({props,prop,expected,actual})=>{
    const bridge=setup(),cursor=documentCursor(bridge.document,bridge.getSnapshot().revision,'list-type');
    const result=prepareAgentEdit(bridge.document,cursor,{expectedRevision:cursor.revision,reason:'Wrong declared list type',operations:[insertNav(props)]},'wrong-list');
    expect(result).toMatchObject({ok:false,diagnostics:[{operation:0,nodeId:'main-nav',prop,path:`operations.0.props.${prop}`,code:'UI_COMPONENT_PROP_TYPE',expected,actual}]});
  });
  it('identifies generated state-key collisions and retains valid automatic list state admission/reuse',()=>{
    const bridge=setup(),cursor=documentCursor(bridge.document,bridge.getSnapshot().revision,'list-state');
    const refused=prepareAgentEdit(bridge.document,cursor,{expectedRevision:cursor.revision,reason:'Occupied identity',operations:[{op:'declareState',key:'catalog_main-nav_items',type:'string',initial:'owner value'},insertNav({items:['One']})]},'list-collision');
    expect(refused).toMatchObject({ok:false,diagnostics:[{operation:1,nodeId:'main-nav',prop:'items',path:'operations.1.props.items',code:'UI_STATE_IDENTITY_COLLISION',stateKey:'catalog_main-nav_items',expected:'stringList',actual:'string'}]});
    const accepted=prepareAgentEdit(bridge.document,cursor,{expectedRevision:cursor.revision,reason:'Supported lists',operations:[insertNav({items:['One'],values:['one']})]},'list-positive');
    expect(accepted.ok).toBe(true);if(!accepted.ok)throw Error(JSON.stringify(accepted));
    expect(accepted.document.localState['catalog_main-nav_items']).toMatchObject({type:'stringList',initial:['One']});
    const nextCursor=documentCursor(accepted.document,cursor.revision,'list-state');
    const reused=prepareAgentEdit(accepted.document,nextCursor,{expectedRevision:nextCursor.revision,reason:'Reuse bound list state',operations:[{op:'modify',nodeId:'main-nav',props:{items:['One','Two']}}]},'list-reuse');
    expect(reused.ok).toBe(true);if(!reused.ok)throw Error(JSON.stringify(reused));
    expect(reused.document.localState['catalog_main-nav_items']).toMatchObject({type:'stringList',initial:['One','Two']});
    expect(Object.keys(bridge.document.localState)).not.toContain('catalog_main-nav_items');
  });
});
describe('shared registered authoring integration',()=>{
  it('exposes Studio responsive host facts consistent with the actual Design and Run wrappers',()=>{
    const bridge=setup();
    const overview=agentContext(bridge.document,documentCursor(bridge.document,bridge.getSnapshot().revision,'host-facts'));
    expect(overview.previewHost).toEqual(studioPreviewHost);
    const innerHost=readFileSync(new URL('../../../packages/ui-svelte/src/viewport/ViewportContent.svelte',import.meta.url),'utf8');
    expect(innerHost).toContain('data-application-content');
    expect(innerHost).toContain('style:container-name={containerName || undefined}');
    expect(innerHost).toContain("style:container-type={containerName ? 'inline-size' : undefined}");
    for(const [path,cssImport] of [
      ['../src/lib/designer/Designer.svelte',"import './workspace.css'"],
      ['../src/routes/run-screen/+page.svelte',"import '$lib/designer/workspace.css'"],
    ]){
      const source=readFileSync(new URL(path,import.meta.url),'utf8');
      expect(source).toContain(cssImport);
      expect(source).toMatch(/class="[^\"]*workspace-screen"[^>]*style:max-width=\{width/);
      expect(source).toContain(`<ApplicationViewport containerName="${studioPreviewHost.container.name}"`);
    }
    expect(bridge.document.conditions.compact).toMatchObject({kind:'container',name:studioPreviewHost.container.name});
    expect(studioPreviewHost.mediaQueries).toContain('application iframe viewport');
    expect(studioPreviewHost.portability).toContain('not a portable document guarantee');
  });
  it('reuses and replaces ordered shared styles through the agent, canonical history and persistence',()=>{
    const bridge=setup();
    edit(bridge,[
      {op:'insert',kind:'element',tag:'article',nodeId:'card-a',parentId:'screen'},
      {op:'insert',kind:'element',tag:'article',nodeId:'card-b',parentId:'screen'},
      {op:'declareToken',id:'shared-accent',value:'#334155'},
      {op:'declareState',key:'sharedSpace',type:'string',initial:'12px'},
      {op:'declareCondition',id:'shared-small',kind:'media',query:'(max-width: 600px)'},
      {op:'defineStyleSource',id:'card-base',declarations:[{property:'color',value:{type:'token',id:'shared-accent'}},{property:'padding',value:{type:'binding',expression:{type:'ref',path:'state.sharedSpace'}}}]},
      {op:'attachStyleSource',nodeId:'card-a',sourceId:'card-base'},
      {op:'attachStyleSource',nodeId:'card-b',sourceId:'card-base'},
      {op:'defineStyleSource',id:'card-hover',pseudo:'hover',declarations:[{property:'color',value:{type:'text',value:'#115e59'}}]},
      {op:'defineStyleSource',id:'card-compact',conditionId:'shared-small',declarations:[{property:'padding',value:{type:'text',value:'8px'}}]},
      {op:'attachStyleSource',nodeId:'card-a',sourceId:'card-hover'},
      {op:'attachStyleSource',nodeId:'card-a',sourceId:'card-compact'},
      {op:'attachStyleSource',nodeId:'card-b',sourceId:'card-compact'},
      {op:'attachStyleSource',nodeId:'card-b',sourceId:'card-hover',index:1},
      {op:'style',nodeId:'card-a',property:'color',value:{type:'text',value:'red'}},
    ]);
    expect(bridge.document.nodes['card-a'].styleSources).toEqual(['card-base','card-hover','card-compact']);
    expect(bridge.document.nodes['card-b'].styleSources).toEqual(['card-base','card-hover','card-compact']);
    const compiled=compileScreen(bridge.document);expect(compiled.ok).toBe(true);
    if(!compiled.ok)throw Error('shared source compilation');
    const rules=Object.values(compiled.plan.documentPlans??{}).flatMap(plan=>plan.style.rules);
    expect(rules.filter(rule=>rule.pseudo==='hover')).toHaveLength(2);
    expect(rules.filter(rule=>rule.mediaConditionId==='shared-small')).toHaveLength(2);
    expect(bridge.document.nodes['card-a'].localStyle).toEqual([{property:'color',value:{type:'text',value:'red'}}]);
    const before=canonicalUiDocument(bridge.document).contentDigest;
    edit(bridge,[{op:'defineStyleSource',id:'card-base',replace:true,declarations:[{property:'color',value:{type:'text',value:'#1d4ed8'}}]}]);
    const after=canonicalUiDocument(bridge.document).contentDigest;
    expect(after).not.toBe(before);
    expect(bridge.document.nodes['card-b'].styleSources).toContain('card-base');
    expect(bridge.undo().ok).toBe(true);expect(canonicalUiDocument(bridge.document).contentDigest).toBe(before);
    expect(bridge.redo().ok).toBe(true);expect(canonicalUiDocument(bridge.document).contentDigest).toBe(after);
    expect(bridge.save().ok).toBe(true);expect(bridge.reopen().ok).toBe(true);
    expect(bridge.document.styleSources['card-base'].declarations[0].value).toEqual({type:'text',value:'#1d4ed8'});
    edit(bridge,[{op:'defineStyleSource',id:'card-base',replace:true,declarations:[]}]);
    expect(bridge.document.styleSources['card-base'].declarations).toEqual([]);
    expect(bridge.document.nodes['card-b'].styleSources).toContain('card-base');
    expect(bridge.undo().ok).toBe(true);
    edit(bridge,[{op:'detachStyleSource',nodeId:'card-a',sourceId:'card-base'},{op:'detachStyleSource',nodeId:'card-b',sourceId:'card-base'},{op:'removeStyleSource',id:'card-base'}]);
    expect(bridge.document.styleSources['card-base']).toBeUndefined();
    expect(bridge.document.nodes['card-a'].styleSources).toEqual(['card-hover','card-compact']);
  });
  it('refuses invalid shared style operations atomically with bounded target diagnostics',()=>{
    const bridge=setup();
    edit(bridge,[{op:'defineStyleSource',id:'guarded',declarations:[{property:'color',value:{type:'text',value:'blue'}}]},{op:'attachStyleSource',nodeId:'screen',sourceId:'guarded'}]);
    const cursor=documentCursor(bridge.document,bridge.getSnapshot().revision,'epoch');
    const before=canonicalUiDocument(bridge.document).contentDigest;
    for(const operations of [
      [{op:'removeStyleSource',id:'guarded'}],
      [{op:'attachStyleSource',nodeId:'screen',sourceId:'guarded'}],
      [{op:'defineStyleSource',id:'guarded',declarations:[{property:'color',value:{type:'text',value:'red'}}]}],
      [{op:'attachStyleSource',nodeId:'screen',sourceId:'missing'}],
      [{op:'defineStyleSource',id:'invalid',declarations:[{property:'color',value:{type:'token',id:'missing-token'}}]}],
      [{op:'defineStyleSource',id:'invalid',conditionId:'unknown-condition',declarations:[{property:'color',value:{type:'text',value:'red'}}]},{op:'attachStyleSource',nodeId:'screen',sourceId:'invalid'}],
      [{op:'defineStyleSource',id:'invalid',declarations:[{property:'color',value:{type:'binding',expression:{type:'ref',path:'state.missing'}}}]},{op:'attachStyleSource',nodeId:'screen',sourceId:'invalid'}],
    ]){
      const result=prepareAgentEdit(bridge.document,cursor,{expectedRevision:cursor.revision,reason:'Shared source refusal',operations},crypto.randomUUID());
      expect(result.ok,JSON.stringify(operations)).toBe(false);if(result.ok)throw Error('invalid shared edit admitted');
      expect(result.diagnostics?.length).toBeGreaterThan(0);
      expect(result.diagnostics![0].path).toBeTruthy();
      expect(canonicalUiDocument(bridge.document).contentDigest).toBe(before);
    }
  });
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
  it('unwraps actual canonical validation causes for missing style references without applying any source or history',()=>{
    const bridge=setup();edit(bridge,[{op:'insert',kind:'element',tag:'h1',nodeId:'title',parentId:'screen',text:'Probe title'}]);
    const cursor=documentCursor(bridge.document,bridge.getSnapshot().revision,'epoch');
    const before=canonicalUiDocument(bridge.document).contentDigest;const history=bridge.getSnapshot();
    const refused=prepareAgentEdit(bridge.document,cursor,{expectedRevision:cursor.revision,reason:'Actual invalid style reference',operations:[{op:'style',nodeId:'title',property:'color',value:{type:'binding',expression:{type:'ref',path:'state.__probeMissing'}}}]},'missing-style-state');
    expect(refused).toMatchObject({ok:false,code:'STUDIO_AGENT_VALIDATION',diagnostics:[{operation:0,commandIndex:0,envelopeCode:'UI_EDIT_VALIDATION_FAILED',code:'UI_EXPR_UNKNOWN_REFERENCE',nodeId:'title',property:'color',sourcePath:'nodes.title',path:'state.__probeMissing',message:expect.stringContaining('does not resolve')}]});
    if(refused.ok)throw Error('Invalid style reference admitted');
    // Unknown-reference diagnostics do not supply a type pair; do not invent it.
    expect(refused.diagnostics![0]).not.toHaveProperty('expected');expect(refused.diagnostics![0]).not.toHaveProperty('actual');
    expect(canonicalUiDocument(bridge.document).contentDigest).toBe(before);expect(bridge.getSnapshot()).toEqual(history);
    edit(bridge,[{op:'declareState',key:'knownColor',type:'string',initial:'#334155'},{op:'style',nodeId:'title',property:'color',value:{type:'binding',expression:{type:'ref',path:'state.knownColor'}}}]);
    expect(compileScreen(bridge.document).ok).toBe(true);
    expect(bridge.undo().ok).toBe(true);expect(canonicalUiDocument(bridge.document).contentDigest).toBe(before);
  });
});
