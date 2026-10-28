import { describe, expect, it } from 'vitest';
import type { UiDocument, UiNode } from '@victframework/ui';
import { capturePresentationSchema } from '@victframework/mastra';
import { captureDeliverySafeSnapshot } from '../../../packages/mastra/src/delivery-snapshot.js';
import { newScreen } from '../src/lib/designer/application.js';
import { documentCursor, prepareAgentEdit } from '../src/lib/designer/agent-edits.js';
import { agentContext, agentReadPresentation } from '../src/lib/designer/agent-reads.js';
import { scopedSourceNodes } from '../src/lib/designer/agent-discovery.js';
import { preflightShapeDiagnostics } from '../src/lib/designer/agent-preflight.js';
import {validateVector} from '@victframework/ui-media-svelte/vectors';
import {agentMediaInventorySnapshot} from '../src/lib/designer/media-assets.js';

function fixture():UiDocument {
  const document=newScreen('Scoped source','scoped');
  const nodes:Record<string,UiNode>={...document.nodes,
    support:{kind:'element',id:'support',tag:'section',attributes:{'aria-label':'Customer support'},children:['message','reply']},
    message:{kind:'text',id:'message',content:{type:'literal',value:'A useful message'}},
    reply:{kind:'element',id:'reply',tag:'input',attributes:{'aria-label':'Write a reply'},children:[]},
    outside:{kind:'element',id:'outside',tag:'section',children:[]},
  };
  const root=nodes.screen;if(root.kind!=='element')throw Error('fixture root');
  nodes.screen={...root,children:[...root.children,'support','outside']};
  return {...document,nodes};
}
const cursor=(document:UiDocument)=>documentCursor(document,'r1#3','fixture-epoch');
const read=(document:UiDocument,input:unknown)=>agentContext(document,cursor(document),undefined,input);
const itemIds=(result:ReturnType<typeof read>)=>(result.items as {id:string}[]).map(node=>node.id);

