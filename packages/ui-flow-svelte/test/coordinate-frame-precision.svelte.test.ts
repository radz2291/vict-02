import {afterEach,expect,test,vi} from 'vitest';
import {observeFlowCoordinateFrame} from '../src/flow-coordinate-frame.js';
afterEach(()=>{document.body.replaceChildren();vi.restoreAllMocks();});
function observe(transform:string,scale?:string,rect=new DOMRect(300,350,129.4547882080078,66.48445129394531)){
 const parent=document.createElement('div'),root=document.createElement('div');
 parent.style.transform=transform;if(scale)parent.style.scale=scale;
 root.style.width='736.8px';root.style.height='378.4px';parent.append(root);document.body.append(parent);
 vi.spyOn(root,'getBoundingClientRect').mockReturnValue(rect);
 let result:{scale:number;supported:boolean}|undefined;
 const observer=observeFlowCoordinateFrame(root,(scale,supported)=>result={scale,supported});
 observer.destroy();return result!;
}
test('recorded uniform Social frame tolerates subpixel DOMRect quantization',()=>{
 const seen=observe('matrix(0.175699,0,0,0.175699,99.4736,245.173)');
 expect(seen.supported).toBe(true);expect(seen.scale).toBeCloseTo(.1756987740599761,12);
});
test.each([
 ['matrix(1,0,0,1.00001,0,0)',undefined],
 ['none','1 1.00001'],
 ['matrix(1,0,0,1.01,0,0)',undefined],
 ['none','1 1.01'],
 ['matrix(-1,0,0,-1,0,0)',undefined],
 ['matrix(0,1,-1,0,0,0)',undefined],
])('transform evidence rejects actual anisotropy/reflection/rotation despite a near-uniform rectangle (%s,%s)',(transform,scale)=>{
 expect(observe(transform,scale,new DOMRect(0,0,368.4,189.2)).supported).toBe(false);
});
test('unexplained physically nonuniform rectangle remains refused',()=>{
 expect(observe('none',undefined,new DOMRect(0,0,129,70)).supported).toBe(false);
});
