import {describe,it,expect} from 'vitest';
import Ajv from 'ajv';
import {authoringDataContracts} from '@victframework/ui';
import {installedAuthoringRegistry} from '../src/lib/designer/authoring.js';
import {capturePresentationSchema} from '@victframework/mastra';
import {agentReadPresentation,agentReadSchema,agentContext} from '../src/lib/designer/agent-reads.js';
import {newScreen} from '../src/lib/designer/application.js';
import {agentEditSchema,documentCursor} from '../src/lib/designer/agent-edits.js';
import {createContractKnowledge} from '../src/lib/designer/agent-progress.js';
const ajvOptions:NonNullable<ConstructorParameters<typeof Ajv>[0]>&{strict:boolean}={strict:false,allErrors:true};
const presented=new Ajv(ajvOptions).compile(agentReadPresentation);
const valid:unknown[]=[{},...['overview','nodes','source','sources','capabilities','preflight','icons','media','palette','component','state','registry','actions','coverage','families','catalog','contracts','elements'].map(section=>({section})),{section:'registry',registry:'tokens',key:'one',query:''},{section:'elements',tag:'',query:'input'},{section:'nodes',nodeId:'screen',scope:'subtree'},{section:'preflight',edit:null},{section:'contracts',components:[{id:'vict.flow.workspace',revision:'1'}],includeExamples:true,expectedBodyIdentities:{'vict.flow.workspace@1':'body'},knownBodyIdentities:{'':'historically allowed'}}, {section:'overview',offset:200000,limit:20},{section:'registry',registry:'dataContracts',key:'some.contract@1'}];
const invalid:unknown[]=[{section:'palette',components:[{id:'vict.flow.workspace'}]},{section:'nodes',scope:'subtree'},{section:'registry',registry:'tokens',key:'one',query:'nonempty'},{section:'elements',tag:'input',query:'input'},{section:'icons',key:'one',query:'search'},{section:'media',key:'one',query:'search'},{section:'contracts',components:[{id:''}]},{section:'contracts',components:[{id:'valid',revision:''}]},{section:'contracts',components:[{id:'valid',unexpected:true}]},{section:'source',offset:200001,nodeId:'screen'},{section:'palette',query:'x'.repeat(101)},{section:'catalog',tag:'x'.repeat(61)},{section:'contracts',knownDigests:{'':'invalid'}},{section:'contracts',expectedBodyIdentities:{['x'.repeat(271)]:'body'}},{section:'source',nodeId:'x'.repeat(161)},{section:'sources',nodeIds:[]},{section:'actions',limit:21},{section:'overview',unknown:'extra'},{section:'tokens'}];
describe('read presentation and authoritative section contract',()=>{
 it('accepts the same historical defaults and valid section combinations',()=>{for(const input of valid){expect(agentReadSchema.safeParse(input).success,JSON.stringify(input)).toBe(true);expect(presented(input),JSON.stringify(input)+JSON.stringify(presented.errors)).toBe(true);}});
 it('rejects reproduced section and bound mismatches without widening admission',()=>{for(const input of invalid){expect(agentReadSchema.safeParse(input).success,JSON.stringify(input)).toBe(false);expect(presented(input),JSON.stringify(input)).toBe(false);}});
 it('keeps the allowed field inventory closed across every section',()=>{for(const input of valid){if(!input||typeof input!=='object'||!('section' in input))continue;for(const field of ['recipe','nodeId','components','key','query','scope']){if(field in input)continue;const sample={...input,[field]:field==='components'?[{id:'vict.flow.workspace'}]:field==='scope'?'self':'sample'};expect(Boolean(presented(sample)),JSON.stringify(sample)).toBe(agentReadSchema.safeParse(sample).success);}}});
 it('fits the unchanged model-facing presentation bounds',()=>{expect(()=>capturePresentationSchema(agentReadPresentation,'read')).not.toThrow();});
});
const source=newScreen('Partial knowledge','partial-knowledge'),cursor=documentCursor(source,'r1','partial-knowledge-epoch');
const read=(query:Record<string,unknown>)=>agentContext(source,cursor,undefined,{section:'contracts',offset:0,limit:12,...query});
type Body={id:string;revision:string;digest:string;bodyIdentity:string;contractJson:string;offset:number;totalCharacters:number;nextOffset:number|null;bodyComplete:boolean};
describe('independently delivered contract knowledge',()=>{
 it('retains valid pages from a refused mixed bundle but not unresolved identities or unseen suffixes',()=>{
  const result=read({components:[{id:'vict.flow.viewport',revision:'1'},{id:'rhea-textarea'}],includeExamples:true});expect(result.ok).toBe(false);
  const items=result.items as Body[],viewport=items.find(item=>item.id==='vict.flow.viewport')!,workspace=items.find(item=>item.id==='vict.flow.workspace')!;
  expect(viewport.bodyComplete).toBe(true);expect(workspace.nextOffset).not.toBeNull();
  const knowledge=createContractKnowledge();knowledge.retain(result);
  const viewportKey=`${viewport.id}@${viewport.revision}`,workspaceKey=`${workspace.id}@${workspace.revision}`,digests={[viewportKey]:viewport.digest,[workspaceKey]:workspace.digest,'rhea-textarea@1':'not-installed'};
  expect(knowledge.reusable(digests)).toEqual({[viewportKey]:viewport.digest});
  let offset=workspace.nextOffset;
  while(offset!==null){const page=read({components:[{id:workspace.id,revision:workspace.revision}],offset,includeExamples:true,expectedBodyIdentities:{[workspaceKey]:workspace.bodyIdentity}});expect(page.ok).toBe(true);knowledge.retain(page);offset=(page.items as Body[])[0].nextOffset;}
  expect(knowledge.reusable(digests)).toEqual({[viewportKey]:viewport.digest,[workspaceKey]:workspace.digest});expect(knowledge.snapshot().complete.some(item=>item.key==='rhea-textarea@1')).toBe(false);
 });
 it('refuses malformed page ranges and clears invalidated bodies',()=>{
  const knowledge=createContractKnowledge(),body={id:'one',revision:'1',digest:'digest',bodyIdentity:'body',contractJson:'abcd',offset:0,totalCharacters:4};
  knowledge.retain({ok:false,items:[{...body,offset:-1},{...body,offset:1},{id:'missingMetadata',contractJson:'abcd',offset:0,totalCharacters:4}]});expect(knowledge.snapshot().complete).toEqual([]);
  knowledge.retain({ok:false,registryReady:false,items:[body]});expect(knowledge.snapshot().complete).toEqual([]);
  knowledge.retain({ok:false,registryReady:true,items:[body]});expect(knowledge.reusable({'one@1':'digest'})).toEqual({'one@1':'digest'});
  knowledge.retain({ok:false,items:[{id:'one',revision:'1',invalidated:true}]});expect(knowledge.reusable({'one@1':'digest'})).toEqual({});
 });
});

