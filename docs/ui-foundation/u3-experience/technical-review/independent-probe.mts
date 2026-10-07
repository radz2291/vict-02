import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectionPlan, studioDocumentCatalogs } from 'file:///C:/Users/RZ1/Desktop/RZ/vict-02-u3-experience/examples/ui-authoring-proof/src/lib/product/compile.ts';
import { inspectionDetailDocument } from 'file:///C:/Users/RZ1/Desktop/RZ/vict-02-u3-experience/examples/ui-authoring-proof/src/lib/product/documents.ts';
import { createAuthoringStore } from 'file:///C:/Users/RZ1/Desktop/RZ/vict-02-u3-experience/examples/ui-authoring-proof/src/lib/authoring/store.ts';
import { InspectionDataAdapter, createInspectionServer, seedDomain } from 'file:///C:/Users/RZ1/Desktop/RZ/vict-02-u3-experience/examples/ui-authoring-proof/src/lib/product/domain.ts';
import { openDurableInspectionStore } from 'file:///C:/Users/RZ1/Desktop/RZ/vict-02-u3-experience/examples/ui-authoring-proof/src/lib/server/inspection-durable.ts';
const m = new Map<string,string>();
const storage = {getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>m.set(k,v),removeItem:(k:string)=>m.delete(k)};
const store=createAuthoringStore(storage,studioDocumentCatalogs);
const edited=structuredClone(inspectionDetailDocument); edited.revision='3'; (edited.nodes['n.approveLabel'] as any).content.value='Authorize reviewed inspection';
const saved=store.save({document:edited,newStoredRevision:'3',expectedStoredRevision:'2'}); assert.equal(saved.ok,true);
const loaded=store.rawLoad(); assert.equal(loaded.status,'loaded'); if(loaded.status!=='loaded') throw Error('load');
const before=inspectionPlan(); const after=inspectionPlan(loaded.document);
assert.notEqual(before.plan.applicationVersion,after.plan.applicationVersion); assert.notEqual(before.detailPlan.sourceDigest,after.detailPlan.sourceDigest);
assert.equal((loaded.document.nodes['n.approveLabel'] as any).content.value,'Authorize reviewed inspection');
console.log('Saved authored edit changes actual product compile:',before.plan.applicationVersion,'=>',after.plan.applicationVersion);
const supervisor={role:'supervisor',actorId:'s.hart'},technician={role:'technician',actorId:'t.nguyen'};
const file=join(mkdtempSync(join(tmpdir(),'technical-loop-')),'inspection.sqlite'); const opened=openDurableInspectionStore(file,'normal');
for(const [mode,server] of [['simulated',createInspectionServer(new InspectionDataAdapter(seedDomain()))],['durable',createInspectionServer(opened.adapter)]] as const){
 const dispatch=async(a:string,i:unknown,actor=supervisor,opts?:any)=>{const r=await server.dispatch(a,i,actor,opts); assert.equal(r.ok,true,`${mode} ${a}: ${JSON.stringify(r)}`);return r.value as any};
 const initial=await dispatch('inspection.get',{id:'i-101'}); const old=initial.domainRevision;
 let denied=await server.dispatch('inspection.approve',{id:'i-101',expectedDomainRevision:old},technician);assert.equal(denied.ok,false); assert.equal(denied.code,'DATA_UNAUTHORIZED');
 await dispatch('inspection.reject',{id:'i-101',expectedDomainRevision:old,rejectionReason:'Verify seal'},supervisor);
 await dispatch('inspection.revise',{id:'i-101'},technician);
 await dispatch('finding.add',{id:'f-own',inspectionId:'i-101',severity:'high',description:'Reviewed correction'},technician);
 await dispatch('evidence.add',{id:'e-own',inspectionId:'i-101',kind:'note',label:'Review note'},technician);
 await dispatch('inspection.submit',{id:'i-101'},technician);
 const updated=await dispatch('inspection.get',{id:'i-101'}); assert.equal(updated.status,'submitted');
 const stale=await server.dispatch('inspection.approve',{id:'i-101',expectedDomainRevision:old},supervisor);assert.equal(stale.code,'DOMAIN_CONFLICT');
 const payload={id:'i-101',expectedDomainRevision:updated.domainRevision};await dispatch('inspection.approve',payload,supervisor,{idempotencyKey:'own-key'});
 const replay=await server.dispatch('inspection.approve',payload,supervisor,{idempotencyKey:'own-key'});assert.equal(replay.code,'DATA_IDEMPOTENT_REPLAY');
 const terminal=await dispatch('inspection.get',{id:'i-101'}); assert.equal(terminal.status,'approved');
 console.log(mode,'full correction loop, runtime denial, stale conflict, replay PASS; final revision',terminal.domainRevision);
}
opened.handle.close();

