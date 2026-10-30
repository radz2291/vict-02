import { expect, it } from 'vitest';
import { createTurnMetrics, phaseFailureStatus } from '../src/lib/designer/agent-progress.js';
import { captureEvidence } from '../src/lib/designer/capture-evidence.js';
import { createVisualObserver, acceptVisualCapture, refuseVisualCapture } from '../src/lib/server/designer-visual.js';
import type { CapabilityContext } from '@victframework/sdk';
const cursor={documentId:'reliability',revision:'r1#6',digest:'fixture',epoch:'be5d20ea-a11d-49cc-98ef-ef062f089e81'};
const bytes=new Uint8Array([0xff,0xd8,0xff,0xc0,0,11,8,0,1,0,1,1,1,0x11,0,0xff,0xd9]);
const metadata=()=>({cursor,capturedAt:new Date().toISOString(),viewport:{width:1,height:1,scrollLeft:0,scrollTop:0,devicePixelRatio:1},image:{width:1,height:1,sourceWidth:1,sourceHeight:1,offsetLeft:0,offsetTop:0,cropped:false},preview:{mode:'design',fingerprint:'a'.repeat(64)}});
it('measures concurrent attempts once, preserves recovery counters across detail compaction and leaves unavailable usage unknown',()=>{
 let now=0;const metrics=createTurnMetrics(()=>now);
 metrics.start('read-a','read');now=10;metrics.start('read-b','read');now=20;metrics.finish('read-a','read',false);metrics.finish('read-a','read',false);now=30;metrics.finish('read-b','read',true);
 metrics.start('read-c','read');metrics.finish('read-c','read',false);now=40;metrics.start('read-d','read');now=50;metrics.finish('read-d','read',true);metrics.edit(8);
 metrics.usage({inputTokens:undefined,outputTokens:0,totalTokens:0});
 expect(metrics.snapshot()).toMatchObject({toolCalls:4,completedCalls:2,refusedCalls:2,recoveryAttempts:1,elapsedMs:50,toolElapsedMs:50,firstEditMs:50,acknowledgementMs:8,modelSteps:null,cost:null});
 expect(metrics.snapshot()).not.toHaveProperty('usage');
 metrics.usage({inputTokens:8,outputTokens:2,totalTokens:10});metrics.usage({inputTokens:3,outputTokens:1,totalTokens:4});
 expect(metrics.snapshot().usage).toEqual({inputTokens:11,outputTokens:3,totalTokens:14});
 metrics.usage({inputTokens:{total:12,noCache:12},outputTokens:{total:21,text:21}});
 expect(metrics.snapshot().usage).toEqual({inputTokens:23,outputTokens:24,totalTokens:47});
});
it('projects capture evidence without source/provider content and tells observation failure apart from edit failure',()=>{
 const projected=captureEvidence({phase:'visibility',reason:'frame-outside-viewport',expectedRevision:cursor.revision,frame:[0,700,400,200],viewport:[0,0,400,500],secret:'not permitted',changed:['geometry','<script>']});
 expect(projected).toEqual({phase:'visibility',reason:'frame-outside-viewport',expectedRevision:cursor.revision,frame:[0,700,400,200],viewport:[0,0,400,500],changed:['geometry']});
 expect(captureEvidence({phase:'private',reason:'content'})).toBeUndefined();
 expect(phaseFailureStatus([{tool:'studio_screen_observe',code:'STUDIO_CAPTURE_NOT_VISIBLE',phase:'visibility'}])).toContain('Visual verification failed');
 expect(phaseFailureStatus([{tool:'studio_screen_observe',code:'STUDIO_CAPTURE_NOT_VISIBLE'}])).toContain('confirmed edits must not be repeated');
});
it('retries transient raster stale once without executing edits or another image model, preserving persistent refusal phase',async()=>{
 let captures=0;let models=0;
 const observer=createVisualObserver({owner:'owner',runId:'retry',model:'zai/glm-5.3-flash',getCursor:()=>cursor,signal:new AbortController().signal,emit:event=>{captures++;refuseVisualCapture('owner',event.captureId,'STUDIO_CAPTURE_STALE',{phase:'raster',reason:'preview-changed',expectedRevision:cursor.revision,changed:['geometry']});},modelFactory:()=>({doStream:async()=>{models++;throw Error('must not call');}})});
 const result=await observer.capability.invoke({focus:'Check spacing'},{} as CapabilityContext);
 expect(result).toMatchObject({ok:false,code:'STUDIO_CAPTURE_STALE',diagnostics:{phase:'raster',changed:['geometry']},recovery:{editsReplayed:false,captureAttempts:2}});
 expect(captures).toBe(2);expect(models).toBe(0);observer.dispose();
});
it('recovers one transient raster change with fresh image evidence and keeps visibility failures explicit',async()=>{
 let captures=0;let models=0;
 const observer=createVisualObserver({owner:'owner',runId:'recovered',model:'zai/glm-5.3-flash',getCursor:()=>cursor,signal:new AbortController().signal,emit:event=>{captures++;if(captures===1)refuseVisualCapture('owner',event.captureId,'STUDIO_CAPTURE_STALE',{phase:'metadata',reason:'preview-changed'});else acceptVisualCapture('owner',event.captureId,metadata(),bytes);},modelFactory:()=>({doStream:async()=>{models++;return{stream:new ReadableStream({start(controller){controller.enqueue({type:'text-delta',delta:'Visible fixture. Interactions untested.'});controller.enqueue({type:'finish'});controller.close();}})};}})});
 expect(await observer.capability.invoke({focus:'Check spacing'},{} as CapabilityContext)).toMatchObject({ok:true,imageComparison:'sha256-identical',interactionVerified:false});
 expect(captures).toBe(3);expect(models).toBe(1);observer.dispose();
 let visibilityCaptures=0;
 const hidden=createVisualObserver({owner:'owner',runId:'hidden',model:'zai/glm-5.3-flash',getCursor:()=>cursor,signal:new AbortController().signal,emit:event=>{visibilityCaptures++;refuseVisualCapture('owner',event.captureId,'STUDIO_CAPTURE_NOT_VISIBLE',{phase:'visibility',reason:'frame-disconnected',connected:false,expectedRevision:cursor.revision});}});
 expect(await hidden.capability.invoke({focus:'Check spacing'},{} as CapabilityContext)).toMatchObject({ok:false,diagnostics:{phase:'visibility',connected:false},recovery:{captureAttempts:1,editsReplayed:false}});
 expect(visibilityCaptures).toBe(1);hidden.dispose();
});
