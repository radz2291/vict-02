import {describe,it,expect} from 'vitest';
import {mount,unmount,flushSync} from 'svelte';
import {GraphConnectionGesture} from '../src/composition/connection-gesture.js';
import type {GraphWorkspaceContext} from '../src/composition/context.js';
import {createWorkspaceSession,workspacePorts,workspaceConnectionIssue,type WorkspaceGraph} from '../src/composition/workspace-model.js';
import {migrateGraphV1ToV2} from '../src/editor/model-v2.js';
import {graphFixture} from './editor-fixture.js';
import ReconnectEdgeFixture from './ReconnectEdgeFixture.svelte';

function harness(version:1|2=2){
  const legacy=graphFixture();legacy.nodeTypes[0]!.ports.find(port=>port.id==='out')!.maxConnections=1;
  const migrated=migrateGraphV1ToV2(legacy,{acknowledgeUnmappedConstraints:true});if(!migrated.ok)throw Error('Fixture');
  let current:WorkspaceGraph=version===1?legacy:migrated.graph,readOnly=false,mounted=true;
  let session=createWorkspaceSession(current,false,()=>[]);
  const calls:{operations:readonly unknown[];revision?:number}[]=[];
  const accept=(result:ReturnType<typeof session.undo>)=>{if(result.ok)current=result.graph;};
  const workspace:GraphWorkspaceContext={get graph(){return current;},get readOnly(){return readOnly;},selection:{nodes:[],edges:['ab']},body:undefined,viewFor:()=>undefined,
    frame:node=>({key:node.id,props:{}}),ports:node=>workspacePorts(current,node.id),connectionIssue:edge=>workspaceConnectionIssue(current,edge),
    apply(operations,revision){calls.push({operations,revision});accept(session.apply(operations,revision??current.revision));},select:()=>{},remember:()=>{},undo:()=>accept(session.undo()),redo:()=>accept(session.redo()),
  };
  return {workspace,calls,get graph(){return current;},get mounted(){return mounted;},unmount(){mounted=false;},setReadOnly(value:boolean){readOnly=value;session.setReadOnly(value);},replace(graph:WorkspaceGraph){current=graph;session=createWorkspaceSession(current,readOnly,()=>[]);}};
}
const candidate=(source='a',target='b')=>({source,sourcePort:'out',target,targetPort:'in'});
const copy=<T>(value:T):T=>JSON.parse(JSON.stringify(value));

