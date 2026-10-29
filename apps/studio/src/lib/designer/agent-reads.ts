/** Bounded discovery. No read embeds the full document or catalog. */
import {selectionContext,type SelectionSet} from './selection-context.js';
import { z } from 'zod';
import { authoringIndex, authoringContractBundle, authoringDataContracts, type UiDocument, type UiNode } from '@victframework/ui';
import { resolveOccurrence, compositionChildren } from '@victframework/ui-editor';
import { screenRecipes, recipeHostRequirements } from './recipes.js';
import { actionInputs, designerCatalogs, catalogDescriptors, screenActionState } from './application.js';
import { prepareAgentEdit, type AgentCursor } from './agent-edits.js';
import { authoringContract, installedAuthoringRegistry } from './authoring.js';
import { studioPreviewHost } from './preview-host.js';
import { effectiveNodeCapabilities, scopedSourceNodes, sourceNodeSearchText, sourceChildren } from './agent-discovery.js';
import { preflightShapeDiagnostics } from './agent-preflight.js';
import { suppliedIconManifest, searchIconManifest } from '@victframework/ui-media-svelte/manifest';
import {canonicalAssetMediaFacts,MEDIA_SOURCE_GUIDANCE,agentMediaInventorySchema,type AgentMediaInventory} from './media-assets.js';
const registries=['componentDefinitions','styleSources','tokens','conditions','assets','dataContracts'] as const;
const readSections=['overview','nodes','source','sources','capabilities','preflight','icons','media','palette','component','state','registry','actions','coverage','families','catalog','contracts','elements'] as const;
/** Keep the legacy envelope, but refuse fields the selected section would ignore. */
const sectionFields:Record<typeof readSections[number],readonly string[]>={
  overview:[],nodes:['nodeId','scope','query'],source:['nodeId'],sources:['nodeIds'],capabilities:['nodeId'],preflight:['edit'],icons:['query','key'],media:['query','key'],
  palette:['query'],component:['recipe'],state:['stateKey'],registry:['registry','key','query'],actions:[],coverage:['requested'],
  families:['query'],catalog:['query','family','category','tag'],contracts:['components','knownDigests','includeExamples','expectedBodyIdentities','knownBodyIdentities'],elements:['tag','query'],
};
export const agentReadSchema = z.object({
  section: z.enum(readSections).default('overview'),
  offset: z.number().int().min(0).max(200000).default(0),
  limit: z.number().int().min(1).max(20).default(12),
  nodeId: z.string().min(1).max(160).optional(), recipe: z.string().min(1).max(160).optional(),
  scope:z.enum(['self','subtree']).optional(),nodeIds:z.array(z.string().min(1).max(160)).min(1).max(8).optional(),edit:z.unknown().optional(),
  stateKey:z.string().min(1).max(160).optional(),
  registry:z.enum(registries).optional(),key:z.string().min(1).max(500).optional(),
  query: z.string().max(100).optional(), requested: z.array(z.string().max(160)).max(30).optional(),
  family:z.string().max(100).optional(),category:z.string().max(100).optional(),tag:z.string().max(60).optional(),
  components:z.array(z.object({id:z.string().min(1).max(160),revision:z.string().min(1).max(100).optional()}).strict()).min(1).max(12).optional(),
  knownDigests:z.record(z.string().min(1).max(270),z.string().max(100)).refine(value=>Object.keys(value).length<=30,'At most 30 known digests.').optional(),
  includeExamples:z.boolean().optional(),
  expectedBodyIdentities:z.record(z.string().max(270),z.string().max(300)).refine(value=>Object.keys(value).length<=30,'At most 30 body identities.').optional(),
  knownBodyIdentities:z.record(z.string().max(270),z.string().max(300)).refine(value=>Object.keys(value).length<=30,'At most 30 body identities.').optional(),
}).strict().superRefine((query,ctx)=>{
  const allowed=new Set(['section','offset','limit',...sectionFields[query.section]]);
  for(const key of Object.keys(query))if(!allowed.has(key)&&query[key as keyof typeof query]!==undefined)ctx.addIssue({code:'custom',path:[key],message:`${key} is not used by section ${query.section}. Allowed section fields: ${sectionFields[query.section].join(', ')||'none'}.`});
  if(query.section==='nodes'&&query.scope&&!query.nodeId)ctx.addIssue({code:'custom',path:['scope'],message:'scope requires nodeId; omit both to search the full source inventory.'});
  if(query.section==='registry'&&query.key&&query.query)ctx.addIssue({code:'custom',path:['query'],message:'query filters the registry inventory; it cannot be combined with an exact key.'});
  if(query.section==='elements'&&query.tag&&query.query)ctx.addIssue({code:'custom',path:['query'],message:'query filters the element inventory; it cannot be combined with an exact tag.'});
  if(query.section==='icons'&&query.key&&query.query)ctx.addIssue({code:'custom',path:['query'],message:'query searches supplied icons; it cannot be combined with an exact icon key.'});
  if(query.section==='media'&&query.key&&query.query)ctx.addIssue({code:'custom',path:['query'],message:'query searches host-reported media; it cannot be combined with an exact asset reference key.'});
});
/** Provider presentation and admission share the same section field inventory.
 * Required content (for example contracts.components) remains an invocation-level
 * diagnostic; this schema mirrors the existing structural input contract. */