describe('implementation-linked scoped authoring discovery',()=>{
  it('searches exact host-reported media metadata by document/list time without inventing a load verdict',()=>{
    const document=fixture(),digest='c'.repeat(64),otherDigest='d'.repeat(64);
    const snapshot=agentMediaInventorySnapshot(document.id,[{schema:'vict.media-asset@1',reference:`asset:sha256:${digest}`,digest,name:'pattern.png',mime:'image/png',size:7350,createdAt:'2026-10-27T00:00:00.000Z'},{schema:'vict.media-asset@1',reference:`asset:sha256:${otherDigest}`,digest:otherDigest,name:'clip.mp4',mime:'video/mp4',size:82613,createdAt:'2026-10-27T00:00:00.000Z'}],'2026-10-27T01:00:00.000Z');
    const get=(query:unknown,inventory=snapshot)=>agentContext(document,cursor(document),undefined,query,undefined,inventory);
    expect(get({section:'media',limit:1})).toMatchObject({items:[{name:'pattern.png',mime:'image/png'}],nextOffset:1,inventory:{documentId:document.id,listedAt:snapshot.listedAt,storeTotal:2,truncated:false}});
    expect(get({section:'media',query:'video/mp4'}).items).toMatchObject([{name:'clip.mp4',size:82613}]);
    expect(get({section:'media',key:`asset:sha256:${digest}`})).toMatchObject({asset:{reference:`asset:sha256:${digest}`,mime:'image/png'}});
    expect(get({section:'media'},{...snapshot,documentId:'other-document'})).toMatchObject({ok:false,code:'STUDIO_AGENT_MEDIA_CONTEXT'});
    expect(read(document,{section:'media'})).toMatchObject({ok:false,code:'STUDIO_AGENT_MEDIA_UNAVAILABLE'});
    expect(get({section:'media',key:'missing',query:'png'})).toMatchObject({ok:false,code:'STUDIO_AGENT_READ_QUERY'});
    expect(get({section:'media',key:'missing'})).toMatchObject({ok:false,code:'STUDIO_AGENT_MEDIA_NOT_FOUND'});
  });
  it('delivers a complete valid multi-colour vector grammar and seed through bounded contract pages',()=>{
    const document=fixture();let offset=0,bodyIdentity:string|undefined,json='';
    for(let attempt=0;attempt<20;attempt++){
      const result=read(document,{section:'contracts',components:[{id:'vict.media.vector',revision:'1'}],includeExamples:true,limit:20,offset,...(offset?{expectedBodyIdentities:{'vict.media.vector@1':bodyIdentity}}:{})});
      const item=(result.items as {id:string;contractJson:string;nextOffset:number|null;bodyIdentity:string}[]).find(item=>item.id==='vict.media.vector')!;
      expect(item).toBeTruthy();json+=item.contractJson;bodyIdentity=item.bodyIdentity;if(item.nextOffset===null)break;offset=item.nextOffset;
    }
    const contract=JSON.parse(json),node=contract.seed.nodes[0],graphic=validateVector(JSON.parse(node.props.data.value));
    expect(graphic.nodes.length).toBeGreaterThan(1);expect(JSON.stringify(graphic)).toContain('#ff3d81');
    expect(contract.guidance.join(' ')).toContain('Complete small valid multi-colour example:');expect(contract.guidance.join(' ')).toContain('linearGradient');expect(contract.examples.length).toBeGreaterThan(0);
  });
  it('includes exact managed source references in asset discovery while leaving missing MIME facts explicit',()=>{
    const original=fixture(),digest='b'.repeat(64),document={...original,assets:{'poster.png-abcdef':{id:'poster.png-abcdef',kind:'digest' as const,digest}}};
    const inventory=read(document,{section:'registry',registry:'assets'});
    expect(inventory.items).toMatchObject([{key:'poster.png-abcdef',sourceReference:`asset:sha256:${digest}`,mime:null,availability:'not-checked'}]);
    const exact=read(document,{section:'registry',registry:'assets',key:'poster.png-abcdef'});
    expect(exact.media).toMatchObject({sourceReference:`asset:sha256:${digest}`,mime:null});
    expect(JSON.parse(exact.sourceJson as string)).toEqual(document.assets['poster.png-abcdef']);
  });
  it('honors subtree scoping before paging and search instead of returning the global root',()=>{
    const document=fixture();
    const first=read(document,{section:'nodes',nodeId:'support',limit:2});
    expect(itemIds(first)).toEqual(['support','message']);
    expect(first).toMatchObject({total:3,nextOffset:2,scope:{kind:'subtree',nodeId:'support',expandsComponentDefinitions:false}});
    expect(itemIds(read(document,{section:'nodes',nodeId:'support',offset:2,limit:2}))).toEqual(['reply']);
    expect(itemIds(read(document,{section:'nodes',nodeId:'support',query:'write a reply'}))).toEqual(['reply']);
    expect(itemIds(read(document,{section:'nodes',nodeId:'support',scope:'self'}))).toEqual(['support']);
    expect(itemIds(read(document,{section:'nodes',query:'outside'}))).toContain('outside');
  });
  it('refuses missing or empty scope identities and irrelevant section fields',()=>{
    const document=fixture();
    expect(read(document,{section:'nodes',nodeId:'absent'})).toMatchObject({ok:false,code:'STUDIO_AGENT_NODE_NOT_FOUND'});
    expect(read(document,{section:'nodes',nodeId:'__proto__'})).toMatchObject({ok:false,code:'STUDIO_AGENT_NODE_NOT_FOUND'});
    expect(read(document,{section:'nodes',nodeId:''})).toMatchObject({ok:false,code:'STUDIO_AGENT_READ_QUERY'});
    expect(read(document,{section:'nodes',scope:'self'})).toMatchObject({ok:false,code:'STUDIO_AGENT_READ_QUERY'});
    for(const query of [{section:'source',nodeId:'support',query:'ignored'},{section:'nodes',recipe:'dialog'},{section:'state',nodeId:'support'},{section:'overview',knownDigests:{x:'y'}},{section:'elements',tag:'div',query:'input'}]){
      expect(read(document,query)).toMatchObject({ok:false,code:'STUDIO_AGENT_READ_QUERY'});
    }
  });
  it('includes inactive branches, repeat templates and slot fallback source, without shared definition expansion',()=>{
    const base=fixture();
    const nodes:Record<string,UiNode>={...base.nodes,
      conditional:{kind:'conditional',id:'conditional',branches:[{children:['repeat']}]},
      repeat:{kind:'repeat',id:'repeat',collection:{type:'ref',path:'view.items'},key:{type:'ref',path:'item.id'},itemName:'item',templateRoot:'fallback'},
      fallback:{kind:'slot',id:'fallback',name:'body',fallback:['message','cycle']},
      cycle:{kind:'element',id:'cycle',tag:'div',children:['conditional']},
      local:{kind:'component',id:'local',definitionId:'shared',props:{},slots:{}},
      definitionRoot:{kind:'element',id:'definitionRoot',tag:'div',children:[]},
    };
    const document={...base,nodes,componentDefinitions:{shared:{id:'shared',revision:'1',root:'definitionRoot',props:[],slots:{}}}};
    expect(scopedSourceNodes(document,'conditional','subtree').map(node=>node.id)).toEqual(['conditional','repeat','fallback','message','cycle']);
    expect(scopedSourceNodes(document,'local','subtree').map(node=>node.id)).toEqual(['local']);
  });
  it('searches full literal labels rather than only truncated previews and returns bounded pages',()=>{
    const document=fixture();const text={kind:'text' as const,id:'long-label',content:{type:'literal' as const,value:'x'.repeat(3000)+' searchable ending'}};
    const source={...document,nodes:{...document.nodes,[text.id]:text}};
    const result=read(source,{section:'nodes',query:'searchable ending'});
    expect(itemIds(result)).toEqual(['long-label']);
    expect(captureDeliverySafeSnapshot(result).ok).toBe(true);
    expect(()=>capturePresentationSchema(agentReadPresentation,'read')).not.toThrow();
  });
  it('bundles exact lossless source pages and refuses a missing member instead of partial fallback',()=>{
    const document=fixture();
    const source:UiDocument={...document,nodes:{...document.nodes,message:{kind:'text' as const,id:'message',content:{type:'literal' as const,value:'large'.repeat(2000)}}}};
    const joined:Record<string,string>={support:'',message:''};let offset=0;
    for(let attempt=0;attempt<100;attempt++){
      const result=read(source,{section:'sources',nodeIds:['support','message'],offset,limit:2});
      expect(captureDeliverySafeSnapshot(result).ok).toBe(true);
      const items=result.items as {nodeId:string;sourceJson:string;nextOffset:number|null}[];
      for(const item of items)joined[item.nodeId]+=item.sourceJson;
      const next=items.flatMap(item=>item.nextOffset===null?[]:[item.nextOffset]);
      if(!next.length)break;
      offset=Math.min(...next);
    }
    expect(JSON.parse(joined.support!)).toEqual(source.nodes.support);
    expect(JSON.parse(joined.message!)).toEqual(source.nodes.message);
    expect(read(document,{section:'sources',nodeIds:['support','missing']})).toMatchObject({ok:false,code:'STUDIO_AGENT_NODE_NOT_FOUND',missing:['missing']});
  });
  it('explains native versus component part/state capabilities without pretending ownership is observed success',()=>{
    const document=fixture();
    expect(read(document,{section:'capabilities',nodeId:'reply'})).toMatchObject({kind:'element',presentation:{style:{conditions:true}}});
    expect(read(document,{section:'capabilities',nodeId:'message'})).toMatchObject({kind:'text',presentation:{style:false},text:{operation:'bindText'}});
    const source={...document,nodes:{...document.nodes,menu:{kind:'component' as const,id:'menu',definitionId:'vict.catalog.dropdown-menu',revision:'1',props:{},slots:{}}}};
    const result=read(source,{section:'capabilities',nodeId:'menu'});
    expect(result).toMatchObject({kind:'component',available:true,presentation:{legacyStyle:{conditional:false},partStyle:{partField:'part'}}});
    expect((result.presentation as {declaredParts:string[]}).declaredParts).toContain('content');
    expect(captureDeliverySafeSnapshot(result).ok).toBe(true);
  });
  it('discovers installed icons through semantic aliases and exact versioned metadata without dumping glyphs',()=>{
    const document=fixture();const result=read(document,{section:'icons',query:'drawer'});
    expect(result).toMatchObject({source:'installed-supplied-icon-manifest',items:[{key:'lucide/menu@1.27.0',pack:'lucide',name:'menu',revision:'1.27.0',license:'ISC',provenance:'@lucide/svelte@1.27.0'}]});
    expect(captureDeliverySafeSnapshot(result).ok).toBe(true);
    expect(read(document,{section:'icons',key:'lucide/menu@1.27.0'})).toMatchObject({icon:{pack:'lucide',name:'menu',revision:'1.27.0'}});
    expect(read(document,{section:'icons',key:'lucide/guessed@1.27.0'})).toMatchObject({ok:false,code:'STUDIO_AGENT_ICON_NOT_FOUND'});
    expect(read(document,{section:'icons',key:'lucide/menu@1.27.0',query:'drawer'})).toMatchObject({ok:false,code:'STUDIO_AGENT_READ_QUERY'});
    expect(JSON.stringify(read(document,{}))).not.toContain('lucide/menu@1.27.0');
    expect(JSON.stringify(result)).not.toMatch(/<svg|<path|"path"\s*:/);
  });
  it('pages the whole installed icon manifest with bounded pages while keeping document assets independent',()=>{
    const document=fixture();let offset=0;const keys:string[]=[];let total=0;
    for(let attempt=0;attempt<100;attempt++){
      const result=read(document,{section:'icons',offset,limit:3});
      expect(captureDeliverySafeSnapshot(result).ok).toBe(true);
      const items=result.items as {key:string}[];expect(items.length).toBeLessThanOrEqual(3);keys.push(...items.map(item=>item.key));
      total=result.total as number;if(result.nextOffset===null)break;offset=result.nextOffset as number;
    }
    expect(keys.length).toBe(total);expect(new Set(keys).size).toBe(total);expect(total).toBeGreaterThan(20);
    expect(Object.keys(document.assets)).toHaveLength(0);
    expect(read(document,{section:'icons',query:'image'}).total).toBeGreaterThan(0);
  });
});

