import type { GraphEdge } from '../editor/model.js';
import type { GraphWorkspaceContext, GraphWorkspaceGraph } from './context.js';
type Candidate=Omit<GraphEdge,'id'>;
interface Gesture {graph:GraphWorkspaceGraph;revision:number;edgeId?:string;event?:object}
// Both retained models reserve this ID. It cannot accidentally exclude a real
// edge from preview validation, and it is never emitted in a source operation.
const UNCOMMITTED_EDGE_ID='__proto__';
/** Runtime gesture ownership only; canonical state and validation stay in workspace. */
export class GraphConnectionGesture {
  private active:Gesture|undefined;
  constructor(private readonly workspace:()=>GraphWorkspaceContext|undefined,private readonly mounted:()=>boolean=()=>true){}
  cancel(){const hadGesture=this.active!==undefined;this.active=undefined;return hadGesture;}
  private current(){const workspace=this.workspace(),gesture=this.active;return !!(this.mounted()&&workspace&&!workspace.readOnly&&gesture&&workspace.graph===gesture.graph&&workspace.graph.revision===gesture.revision&&(!gesture.edgeId||workspace.graph.edges.some(edge=>edge.id===gesture.edgeId)));}
  beginConnect(event?:object){
    // The public reconnect anchor invokes reconnectstart then connectstart for
    // the very same original event. An abandoned older gesture must not turn a
    // later ordinary connection into a reconnect.
    if(event!==undefined&&this.active?.edgeId&&this.active.event===event&&this.current())return;
    this.begin(undefined,event);
  }
  beginReconnect(edgeId:string,event?:object){this.begin(edgeId,event);}
  private begin(edgeId?:string,event?:object){
    const workspace=this.workspace();this.cancel();
    if(!this.mounted()||!workspace||workspace.readOnly||edgeId!==undefined&&!workspace.graph.edges.some(edge=>edge.id===edgeId))return;
    this.active={graph:workspace.graph,revision:workspace.graph.revision,event,...(edgeId===undefined?{}:{edgeId})};
  }
  valid(candidate:Candidate){
    const workspace=this.workspace();if(!this.mounted()||!workspace||workspace.readOnly||this.active&&!this.current())return false;
    return !workspace.connectionIssue({...candidate,id:this.active?.edgeId??UNCOMMITTED_EDGE_ID});
  }
  connect(candidate:Candidate){
    const workspace=this.workspace(),gesture=this.active;
    if(workspace&&gesture&&gesture.edgeId===undefined&&this.current()&&this.valid(candidate))workspace.apply([{type:'connect',edge:candidate}],gesture.revision);
    this.cancel();
  }
  reconnect(edgeId:string,candidate:Candidate){
    const workspace=this.workspace(),gesture=this.active;
    if(workspace&&gesture?.edgeId===edgeId&&this.current()&&this.valid(candidate))workspace.apply([{type:'reconnect',edgeId,connection:candidate}],gesture.revision);
    this.cancel();
  }
}
