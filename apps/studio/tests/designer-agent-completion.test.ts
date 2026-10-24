import { describe,it,expect } from 'vitest';
import { EditorBridge,insertRecipe } from '@victframework/ui-editor';
import { capturePresentationSchema } from '@victframework/mastra';
import { captureDeliverySafeSnapshot } from '../../../packages/mastra/src/delivery-snapshot.js';
import { newScreen,designerCatalogs } from '../src/lib/designer/application.js';
import { validateAgentStart } from '../src/lib/server/designer-agent.js';
import { screenStore } from '../src/lib/designer/storage.js';
import { applyUiEdit } from '@victframework/ui';
import { screenRecipes } from '../src/lib/designer/recipes.js';
import { documentCursor,prepareAgentEdit,agentContext,agentReadPresentation,agentCoverage } from '../src/lib/designer/agent-edits.js';
const cursorFor = (document:ReturnType<typeof newScreen>) => documentCursor(document,'r1',crypto.randomUUID());
function edit(document:ReturnType<typeof newScreen>,operations:unknown[]) {const cursor=cursorFor(document);return prepareAgentEdit(document,cursor,{expectedRevision:cursor.revision,reason:'Completion fixture',operations},crypto.randomUUID());}
describe('completion round canonical authoring and bounded discovery',()=>{
 it('reads every node at the advertised 500 node boundary without bypassing delivery bounds',()=>{
  const original=newScreen('Large fixture','bounded');const nodes={...original.nodes};
  for(let index=Object.keys(nodes).length;index<500;index++)nodes[`text-${index}`]={kind:'text',id:`text-${index}`,content:{type:'literal',value:'x'.repeat(300)}};
  const root=nodes.screen;if(root.kind!=='element')throw Error('fixture');nodes.screen={...root,children:[...root.children,...Object.keys(nodes).filter(id=>id.startsWith('text-'))]};
  const document={...original,nodes};const cursor=cursorFor(document);
  expect(validateAgentStart({prompt:'Read boundary',document,cursor,history:[]})).toMatchObject({ok:true});
  const overview=agentContext(document,cursor);expect(overview).not.toHaveProperty('document.nodes');
  for(let offset=0;offset<500;offset+=20){const result=agentContext(document,cursor,undefined,{section:'nodes',offset,limit:20});expect(captureDeliverySafeSnapshot(result).ok).toBe(true);}
  expect(JSON.stringify(overview)).toContain('500');
 });
 it('admits exactly 200000 source characters and refuses the next character explicitly',()=>{
  const original=newScreen('Character boundary','character-boundary');const root=original.nodes.screen;if(root.kind!=='element')throw Error('fixture');
  const node={kind:'text' as const,id:'boundary',content:{type:'literal' as const,value:''}};
  const document={...original,nodes:{...original.nodes,boundary:node,screen:{...root,children:[...root.children,node.id]}}};
  node.content.value='x'.repeat(200000-JSON.stringify(document).length);expect(JSON.stringify(document)).toHaveLength(200000);
  expect(validateAgentStart({prompt:'Read boundary',document,cursor:cursorFor(document),history:[]})).toMatchObject({ok:true});
  node.content.value+='x';expect(validateAgentStart({prompt:'Read boundary',document,cursor:cursorFor(document),history:[]})).toMatchObject({ok:false,code:'STUDIO_AGENT_SOURCE_LIMIT'});
 });
 it('admits non-ASCII source at the source character boundary with bounded reads',()=>{
  const original=newScreen('Unicode','unicode');const node={kind:'text' as const,id:'unicode-text',content:{type:'literal' as const,value:String.fromCharCode(0x754c).repeat(50000)}};const root=original.nodes.screen;if(root.kind!=='element')throw Error('fixture');const document={...original,nodes:{...original.nodes,'unicode-text':node,screen:{...root,children:[...root.children,node.id]}}};const cursor=cursorFor(document);expect(validateAgentStart({prompt:'Read unicode',document,cursor,history:[]})).toMatchObject({ok:true});expect(captureDeliverySafeSnapshot(agentContext(document,cursor)).ok).toBe(true);
 });
 it('fits discovery schema and returns recoverable query errors',()=>{
  expect(()=>capturePresentationSchema(agentReadPresentation,'read')).not.toThrow();
  const document=newScreen('Read','read');expect(agentContext(document,cursorFor(document),undefined,{limit:100})).toMatchObject({ok:false,code:'STUDIO_AGENT_READ_QUERY'});
 });
 it('retrieves exact long node source through lossless bounded text pages',()=>{
  const original=newScreen('Text','text');const node={kind:'text' as const,id:'long',content:{type:'literal' as const,value:'x'.repeat(18000)}};const document={...original,nodes:{...original.nodes,long:node}};const cursor=cursorFor(document);
  let offset:number|null=0;let joined='';while(offset!==null){const result=agentContext(document,cursor,undefined,{section:'source',nodeId:'long',offset,limit:20}) as {sourceJson:string;nextOffset:number|null};joined+=result.sourceJson;offset=result.nextOffset;expect(captureDeliverySafeSnapshot(result).ok).toBe(true);}expect(JSON.parse(joined)).toEqual(node);
 });
 it('seeds independent manual/agent input and boolean control state',()=>{
  const document=newScreen('Fields','fields');const result=edit(document,[{op:'add',recipe:'input',nodeId:'email',parentId:'screen'},{op:'add',recipe:'input',nodeId:'name',parentId:'screen'},{op:'add',recipe:'switch',nodeId:'news',parentId:'screen'}]);expect(result.ok).toBe(true);if(!result.ok)throw Error(result.message);
  expect(result.document.localState.input_email).toMatchObject({type:'string',initial:''});expect(result.document.localState.input_name).toBeDefined();
  const news=result.document.nodes.news;if(news.kind!=='component'||news.props?.checked?.type!=='ref')throw Error('Independent switch binding missing');
  const newsKey=news.props.checked.path.slice(6);expect(result.document.localState[newsKey]).toMatchObject({type:'boolean'});expect(news.outputs?.checkedChange).toEqual({setState:{key:newsKey}});expect(newsKey).not.toBe('accepted');
  const input=result.document.nodes.email;expect(input.kind==='element'&&input.interactions?.[0]).toMatchObject({on:'change',key:'input_email'});
  const manual=insertRecipe('manual',screenRecipes.find(recipe=>recipe.id==='input')!,document,'email',{nodeId:'screen'});expect(manual.commands).toEqual(result.draft.commands.slice(0,manual.commands.length));
 });
 it('exposes independent scalar state and supported same-batch bindings',()=>{
  const document=newScreen('Wiring','wiring');const result=edit(document,[{op:'declareState',key:'consent',type:'boolean',initial:false},{op:'add',recipe:'checkbox',nodeId:'terms',parentId:'screen'},{op:'bind',nodeId:'terms',prop:'checked',expression:{type:'ref',path:'state.consent'}},{op:'connect',nodeId:'terms',output:'checkedChange',binding:{setState:{key:'consent'}}}]);expect(result.ok).toBe(true);
  expect(edit(document,[{op:'declareState',key:'consent',type:'boolean',initial:'false'}])).toMatchObject({ok:false,code:'STUDIO_AGENT_STATE_TYPE'});
 });
 it('reports field paths and supported properties',()=>{
  const document=newScreen('Invalid','invalid');expect(edit(document,[{op:'bind',nodeId:'screen',prop:'checked',expression:true}])).toMatchObject({ok:false,code:'STUDIO_AGENT_INVALID_EDIT',diagnostics:expect.arrayContaining([expect.objectContaining({path:'operations.0.expression'})])});
  expect(edit(document,[{op:'add',recipe:'select',nodeId:'choose',parentId:'screen'},{op:'bind',nodeId:'choose',prop:'invented',expression:{type:'literal',value:'x'}}])).toMatchObject({ok:false,code:'STUDIO_AGENT_PROPERTY',diagnostics:[expect.objectContaining({operation:1,path:'operations.1.prop'})]});
 });
 it('replaces untouched slot placeholders and reports actual coverage',()=>{
  const document=newScreen('Options','options');const result=edit(document,[{op:'add',recipe:'select',nodeId:'choose',parentId:'screen'},{op:'add',recipe:'select-item',nodeId:'custom',parentId:'choose',slotName:'items',props:{label:'Custom',value:'custom'}}]);expect(result.ok).toBe(true);if(!result.ok)throw Error(result.message);expect(result.document.nodes['choose-items-1']).toBeUndefined();expect(result.document.nodes['choose-items-2']).toBeUndefined();expect(result.document.nodes.choose.kind==='component'&&result.document.nodes.choose.slots?.items.children).toEqual(['custom']);
  expect(agentCoverage(result.document,['select','button']).missing).toEqual(['button']);
 });
 it('wires native input explicitly and refuses new interactive nesting',()=>{
  const original=newScreen('Native','native');const result=edit(original,[{op:'add',recipe:'input',nodeId:'field',parentId:'screen'},{op:'wireInput',nodeId:'field',key:'independent'}]);expect(result.ok).toBe(true);if(!result.ok)throw Error(result.message);expect(result.document.nodes.field.kind==='element'&&result.document.nodes.field.interactions?.[0]).toMatchObject({key:'independent'});
  expect(edit(original,[{op:'add',recipe:'popover',nodeId:'modal',parentId:'screen'},{op:'add',recipe:'button',nodeId:'nested',parentId:'modal',slotName:'trigger'}])).toMatchObject({ok:false,code:'STUDIO_AGENT_INTERACTIVE_SLOT'});
 });
});

