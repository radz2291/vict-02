/** Bounded discovery. No read embeds the full document or catalog. */
import { z } from 'zod';
import type { UiDocument, UiNode } from '@victframework/ui';
import { resolveOccurrence, compositionChildren } from '@victframework/ui-editor';
import { screenRecipes } from './recipes.js';
import { catalogDescriptors, actionInputs, designerCatalogs } from './application.js';
import type { AgentCursor } from './agent-edits.js';
const registries=['componentDefinitions','styleSources','tokens','conditions','assets'] as const;
export const agentReadSchema = z.object({
  section: z.enum(['overview','nodes','source','palette','component','state','registry','actions','coverage']).default('overview'),
  offset: z.number().int().min(0).max(200000).default(0),
  limit: z.number().int().min(1).max(20).default(12),
  nodeId: z.string().max(160).optional(), recipe: z.string().max(160).optional(),
  stateKey:z.string().min(1).max(160).optional(),
  registry:z.enum(registries).optional(),key:z.string().min(1).max(500).optional(),
  query: z.string().max(100).optional(), requested: z.array(z.string().max(160)).max(30).optional(),
}).strict();
export const agentReadPresentation = { type:'object',additionalProperties:false,properties:{
  section:{type:'string',enum:['overview','nodes','source','palette','component','state','registry','actions','coverage']},
  offset:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:20},
  stateKey:{type:'string'},registry:{type:'string',enum:[...registries]},key:{type:'string'},
  nodeId:{type:'string'},recipe:{type:'string'},query:{type:'string'},requested:{type:'array',maxItems:30,items:{type:'string'}},
} };
const truncate = (text: string, max = 1200) => text.length > max ? text.slice(0,max) + '… [truncated; use source pages]' : text;
const recipeDefinitions = new Map(screenRecipes.map(recipe => [recipe.id,recipe.create('example').filter(node => node.kind === 'component').map(node => node.kind === 'component' ? node.definitionId : '')]));
export function agentCoverage(document: UiDocument, requested?: readonly string[]) {
  const authoredIds = new Set(Object.values(document.nodes).flatMap(node => node.kind === 'component' ? [node.definitionId] : []));
  const availableIds = [...new Set([...recipeDefinitions.values()].flat())];
  const expected = requested ?? availableIds.map(id => id.replace('vict.catalog.',''));
  const missing = expected.filter(id => {
    const definitions = recipeDefinitions.get(id) ?? (id.startsWith('vict.catalog.') ? [id] : [`vict.catalog.${id}`]);
    if (!definitions.length) { const recipe = screenRecipes.find(recipe => recipe.id === id); const root = recipe?.create('example')[0]; return !root || !Object.values(document.nodes).some(node => node.kind === root.kind && (node.kind !== 'element' || root.kind !== 'element' || node.tag === root.tag)); }
    return !definitions.every(definition => authoredIds.has(definition));
  });
  return { available:availableIds.length, authored:expected.length-missing.length, catalogAuthored:availableIds.filter(id => authoredIds.has(id)).length, requested:expected.length, scope:requested ? 'declared-request' : 'catalog-inventory', missing,
    evidence:'Declared source presence only. Does not prove appearance, interaction, requested intent, or completion.' };
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
  if (query.section === 'nodes') result = { ...base,...page(nodes.filter(node => !query.query || JSON.stringify(nodeSummary(node)).toLowerCase().includes(query.query.toLowerCase())).map(nodeSummary)) };
  else if (query.section === 'source') {
    const node = query.nodeId && Object.hasOwn(document.nodes,query.nodeId) ? document.nodes[query.nodeId] : undefined;
    if (!node) return { ...base,ok:false,code:'STUDIO_AGENT_NODE_NOT_FOUND',message:'source requires an existing nodeId from nodes discovery.' };
    const source = JSON.stringify(node);
    // Source is losslessly paged as text so deep/large authored expressions cannot violate delivery snapshots.
    const length = Math.min(query.limit * 300,6000);
    result = { ...base,nodeId:node.id,sourceJson:source.slice(query.offset,query.offset+length),totalCharacters:source.length,offset:query.offset,nextOffset:query.offset+length < source.length ? query.offset+length : null };
  } else if (query.section === 'palette') result = { ...base,...page(screenRecipes.filter(recipe => !query.query || `${recipe.id} ${recipe.label} ${recipe.description}`.toLowerCase().includes(query.query.toLowerCase())).map(({id,label,description,placements}) => ({id,label,description,...(placements ? {placements} : {})}))) };
  else if (query.section === 'component') {
    const id = query.recipe?.startsWith('vict.catalog.') ? query.recipe : `vict.catalog.${query.recipe}`;
    const descriptor = catalogDescriptors.find(item => item.id === id);
    result = descriptor ? { ...base,descriptorJson:JSON.stringify(descriptor).slice(query.offset,query.offset+6000),totalCharacters:JSON.stringify(descriptor).length,offset:query.offset,nextOffset:query.offset+6000 < JSON.stringify(descriptor).length ? query.offset+6000 : null } : { ...base,ok:false,code:'STUDIO_AGENT_COMPONENT_NOT_FOUND',message:'Use recipe from palette. Native input uses wireInput; text uses text.' };
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
      discovery:'Read nodes/palette/state with offset and limit <=20. State initialJson is a preview; read state with stateKey for lossless declaration JSON pages. Registry lists componentDefinitions/styleSources/tokens/conditions/assets; provide registry and optional key to page a whole entry as lossless JSON text. Read component with recipe for exact props/outputs/slots. Read source with nodeId for lossless JSON text pages (nextOffset is character offset). Read coverage with requested recipe IDs for source presence only.',
      editing:'Use fresh node IDs, exact expectedRevision and registered recipes. add/modify/move/remove/bind/connect; headingLevel:1..6 changes existing heading tags (one page h1, sections h2-h6); declareState(key,type,initial) creates independent scalar state. wireInput(nodeId,key,initial?) wires native input through existing attribute/change contracts. bind(nodeId,prop,expression?:{type:"ref",path:"state.key"}|{type:"literal",value:scalar}). connect(nodeId,output,binding?:{setState:{key,value?:expression}}|{invokeAction:{actionId,input?:{field:expression}}}). Same-batch add then bind/connect is supported; canonical payload type equality remains mandatory. New text inputs have independent state. add into an unchanged seeded slot replaces its placeholder subtree; set replacePlaceholder:false to append intentionally. Each acknowledged batch is one Undo. Source facts, appearance and interaction evidence are distinct; compilation is not completion.',
      limits:{nodes:500,documentCharacters:200000,readPage:20},
    };
  }
  try { return assertBounded(result); } catch { return { ...base,ok:false,code:'STUDIO_AGENT_READ_LIMIT',message:'This selection exceeds a safe read page. Reduce limit, select a single component, or use source text pages. No snapshot safety limit was changed.' }; }
}