const readFieldPresentation:Record<string,unknown>={
  section:{type:'string',enum:[...readSections],default:'overview'},
  offset:{type:'integer',minimum:0,maximum:200000,default:0},limit:{type:'integer',minimum:1,maximum:20,default:12},
  stateKey:{type:'string',minLength:1,maxLength:160},registry:{type:'string',enum:[...registries]},key:{type:'string',minLength:1,maxLength:500},
  nodeId:{type:'string',minLength:1,maxLength:160},recipe:{type:'string',minLength:1,maxLength:160},query:{type:'string',maxLength:100},requested:{type:'array',maxItems:30,items:{type:'string',maxLength:160}},
  scope:{type:'string',enum:['self','subtree']},nodeIds:{type:'array',minItems:1,maxItems:8,items:{type:'string',minLength:1,maxLength:160}},
  edit:{description:'For section preflight only: the exact studio_screen_edit payload. It is validated without applying or returning an applicable proposal.'},
  family:{type:'string',maxLength:100},category:{type:'string',maxLength:100},tag:{type:'string',maxLength:60},
  components:{type:'array',minItems:1,maxItems:12,items:{type:'object',additionalProperties:false,required:['id'],properties:{id:{type:'string',minLength:1,maxLength:160},revision:{type:'string',minLength:1,maxLength:100}}}},
  knownDigests:{type:'object',maxProperties:30,propertyNames:{type:'string',minLength:1,maxLength:270},additionalProperties:{type:'string',maxLength:100}},
  includeExamples:{type:'boolean'},
  expectedBodyIdentities:{type:'object',maxProperties:30,propertyNames:{type:'string',maxLength:270},additionalProperties:{type:'string',maxLength:300}},
  knownBodyIdentities:{type:'object',maxProperties:30,propertyNames:{type:'string',maxLength:270},additionalProperties:{type:'string',maxLength:300}},
};
const sectionPresentation=readSections.map(section=>({
  type:'object',additionalProperties:false,
  ...(section==='overview'?{}:{required:['section']}),
  properties:Object.fromEntries(['section','offset','limit',...sectionFields[section]].map(field=>[field,field==='section'?{const:section}:{$ref:`#/$defs/${field}`} ])),
  ...(section==='nodes'?{if:{required:['scope']},then:{required:['nodeId']}}:{}),
  ...(['registry','icons','media'].includes(section)?{not:{required:['key','query'],properties:{query:{minLength:1}}}}:{}),
  ...(section==='elements'?{not:{required:['tag','query'],properties:{tag:{minLength:1},query:{minLength:1}}}}:{}),
}));
export const agentReadPresentation={
  type:'object',additionalProperties:false,
  $defs:readFieldPresentation,
  properties:Object.fromEntries(Object.keys(readFieldPresentation).map(field=>[field,{$ref:`#/$defs/${field}`} ])),
  oneOf:sectionPresentation,
};
const truncate = (text: string, max = 1200) => text.length > max ? text.slice(0,max) + '… [truncated; use source pages]' : text;
const recipeDefinitions = new Map(screenRecipes.map(recipe => [recipe.id,recipe.create('example').filter(node => node.kind === 'component').map(node => node.kind === 'component' ? node.definitionId : '')]));
const nativeRecipeSignatures = new Map(screenRecipes.map(recipe => [recipe.id, recipe.create('example').filter((node): node is Extract<UiNode,{kind:'element'}> => node.kind === 'element').map(node => ({tag:node.tag,classes:node.classes ?? []}))]));
/** Describes existing seeds without changing canonical defaults or pretending a recipe is a contract. */
function recipePreparation(recipe:typeof screenRecipes[number]) {
  const nodes=recipe.create('example');
  const root=nodes[0];
  const definitionIds=[...new Set(nodes.flatMap(node=>node.kind==='component'?[node.definitionId]:[]))];
  return {rootKind:root?.kind,seedClasses:root&&'classes' in root?root.classes??[]:[],seedStyles:root&&'localStyle' in root?root.localStyle??[]:[],
    styledNodeCount:nodes.filter(node=>'localStyle' in node&&node.localStyle?.length).length,
    initialStateKeys:Object.keys(recipe.initialState?.('example')??{}),definitionIds,
    hostRequirements:definitionIds.flatMap(id=>authoringContract(id)?.rules?.filter(rule=>rule.kind==='hostRequirement')??[]),patternHostRequirements:recipeHostRequirements(recipe.id),
    guidance:'Seed local styles remain in the authored source and override shared style sources. Review padding, minimum size, background and color before adding; replace/remove explicitly or use generic insert for an unstyled native element. Read component/recipe for full source.'};
}
export const contractBodyIdentity=(digest:string,includeExamples=false)=>`studio-contract-body@2:${includeExamples?'examples':'guidance'}:${digest}`;
export function agentCoverage(document: UiDocument, requested?: readonly string[]) {
  const reachable=new Set<string>();
  const visit=(id:string)=>{if(reachable.has(id))return;reachable.add(id);const node=document.nodes[id];if(!node)return;
    compositionChildren(node).forEach(visit);
    if(node.kind==='component'&&document.componentDefinitions[node.definitionId])visit(document.componentDefinitions[node.definitionId]!.root);
    if(node.kind==='repeat')visit(node.templateRoot);
    if(node.kind==='conditional')node.branches.forEach(branch=>branch.children.forEach(visit));
    if(node.kind==='slot')node.fallback?.forEach(visit);
  };visit(document.root);
  const sourceNodes=[...reachable].flatMap(id=>document.nodes[id]?[document.nodes[id]!]:[]);
  const authoredIds = new Set(sourceNodes.flatMap(node => node.kind === 'component' ? [node.definitionId] : []));
  const availableIds = [...new Set(installedAuthoringRegistry.contracts.filter(item=>['standalone','part'].includes(item.eligibility.kind)).map(item=>item.descriptor.id))];
  const expected = requested ?? availableIds;
  const missing = expected.filter(id => {
    // Global inventory counts exact registered definitions. A Flow starter
    // recipe may also include node/edge examples; those are required only when
    // a caller explicitly requests that recipe, not for canvas presence.
    const definitions = requested ? recipeDefinitions.get(id) ?? (id.startsWith('vict.') ? [id] : [`vict.catalog.${id}`]) : [id];
    if (!definitions.length) {
      const recipe = screenRecipes.find(recipe => recipe.id === id), root = recipe?.create('example')[0];
      const signature = nativeRecipeSignatures.get(id) ?? [];
      return !root || !sourceNodes.some(node => {
        if (node.kind !== root.kind || node.kind !== 'element' || root.kind !== 'element' || node.tag !== root.tag || !(root.classes ?? []).every(name => node.classes?.includes(name))) return false;
        const members: UiNode[] = [], visited = new Set<string>();
        const collect = (key:string) => {if(visited.has(key))return;visited.add(key);const child=document.nodes[key];if(!child)return;members.push(child);compositionChildren(child).forEach(collect);};
        collect(node.id);
        return signature.every(required => members.some(child => child.kind === 'element' && child.tag === required.tag && required.classes.every(name => child.classes?.includes(name))));
      });
    }
    return !definitions.every(definition => authoredIds.has(definition));
  });
  return { available:availableIds.length, authored:expected.length-missing.length, catalogAuthored:availableIds.filter(id => id.startsWith('vict.catalog.')&&authoredIds.has(id)).length,
    registeredAuthored:availableIds.filter(id=>authoredIds.has(id)).length,reachableSourceNodes:sourceNodes.length,
    requested:expected.length, scope:requested ? 'declared-request' : 'registered-component-inventory', missing,
    evidence:'Reachable declared source presence only, including inactive branches/templates. An agent-declared manifest is not proof of the user intent, observed appearance, exercised interaction or completion.' };
}
function nodeSummary(node: UiNode) {
  return { id:node.id,kind:node.kind,...(node.kind === 'element' ? {tag:node.tag} : node.kind === 'component' ? {definitionId:node.definitionId} : {}),
    children:sourceChildren(node).slice(0,20), childCount:sourceChildren(node).length,
    sourcePreview:truncate(JSON.stringify(node),600) };
}
/** Keep all bridge limits intact, including recursive node count, depth and string length. */
function assertBounded<T>(value: T) {
  let count = 0;
  function visit(item: unknown, depth: number): void {
    if (++count > 3000 || depth > 12) throw Error('read-budget');
    if (typeof item === 'string' && item.length > 8000) throw Error('read-budget');
    if (Array.isArray(item)) { if (item.length > 100) throw Error('read-budget'); item.forEach(child => visit(child,depth+1)); }
    else if (item && typeof item === 'object') { const values = Object.values(item); if (values.length > 100) throw Error('read-budget'); values.forEach(child => visit(child,depth+1)); }
  }
  visit(value,0); return value;
}
export interface AgentReadResult {
  ok?: boolean; items?: unknown;
  expectedRevision?: string; cursor?: AgentCursor; section?: string;
  selection?: { occurrence?: string; nodeId: string; repeated: boolean } | null;
  [key:string]: unknown;
}
export function agentContext(document: UiDocument, cursor: AgentCursor, selection?: string, input: unknown = {}, selectedSet?:SelectionSet, mediaInventory?:AgentMediaInventory): AgentReadResult {
  const parsed = agentReadSchema.safeParse(input);
  if (!parsed.success) return { ok:false,code:'STUDIO_AGENT_READ_QUERY',message:'Use section, offset and limit (1–20). source requires nodeId; component requires recipe; stateKey pages a state declaration; registry needs its registry name and optional key.',diagnostics:parsed.error.issues.slice(0,4).map(issue => ({path:issue.path.join('.'),message:issue.message})) };
  const query = parsed.data;
  const base = { expectedRevision:cursor.revision,cursor,section:query.section };
  const page = <T,>(items: T[]) => ({ items:items.slice(query.offset,query.offset+query.limit),total:items.length,offset:query.offset,nextOffset:query.offset+query.limit < items.length ? query.offset+query.limit : null });
  const textPage=(value:unknown)=>{const source=JSON.stringify(value);const length=Math.min(query.limit*300,6000);return {sourceJson:source.slice(query.offset,query.offset+length),totalCharacters:source.length,offset:query.offset,nextOffset:query.offset+length<source.length ? query.offset+length : null};};
  let result: Record<string, unknown>;
  const nodes = Object.values(document.nodes);
  if(query.section==='media'){
    if(!mediaInventory)return {...base,ok:false,code:'STUDIO_AGENT_MEDIA_UNAVAILABLE',message:'The host has not supplied current application media metadata. Reveal the media library and refresh its inventory; no absence or loading conclusion follows.'};
    const checked=agentMediaInventorySchema.safeParse(mediaInventory);
    if(!checked.success||checked.data.documentId!==document.id)return {...base,ok:false,code:'STUDIO_AGENT_MEDIA_CONTEXT',message:'Media metadata is invalid or belongs to another document. Refresh the current application inventory; no other document data was returned.'};
    const inventory=checked.data,metadata={documentId:inventory.documentId,listedAt:inventory.listedAt,scope:'current-application-asset-store',evidence:'Host-reported metadata at listedAt. This is not current byte retrieval, decoded media, playback, caption, or visual-observation proof.',snapshotItems:inventory.items.length,storeTotal:inventory.total,truncated:inventory.truncated};
    if(query.key){const asset=inventory.items.find(item=>item.reference===query.key);if(!asset)return {...base,ok:false,code:'STUDIO_AGENT_MEDIA_NOT_FOUND',inventory:metadata,message:inventory.truncated?'This exact reference is absent from the supplied bounded snapshot; the store inventory is truncated, so absence from the store is not established.':'This exact reference was absent at the host listing time. Refresh after supplying an asset.'};result={...base,inventory:metadata,asset,guidance:MEDIA_SOURCE_GUIDANCE};}
    else{const filtered=inventory.items.filter(asset=>!query.query||`${asset.name} ${asset.mime} ${asset.reference}`.toLowerCase().includes(query.query.toLowerCase()));result={...base,inventory:metadata,...page(filtered),guidance:MEDIA_SOURCE_GUIDANCE};}
  }
  else if(query.section==='icons') {
    const identity=(item:typeof suppliedIconManifest[number])=>`${item.pack}/${item.name}@${item.revision}`;
    if(query.key){
      const item=suppliedIconManifest.find(item=>identity(item)===query.key);
      if(!item)return {...base,ok:false,code:'STUDIO_AGENT_ICON_NOT_FOUND',message:'No installed supplied icon has this exact key. Search icons with query; do not guess icon identities or infer media absence from an empty document asset registry.'};
      result={...base,icon:{key:identity(item),...item},source:'installed-supplied-icon-manifest',guidance:'Use this exact pack/name/revision through the registered icon authoring contract. Custom icon/vector assets are separately declared; this manifest does not enumerate them.'};
    }else{
      const found=searchIconManifest(query.query??'',query.offset,query.limit);
      result={...base,...found,offset:query.offset,totalInstalled:suppliedIconManifest.length,source:'installed-supplied-icon-manifest',items:found.items.map(item=>({key:identity(item),...item})),guidance:'Bounded installed metadata only; exact key selects one icon. Search tags/aliases, then read its registered icon component contract. Document assets and custom icons are separate inventories; an empty assets registry does not mean images or icons are unsupported.'};
    }
  }
  else if(query.section==='families') {
    const groups=new Map<string,{family:string;count:number;authorable:number;categories:string[];packages:string[]}>();
    for(const item of installedAuthoringRegistry.contracts) {
      const group=groups.get(item.family)??{family:item.family,count:0,authorable:0,categories:[],packages:[]};
      group.count++;if(['standalone','part'].includes(item.eligibility.kind))group.authorable++;
      if(!group.categories.includes(item.category))group.categories.push(item.category);
      if(!group.packages.includes(item.packageName))group.packages.push(item.packageName);
      groups.set(item.family,group);
    }
    result={...base,registryDigest:installedAuthoringRegistry.digest,...page([...groups.values()].filter(item=>!query.query||item.family.toLowerCase().includes(query.query.toLowerCase())))};
  } else if(query.section==='catalog') result={...base,...authoringIndex(installedAuthoringRegistry,query)};
  else if(query.section==='contracts') {
    if(!query.components)return {...base,ok:false,code:'STUDIO_AGENT_READ_QUERY',message:'contracts requires selected components:[{id,revision?}]. Discover exact identities with catalog; knownDigests reuses unchanged knowledge.'};
    // An unchanged guidance digest cannot stand in for a body containing examples.
    const knownDigests=Object.fromEntries(Object.entries(query.knownDigests??{}).filter(([key,digest])=>!query.includeExamples||query.knownBodyIdentities?.[key]===contractBodyIdentity(digest,true)));
    const bundle=authoringContractBundle(installedAuthoringRegistry,{requested:query.components,knownDigests:query.offset===0?knownDigests:undefined,maxItems:12,maxBytes:42000});
    const invalidations:unknown[]=[];
    // A continuation pages only named bodies. Automatically expanded dependency
    // bodies may have different lengths and must not share the selected offset.
    const pageItems=query.offset>0?bundle.items.filter(item=>query.components!.some(component=>component.id===item.id&&(!component.revision||component.revision===item.revision))):bundle.items;
    const items=pageItems.map(item=>{
      const key=`${item.id}@${item.revision}`,bodyIdentity=contractBodyIdentity(item.digest,query.includeExamples);
      if('unchanged' in item)return {...item,bodyIdentity};
      if(query.offset>0&&query.expectedBodyIdentities?.[key]!==bodyIdentity){invalidations.push({key,expected:query.expectedBodyIdentities?.[key]??null,actual:bodyIdentity});return {id:item.id,revision:item.revision,digest:item.digest,bodyIdentity,invalidated:true,bodyComplete:false};}
      const {seed,examples,dataContracts,...contract}=item.contract;
      const dataContractRefs=dataContracts?.map(({id,revision,digest})=>({id,revision,digest,registry:'dataContracts',key:`${id}@${revision}`}));
      const publicContract={...contract,...(dataContractRefs?{dataContracts:dataContractRefs}:{})};
      const fullContract=dataContractRefs?{...item.contract,dataContracts:dataContractRefs}:item.contract;
      const preparation={seedStyles:seed?.nodes.filter(node=>'localStyle' in node&&node.localStyle?.length).map(node=>({nodeId:node.id,localStyle:'localStyle' in node?node.localStyle:[]}))??[],hostRequirements:item.contract.rules?.filter(rule=>rule.kind==='hostRequirement')??[],dependencies:item.contract.dependencies??[],seedStylePrecedence:'Local styles override shared style sources; explicitly replace/remove undesired seed declarations before construction.'};
      const projection=query.includeExamples?{...fullContract,preparation}:{...publicContract,exampleCount:examples?.length??0,hasSeed:!!seed,preparation};
      const json=JSON.stringify(projection),length=Math.min(query.limit*300,6000),next=query.offset+length;
      if(query.offset>=json.length&&query.offset>0){invalidations.push({key,reason:'offset-outside-body',totalCharacters:json.length});return {id:item.id,revision:item.revision,digest:item.digest,bodyIdentity,invalidated:true,bodyComplete:false};}
      return {id:item.id,revision:item.revision,digest:item.digest,bodyIdentity,contractJson:json.slice(query.offset,next),totalCharacters:json.length,offset:query.offset,nextOffset:next<json.length?next:null,bodyComplete:query.offset===0&&next>=json.length};
    });
    result={...base,registryReady:installedAuthoringRegistry.ok,ok:bundle.ok&&!invalidations.length,...(invalidations.length?{code:'STUDIO_AGENT_CONTRACT_BODY_INVALIDATED',invalidations,message:'Discard partial text for these identities and restart at offset 0 with the intended includeExamples projection. Continuations require expectedBodyIdentities keyed id@revision.'}:{}),complete:bundle.complete&&items.every(item=>'unchanged' in item||item.bodyComplete),registryDigest:bundle.registryDigest,items,pending:bundle.pending,problems:bundle.problems,...(bundle.budgetCause?{budgetCause:bundle.budgetCause}:{}),
      projection:query.includeExamples?'contract-with-examples':'contract-and-semantic-guidance',
      paging:'Bodies are lossless JSON text pages. Initial bundles include dependency bodies; continuations page only explicitly selected components, one body at its own nextOffset. Send expectedBodyIdentities:{"id@revision":bodyIdentity} with unchanged includeExamples. Changing projection invalidates partial pages. Retain digest/bodyIdentity only after assembling every character from offset 0 to totalCharacters. knownBodyIdentities proves projection when reusing examples; a guidance-only body does not contain examples. Pending/partial dependencies are not complete knowledge. Source facts never use knowledge-cache digests.'};
  } else if(query.section==='elements') {
    const catalog=designerCatalogs.elements;
    result=query.tag?{...base,element:catalog.elements.find(item=>item.tag===query.tag)??null,globalAttributes:catalog.globalAttributes,
      guidance:'Insert a registered native tag; use bindText on an actual text node and bindAttribute for native refs. Leaf elements cannot contain child text. Attributes and interactions still pass canonical validation.'}:{...base,...page(catalog.elements.filter(item=>!query.query||item.tag.includes(query.query)).map(item=>({tag:item.tag,leaf:item.leaf===true}))),guidance:'Read elements with tag for its attributes; native tags are not component descriptors.'};
  } else if (query.section === 'nodes') {
    if(query.nodeId&&!Object.hasOwn(document.nodes,query.nodeId))return {...base,ok:false,code:'STUDIO_AGENT_NODE_NOT_FOUND',message:'nodes nodeId must be an existing source identity; no global fallback was performed.'};
    const scope=query.nodeId?query.scope??'subtree':'document';
    const scoped=scopedSourceNodes(document,query.nodeId,scope);
    result={...base,scope:{kind:scope,nodeId:query.nodeId??null,includesInactiveSource:true,expandsComponentDefinitions:false},...page(scoped.filter(node=>!query.query||sourceNodeSearchText(node).includes(query.query.toLowerCase())).map(nodeSummary))};
  }
  else if(query.section==='capabilities') {
    const node=query.nodeId&&Object.hasOwn(document.nodes,query.nodeId)?document.nodes[query.nodeId]:undefined;
    if(!node)return {...base,ok:false,code:'STUDIO_AGENT_NODE_NOT_FOUND',message:'capabilities requires an existing nodeId.'};
    result={...base,nodeId:node.id,...effectiveNodeCapabilities(node)};
  }
  else if(query.section==='preflight') {
    if(query.edit===undefined)return {...base,ok:false,code:'STUDIO_AGENT_READ_QUERY',message:'preflight requires edit: the complete proposed edit payload, including expectedRevision, reason and operations.'};
    const validation=prepareAgentEdit(document,cursor,query.edit,'preflight-only');
    const shape=!validation.ok&&['STUDIO_AGENT_INVALID_EDIT','STUDIO_AGENT_ELEMENT','STUDIO_AGENT_COMPONENT_NOT_FOUND'].includes(validation.code)?preflightShapeDiagnostics(query.edit):[];
    result=validation.ok?{...base,ok:true,applied:false,resultDigest:validation.digest,commandCount:validation.draft.commands.length,message:'Valid against this exact source cursor. No transaction was applied or reserved; submit the same payload through studio_screen_edit and expect fresh revision validation.'}:{...base,...validation,...(shape.length?{diagnostics:shape}:{}),applied:false};
  }
  else if(query.section==='sources') {
    if(!query.nodeIds)return {...base,ok:false,code:'STUDIO_AGENT_READ_QUERY',message:'sources requires nodeIds (1-8 exact identities). Each item has independent lossless JSON pages; retain the same nodeIds for continuation.'};
    const ids=[...new Set(query.nodeIds)];const missing=ids.filter(id=>!Object.hasOwn(document.nodes,id));
    if(missing.length)return {...base,ok:false,code:'STUDIO_AGENT_NODE_NOT_FOUND',missing,message:'Every bundled source identity must exist; no partial bundle or global fallback was returned.'};
    const length=Math.max(1,Math.floor(Math.min(query.limit*300,6000)/ids.length));
    result={...base,items:ids.map(id=>{const source=JSON.stringify(document.nodes[id]);return {nodeId:id,sourceJson:source.slice(query.offset,query.offset+length),totalCharacters:source.length,offset:query.offset,nextOffset:query.offset+length<source.length?query.offset+length:null};}),paging:'Lossless text pages for each named source at this exact cursor. Completed shorter items remain complete on later shared-offset pages. Stop only when every nextOffset is null.'};
  }
  else if (query.section === 'source') {
    const node = query.nodeId && Object.hasOwn(document.nodes,query.nodeId) ? document.nodes[query.nodeId] : undefined;
    if (!node) return { ...base,ok:false,code:'STUDIO_AGENT_NODE_NOT_FOUND',message:'source requires an existing nodeId from nodes discovery.' };
    const source = JSON.stringify(node);
    // Source is losslessly paged as text so deep/large authored expressions cannot violate delivery snapshots.
    const length = Math.min(query.limit * 300,6000);
    result = { ...base,nodeId:node.id,sourceJson:source.slice(query.offset,query.offset+length),totalCharacters:source.length,offset:query.offset,nextOffset:query.offset+length < source.length ? query.offset+length : null };
  } else if (query.section === 'palette') {
    const recipes=screenRecipes.map(recipe=>({kind:'recipe' as const,id:recipe.id,label:recipe.label,description:recipe.description,...(recipe.placements?{placements:recipe.placements}:{}),preparation:recipePreparation(recipe)}));
    const components=installedAuthoringRegistry.contracts.filter(contract=>!contract.seed&&['standalone','part'].includes(contract.eligibility.kind)&&!screenRecipes.some(recipe=>recipe.id===contract.descriptor.id)).map(contract=>({kind:'component' as const,id:contract.descriptor.id,key:`${contract.descriptor.id}@${contract.descriptor.revision}`,definitionId:contract.descriptor.id,revision:contract.descriptor.revision,label:contract.label,description:contract.purpose,eligibility:contract.eligibility,
      insertion:{op:'insert',kind:'component',componentId:contract.descriptor.id,revision:contract.descriptor.revision,requires:'Read exact contracts first; this is not a recipe ID.'},
      preparation:{rootKind:'component',definitionIds:[contract.descriptor.id],seedStyles:[],initialStateKeys:[],hostRequirements:contract.rules?.filter(rule=>rule.kind==='hostRequirement')??[],guidance:'No prepared recipe or application seed. Use exact component insertion and compose its declared slots through normal canonical edits.'}}));
    result={...base,...page([...recipes,...components].filter(item=>!query.query||`${item.id} ${item.label} ${item.description}`.toLowerCase().includes(query.query.toLowerCase())))};
  }
  else if (query.section === 'component') {
    const recipe=screenRecipes.find(item=>item.id===query.recipe);
    const root=recipe?.create('example')[0];
    const id=query.recipe?.startsWith('vict.')?query.recipe:root?.kind==='component'?root.definitionId:`vict.catalog.${query.recipe}`;
    const contract=authoringContract(id),descriptor=contract?.descriptor;
    result = descriptor ? { ...base,id:descriptor.id,revision:descriptor.revision,digest:contract!.digest,descriptorJson:JSON.stringify(descriptor).slice(query.offset,query.offset+6000),totalCharacters:JSON.stringify(descriptor).length,offset:query.offset,nextOffset:query.offset+6000 < JSON.stringify(descriptor).length ? query.offset+6000 : null,knowledge:'Read contracts with this exact id/revision for composition, dependencies, eligibility and semantic rules.' } : recipe ? {...base,kind:'native-recipe',recipe:recipe.id,description:recipe.description,...textPage({nodes:recipe.create('example'),localState:recipe.initialState?.('example')??{}}),knowledge:'Native recipe source, not a component descriptor. Generic native insertion uses elements.'} : { ...base,ok:false,code:'STUDIO_AGENT_COMPONENT_NOT_FOUND',requested:query.recipe??null,message:'Exact component/recipe not found. Discover catalog or palette; native tags use elements.' };
  } else if (query.section === 'state') {
    if(query.stateKey){const declaration=Object.hasOwn(document.localState,query.stateKey) ? document.localState[query.stateKey] : undefined;if(!declaration)return {...base,ok:false,code:'STUDIO_AGENT_STATE_NOT_FOUND',message:'Use an existing stateKey from the state inventory.'};result={...base,stateKey:query.stateKey,...textPage(declaration)};}
    else result={...base,...page(Object.values(document.localState).map(decl=>({key:decl.key,type:decl.type,initialJson:truncate(JSON.stringify(decl.initial),1000),fullSource:'Read state with stateKey for lossless declaration JSON pages.'})))};
  } else if(query.section === 'registry'){
    if(!query.registry)return {...base,ok:false,code:'STUDIO_AGENT_READ_QUERY',message:'registry requires one of: '+registries.join(', ')};
    if(query.registry==='dataContracts'){
      const entries=authoringDataContracts(installedAuthoringRegistry);
      if(query.key){
        const entry=entries.find(item=>`${item.id}@${item.revision}`===query.key);
        if(!entry)return {...base,ok:false,code:'STUDIO_AGENT_REGISTRY_KEY_NOT_FOUND',message:'Use an exact id@revision key from the dataContracts inventory; this registry contains package-owned data contracts, not source nodes or component recipes.'};
        const {digest,...data}=entry;
        result={...base,registry:query.registry,key:query.key,id:entry.id,revision:entry.revision,digest,bodyIdentity:`studio-data-contract-body@1:${digest}`,registryDigest:installedAuthoringRegistry.digest,...textPage(data),guidance:'Package-owned data grammar only, with no execution authority. Reassemble sourceJson pages using this exact key and digest. If nextOffset is a number, copy that JSON number into the next read offset without quotes; keep section, registry and key unchanged. If nextOffset is null, this body is complete: stop paging and do not send offset:null. component contracts link these identities without embedding their full schemas.'};
      }else result={...base,registry:query.registry,registryDigest:installedAuthoringRegistry.digest,...page(entries.filter(item=>!query.query||`${item.id}@${item.revision}`.toLowerCase().includes(query.query.toLowerCase())).map(({id,revision,digest})=>({key:`${id}@${revision}`,id,revision,digest}))),guidance:'Read one exact key as lossless JSON text pages. Contract schema/examples are package-owned knowledge, not authored app source or a prepared editor template.'};
    }else {
    const registry=document[query.registry];
    if(query.key){if(!Object.hasOwn(registry,query.key))return {...base,ok:false,code:'STUDIO_AGENT_REGISTRY_KEY_NOT_FOUND',message:'Use an existing key from this registry inventory.'};result={...base,registry:query.registry,key:query.key,...textPage((registry as Readonly<Record<string,unknown>>)[query.key]),...(query.registry==='assets'?{media:canonicalAssetMediaFacts(document.assets[query.key]!),guidance:MEDIA_SOURCE_GUIDANCE}:{})};}
    else result={...base,registry:query.registry,...page(Object.entries(registry).filter(([key])=>!query.query||key.toLowerCase().includes(query.query.toLowerCase())).map(([key,value])=>({key,sourcePreview:truncate(JSON.stringify(value),600),...(query.registry==='assets'?canonicalAssetMediaFacts(document.assets[key]!):{})}))),...(query.registry==='assets'?{guidance:MEDIA_SOURCE_GUIDANCE}:{})};
    }
  }
  else if (query.section === 'actions') result = { ...base,actions:designerCatalogs.actionIds,actionInputs };
  else if (query.section === 'coverage') { const coverage = agentCoverage(document,query.requested); const {missing,...counts} = coverage; result = { ...base,...counts,...page(missing) }; }
  else {
    const occurrence = selection ? resolveOccurrence(selection,document) : undefined;
    result = { ...base,document:{schema:document.schema,id:document.id,revision:document.revision,root:document.root,nodeCount:nodes.length,stateCount:Object.keys(document.localState).length},
      selection:occurrence ? { occurrence:selection,nodeId:occurrence.sourceNodeId,repeated:!!occurrence.repeatKeys.length } : null,
      ...(selectedSet?{selectionSet:selectionContext(document,selectedSet,{descriptors:catalogDescriptors,actionState:screenActionState,actionIds:designerCatalogs.actionIds,routeIds:designerCatalogs.routeIds})}:{}),
      roots:nodes.filter(node => node.id === document.root).map(nodeSummary),
      previewHost:studioPreviewHost,
      knowledge:{registryDigest:installedAuthoringRegistry.digest,contracts:installedAuthoringRegistry.contracts.length,families:new Set(installedAuthoringRegistry.contracts.map(item=>item.family)).size,ready:installedAuthoringRegistry.ok,suppliedIconCount:suppliedIconManifest.length,icons:'Read icons with query/offset/limit or exact key for installed pack/name/revision and provenance; glyphs are never embedded in initial context.',media:'Read media with query/offset/limit or exact asset reference key for host-reported name/MIME/size/digest at its document-bound listedAt time. Read registry assets for canonical digest/external declarations separately. No bytes/provenance enter this inventory; metadata is not load/playback proof.',
        dataContracts:'Read registry/dataContracts for package-owned data grammar identities/digests, then registry/dataContracts/key:id@revision for lossless schema/example JSON pages. Component contracts contain references only; no app source or template is generated.',
        discovery:'families → catalog with family/category/query → contracts with selected components and knownDigests. Native tags use elements; recipes use palette. Knowledge freshness is separate from this source cursor.'},
      discovery:'Read nodes with optional nodeId (defaults to that source subtree), scope:self|subtree and semantic query; no nodeId means the full inventory. Inactive branches/templates are source, not proof of visibility; shared component definitions are not expanded implicitly. Read capabilities with nodeId before proposing part/state edits. Read source with nodeId or sources with up to8 nodeIds for lossless JSON text pages at this exact cursor. Read preflight with edit:{expectedRevision,reason,operations} to validate the same canonical transaction without applying it. Section-specific irrelevant fields are refused. State initialJson is a preview; state/stateKey and registry/registry/key provide lossless entry pages. Recipes: discover with {"section":"palette","query":"rhea-input"} or {"section":"palette","query":"rhea-native-select"}, then read {"section":"component","recipe":"rhea-input"} or {"section":"component","recipe":"rhea-native-select"}. Use key only for registry/icons/media; source requires an existing document nodeId, never a recipe identity. Component/recipe and catalog/contracts provide exact identities and composition; coverage is source presence only. All inventory limits remain <=20.',
      editing:'Use add with a palette recipe as an accelerator, or insert kind element/text/component through the registered canonical path. Component insertion requires exact componentId/revision from catalog/contracts and explicit slotName for slot children. Native tags come from elements. declareState accepts string/number/boolean/isoDate/isoTime/stringList/numberList with a matching canonical initial value. bindText targets an actual text node; bindAttribute targets a native attribute. bind/connect use exact component props/outputs. style accepts text/token/binding values and optional conditionId/pseudo; declareToken and declareCondition add registered presentation data. defineStyleSource and attachStyleSource/detachStyleSource reuse ordered rules; replace:true explicitly updates a shared source. removeStyleSource requires no remaining references. Local styles retain precedence. Heading levels1..6 are native headings. Compatible same-batch construction is supported; final semantic/renderer checks are atomic. Read the current source after a refusal; never replay acknowledged edits merely to retry observation. Source presence, actual appearance and exercised behavior are distinct.',
      limits:{nodes:500,documentCharacters:200000,readPage:20},
    };
  }
  try { return assertBounded(result); } catch { return { ...base,ok:false,code:'STUDIO_AGENT_READ_LIMIT',message:'This selection exceeds a safe read page. Reduce limit, select a single component, or use source text pages. No snapshot safety limit was changed.' }; }
}