it('refuses newly nested interactive wrappers through both agent preparation and the manual bridge',()=>{
 const original=newScreen('Wrapper guard','wrapper-guard');const outer=edit(original,[{op:'add',recipe:'popover',nodeId:'outer',parentId:'screen'}]);if(!outer.ok)throw Error(outer.message);
 for(const recipe of ['popover','alert-dialog','tooltip','dropdown-menu','dialog','accordion','tabs']) {
  expect(edit(outer.document,[{op:'add',recipe,nodeId:'inner',parentId:'outer',slotName:'trigger'}])).toMatchObject({ok:false,code:'STUDIO_AGENT_INTERACTIVE_SLOT'});
  const values=new Map<string,string>();const bridge=new EditorBridge({catalogs:designerCatalogs,store:screenStore({getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)},outer.document.id),initial:{document:outer.document,storedRevision:'r1'}});
  const draft=insertRecipe('manual-inner',screenRecipes.find(item=>item.id===recipe)!,bridge.document,'inner',{nodeId:'outer',slotName:'trigger'});
  expect(bridge.apply(draft)).toMatchObject({ok:false,issues:expect.arrayContaining([expect.objectContaining({code:'UI_EDIT_VALIDATION_FAILED'})])});expect(bridge.document.nodes.inner).toBeUndefined();
 }
});
it('uses existing canonical semantic tag changes for an intentional heading hierarchy',()=>{
 const original=newScreen('Headings','headings');const result=edit(original,[{op:'add',recipe:'heading',nodeId:'section-title',parentId:'screen',headingLevel:3}]);expect(result.ok).toBe(true);if(!result.ok)throw Error(result.message);
 const draft=insertRecipe('manual-heading',screenRecipes.find(item=>item.id==='heading')!,original,'section-title',{nodeId:'screen'});
 const manual=applyUiEdit({document:original,revision:'r1'},{requestId:'manual-heading',expectedDocumentRevision:'r1',commands:[...draft.commands,{op:'setProperty',nodeId:'section-title',property:'tag',value:'h3'}]},designerCatalogs);expect(manual.ok).toBe(true);if(manual.ok)expect(result.document).toEqual(manual.document);
 expect(edit(result.document,[{op:'modify',nodeId:'section-title',headingLevel:2}])).toMatchObject({ok:true,document:{nodes:{'section-title':{tag:'h2'}}}});
 expect(edit(original,[{op:'add',recipe:'text',nodeId:'copy',parentId:'screen',headingLevel:2}])).toMatchObject({ok:false,code:'STUDIO_AGENT_HEADING_TARGET'});
});

