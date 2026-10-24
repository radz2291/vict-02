/** Bounded discovery. No read embeds the full document or catalog. */
import { z } from 'zod';
import { authoringIndex, authoringContractBundle, type UiDocument, type UiNode } from '@victframework/ui';
import { resolveOccurrence, compositionChildren } from '@victframework/ui-editor';
import { screenRecipes } from './recipes.js';
import { actionInputs, designerCatalogs } from './application.js';
import type { AgentCursor } from './agent-edits.js';
import { authoringContract, installedAuthoringRegistry } from './authoring.js';
import { studioPreviewHost } from './preview-host.js';
const registries=['componentDefinitions','styleSources','tokens','conditions','assets'] as const;
export const agentReadSchema = z.object({
  section: z.enum(['overview','nodes','source','palette','component','state','registry','actions','coverage','families','catalog','contracts','elements']).default('overview'),
  offset: z.number().int().min(0).max(200000).default(0),
  limit: z.number().int().min(1).max(20).default(12),
  nodeId: z.string().max(160).optional(), recipe: z.string().max(160).optional(),
  stateKey:z.string().min(1).max(160).optional(),
  registry:z.enum(registries).optional(),key:z.string().min(1).max(500).optional(),
  query: z.string().max(100).optional(), requested: z.array(z.string().max(160)).max(30).optional(),
  family:z.string().max(100).optional(),category:z.string().max(100).optional(),tag:z.string().max(60).optional(),
  components:z.array(z.object({id:z.string().min(1).max(160),revision:z.string().min(1).max(100).optional()}).strict()).min(1).max(12).optional(),
  knownDigests:z.record(z.string().min(1).max(270),z.string().max(100)).refine(value=>Object.keys(value).length<=30,'At most 30 known digests.').optional(),
  includeExamples:z.boolean().optional(),
}).strict();
export const agentReadPresentation = { type:'object',additionalProperties:false,properties:{
  section:{type:'string',enum:['overview','nodes','source','palette','component','state','registry','actions','coverage','families','catalog','contracts','elements']},
  offset:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:20},
  stateKey:{type:'string'},registry:{type:'string',enum:[...registries]},key:{type:'string'},
  nodeId:{type:'string'},recipe:{type:'string'},query:{type:'string'},requested:{type:'array',maxItems:30,items:{type:'string'}},
  family:{type:'string'},category:{type:'string'},tag:{type:'string'},
  components:{type:'array',minItems:1,maxItems:12,items:{type:'object',additionalProperties:false,required:['id'],properties:{id:{type:'string'},revision:{type:'string'}}}},
  knownDigests:{type:'object',maxProperties:30,additionalProperties:{type:'string'}},
  includeExamples:{type:'boolean'},
} };
const truncate = (text: string, max = 1200) => text.length > max ? text.slice(0,max) + '… [truncated; use source pages]' : text;
const recipeDefinitions = new Map(screenRecipes.map(recipe => [recipe.id,recipe.create('example').filter(node => node.kind === 'component').map(node => node.kind === 'component' ? node.definitionId : '')]));
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
    if (!definitions.length) { const recipe = screenRecipes.find(recipe => recipe.id === id); const root = recipe?.create('example')[0]; return !root || !sourceNodes.some(node => node.kind === root.kind && (node.kind !== 'element' || root.kind !== 'element' || node.tag === root.tag)); }
    return !definitions.every(definition => authoredIds.has(definition));
  });
  return { available:availableIds.length, authored:expected.length-missing.length, catalogAuthored:availableIds.filter(id => id.startsWith('vict.catalog.')&&authoredIds.has(id)).length,
    registeredAuthored:availableIds.filter(id=>authoredIds.has(id)).length,reachableSourceNodes:sourceNodes.length,
    requested:expected.length, scope:requested ? 'declared-request' : 'registered-component-inventory', missing,
    evidence:'Reachable declared source presence only, including inactive branches/templates. An agent-declared manifest is not proof of the user intent, observed appearance, exercised interaction or completion.' };
}
function nodeSummary(node: UiNode) {
  return { id:node.id,kind:node.kind,...(node.kind === 'element' ? {tag:node.tag} : node.kind === 'component' ? {definitionId:node.definitionId} : {}),
    children:compositionChildren(node).slice(0,20), childCount:compositionChildren(node).length,
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
  expectedRevision?: string; cursor?: AgentCursor; section?: string;
  selection?: { occurrence?: string; nodeId: string; repeated: boolean } | null;
  [key:string]: unknown;
}
export function agentContext(document: UiDocument, cursor: AgentCursor, selection?: string, input: unknown = {}): AgentReadResult {
  const parsed = agentReadSchema.safeParse(input);
  if (!parsed.success) return { ok:false,code:'STUDIO_AGENT_READ_QUERY',message:'Use section, offset and limit (1–20). source requires nodeId; component requires recipe; stateKey pages a state declaration; registry needs its registry name and optional key.',diagnostics:parsed.error.issues.slice(0,4).map(issue => ({path:issue.path.join('.'),message:issue.message})) };
  const query = parsed.data;
  const base = { expectedRevision:cursor.revision,cursor,section:query.section };
  const page = <T,>(items: T[]) => ({ items:items.slice(query.offset,query.offset+query.limit),total:items.length,offset:query.offset,nextOffset:query.offset+query.limit < items.length ? query.offset+query.limit : null });
  const textPage=(value:unknown)=>{const source=JSON.stringify(value);const length=Math.min(query.limit*300,6000);return {sourceJson:source.slice(query.offset,query.offset+length),totalCharacters:source.length,offset:query.offset,nextOffset:query.offset+length<source.length ? query.offset+length : null};};
  let result: Record<string, unknown>;
  const nodes = Object.values(document.nodes);
  if(query.section==='families') {
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
    const bundle=authoringContractBundle(installedAuthoringRegistry,{requested:query.components,knownDigests:query.knownDigests,maxItems:12,maxBytes:42000});
    const items=bundle.items.map(item=>{
      if('unchanged' in item)return item;
      const {seed,examples,...contract}=item.contract;
      const projection=query.includeExamples?item.contract:{...contract,exampleCount:examples?.length??0,hasSeed:!!seed};
      const json=JSON.stringify(projection),length=Math.min(query.limit*300,6000),next=query.offset+length;
      return {id:item.id,revision:item.revision,digest:item.digest,contractJson:json.slice(query.offset,next),totalCharacters:json.length,offset:query.offset,nextOffset:next<json.length?next:null,bodyComplete:query.offset===0&&next>=json.length};
    });
    result={...base,ok:bundle.ok,complete:bundle.complete&&items.every(item=>'unchanged' in item||item.bodyComplete),registryDigest:bundle.registryDigest,items,pending:bundle.pending,problems:bundle.problems,...(bundle.budgetCause?{budgetCause:bundle.budgetCause}:{}),
      projection:query.includeExamples?'contract-with-examples':'contract-and-semantic-guidance',
      paging:'Bodies are lossless JSON text pages of the named projection. Request a selected ID with nextOffset until complete; retain its digest. includeExamples adds canonical seed/examples; omit its known digest when requesting a different projection. Pending dependencies are not a complete bundle. Source facts never use knowledge-cache digests.'};
  } else if(query.section==='elements') {
    const catalog=designerCatalogs.elements;
    result=query.tag?{...base,element:catalog.elements.find(item=>item.tag===query.tag)??null,globalAttributes:catalog.globalAttributes,
      guidance:'Insert a registered native tag; use bindText on an actual text node and bindAttribute for native refs. Leaf elements cannot contain child text. Attributes and interactions still pass canonical validation.'}:{...base,...page(catalog.elements.filter(item=>!query.query||item.tag.includes(query.query)).map(item=>({tag:item.tag,leaf:item.leaf===true}))),guidance:'Read elements with tag for its attributes; native tags are not component descriptors.'};
  } else if (query.section === 'nodes') result = { ...base,...page(nodes.filter(node => !query.query || JSON.stringify(nodeSummary(node)).toLowerCase().includes(query.query.toLowerCase())).map(nodeSummary)) };
  else if (query.section === 'source') {
    const node = query.nodeId && Object.hasOwn(document.nodes,query.nodeId) ? document.nodes[query.nodeId] : undefined;
    if (!node) return { ...base,ok:false,code:'STUDIO_AGENT_NODE_NOT_FOUND',message:'source requires an existing nodeId from nodes discovery.' };
    const source = JSON.stringify(node);
    // Source is losslessly paged as text so deep/large authored expressions cannot violate delivery snapshots.
    const length = Math.min(query.limit * 300,6000);
    result = { ...base,nodeId:node.id,sourceJson:source.slice(query.offset,query.offset+length),totalCharacters:source.length,offset:query.offset,nextOffset:query.offset+length < source.length ? query.offset+length : null };
  } else if (query.section === 'palette') result = { ...base,...page(screenRecipes.filter(recipe => !query.query || `${recipe.id} ${recipe.label} ${recipe.description}`.toLowerCase().includes(query.query.toLowerCase())).map(({id,label,description,placements}) => ({id,label,description,...(placements ? {placements} : {})}))) };
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
    const registry=document[query.registry];
    if(query.key){if(!Object.hasOwn(registry,query.key))return {...base,ok:false,code:'STUDIO_AGENT_REGISTRY_KEY_NOT_FOUND',message:'Use an existing key from this registry inventory.'};result={...base,registry:query.registry,key:query.key,...textPage((registry as Readonly<Record<string,unknown>>)[query.key])};}
    else result={...base,registry:query.registry,...page(Object.entries(registry).filter(([key])=>!query.query||key.toLowerCase().includes(query.query.toLowerCase())).map(([key,value])=>({key,sourcePreview:truncate(JSON.stringify(value),600)})))};
  }
  else if (query.section === 'actions') result = { ...base,actions:designerCatalogs.actionIds,actionInputs };
  else if (query.section === 'coverage') { const coverage = agentCoverage(document,query.requested); const {missing,...counts} = coverage; result = { ...base,...counts,...page(missing) }; }
  else {
    const occurrence = selection ? resolveOccurrence(selection,document) : undefined;
    result = { ...base,document:{schema:document.schema,id:document.id,revision:document.revision,root:document.root,nodeCount:nodes.length,stateCount:Object.keys(document.localState).length},
      selection:occurrence ? { occurrence:selection,nodeId:occurrence.sourceNodeId,repeated:!!occurrence.repeatKeys.length } : null,
      roots:nodes.filter(node => node.id === document.root).map(nodeSummary),
      previewHost:studioPreviewHost,
      knowledge:{registryDigest:installedAuthoringRegistry.digest,contracts:installedAuthoringRegistry.contracts.length,families:new Set(installedAuthoringRegistry.contracts.map(item=>item.family)).size,ready:installedAuthoringRegistry.ok,
        discovery:'families → catalog with family/category/query → contracts with selected components and knownDigests. Native tags use elements; recipes use palette. Knowledge freshness is separate from this source cursor.'},
      discovery:'Read nodes/palette/state with offset and limit <=20. State initialJson is a preview; read state with stateKey for lossless declaration JSON pages. Registry lists componentDefinitions/styleSources/tokens/conditions/assets; provide registry and optional key to page a whole entry as lossless JSON text. Read component with recipe for exact props/outputs/slots. Read source with nodeId for lossless JSON text pages (nextOffset is character offset). Read coverage with requested recipe IDs for source presence only.',
      editing:'Use add with a palette recipe as an accelerator, or insert kind element/text/component through the registered canonical path. Component insertion requires exact componentId/revision from catalog/contracts and explicit slotName for slot children. Native tags come from elements. declareState accepts string/number/boolean/isoDate/isoTime/stringList/numberList with a matching canonical initial value. bindText targets an actual text node; bindAttribute targets a native attribute. bind/connect use exact component props/outputs. style accepts text/token/binding values and optional conditionId/pseudo; declareToken and declareCondition add registered presentation data. defineStyleSource and attachStyleSource/detachStyleSource reuse ordered rules; replace:true explicitly updates a shared source. removeStyleSource requires no remaining references. Local styles retain precedence. Heading levels1..6 are native headings. Compatible same-batch construction is supported; final semantic/renderer checks are atomic. Read the current source after a refusal; never replay acknowledged edits merely to retry observation. Source presence, actual appearance and exercised behavior are distinct.',
      limits:{nodes:500,documentCharacters:200000,readPage:20},
    };
  }
  try { return assertBounded(result); } catch { return { ...base,ok:false,code:'STUDIO_AGENT_READ_LIMIT',message:'This selection exceeds a safe read page. Reduce limit, select a single component, or use source text pages. No snapshot safety limit was changed.' }; }
}
