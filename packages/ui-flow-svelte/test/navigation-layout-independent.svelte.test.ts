import {beforeEach,expect,test,vi} from 'vitest';
import {mount,unmount,flushSync} from 'svelte';
import {navigationLayout,navigationFrame} from './navigation-layout-state.svelte.js';
import Host from './NavigationLayoutHost.svelte';
const control=vi.hoisted(()=>({fit:vi.fn()}));
vi.mock('@xyflow/svelte',async()=>{
 const {navigationLayout}=await import('./navigation-layout-state.svelte.js');
 return {useStore:()=>navigationLayout,useViewportInitialized:()=>({current:true}),useNodes:()=>({current:['crop','grade','caption'].map(id=>({id,measured:{width:210,height:128}}))}),useSvelteFlow:()=>({fitView:control.fit})};
});
const settle=async()=>{flushSync();await new Promise(resolve=>setTimeout(resolve,0));flushSync();};
beforeEach(()=>{control.fit.mockReset();navigationFrame.scale=.321269;navigationFrame.expectedWidth=736.8*.321269;navigationFrame.expectedHeight=378.4*.321269;navigationLayout.width=237;navigationLayout.height=122;});

test('a replacement frame already ready before old async fit settles retries immediately once, preserving focused draft',async()=>{
 const pending:ReturnType<typeof Promise.withResolvers<boolean>>[]=[];
 control.fit.mockImplementation(()=>{const next=Promise.withResolvers<boolean>();pending.push(next);return next.promise;});
 const target=document.createElement('div');document.body.append(target);const settled=vi.fn(),app=mount(Host,{target,props:{settled}});
 try{
  await settle();expect(control.fit).toHaveBeenCalledTimes(1);
  const input=target.querySelector('input')!;input.focus();input.value='Manual pending-fit draft';
  navigationFrame.scale=.5;navigationFrame.expectedWidth=368.4;navigationFrame.expectedHeight=189.2;navigationLayout.width=368;navigationLayout.height=189;
  await settle();expect(control.fit).toHaveBeenCalledTimes(1);
  pending[0].resolve(true);await settle();
  expect(settled).not.toHaveBeenCalled();expect(control.fit).toHaveBeenCalledTimes(2);
  pending[1].resolve(true);await settle();expect(settled).toHaveBeenCalledTimes(1);
  expect(target.querySelector('input')).toBe(input);expect(document.activeElement).toBe(input);expect(input.value).toBe('Manual pending-fit draft');
  navigationLayout.width=369;await settle();expect(control.fit).toHaveBeenCalledTimes(2);
 }finally{await unmount(app);target.remove();}
});

test.each(['false','reject'] as const)('a %s fit does not promise-loop and retries only when replacement layout is coherent',async mode=>{
 if(mode==='false')control.fit.mockResolvedValueOnce(false);else control.fit.mockRejectedValueOnce(new Error('Controlled fit failure'));
 control.fit.mockResolvedValue(true);
 const target=document.createElement('div');document.body.append(target);const settled=vi.fn(),app=mount(Host,{target,props:{settled}});
 try{
  await settle();await settle();await settle();expect(control.fit).toHaveBeenCalledTimes(1);expect(settled).not.toHaveBeenCalled();
  navigationFrame.scale=.5;navigationFrame.expectedWidth=368.4;navigationFrame.expectedHeight=189.2;
  await settle();expect(control.fit).toHaveBeenCalledTimes(1);
  navigationLayout.width=368;navigationLayout.height=189;await settle();
  expect(control.fit).toHaveBeenCalledTimes(2);expect(settled).toHaveBeenCalledTimes(1);
 }finally{await unmount(app);target.remove();}
});
