import {afterEach,expect,test,vi} from 'vitest';
import {observeFlowCoordinateFrame} from '../src/flow-coordinate-frame.js';

afterEach(()=>{document.body.replaceChildren();vi.restoreAllMocks();});

test('computed responsive ancestor scaling refreshes on viewport resize without an attribute mutation',async()=>{
  const parent=document.createElement('div'),root=document.createElement('div');
  root.style.width='760px';root.style.height='380px';parent.append(root);document.body.append(parent);
  // A CSS media-query/viewport-unit transform changes its computed result on
  // resize without changing style/class attributes or the content-box size.
  let scale=.5;
  const computed=window.getComputedStyle.bind(window);
  vi.spyOn(window,'getComputedStyle').mockImplementation((element,pseudo)=>{
    const css=computed(element,pseudo);
    return element===parent?new Proxy(css,{get(target,key){if(key==='transform')return `matrix(${scale}, 0, 0, ${scale}, 0, 0)`;const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}}):css;
  });
  vi.spyOn(root,'getBoundingClientRect').mockImplementation(()=>new DOMRect(10,20,760*scale,380*scale));
  const seen:{scale:number;supported:boolean}[]=[];
  const observer=observeFlowCoordinateFrame(root,(next,supported)=>seen.push({scale:next,supported}));
  try{
    expect(seen.at(-1)).toEqual({scale:.5,supported:true});
    scale=.25;
    window.dispatchEvent(new Event('resize'));
    await new Promise(resolve=>setTimeout(resolve,0));
    expect(seen.at(-1)).toEqual({scale:.25,supported:true});
  }finally{observer.destroy();}
});

test('queued ancestor changes cannot publish after teardown or alter a sibling observer',async()=>{
 const parent=document.createElement('div'),root=document.createElement('div'),sibling=document.createElement('div');
 for(const element of [root,sibling]){element.style.width='760px';element.style.height='380px';vi.spyOn(element,'getBoundingClientRect').mockReturnValue(new DOMRect(0,0,380,190));}
 parent.append(root);document.body.append(parent,sibling);
 const own:number[]=[],other:number[]=[];
 const a=observeFlowCoordinateFrame(root,next=>own.push(next)),b=observeFlowCoordinateFrame(sibling,next=>other.push(next));
 const ownCount=own.length,otherCount=other.length;
 parent.className='changed';a.destroy();
 await new Promise(resolve=>setTimeout(resolve,0));
 expect(own).toHaveLength(ownCount);expect(other).toHaveLength(otherCount);b.destroy();
});
