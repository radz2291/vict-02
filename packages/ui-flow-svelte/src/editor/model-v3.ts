import {passiveJsonSnapshot,passiveJsonFields} from './passive-json.js';
import type {GraphEdge,GraphIssue,GraphSelection} from './model.js';
import {validateGraphV2,parseGraphOperationsV2,type GraphDocumentV2,type GraphNodeV2,type GraphNodeTypeV2,type GraphOperationV2,type GraphResultV2} from './model-v2.js';
import {reduceTypedGraphOperations} from './typed-operations.js';
import {graphStructuralProblems} from './graph-schemas.js';
import {graphDocumentSchemaV3,graphOperationsSchemaV3,graphClipboardSchemaV3,graphEdgeAppearanceSchema,graphOperationSchemasV3} from './graph-v3-schemas.js';
export interface GraphEdgeAppearance {route?:'bezier'|'straight'|'orthogonal';pattern?:'solid'|'dash'|'dot';color?:string;width?:number;startArrow?:'none'|'arrow'|'closed';endArrow?:'none'|'arrow'|'closed'}
export interface GraphEdgeV3 extends GraphEdge {appearance?:GraphEdgeAppearance}
export interface GraphDocumentV3 {schema:'vict.flow-graph@3';revision:number;nodeTypes:GraphNodeTypeV2[];nodes:GraphNodeV2[];edges:GraphEdgeV3[];allowCycles?:boolean;edgeDefaults?:GraphEdgeAppearance}
export type GraphOperationV3=Exclude<GraphOperationV2,{type:'connect'}>|{type:'connect';edge:Omit<GraphEdgeV3,'id'>&{id?:string}}|{type:'setEdgeDefaults';appearance:GraphEdgeAppearance}|{type:'setEdgeAppearance';edgeId:string;appearance:GraphEdgeAppearance}|{type:'clearEdgeAppearance';edgeId:string};
export type GraphResultV3={ok:true;graph:GraphDocumentV3}|{ok:false;issues:GraphIssue[]};
export type GraphOperationsResultV3={ok:true;operations:GraphOperationV3[]}|{ok:false;issues:GraphIssue[]};
export type GraphPatchResultV3=({ok:true;source:string;graph:GraphDocumentV3}|{ok:false;issues:GraphIssue[]});
const clone=<T>(value:T):T=>{const owned=passiveJsonSnapshot(value);if(!owned.ok)throw new GraphValidationErrorV3([issue('GRAPH_STRUCTURE','graph','Supply finite acyclic passive JSON data.')]);return owned.value as T;};
const issue=(code:string,path:string,message:string):GraphIssue=>({code,path,message});
export class GraphValidationErrorV3 extends Error{constructor(readonly issues:GraphIssue[]){super(issues.map(i=>`${i.path}: ${i.message}`).join('; '));this.name='GraphValidationErrorV3';}}
export const defaultGraphEdgeAppearance:Readonly<Required<GraphEdgeAppearance>>=Object.freeze({route:'bezier',pattern:'solid',color:'token:border',width:1.5,startArrow:'none',endArrow:'none'});
export function resolveGraphEdgeAppearance(graph:Pick<GraphDocumentV3,'edgeDefaults'>,edge?:Pick<GraphEdgeV3,'appearance'>):Required<GraphEdgeAppearance>{
 const defaults=passiveJsonFields(graph,['edgeDefaults']),overrides=passiveJsonFields(edge===undefined?{}:edge,['appearance']);
 if(!defaults.ok||!overrides.ok)throw new GraphValidationErrorV3([issue('GRAPH_STRUCTURE','appearance','Supply passive JSON appearance data.')]);
 const base=(defaults.value as Pick<GraphDocumentV3,'edgeDefaults'>).edgeDefaults,override=(overrides.value as Pick<GraphEdgeV3,'appearance'>).appearance;
 for(const appearance of [base,override])if(appearance!==undefined){const issues=structural(graphEdgeAppearanceSchema,appearance,'appearance');if(issues.length)throw new GraphValidationErrorV3(issues);}
 return {...defaultGraphEdgeAppearance,...base,...override};
}
export const emptyGraphV3=():GraphDocumentV3=>({schema:'vict.flow-graph@3',revision:0,nodeTypes:[],nodes:[],edges:[]});
function structural(schema:Parameters<typeof graphStructuralProblems>[0],value:unknown,path:string){try{return graphStructuralProblems(schema,value,path);}catch{return [issue('GRAPH_STRUCTURE',path,'Supply finite acyclic JSON data.')];}}
function capture(schema:Parameters<typeof graphStructuralProblems>[0],input:unknown,path:string):{ok:true;value:unknown}|{ok:false;issues:GraphIssue[]}{
 const owned=passiveJsonSnapshot(input);if(!owned.ok)return {ok:false,issues:[issue('GRAPH_STRUCTURE',path,'Supply finite acyclic passive JSON data.')]};
 const issues=structural(schema,owned.value,path);return issues.length?{ok:false,issues}:{ok:true,value:owned.value};
}
function topology(graph:GraphDocumentV3):GraphDocumentV2{const {edgeDefaults:_,...rest}=graph;return {...rest,schema:'vict.flow-graph@2',edges:graph.edges.map(({appearance:_,...edge})=>edge)};}
export function validateGraphV3(input:unknown):GraphResultV3{const captured=capture(graphDocumentSchemaV3,input,'graph');if(!captured.ok)return captured;const graph=captured.value as GraphDocumentV3;const checked=validateGraphV2(topology(graph));return checked.ok?{ok:true,graph}:checked;}
export function parseGraphV3(source:string):GraphResultV3{if(typeof source!=='string')return {ok:false,issues:[issue('GRAPH_JSON','graph','Supply valid graph JSON.')]};try{return validateGraphV3(JSON.parse(source));}catch{return {ok:false,issues:[issue('GRAPH_JSON','graph','Supply valid graph JSON.')]};}}
export function serializeGraphV3(graph:GraphDocumentV3):string{const checked=validateGraphV3(graph);if(!checked.ok)throw new GraphValidationErrorV3(checked.issues);return JSON.stringify(checked.graph);}
export function parseGraphOperationsV3(input:unknown):GraphOperationsResultV3{
 const captured=capture(graphOperationsSchemaV3,input,'operations');if(!captured.ok)return captured;const operations=captured.value as GraphOperationV3[];
 const retained=operations.filter(op=>!['setEdgeDefaults','setEdgeAppearance','clearEdgeAppearance'].includes(op.type)).map(op=>op.type==='connect'?{...op,edge:(({appearance:_,...edge})=>edge)(op.edge)}:op);
 if(retained.length){const checked=parseGraphOperationsV2(retained);if(!checked.ok)return checked;}
 return {ok:true,operations};
}
export function copyGraphSelectionV3(graph:GraphDocumentV3,selection:GraphSelection):string{
 const checked=validateGraphV3(graph);if(!checked.ok)throw new GraphValidationErrorV3(checked.issues);
 const selected=capture(graphOperationSchemasV3.remove.properties!.selection!,selection,'selection');if(!selected.ok)throw new GraphValidationErrorV3(selected.issues);
 const own=checked.graph,scope=selected.value as GraphSelection,nodes=own.nodes.filter(node=>scope.nodes.includes(node.id)),ids=new Set(nodes.map(node=>node.id));
 return JSON.stringify({schema:'vict.flow-clipboard@3',nodeTypes:own.nodeTypes.filter(type=>nodes.some(node=>node.type===type.id)),nodes,edges:own.edges.filter(edge=>ids.has(edge.source)&&ids.has(edge.target)),...(own.allowCycles===undefined?{}:{allowCycles:own.allowCycles}),...(own.edgeDefaults===undefined?{}:{edgeDefaults:own.edgeDefaults})});
}
export function applyGraphOperationsV3(graph:GraphDocumentV3,input:readonly GraphOperationV3[],expectedRevision:number|undefined=undefined):GraphResultV3{
 const initial=validateGraphV3(graph);if(!initial.ok)return initial;const parsed=parseGraphOperationsV3(input);if(!parsed.ok)return parsed;if((expectedRevision===undefined?initial.graph.revision:expectedRevision)!==initial.graph.revision)return {ok:false,issues:[issue('GRAPH_STALE','revision','Graph changed; read the current revision before retrying.')]};
 // The one shared typed reducer owns all topology/parameter/batch behavior.
 // Its internal data adapter is schema-opaque; public @2 validators never admit @3.
 const result=reduceTypedGraphOperations(initial.graph as unknown as GraphDocumentV2,parsed.operations as GraphOperationV2[],{
  operation(data,raw){const next=data as unknown as GraphDocumentV3,op=raw as GraphOperationV3;
   if(op.type==='setEdgeDefaults'){next.edgeDefaults=clone(op.appearance);return true;}
   if(op.type==='setEdgeAppearance'||op.type==='clearEdgeAppearance'||op.type==='reconnect'){
    const edge=next.edges.find(e=>e.id===op.edgeId);if(!edge)throw new GraphValidationErrorV3([issue('GRAPH_OPERATION','operations','Unknown edge.')]);
    if(op.type==='setEdgeAppearance')edge.appearance=clone(op.appearance);else if(op.type==='clearEdgeAppearance')delete edge.appearance;else Object.assign(edge,op.connection);return true;
   }return false;
  },
  copy:(data,selection)=>copyGraphSelectionV3(data as unknown as GraphDocumentV3,selection),
  clipboard(source,purpose){let data:unknown;try{data=JSON.parse(source);}catch{return {ok:false,issues:[issue('GRAPH_CLIPBOARD','clipboard','Supply valid clipboard JSON.')]};}const issues=structural(graphClipboardSchemaV3,data,'clipboard');if(issues.length)return {ok:false,issues};const {schema:_,...fields}=data as Omit<GraphDocumentV3,'revision'>;const checked=validateGraphV3({...fields,schema:'vict.flow-graph@3',revision:0});if(!checked.ok)return checked;
   // Cross-canvas paste preserves effective values (semantic colors stay tokens), not
   // destination defaults. Duplicate retains local inheritance and overrides.
   if(purpose==='paste')checked.graph.edges=checked.graph.edges.map(edge=>({...edge,appearance:resolveGraphEdgeAppearance(checked.graph,edge)}));
   return checked as unknown as GraphResultV2;
  },
 });
 return result.ok?validateGraphV3(result.graph):result;
}
export function applyGraphPatchV3(source:string,input:unknown,expectedRevision:number):GraphPatchResultV3{const graph=parseGraphV3(source);if(!graph.ok)return graph;const operations=parseGraphOperationsV3(input);if(!operations.ok)return operations;const result=applyGraphOperationsV3(graph.graph,operations.operations,expectedRevision);return result.ok?{...result,source:serializeGraphV3(result.graph)}:result;}
export function migrateGraphV2ToV3(graph:GraphDocumentV2):GraphResultV3{const owned=passiveJsonSnapshot(graph);if(!owned.ok)return {ok:false,issues:[issue('GRAPH_STRUCTURE','migration','Supply finite acyclic passive JSON data.')]};const checked=validateGraphV2(owned.value);return checked.ok?validateGraphV3({...checked.graph,schema:'vict.flow-graph@3'}):checked;}
export const graphMigrationV2ToV3=Object.freeze({schema:'vict.flow-migration@1',from:'vict.flow-graph@2',to:'vict.flow-graph@3',componentRevisions:Object.freeze(['workspace','viewport','port'].map(role=>Object.freeze({definitionId:`vict.flow.${role}`,from:'2',to:'3',role})))}) ;
export class GraphSessionV3{
 private current:GraphDocumentV3;private past:GraphDocumentV3[]=[];private future:GraphDocumentV3[]=[];
 constructor(graph:GraphDocumentV3,private readonly options:{readOnly?:boolean;maxHistory?:number;validate?:(graph:GraphDocumentV3)=>readonly GraphIssue[]}={}){const result=validateGraphV3(graph);if(!result.ok)throw new GraphValidationErrorV3(result.issues);this.current=result.graph;}
 get graph(){return clone(this.current);}get canUndo(){return !!this.past.length;}get canRedo(){return !!this.future.length;}
 setReadOnly(value:boolean){this.options.readOnly=value;}
 private policy(graph:GraphDocumentV3):GraphIssue[]{try{return [...(this.options.validate?.(clone(graph))??[])];}catch{return [issue('GRAPH_DOMAIN_VALIDATION','graph','Application validation unavailable; existing graph retained.')];}}
 apply(operations:readonly GraphOperationV3[],revision=this.current.revision):GraphResultV3{if(this.options.readOnly)return {ok:false,issues:[issue('GRAPH_READ_ONLY','graph','Graph is read-only.')]};const result=applyGraphOperationsV3(this.current,operations,revision);if(!result.ok)return result;const issues=this.policy(result.graph);if(issues.length)return {ok:false,issues};this.past.push(this.current);if(this.options.maxHistory!==undefined&&this.past.length>this.options.maxHistory)this.past.shift();this.current=result.graph;this.future=[];return {ok:true,graph:this.graph};}
 replace(graph:GraphDocumentV3):GraphResultV3{const result=validateGraphV3(graph);if(!result.ok)return result;const issues=this.policy(result.graph);if(issues.length)return {ok:false,issues};this.current=result.graph;this.past=[];this.future=[];return {ok:true,graph:this.graph};}
 undo(){return this.travel(this.past,this.future);}redo(){return this.travel(this.future,this.past);}
 private travel(from:GraphDocumentV3[],to:GraphDocumentV3[]):GraphResultV3{if(this.options.readOnly)return {ok:false,issues:[issue('GRAPH_READ_ONLY','graph','Graph is read-only.')]};const previous=from.at(-1);if(!previous)return {ok:false,issues:[issue('GRAPH_HISTORY_EMPTY','history','No history in this direction.')]};const result=validateGraphV3({...previous,revision:this.current.revision+1});if(!result.ok)return result;const issues=this.policy(result.graph);if(issues.length)return {ok:false,issues};from.pop();to.push(this.current);this.current=result.graph;return {ok:true,graph:this.graph};}
}
