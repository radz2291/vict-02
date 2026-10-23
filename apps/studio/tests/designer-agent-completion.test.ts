import { describe,it,expect } from 'vitest';
import { insertRecipe } from '@victframework/ui-editor';
import { capturePresentationSchema } from '@victframework/mastra';
import { captureDeliverySafeSnapshot } from '../../../packages/mastra/src/delivery-snapshot.js';
import { newScreen } from '../src/lib/designer/application.js';
import { validateAgentStart } from '../src/lib/server/designer-agent.js';
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
  expect(result.document.localState.input_email).toMatchObject({type:'string',initial:''});expect(result.document.localState.input_name).toBeDefined();expect(result.document.localState.field_news).toMatchObject({type:'boolean'});
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