describe('package-owned data-contract registry reads',()=>{
 const registryRead=(query:Record<string,unknown>)=>agentContext(source,cursor,undefined,{section:'registry',registry:'dataContracts',offset:0,limit:12,...query});
 it('lists individually addressable identities and hashes without embedding schemas or templates',()=>{
  expect(installedAuthoringRegistry.ok,JSON.stringify(installedAuthoringRegistry.issues)).toBe(true);
  const installed=authoringDataContracts(installedAuthoringRegistry);expect(installed.length).toBeGreaterThan(0);
  const listed=registryRead({limit:1}),items=listed.items as {key:string;id:string;revision:string;digest:string}[];
  expect(items).toHaveLength(1);expect(items[0]).toEqual({key:`${installed[0].id}@${installed[0].revision}`,id:installed[0].id,revision:installed[0].revision,digest:installed[0].digest});
  expect(items[0]).not.toHaveProperty('schema');expect(items[0]).not.toHaveProperty('examples');
  expect(agentReadSchema.safeParse({section:'registry',registry:'dataContracts',query:installed[0].id}).success).toBe(true);
  expect(presented({section:'registry',registry:'dataContracts',query:installed[0].id})).toBe(true);
 });
 it('reassembles one exact hashed package grammar through bounded lossless text pages',()=>{
  const installed=authoringDataContracts(installedAuthoringRegistry)[0],key=`${installed.id}@${installed.revision}`;
  let offset:number|null=0,joined='',pages=0;
  while(offset!==null){const page=registryRead({key,offset,limit:1}) as {sourceJson:string;nextOffset:number|null;digest:string;bodyIdentity:string;guidance:string};expect(page.sourceJson.length).toBeLessThanOrEqual(300);expect(page.digest).toBe(installed.digest);expect(page.bodyIdentity).toBe(`studio-data-contract-body@1:${installed.digest}`);expect(page.guidance).toContain('without quotes');expect(page.guidance).toContain('do not send offset:null');expect(page.nextOffset===null||Number.isInteger(page.nextOffset)).toBe(true);joined+=page.sourceJson;offset=page.nextOffset;if(++pages>1000)throw Error('Nonterminating data contract pages');}
  const {digest,...data}=installed;expect(JSON.parse(joined)).toEqual(data);
  expect(registryRead({key:'missing.contract@1'})).toMatchObject({ok:false,code:'STUDIO_AGENT_REGISTRY_KEY_NOT_FOUND'});
 });
 it('keeps data grammar payload out of component bodies in both example projections',()=>{
  const contract=installedAuthoringRegistry.contracts.find(item=>item.dataContracts?.length);expect(contract).toBeDefined();
  for(const includeExamples of [false,true]){
   const id=contract!.descriptor.id,revision=contract!.descriptor.revision;let offset:number|null=0,joined='',identity='';
   while(offset!==null){const result=read({components:[{id,revision}],includeExamples,offset,...(offset?{expectedBodyIdentities:{[`${id}@${revision}`]:identity}}:{})});expect(result.ok).toBe(true);const item=(result.items as Body[]).find(item=>item.id===id&&item.revision===revision)!;identity=item.bodyIdentity;joined+=item.contractJson;offset=item.nextOffset;}
   const projection=JSON.parse(joined);expect(projection.dataContracts).toHaveLength(contract!.dataContracts!.length);
   for(const ref of projection.dataContracts){expect(ref).toMatchObject({id:expect.any(String),revision:expect.any(String),digest:expect.any(String),registry:'dataContracts',key:`${ref.id}@${ref.revision}`});expect(ref).not.toHaveProperty('schema');expect(ref).not.toHaveProperty('examples');}
  }
 });
});

