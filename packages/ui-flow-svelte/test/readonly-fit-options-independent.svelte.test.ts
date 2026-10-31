import {beforeEach,expect,test,vi} from 'vitest';
import {mount,unmount,flushSync} from 'svelte';
import {navigationLayout,navigationFrame} from './navigation-layout-state.svelte.js';
import Host from './NavigationOptionsIndependentHost.svelte';
const control=vi.hoisted(()=>({fit:vi.fn()}));
vi.mock('@xyflow/svelte',async()=>{
 const {navigationLayout}=await import('./navigation-layout-state.svelte.js');
 return {useStore:()=>navigationLayout,useViewportInitialized:()=>({current:true}),useNodes:()=>({current:['crop','grade','caption'].map(id=>({id,measured:{width:180,height:54}}))}),useSvelteFlow:()=>({fitView:control.fit})};
});
const settle=async()=>{flushSync();await new Promise(resolve=>setTimeout(resolve,0));flushSync();};
beforeEach(()=>{control.fit.mockReset().mockResolvedValue(true);navigationFrame.scale=.321269;navigationFrame.expectedWidth=736.8*.321269;navigationFrame.expectedHeight=380*.321269;navigationLayout.width=737;navigationLayout.height=380;});

test.each([{name:'read-only original options',options:{minZoom:.5,maxZoom:2,padding:.1},expected:{minZoom:.5,maxZoom:2,padding:.1}},{name:'workspace/editor unchanged defaults',options:undefined,expected:{minZoom:.15,maxZoom:1.1,padding:.2}}])('$name wait for physical layout and retain their own fit policy',async({options,expected})=>{
 const target=document.createElement('div');document.body.append(target);const settled=vi.fn(),app=mount(Host,{target,props:{options,settled}});
 try{
  await settle();expect(control.fit).not.toHaveBeenCalled();
  navigationLayout.width=237;navigationLayout.height=122;await settle();
  expect(control.fit).toHaveBeenCalledTimes(1);expect(control.fit).toHaveBeenCalledWith({minZoom:expected.minZoom*.321269,maxZoom:expected.maxZoom*.321269,padding:expected.padding});expect(settled).toHaveBeenCalledTimes(1);
  navigationFrame.scale=.5;navigationFrame.expectedWidth=368.4;navigationFrame.expectedHeight=190;navigationLayout.width=368;navigationLayout.height=190;await settle();
  expect(control.fit).toHaveBeenCalledTimes(1);
 }finally{await unmount(app);target.remove();}
});
