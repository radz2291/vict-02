import {test,expect,vi} from 'vitest';
import {mount,unmount,flushSync} from 'svelte';
import {portProbe} from './port-projection-independent-probe.js';
import Host from './PortProjectionIndependentHost.svelte';
import {createHandleProjection} from '../src/handle-projection.js';
import {graphFixture} from './editor-fixture.js';
import {migrateGraphV1ToV2} from '../src/editor/model-v2.js';
import {migrateGraphV2ToV3} from '../src/editor/model-v3.js';
import {createWorkspaceSession,workspacePorts,workspaceConnectionIssue,type WorkspaceGraph} from '../src/composition/workspace-model.js';
import type {GraphWorkspaceContext} from '../src/composition/context.js';
vi.mock('@xyflow/svelte',async original=>({...await original<typeof import('@xyflow/svelte')>(),SvelteFlow:(await import('./PortProjectionIndependentEngine.svelte')).default}));
function harness(){
 const v2=migrateGraphV1ToV2(graphFixture(),{acknowledgeUnmappedConstraints:true});if(!v2.ok)throw Error('fixture');
 const v3=migrateGraphV2ToV3(v2.graph);if(!v3.ok)throw Error('fixture');
 let graph:WorkspaceGraph=v3.graph; graph.edges[0]={...graph.edges[0],appearance:{pattern:'dash',color:'#123456'}};
 const session=createWorkspaceSession(graph,false,()=>[]);const calls:unknown[]=[];let readonly=false;
 const workspace={get graph(){return graph;},get readOnly(){return readonly;},selection:{nodes:[],edges:[]},viewFor:()=>undefined,frame:()=>({key:'frame',props:{}}),ports:(node:{id:string})=>workspacePorts(graph,node.id),connectionIssue:(edge:Parameters<typeof workspaceConnectionIssue>[1])=>workspaceConnectionIssue(graph,edge),remember:()=>{},select:()=>{},apply(ops:Parameters<typeof session.apply>[0],revision?:number){calls.push(ops);const result=session.apply(ops,revision??graph.revision);if(result.ok)graph=result.graph;},undo(){const r=session.undo();if(r.ok)graph=r.graph;},redo(){const r=session.redo();if(r.ok)graph=r.graph;}} as unknown as GraphWorkspaceContext;
 return{workspace,calls,get graph(){return graph;},replace(){graph=JSON.parse(JSON.stringify(graph));},readonly(){readonly=true;}};
}
const settle=async()=>{flushSync();await new Promise(r=>setTimeout(r,30));flushSync();};
async function mounted(){const h=harness();const target=document.createElement('div');document.body.append(target);const app=mount(Host,{target,props:{workspace:h.workspace}});await settle();const p=portProbe.current!;expect(p).toBeTruthy();return{h,p,dispose:async()=>{await unmount(app);target.remove();}};}
function engineCandidate(p:Record<string,unknown>){
 const nodes=p.nodes as {id:string;data:{projectHandle:(node:string,port:string)=>string}}[];const id=nodes[0].data.projectHandle;
 return{source:'c',sourceHandle:id('c','out'),target:'b',targetHandle:id('b','in')};
}
test('actual viewport callback refuses sibling/foreign-node/raw IDs before any source operation, then reconnects graph3 canonically',async()=>{
 const{h,p,dispose}=await mounted();try{
  const own=engineCandidate(p),before=JSON.stringify(h.graph.nodes),old=h.graph.edges[0];const start=p.onreconnectstart as (e:object,edge:{id:string})=>void;const valid=p.isValidConnection as (v:unknown)=>boolean;const commit=p.onbeforereconnect as (n:unknown,o:{id:string})=>boolean;
  const nodes=p.nodes as {data:{projectHandle:(node:string,port:string)=>string}}[];const project=nodes[0].data.projectHandle;
  for(const sourceHandle of ['out',createHandleProjection('foreign').id('c','out'),project('a','out'),project('c','in')]){start({},old);expect(valid({...own,sourceHandle})).toBe(false);expect(commit({...own,sourceHandle},old)).toBe(false);expect(h.calls).toEqual([]);}
  start({},old);expect(valid(own)).toBe(true);commit(own,old);expect(h.calls).toHaveLength(1);expect(JSON.stringify(h.calls)).not.toContain('vict-h:');expect(h.graph.edges[0]).toEqual({...old,source:'c'});expect(JSON.stringify(h.graph.nodes)).toBe(before);
  h.workspace.undo();expect(h.graph.edges[0]).toEqual(old);h.workspace.redo();expect(h.graph.edges[0]).toEqual({...old,source:'c'});
 }finally{await dispose();}
});
test.each(['same-revision replacement','readonly','unmount'] as const)('retained actual viewport callback cannot commit after %s',async(reason)=>{
 const{h,p,dispose}=await mounted();let disposed=false;try{
  const candidate=engineCandidate(p),edge=h.graph.edges[0];(p.onreconnectstart as (e:object,x:unknown)=>void)({},edge);
  if(reason==='same-revision replacement')h.replace();if(reason==='readonly')h.readonly();if(reason==='unmount'){await dispose();disposed=true;}
  expect((p.onbeforereconnect as (n:unknown,e:unknown)=>boolean)(candidate,edge)).toBe(false);expect(h.calls).toEqual([]);expect(h.graph.edges[0].source).toBe('a');
 }finally{if(!disposed)await dispose();}
});
test('physical edge mapping is identical to own node projection, without semantic source mutation',async()=>{
 const{h,p,dispose}=await mounted();try{
  const nodes=p.nodes as {id:string;data:{projectHandle:(node:string,port:string)=>string}}[];const edges=p.edges as {source:string;target:string;sourceHandle:string;targetHandle:string}[];
  for(const edge of edges){expect(edge.sourceHandle).toBe(nodes.find(n=>n.id===edge.source)!.data.projectHandle(edge.source,'out'));expect(edge.targetHandle).toBe(nodes.find(n=>n.id===edge.target)!.data.projectHandle(edge.target,'in'));}
  expect(h.graph.edges[0].sourcePort).toBe('out');expect(h.graph.edges[0].targetPort).toBe('in');expect(h.calls).toEqual([]);
 }finally{await dispose();}
});