describe('side-effect-free canonical preflight',()=>{
  it('retains exact unknown-list-prop details from the shared admission boundary without applying an earlier valid prefix',()=>{
    const document=fixture(),before=JSON.stringify(document);
    const result=read(document,{section:'preflight',edit:{expectedRevision:cursor(document).revision,reason:'Actual responsive list refusal',operations:[
      {op:'insert',kind:'element',nodeId:'prefix',parentId:'support',tag:'p',text:'Must remain unapplied'},
      {op:'insert',kind:'component',nodeId:'main-nav',parentId:'support',componentId:'vict.pattern.navigation',revision:'1',props:{icons:['home']}},
    ]}});
    expect(result).toMatchObject({ok:false,applied:false,code:'STUDIO_AGENT_VALIDATION',diagnostics:[{operation:1,nodeId:'main-nav',prop:'icons',path:'operations.1.props.icons',code:'UI_COMPONENT_PROP_UNKNOWN',expected:'declared property',actual:'stringList',supportedProps:expect.arrayContaining(['items','values'])}]});
    expect(JSON.stringify(document)).toBe(before);expect(result).not.toHaveProperty('draft');
  });
  it('validates a complete batch with the actual edit compiler and exposes no applicable proposal',()=>{
    const document=fixture();const before=JSON.stringify(document);const edit={expectedRevision:cursor(document).revision,reason:'Add two siblings',operations:[
      {op:'insert',kind:'element',nodeId:'one',parentId:'support',tag:'p',text:'One'},
      {op:'insert',kind:'element',nodeId:'two',parentId:'support',tag:'p',text:'Two'},
    ]};
    const result=read(document,{section:'preflight',edit});
    const prepared=prepareAgentEdit(document,cursor(document),edit,'normal-edit');
    expect(prepared.ok).toBe(true);
    expect(result).toMatchObject({ok:true,applied:false,...(prepared.ok?{resultDigest:prepared.digest}:{} )});
    expect(result).not.toHaveProperty('draft');expect(result).not.toHaveProperty('document');expect(result).not.toHaveProperty('proposalId');
    expect(JSON.stringify(document)).toBe(before);
  });
  it('identifies missing insertion fields by operation/node and keeps stale revision refusal authoritative',()=>{
    const document=fixture();const before=JSON.stringify(document);const edit={expectedRevision:cursor(document).revision,reason:'Invalid insert',operations:[{op:'insert',kind:'element',nodeId:'galleryHead',parentId:'support'}]};
    expect(read(document,{section:'preflight',edit})).toMatchObject({ok:false,applied:false,diagnostics:[{operation:0,nodeId:'galleryHead',path:'operations.0.tag'}]});
    expect(read(document,{section:'preflight',edit:{...edit,expectedRevision:'stale'}})).toMatchObject({ok:false,code:'STUDIO_AGENT_REVISION_MISMATCH',applied:false});
    expect(JSON.stringify(document)).toBe(before);
    expect(preflightShapeDiagnostics({operations:[{op:'insert',kind:'component',nodeId:'missing-contract'}]}).map(issue=>issue.path)).toEqual(['operations.0.componentId','operations.0.revision']);
  });
  it('rejects a final invalid operation atomically and does not treat valid prefixes as applied',()=>{
    const document=fixture();const before=JSON.stringify(document);
    expect(read(document,{section:'preflight',edit:{expectedRevision:cursor(document).revision,reason:'Atomic refusal',operations:[{op:'insert',kind:'element',nodeId:'valid-prefix',parentId:'support',tag:'p'},{op:'style',nodeId:'message',property:'color',value:{type:'text',value:'red'},pseudo:'focus'}]}})).toMatchObject({ok:false,applied:false});
    expect(JSON.stringify(document)).toBe(before);expect(document.nodes['valid-prefix']).toBeUndefined();
  });
  it('accepts two complete raw tab pairs in one atomic batch and refuses an unmatched pair',()=>{
    const document=fixture();const before=JSON.stringify(document);
    const insert=(nodeId:string,parentId:string,componentId:string,slotName?:string,props?:Record<string,string>)=>({op:'insert',kind:'component',nodeId,parentId,componentId,revision:'1',...(slotName?{slotName}:{}),...(props?{props}:{})});
    const operations=[insert('gallery','support','vict.catalog.tabs',undefined,{value:'a',label:'Gallery'}),
      insert('tab-a','gallery','vict.catalog.tabs-trigger','tabs',{value:'a',label:'A'}),
      insert('panel-a','gallery','vict.catalog.tabs-panel','panels',{value:'a'}),
      {op:'insert',kind:'text',nodeId:'panel-a-copy',parentId:'panel-a',slotName:'content',text:'Slide A'},
      insert('tab-b','gallery','vict.catalog.tabs-trigger','tabs',{value:'b',label:'B'}),
      insert('panel-b','gallery','vict.catalog.tabs-panel','panels',{value:'b'}),
      {op:'insert',kind:'text',nodeId:'panel-b-copy',parentId:'panel-b',slotName:'content',text:'Slide B'},
    ];
    const edit={expectedRevision:cursor(document).revision,reason:'Paired gallery',operations};
    const verdict=read(document,{section:'preflight',edit});
    expect(verdict,JSON.stringify(verdict)).toMatchObject({ok:true,applied:false});
    expect(read(document,{section:'preflight',edit:{...edit,operations:operations.slice(0,-2)}})).toMatchObject({ok:false,applied:false});
    expect(JSON.stringify(document)).toBe(before);
  });
});