it('losslessly pages long state and every non-node source registry without exceeding bridge bounds',()=>{
 const base=newScreen('Complete inspection','complete-inspection');
 const document={...base,localState:{...base.localState,long:{key:'long',type:'string' as const,initial:'x'.repeat(18000)}},
  componentDefinitions:{shared:{id:'shared',revision:'1',root:'definition-root',props:[],slots:{}}},
  nodes:{...base.nodes,'definition-root':{kind:'element' as const,id:'definition-root',tag:'div',children:[]}},
  styleSources:{shared:{id:'shared',declarations:[{property:'color',value:{type:'text' as const,value:'#333333'}}]}},
  tokens:{accent:{id:'accent',value:'#ff0000'}},assets:{logo:{id:'logo',kind:'external' as const,href:'https://example.com/'+ 'x'.repeat(10000)}},
 };
 const cursor=cursorFor(document);expect(validateAgentStart({prompt:'Inspect complete source',document,cursor,history:[]})).toMatchObject({ok:true});
 const reconstruct=(input:Record<string,unknown>)=>{let offset:number|null=0;let text='';while(offset!==null){const result=agentContext(document,cursor,undefined,{...input,offset,limit:20}) as {sourceJson:string;nextOffset:number|null};expect(captureDeliverySafeSnapshot(result).ok).toBe(true);text+=result.sourceJson;offset=result.nextOffset;}return JSON.parse(text);};
 expect(reconstruct({section:'state',stateKey:'long'})).toEqual(document.localState.long);
 for(const registry of ['componentDefinitions','styleSources','tokens','conditions','assets'] as const){const inventory=agentContext(document,cursor,undefined,{section:'registry',registry}) as {items:{key:string}[]};expect(captureDeliverySafeSnapshot(inventory).ok).toBe(true);for(const entry of inventory.items)expect(reconstruct({section:'registry',registry,key:entry.key})).toEqual((document[registry] as Record<string,unknown>)[entry.key]);}
 expect(agentContext(document,cursor,undefined,{section:'registry',registry:'tokens',key:'missing'})).toMatchObject({ok:false,code:'STUDIO_AGENT_REGISTRY_KEY_NOT_FOUND'});
});

it('refuses prototype-named reads as recoverable missing source instead of traversing object prototypes',()=>{
 const document=newScreen('Safe discovery','safe-discovery');const cursor=cursorFor(document);
 for(const key of ['__proto__','constructor','prototype']){
  expect(agentContext(document,cursor,undefined,{section:'source',nodeId:key})).toMatchObject({ok:false,code:'STUDIO_AGENT_NODE_NOT_FOUND'});
  expect(agentContext(document,cursor,undefined,{section:'state',stateKey:key})).toMatchObject({ok:false,code:'STUDIO_AGENT_STATE_NOT_FOUND'});
  expect(agentContext(document,cursor,undefined,{section:'registry',registry:'tokens',key})).toMatchObject({ok:false,code:'STUDIO_AGENT_REGISTRY_KEY_NOT_FOUND'});
 }
});
