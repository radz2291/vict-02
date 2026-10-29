/** Version dispatch belongs at the model boundary; geometry and UI bodies never
 * convert control values or reinterpret saved graph versions. */
import type {UiValue} from '@victframework/ui';
import {GraphSession,emptyGraph,parseGraph,parseGraphOperations,graphType,graphFieldValue,graphPorts,connectionIssue,type GraphDocument,type GraphIssue,type GraphEdge} from '../editor/model.js';
import {GraphSessionV2,emptyGraphV2,parseGraphV2,parseGraphOperationsV2,graphTypeV2,graphParameterValueV2,graphPortsV2,connectionIssueV2,type GraphDocumentV2} from '../editor/model-v2.js';

export type WorkspaceModelVersion=1|2;
export type WorkspaceGraph=GraphDocument|GraphDocumentV2;
export type WorkspaceResult={ok:true;graph:WorkspaceGraph;removedNodeIds?:readonly string[]}|{ok:false;issues:readonly GraphIssue[]};
export interface WorkspaceSession {
  setReadOnly(value:boolean):void;
  apply(operations:unknown,revision:number):WorkspaceResult;
  undo():WorkspaceResult;
  redo():WorkspaceResult;
}
export const emptyWorkspaceGraph=(version:WorkspaceModelVersion):WorkspaceGraph=>version===1?emptyGraph():emptyGraphV2();
export function parseWorkspaceGraph(source:string,version:WorkspaceModelVersion):WorkspaceResult {
  return version===1?parseGraph(source):parseGraphV2(source);
}
export function createWorkspaceSession(graph:WorkspaceGraph,readOnly:boolean,validate:(graph:WorkspaceGraph)=>readonly GraphIssue[]):WorkspaceSession {
  if(graph.schema==='vict.flow-graph@1'){
    const session=new GraphSession(graph,{readOnly,validate});
    return {setReadOnly:value=>session.setReadOnly(value),undo:()=>session.undo(),redo:()=>session.redo(),apply(input,revision){
      const parsed=parseGraphOperations(input);if(!parsed.ok)return parsed;
      const result=session.apply(parsed.operations,revision);
      return result.ok?{...result,removedNodeIds:parsed.operations.flatMap(op=>op.type==='remove'?op.selection.nodes:[])}:result;
    }};
  }
  const session=new GraphSessionV2(graph,{readOnly,validate});
  return {setReadOnly:value=>session.setReadOnly(value),undo:()=>session.undo(),redo:()=>session.redo(),apply(input,revision){
    const parsed=parseGraphOperationsV2(input);if(!parsed.ok)return parsed;
    const result=session.apply(parsed.operations,revision);
    return result.ok?{...result,removedNodeIds:parsed.operations.flatMap(op=>op.type==='remove'?op.selection.nodes:[])}:result;
  }};
}
export function workspaceParameters(graph:WorkspaceGraph,nodeId:string):Readonly<Record<string,UiValue>> {
  if(graph.schema==='vict.flow-graph@1'){
    const node=graph.nodes.find(item=>item.id===nodeId);if(!node)return {};
    return Object.fromEntries(graphType(graph,node).fields.map(field=>[field.id,graphFieldValue(graph,node,field)]));
  }
  const node=graph.nodes.find(item=>item.id===nodeId);if(!node)return {};
  return Object.fromEntries(Object.entries(graphTypeV2(graph,node).parameters).map(([key,parameter])=>[key,graphParameterValueV2(graph,node,key)??parameter.default]));
}
export function workspacePorts(graph:WorkspaceGraph,nodeId:string){
  if(graph.schema==='vict.flow-graph@1'){const node=graph.nodes.find(item=>item.id===nodeId);return node?graphPorts(graph,node):[];}
  const node=graph.nodes.find(item=>item.id===nodeId);return node?graphPortsV2(graph,node):[];
}
export function workspaceConnectionIssue(graph:WorkspaceGraph,edge:GraphEdge){return graph.schema==='vict.flow-graph@1'?connectionIssue(graph,edge):connectionIssueV2(graph,edge);}
export function workspaceParameterOperation(graph:WorkspaceGraph,nodeId:string,key:string,value:UiValue):unknown {
  return graph.schema==='vict.flow-graph@1'?{type:'setField',nodeId,fieldId:key,value}:{type:'setParameter',nodeId,key,value};
}