describe('public geometry reconnect ownership',()=>{
  for(const version of [1,2] as const)it(`reconnects source and target atomically with the same edge ID and history in graph${version}`,()=>{
    const h=harness(version),controller=new GraphConnectionGesture(()=>h.workspace,()=>h.mounted),before=copy(h.graph);
    controller.beginReconnect('ab');
    expect(controller.valid(candidate())).toBe(true); // Existing capacity-one edge excludes itself.
    expect(controller.valid(candidate('c','b'))).toBe(true);controller.reconnect('ab',candidate('c','b'));
    expect(h.graph.edges).toEqual([{id:'ab',...candidate('c','b')}]);expect(h.graph.revision).toBe(4);
    expect(h.graph.nodes.map(node=>node.values)).toEqual(before.nodes.map(node=>node.values));expect(h.graph.nodes.map(node=>node.position)).toEqual(before.nodes.map(node=>node.position));
    h.workspace.undo();expect(h.graph.edges).toEqual(before.edges);
    controller.beginReconnect('ab');expect(controller.valid(candidate('a','c'))).toBe(true);controller.reconnect('ab',candidate('a','c'));
    expect(h.graph.edges).toEqual([{id:'ab',...candidate('a','c')}]);expect(h.calls).toHaveLength(2);
    expect(h.calls[0]!.revision).toBe(3);expect(h.calls[1]!.revision).toBe(5);
    h.workspace.undo();expect(h.graph.edges).toEqual(before.edges);
  });

  it('refuses incompatible type, occupied capacity and cycle candidates without changing canonical data',()=>{
    for(const kind of ['type','capacity','cycle'] as const){
      const h=harness(),graph=copy(h.graph);
      if(kind==='type')graph.nodes.find(node=>node.id==='c')!.ports=[{id:'in',label:'Image input',direction:'input',type:'image'}];
      if(kind==='capacity')graph.edges.push({id:'bc',...candidate('b','c')});
      if(kind==='cycle')graph.edges.push({id:'ca',...candidate('c','a')});
      h.replace(graph);const controller=new GraphConnectionGesture(()=>h.workspace),before=JSON.stringify(h.graph);
      controller.beginReconnect('ab');expect(controller.valid(candidate('a','c')),kind).toBe(false);controller.reconnect('ab',candidate('a','c'));
      expect(JSON.stringify(h.graph),kind).toBe(before);expect(h.calls,kind).toEqual([]);
    }
  });

  it('preserves only the same-event reconnect callback pair and resets abandoned gestures',()=>{
    const h=harness(),controller=new GraphConnectionGesture(()=>h.workspace),reconnectEvent={};
    controller.beginReconnect('ab',reconnectEvent);controller.beginConnect(reconnectEvent);
    expect(controller.valid(candidate('a','c'))).toBe(true); // Excludes the old capacity-one edge.
    controller.beginConnect({});
    expect(controller.valid(candidate('a','c'))).toBe(false); // A new start counts the old edge normally.
    controller.reconnect('ab',candidate('c','b'));expect(h.calls).toEqual([]);
    controller.beginReconnect('ab',{});expect(controller.cancel()).toBe(true);expect(controller.cancel()).toBe(false);
    controller.reconnect('ab',candidate('c','b'));expect(h.calls).toEqual([]);
    controller.beginReconnect('ab');controller.beginConnect();
    expect(controller.valid(candidate('a','c'))).toBe(false); // Missing event identity never preserves ownership.
  });

  it('does not exclude a real edge named pending during new-connection validation',()=>{
    const h=harness(),graph=copy(h.graph);graph.edges[0]!.id='pending';h.replace(graph);
    const controller=new GraphConnectionGesture(()=>h.workspace);controller.beginConnect();
    expect(controller.valid(candidate('a','c'))).toBe(false);
    expect(controller.valid(candidate('c','a'))).toBe(true);controller.connect(candidate('c','a'));
    expect(h.graph.edges).toHaveLength(2);expect(h.graph.edges[0]!.id).toBe('pending');expect(h.graph.edges[1]!.id).not.toBe('__proto__');
  });

  it('fences same-revision replacement, read-only, cancel, unmount and separate graph occurrences',()=>{
    for(const reason of ['source','readonly','cancel','unmount'] as const){
      const h=harness(),controller=new GraphConnectionGesture(()=>h.workspace,()=>h.mounted);controller.beginReconnect('ab');
      if(reason==='source'){const graph=copy(h.graph);graph.nodes[0]!.label='Manual source replacement';h.replace(graph);}
      if(reason==='readonly')h.setReadOnly(true);
      if(reason==='cancel')controller.cancel();
      if(reason==='unmount')h.unmount();
      controller.reconnect('ab',candidate('c','b'));
      expect(h.calls,reason).toEqual([]);expect(h.graph.edges).toEqual([{id:'ab',...candidate()}]);
      if(reason==='source')expect(h.graph.nodes[0]!.label).toBe('Manual source replacement');
    }
    const one=harness(),two=harness(),first=new GraphConnectionGesture(()=>one.workspace),second=new GraphConnectionGesture(()=>two.workspace);
    first.beginReconnect('ab');second.beginReconnect('ab');second.reconnect('ab',candidate('c','b'));
    expect(one.graph.edges).toEqual([{id:'ab',...candidate()}]);expect(first.valid(candidate('a','c'))).toBe(true);
  });

  it('renders two public pointer anchors only for a selected writable edge',async()=>{
    const target=document.createElement('div');document.body.append(target);const fixture=mount(ReconnectEdgeFixture,{target});
    const settle=async()=>{flushSync();await new Promise(resolve=>setTimeout(resolve,40));flushSync();};
    try{
      await settle();expect(target.querySelectorAll('.svelte-flow__edge-path')).toHaveLength(1);
      expect(target.querySelectorAll('[data-graph-reconnect]')).toHaveLength(2);
      expect(target.querySelector('[data-graph-reconnect][role="button"]')).toBeNull();
      expect([...target.querySelectorAll('[data-graph-reconnect]')].every(anchor=>anchor.getAttribute('aria-hidden')==='true')).toBe(true);
      fixture.configure(false,false);await settle();expect(target.querySelectorAll('[data-graph-reconnect]')).toHaveLength(0);
      fixture.configure(true,true);await settle();expect(target.querySelectorAll('[data-graph-reconnect]')).toHaveLength(0);expect(target.querySelectorAll('.svelte-flow__edge-path')).toHaveLength(1);
      fixture.configure(true,false);await settle();expect(target.querySelectorAll('[data-graph-reconnect]')).toHaveLength(2);
    }finally{await unmount(fixture);target.remove();}
  });
});
