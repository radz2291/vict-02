import {afterEach,expect,test,vi} from 'vitest';
import observations from '../../../docs/studio/foundation-evidence/node-suite-stress-20261031/ancestor-scale-coordinate/coherent-independent/native-observation.json';
import {observeFlowCoordinateFrame} from '../src/flow-coordinate-frame.js';

afterEach(()=>{document.body.replaceChildren();vi.restoreAllMocks();vi.unstubAllGlobals();});

test.each(observations.frames.map((frame,index)=>({frame,index})))('captured frame $index stays supported when stale RO data arrives after fresh layout',({frame})=>{
 let callback:ResizeObserverCallback|undefined;
 vi.stubGlobal('ResizeObserver',class {constructor(next:ResizeObserverCallback){callback=next;}observe(){}unobserve(){}disconnect(){}});
 const root=document.createElement('div');root.style.width=frame.computed.width;root.style.height=frame.computed.height;document.body.append(root);
 vi.spyOn(root,'getBoundingClientRect').mockReturnValue(new DOMRect(frame.rect.x,frame.rect.y,frame.rect.width,frame.rect.height));
 const seen:{scale:number;supported:boolean}[]=[];
 const observer=observeFlowCoordinateFrame(root,(scale,supported)=>seen.push({scale,supported}));
 try{
  const expected=(frame.rect.width/parseFloat(frame.computed.width)+frame.rect.height/parseFloat(frame.computed.height))/2;
  expect(seen.at(-1)).toEqual({scale:expected,supported:true});
  // Deliberately synthetic stale data. These are not measured native RO values.
  callback!([{target:root,contentRect:new DOMRect(0,0,800.25,400.5)} as ResizeObserverEntry],{} as ResizeObserver);
  expect(seen.at(-1)).toEqual({scale:expected,supported:true});
 }finally{observer.destroy();}
});

test('measurement uses owning frame constructors and fences a delivered callback after teardown',()=>{
 const iframe=document.createElement('iframe');document.body.append(iframe);
 const owner=iframe.contentWindow!,doc=iframe.contentDocument!;
 let callback:ResizeObserverCallback|undefined,disconnected=0,matrixReads=0;
 class OwnResizeObserver {constructor(next:ResizeObserverCallback){callback=next;}observe(){}unobserve(){}disconnect(){disconnected++;}}
 class OwnMatrix {is2D=true;a=.5;d=.5;b=0;c=0;constructor(_transform:string){matrixReads++;}}
 Object.defineProperty(owner,'ResizeObserver',{value:OwnResizeObserver,configurable:true});
 Object.defineProperty(owner,'DOMMatrixReadOnly',{value:OwnMatrix,configurable:true});
 vi.stubGlobal('ResizeObserver',class {constructor(){throw Error('Host-window constructor used');}});
 vi.stubGlobal('DOMMatrixReadOnly',class {constructor(){throw Error('Host-window matrix used');}});
 const parent=doc.createElement('div'),root=doc.createElement('div');parent.style.transform='matrix(0.5,0,0,0.5,0,0)';root.style.width='760px';root.style.height='380px';parent.append(root);doc.body.append(parent);
 vi.spyOn(root,'getBoundingClientRect').mockReturnValue(new DOMRect(0,0,380,190));
 const seen:{scale:number;supported:boolean}[]=[];
 const observer=observeFlowCoordinateFrame(root,(scale,supported)=>seen.push({scale,supported}));
 expect(seen.at(-1)).toEqual({scale:.5,supported:true});expect(matrixReads).toBeGreaterThan(0);
 const count=seen.length;observer.destroy();
 callback!([{target:root,contentRect:new DOMRect(0,0,760,380)} as ResizeObserverEntry],{} as ResizeObserver);
 expect(disconnected).toBe(1);expect(seen).toHaveLength(count);
});
