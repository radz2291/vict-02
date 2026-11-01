// @vitest-environment happy-dom
import {afterEach,expect,test,vi} from 'vitest';
import {mount,unmount,flushSync} from 'svelte';
import {observeFlowCoordinateFrame} from '../../../../packages/ui-flow-svelte/src/flow-coordinate-frame.js';
const refresh=vi.hoisted(()=>vi.fn());
vi.mock('@xyflow/svelte',()=>({useUpdateNodeInternals:()=>refresh}));
import Host from '../../../../packages/ui-flow-svelte/test/CoordinateHandleRefreshHost.svelte';
const settle=async()=>{flushSync();await Promise.resolve();flushSync();await Promise.resolve();};
afterEach(()=>{document.body.replaceChildren();vi.restoreAllMocks();});

test('recorded uniform frame recovers after an actual unsupported ancestor and stops after destroy',async()=>{
 const parent=document.createElement('div'),root=document.createElement('div');
 parent.append(root);document.body.append(parent);root.style.width='736.8px';root.style.height='378.4px';
 parent.style.transform='matrix(0.175699,0,0,0.175699,99.4736,245.173)';
 vi.spyOn(root,'getBoundingClientRect').mockReturnValue(new DOMRect(300,350,129.4547882080078,66.48445129394531));
 const seen:{scale:number;supported:boolean}[]=[];
 const observer=observeFlowCoordinateFrame(root,(scale,supported)=>seen.push({scale,supported}));
 expect(seen.at(-1)?.supported).toBe(true);
 parent.style.scale='1 1.01';await new Promise(resolve=>setTimeout(resolve,0));
 expect(seen.at(-1)).toEqual({scale:1,supported:false});
 parent.style.scale='1 1';await new Promise(resolve=>setTimeout(resolve,0));
 expect(seen.at(-1)?.supported).toBe(true);expect(seen.at(-1)?.scale).toBeCloseTo(.17569877405997613,12);
 observer.destroy();const count=seen.length;
 parent.style.scale='1 1.5';window.dispatchEvent(new Event('resize'));
 await new Promise(resolve=>setTimeout(resolve,0));expect(seen).toHaveLength(count);
});

test('queued nearest-coordinate refresh cannot update a destroyed card',async()=>{
 refresh.mockClear();const target=document.createElement('div');document.body.append(target);
 const app=mount(Host,{target,props:{id:'destroyed-before-tick'}});
 await settle();refresh.mockClear();
 app.setScale(.17569877405997613);flushSync();await unmount(app);await settle();
 expect(refresh).not.toHaveBeenCalled();
});
