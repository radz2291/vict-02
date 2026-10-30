import {describe,it,expect,vi,beforeEach} from 'vitest';
import {mount,unmount,flushSync} from 'svelte';
import {navigationSignals} from './NavigationSignals.svelte.js';
const hooks=vi.hoisted(()=>({fit:vi.fn(async()=>true)}));
vi.mock('@xyflow/svelte',async()=>{
  const {navigationSignals}=await import('./NavigationSignals.svelte.js');
  return {
    useSvelteFlow:()=>({fitView:hooks.fit}),
    useNodes:()=>({get current(){return navigationSignals.nodes;}}),
    useViewportInitialized:()=>({get current(){return navigationSignals.ready;}}),
  };
});
import FlowNavigation from '../src/FlowNavigation.svelte';
import NavigationHost from './NavigationHost.svelte';
async function settle(){flushSync();await Promise.resolve();flushSync();}
describe('initial camera fits the complete measured graph once',()=>{
  beforeEach(()=>{navigationSignals.nodes=[];navigationSignals.ready=false;navigationSignals.request=undefined;hooks.fit.mockReset().mockResolvedValue(true);});
  it('does not fit the first card alone, and does not refit after later edits',async()=>{
    const target=document.createElement('div');document.body.append(target);let ready=0;
    const app=mount(FlowNavigation,{target,props:{initialFit:true,initialNodeIds:['input','processor','output'],onInitialFit:()=>ready++}});
    navigationSignals.ready=true;await settle();expect(hooks.fit).not.toHaveBeenCalled();expect(ready).toBe(0);
    navigationSignals.nodes=[{id:'input',position:{x:20,y:60},data:{},measured:{width:280,height:200}},{id:'processor',position:{x:340,y:30},data:{}},{id:'output',position:{x:680,y:60},data:{}}];
    await settle();expect(hooks.fit).not.toHaveBeenCalled();expect(ready).toBe(0);
    navigationSignals.nodes=navigationSignals.nodes.map(node=>({...node,measured:{width:280,height:200}}));
    await settle();expect(hooks.fit).toHaveBeenCalledTimes(1);expect(hooks.fit).toHaveBeenCalledWith({minZoom:.15,maxZoom:1.1,padding:.2});expect(ready).toBe(1);
    navigationSignals.nodes=navigationSignals.nodes.map(node=>({...node,position:{x:node.position.x+10,y:10}}));
    await settle();expect(hooks.fit).toHaveBeenCalledTimes(1);
    await unmount(app);target.remove();
  });
  it('leaves restored cameras alone and completes an empty graph without an artificial fit',async()=>{
    const target=document.createElement('div');document.body.append(target);navigationSignals.ready=true;let ready=0;
    const restored=mount(FlowNavigation,{target,props:{initialFit:false,onInitialFit:()=>ready++}});
    await settle();expect(hooks.fit).not.toHaveBeenCalled();expect(ready).toBe(0);await unmount(restored);
    const empty=mount(FlowNavigation,{target,props:{initialFit:true,onInitialFit:()=>ready++}});
    await settle();expect(hooks.fit).not.toHaveBeenCalled();expect(ready).toBe(1);await unmount(empty);target.remove();
  });
  it.each(['false','reject'] as const)('recovers from %s only after a real measurement change, without a promise retry loop',async failure=>{
    const target=document.createElement('div');document.body.append(target);let ready=0;
    navigationSignals.nodes=[{id:'input',position:{x:20,y:60},data:{},measured:{width:280,height:200}}];navigationSignals.ready=true;
    if(failure==='false')hooks.fit.mockResolvedValueOnce(false);else hooks.fit.mockRejectedValueOnce(new Error('viewport unavailable'));
    const app=mount(FlowNavigation,{target,props:{initialFit:true,initialNodeIds:['input'],onInitialFit:()=>ready++}});
    await settle();await settle();expect(hooks.fit).toHaveBeenCalledTimes(1);expect(ready).toBe(0);
    navigationSignals.nodes=navigationSignals.nodes.map(node=>({...node,position:{x:40,y:60}}));
    await settle();expect(hooks.fit).toHaveBeenCalledTimes(1);
    navigationSignals.nodes=navigationSignals.nodes.map(node=>({...node,measured:{width:280,height:240}}));
    await settle();expect(hooks.fit).toHaveBeenCalledTimes(2);expect(ready).toBe(1);
    await unmount(app);target.remove();
  });
  it('allows a successful explicit Fit request to recover camera persistence after rejection',async()=>{
    const target=document.createElement('div');document.body.append(target);let ready=0;
    navigationSignals.nodes=[{id:'input',position:{x:20,y:60},data:{},measured:{width:280,height:200}}];navigationSignals.ready=true;
    hooks.fit.mockRejectedValueOnce(new Error('viewport unavailable'));
    const app=mount(NavigationHost,{target,props:{onInitialFit:()=>ready++}});
    await settle();await settle();expect(hooks.fit).toHaveBeenCalledTimes(1);expect(ready).toBe(0);
    navigationSignals.request={};await settle();expect(hooks.fit).toHaveBeenCalledTimes(2);expect(ready).toBe(1);
    await unmount(app);target.remove();
  });
});
