import type {GraphEdge,GraphIssue,GraphSelection} from './model.js';
import {validateGraphV2,parseGraphOperationsV2,type GraphDocumentV2,type GraphNodeV2,type GraphNodeTypeV2,type GraphOperationV2,type GraphResultV2} from './model-v2.js';
import {reduceTypedGraphOperations} from './typed-operations.js';
import {graphStructuralProblems} from './graph-schemas.js';
import {graphDocumentSchemaV3,graphOperationsSchemaV3,graphClipboardSchemaV3} from './graph-v3-schemas.js';
export interface GraphEdgeAppearance {route?:'bezier'|'straight'|'orthogonal';pattern?:'solid'|'dash'|'dot';color?:string;width?:number;startArrow?:'none'|'arrow'|'closed';endArrow?:'none'|'arrow'|'closed'}
export interface GraphEdgeV3 extends GraphEdge {appearance?:GraphEdgeAppearance}
export interface GraphDocumentV3 {schema:'vict.flow-graph@3';revision:number;nodeTypes:GraphNodeTypeV2[];nodes:GraphNodeV2[];edges:GraphEdgeV3[];allowCycles?:boolean;edgeDefaults?:GraphEdgeAppearance}
export type GraphOperationV3=Exclude<GraphOperationV2,{type:'connect'}>|{type:'connect';edge:Omit<GraphEdgeV3,'id'>&{id?:string}}|{type:'setEdgeDefaults';appearance:GraphEdgeAppearance}|{type:'setEdgeAppearance';edgeId:string;appearance:GraphEdgeAppearance}|{type:'clearEdgeAppearance';edgeId:string};
export type GraphResultV3={ok:true;graph:GraphDocumentV3}|{ok:false;issues:GraphIssue[]};
export type GraphOperationsResultV3={ok:true;operations:GraphOperationV3[]}|{ok:false;issues:GraphIssue[]};
export type GraphPatchResultV3=({ok:true;source:string;graph:GraphDocumentV3}|{ok:false;issues:GraphIssue[]});
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
const issue=(code:string,path:string,message:string):GraphIssue=>({code,path,message});
export class GraphValidationErrorV3 extends Error{constructor(readonly issues:GraphIssue[]){super(issues.map(i=>`${i.path}: ${i.message}`).join('; '));this.name='GraphValidationErrorV3';}}
export const defaultGraphEdgeAppearance:Readonly<Required<GraphEdgeAppearance>>=Object.freeze({route:'bezier',pattern:'solid',color:'token:border',width:1.5,startArrow:'none',endArrow:'none'});
export function resolveGraphEdgeAppearance(graph:Pick<GraphDocumentV3,'edgeDefaults'>,edge?:Pick<GraphEdgeV3,'appearance'>):Required<GraphEdgeAppearance>{return {...defaultGraphEdgeAppearance,...graph.edgeDefaults,...edge?.appearance};}
export const emptyGraphV3=():GraphDocumentV3=>({schema:'vict.flow-graph@3',revision:0,nodeTypes:[],nodes:[],edges:[]});
function plainJson(value:unknown):boolean{
 const active=new Set<object>(),stack:{value:unknown;exit?:boolean}[]=[{value}];
 while(stack.length){
  const {value:next,exit}=stack.pop()!;
  if(next===null||typeof next==='string'||typeof next==='boolean')continue;
  if(typeof next==='number'){if(!Number.isFinite(next))return false;continue;}
  if(typeof next!=='object')return false;
  if(exit){active.delete(next);continue;}
  if(active.has(next)||(!Array.isArray(next)&&![Object.prototype,null].includes(Object.getPrototypeOf(next))))return false;
  const descriptors=Object.getOwnPropertyDescriptors(next),keys=Reflect.ownKeys(descriptors);
  if(Array.isArray(next)&&keys.length!==next.length+1)return false;
  active.add(next);stack.push({value:next,exit:true});
  for(const key of keys){
   if(typeof key!=='string')return false;
   if(Array.isArray(next)&&key==='length')continue;
   const descriptor=descriptors[key]!;
   if(!descriptor.enumerable||!Object.hasOwn(descriptor,'value'))return false;
   if(Array.isArray(next)&&(!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=next.length))return false;
   stack.push({value:descriptor.value});
  }
 }
 return true;
}
function structural(schema:Parameters<typeof graphStructuralProblems>[0],value:unknown,path:string){try{return plainJson(value)?graphStructuralProblems(schema,value,path):[issue('GRAPH_STRUCTURE',path,'Supply finite acyclic JSON data.')];}catch{return [issue('GRAPH_STRUCTURE',path,'Supply finite acyclic JSON data.')];}}
function topology(graph:GraphDocumentV3):GraphDocumentV2{const {edgeDefaults:_,...rest}=graph;return {...rest,schema:'vict.flow-graph@2',edges:graph.edges.map(({appearance:_,...edge})=>edge)};}
export function validateGraphV3(input:unknown):GraphResultV3{const problems=structural(graphDocumentSchemaV3,input,'graph');if(problems.length)return {ok:false,issues:problems};const graph=clone(input) as GraphDocumentV3;const checked=validateGraphV2(topology(graph));return checked.ok?{ok:true,graph}:checked;}
export function parseGraphV3(source:string):GraphResultV3{try{return validateGraphV3(JSON.parse(source));}catch{return {ok:false,issues:[issue('GRAPH_JSON','graph','Supply valid graph JSON.')]};}}
export function serializeGraphV3(graph:GraphDocumentV3):string{const checked=validateGraphV3(graph);if(!checked.ok)throw new GraphValidationErrorV3(checked.issues);return JSON.stringify(checked.graph);}
export function parseGraphOperationsV3(input:unknown):GraphOperationsResultV3{
 const issues=structural(graphOperationsSchemaV3,input,'operations');if(issues.length)return {ok:false,issues};const operations=clone(input) as GraphOperationV3[];
 const retained=operations.filter(op=>!['setEdgeDefaults','setEdgeAppearance','clearEdgeAppearance'].includes(op.type)).map(op=>op.type==='connect'?{...op,edge:(({appearance:_,...edge})=>edge)(op.edge)}:op);
 if(retained.length){const checked=parseGraphOperationsV2(retained);if(!checked.ok)return checked;}
 return {ok:true,operations};
}
export function copyGraphSelectionV3(graph:GraphDocumentV3,selection:GraphSelection):string{const checked=validateGraphV3(graph);if(!checked.ok)throw new GraphValidationErrorV3(checked.issues);const nodes=checked.graph.nodes.filter(n=>selection.nodes.includes(n.id)),ids=new Set(nodes.map(n=>n.id));return JSON.stringify({schema:'vict.flow-clipboard@3',nodeTypes:checked.graph.nodeTypes.filter(t=>nodes.some(n=>n.type===t.id)),nodes,edges:checked.graph.edges.filter(e=>ids.has(e.source)&&ids.has(e.target)),...(graph.allowCycles===undefined?{}:{allowCycles:graph.allowCycles}),...(graph.edgeDefaults===undefined?{}:{edgeDefaults:clone(graph.edgeDefaults)})});}
export function applyGraphOperationsV3(graph:GraphDocumentV3,input:readonly GraphOperationV3[],expectedRevision=graph.revision):GraphResultV3{
 const parsed=parseGraphOperationsV3(input);if(!parsed.ok)return parsed;if(expectedRevision!==graph.revision)return {ok:false,issues:[issue('GRAPH_STALE','revision','Graph changed; read the current revision before retrying.')]};const initial=validateGraphV3(graph);if(!initial.ok)return initial;
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
export function migrateGraphV2ToV3(graph:GraphDocumentV2):GraphResultV3{const checked=validateGraphV2(graph);return checked.ok?validateGraphV3({...checked.graph,schema:'vict.flow-graph@3'}):checked;}
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
