// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@victframework/ui-ai-svelte',()=>({captureRenderedElement:vi.fn()}));
import { captureRenderedElement } from '@victframework/ui-ai-svelte';
import { captureDesignerPreview } from '../../src/lib/designer/visual-observation.js';
const cursor={documentId:'capture-evidence',revision:'r1#6',digest:'fixture',epoch:'be5d20ea-a11d-49cc-98ef-ef062f089e81'};
afterEach(()=>{document.body.innerHTML='';vi.mocked(captureRenderedElement).mockReset();});
it('retains capture-time geometry and exact raster changed fences without weakening refusal (DOM/raster seam simulation)',async()=>{
 const frame=document.createElement('div');const viewport=document.createElement('div');viewport.append(frame);document.body.append(viewport);
 let width=400;frame.getBoundingClientRect=()=>new DOMRect(10,20,width,500);viewport.getBoundingClientRect=()=>new DOMRect(0,0,450,300);
 vi.mocked(captureRenderedElement).mockImplementation(async()=>{width=420;return {blob:new Blob(['fixture']),width:400,height:300,sourceWidth:400,sourceHeight:500,offsetLeft:0,offsetTop:0,cropped:true};});
 const result=await captureDesignerPreview(frame,cursor,()=>({cursor,mode:'design',state:{}}),viewport);
 expect(result).toMatchObject({ok:false,code:'STUDIO_CAPTURE_STALE',diagnostics:{phase:'raster',reason:'preview-changed',expectedRevision:'r1#6',actualRevision:'r1#6',mode:'design',frameBefore:[10,20,400,500],frame:[10,20,420,500],viewportBefore:[0,0,450,300],changed:['geometry']}});
});
it('distinguishes missing frame from the public raster visibility reason and preserves mode/revision',async()=>{
 expect(await captureDesignerPreview(undefined,cursor,()=>({cursor,mode:'interact',state:{}}))).toMatchObject({ok:false,diagnostics:{phase:'visibility',reason:'frame-missing',mode:'interact',expectedRevision:'r1#6'}});
 const frame=document.createElement('div');document.body.append(frame);
 vi.mocked(captureRenderedElement).mockRejectedValue(Object.assign(new Error('STUDIO_CAPTURE_NOT_VISIBLE'),{captureReason:'frame-outside-viewport'}));
 expect(await captureDesignerPreview(frame,cursor,()=>({cursor,mode:'interact',state:{}}))).toMatchObject({ok:false,code:'STUDIO_CAPTURE_NOT_VISIBLE',diagnostics:{phase:'visibility',reason:'frame-outside-viewport',mode:'interact',connected:true}});
});