it('discovers eligible seedless components in palette without inventing recipe identities or app seeds',()=>{
 const result=agentContext(source,cursor,undefined,{section:'palette',query:'vict.flow',offset:0,limit:20});
 const items=result.items as {kind:string;id:string;definitionId?:string;revision?:string;insertion?:{op:string;kind:string;componentId:string;revision:string}}[];
 const workspace=items.find(item=>item.definitionId==='vict.flow.workspace');expect(workspace).toMatchObject({kind:'component',definitionId:'vict.flow.workspace',revision:expect.any(String),insertion:{op:'insert',kind:'component',componentId:'vict.flow.workspace'}});
 expect(items.filter(item=>item.definitionId==='vict.flow.workspace').map(item=>item.revision)).toEqual(expect.arrayContaining(['1','2']));
 expect(workspace).not.toHaveProperty('seed');expect(items.find(item=>item.id==='vict.flow.canvas')).toMatchObject({kind:'recipe'});
 const edit={expectedRevision:'r1',reason:'Exact component insertion',operations:[{op:'insert',kind:'component',nodeId:'workspace',parentId:'screen',componentId:workspace!.definitionId,revision:workspace!.revision}]};
 expect(agentEditSchema.safeParse(edit).success).toBe(true);
 expect(agentEditSchema.safeParse({...edit,operations:[{op:'add',recipe:workspace!.id,nodeId:'workspace',parentId:'screen'}]}).success).toBe(false);
 expect(items.some(item=>item.definitionId==='vict.flow.editor')).toBe(false);
});
