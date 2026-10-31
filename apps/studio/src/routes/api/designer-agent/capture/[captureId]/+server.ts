import {json,type RequestHandler} from '@sveltejs/kit';
import {acceptVisualCapture,refuseVisualCapture} from '$lib/server/designer-visual.js';

/** Authenticated single-use capture upload. Multipart keeps metadata out of
 * HTTP headers; legacy JPEG + x-vict-capture remains a read-compatible wire. */
export const POST:RequestHandler=async({request,locals,params})=>{
  if(!locals.session)return json({ok:false,code:'VICT_STUDIO_UNAUTHENTICATED'},{status:401});
  if(request.headers.get('x-vict-csrf')!==locals.session.csrfToken)return json({ok:false,code:'VICT_STUDIO_CSRF'},{status:403});
  const contentType=request.headers.get('content-type')?.split(';')[0]?.trim();
  if(!['multipart/form-data','image/jpeg','application/json'].includes(contentType??''))return json({ok:false,code:'STUDIO_CAPTURE_CONTENT_TYPE'},{status:415});
  try{
    const owner=locals.session.sessionId,id=params.captureId!;
    if(contentType==='application/json'){
      const value=await request.json();
      const ok=refuseVisualCapture(owner,id,typeof value?.code==='string'?value.code:'STUDIO_CAPTURE_FAILED',value?.diagnostics);
      return json({ok},{status:ok?200:404});
    }
    let metadata:unknown,bytes:Uint8Array;
    if(contentType==='multipart/form-data'){
      const form=await request.formData(),fields=[...form.keys()],image=form.get('image'),text=form.get('metadata');
      if(fields.length!==2||!fields.includes('image')||!fields.includes('metadata')||!(image instanceof Blob)||image.type!=='image/jpeg'||typeof text!=='string')return json({ok:false,code:'STUDIO_CAPTURE_INVALID'},{status:400});
      metadata=JSON.parse(text);bytes=new Uint8Array(await image.arrayBuffer());
    }else{
      const text=request.headers.get('x-vict-capture');
      if(!text)return json({ok:false,code:'STUDIO_CAPTURE_INVALID'},{status:400});
      metadata=JSON.parse(decodeURIComponent(text));bytes=new Uint8Array(await request.arrayBuffer());
    }
    const result=acceptVisualCapture(owner,id,metadata,bytes);
    return json(result,{status:result.ok?200:result.code==='STUDIO_CAPTURE_UNAVAILABLE'?404:result.code==='STUDIO_CAPTURE_STALE'?409:400,headers:{'cache-control':'no-store'}});
  }catch{return json({ok:false,code:'STUDIO_CAPTURE_INVALID'},{status:400});}
};
