import {afterEach,it,expect,vi} from 'vitest';
const toSvg=vi.hoisted(()=>vi.fn());vi.mock('html-to-image',()=>({toSvg}));
import {captureRenderedElement} from '../../../../packages/ui-ai-svelte/src/capture.js';
const fonts=Object.getOwnPropertyDescriptor(document,'fonts');
afterEach(()=>{document.body.replaceChildren();vi.restoreAllMocks();vi.unstubAllGlobals();toSvg.mockReset();if(fonts)Object.defineProperty(document,'fonts',fonts);else Reflect.deleteProperty(document,'fonts');});
function setup(rootRect:DOMRect,viewportRect:DOMRect,popupRect:DOMRect){
 const root=document.createElement('div'),popup=document.createElement('div'),viewport=document.createElement('div');
 root.style.cssText='width:100px;height:100px;overflow:visible';root.dataset.uiOwnerRoot='own';popup.dataset.uiOwner='own';popup.style.position='absolute';root.append(popup);document.body.append(root);
 for(const [node,rect] of [[root,rootRect],[popup,popupRect],[viewport,viewportRect]] as const){vi.spyOn(node,'getBoundingClientRect').mockReturnValue(rect);vi.spyOn(node,'getClientRects').mockReturnValue([rect] as unknown as DOMRectList);}
 Object.defineProperty(document,'fonts',{configurable:true,value:{ready:Promise.resolve()}});
 toSvg.mockImplementation(async()=>`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div xmlns="http://www.w3.org/1999/xhtml" /></foreignObject></svg>`)}`);
 vi.stubGlobal('Image',class{onload?:()=>void;set src(_v:string){queueMicrotask(()=>this.onload?.());}});
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({fillStyle:'',fillRect:vi.fn(),drawImage:vi.fn()} as unknown as CanvasRenderingContext2D);
 vi.spyOn(HTMLCanvasElement.prototype,'toBlob').mockImplementation(cb=>cb(new Blob(['pixels'],{type:'image/jpeg'})));
 return {root,viewport};
}
it('does not claim uncropped success while omitting same-owner visible paint above/left of an inset capture root',async()=>{
 const {root,viewport}=setup(new DOMRect(50.25,50.5,100,100),new DOMRect(0,0,300,300),new DOMRect(10.25,10.5,80,80));
 const before=root.outerHTML;
 let captured:Awaited<ReturnType<typeof captureRenderedElement>>|undefined;
 try{captured=await captureRenderedElement(root,viewport);}
 catch(error){expect((error as Error).message).toMatch(/UNSUPPORTED/);}
 if(captured){
  console.log(JSON.stringify(captured,(_key,value)=>value instanceof Blob?'blob':value));
  expect(captured.cropped||(captured.width>=140&&captured.height>=140),'Visible left/up overflow must be captured, marked partial, or explicitly refused').toBe(true);
 }
 expect(root.outerHTML).toBe(before);
});
it('keeps fractional inset offsets and right/bottom paint accounting relative to the real capture root',async()=>{
 const {root,viewport}=setup(new DOMRect(20.2,30.4,100,100),new DOMRect(50.6,60.8,200,200),new DOMRect(75.2,115.4,80,80));
 expect(await captureRenderedElement(root,viewport)).toMatchObject({width:105,height:135,sourceWidth:135,sourceHeight:165,offsetLeft:31,offsetTop:31,cropped:true});
});
