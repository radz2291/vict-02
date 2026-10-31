import assert from'node:assert/strict';
import{readFileSync,writeFileSync,readdirSync,existsSync}from'node:fs';
import{resolve,join}from'node:path';
import{gzipSync,gunzipSync}from'node:zlib';
import{createHash}from'node:crypto';
const output=resolve('docs/studio/foundation-evidence/node-suite-stress-20261031/actual-turn-originals-independent');
const sourceRoot=process.argv[2];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const reports=[];
for(const turn of ['29','30']){
 const bundlePath=join(output,turn+'-originals.json.gz');
 if(sourceRoot){
  const folder=join(resolve(sourceRoot),'docs/studio/foundation-evidence/node-suite-stress-20261031',turn+'-tool-originals');
  const files=readdirSync(folder,{withFileTypes:true}).map(entry=>{assert.ok(entry.isFile(),'Unexpected archive subdirectory');const bytes=readFileSync(join(folder,entry.name));return{path:entry.name,sha256:hash(bytes),bytes:bytes.length,base64:bytes.toString('base64')};});
  // Verify a stable capture while reading completed29/30 only, never active32.
  for(const file of files)assert.equal(hash(readFileSync(join(folder,file.path))),file.sha256,'Archive changed during snapshot');
  const bundle={turn,sourceFolder:folder,files};writeFileSync(bundlePath,gzipSync(Buffer.from(JSON.stringify(bundle))));
 }
 assert.ok(existsSync(bundlePath),'Supply source checkout to create the completed archive snapshot');
 const bundle=JSON.parse(gunzipSync(readFileSync(bundlePath))),files=new Map(bundle.files.map(file=>{const bytes=Buffer.from(file.base64,'base64');assert.equal(hash(bytes),file.sha256);assert.equal(bytes.length,file.bytes);return[file.path,bytes];}));
 const json=path=>JSON.parse(files.get(path).toString('utf8'));
 const inventory=json('inventory-complete.json'),records=[];
 assert.equal(inventory.length,turn==='29'?53:106);
 assert.equal([...files.keys()].filter(path=>path.endsWith('.txt')).length,inventory.length);
 let characters=0,pages=0;
 for(const [index,item]of inventory.entries()){
  assert.equal(item.record.index,index);assert.equal(item.complete,true);
  const stem=String(index+1).padStart(2,'0')+'-'+item.record.id;
  const capture=json(stem+'.capture.json'),metadata=json(stem+'.pages.json'),text=files.get(stem+'.txt').toString('utf8');
  assert.deepEqual(capture.record,item.record);assert.deepEqual(metadata.record,item.record);assert.equal(capture.complete,true);assert.equal(metadata.complete,true);
  assert.equal(capture.total,item.total);assert.equal(metadata.total,item.total);assert.equal(text.length,item.total);assert.equal(capture.end,item.total);
  assert.equal(capture.pages.length,item.pageCount);assert.equal(metadata.pages.length,item.pageCount);
  let offset=0,joined='';
  for(const [pageIndex,page]of capture.pages.entries()){
   assert.equal(page.start,offset);assert.equal(page.total,item.total);assert.equal(page.end-page.start,page.text.length);offset=page.end;joined+=page.text;
   assert.deepEqual(metadata.pages[pageIndex],{start:page.start,end:page.end,total:page.total});
  }
  assert.equal(offset,item.total);assert.equal(joined,text);const value=JSON.parse(text);
  characters+=text.length;pages+=capture.pages.length;
  records.push({index,label:item.record.label,id:item.record.id,total:item.total,sha256:hash(files.get(stem+'.txt')),value});
 }
 const resultRecords=records.filter(record=>record.label.endsWith('result'));
 const acknowledgements=records.filter(record=>record.label==='Edit screen · result'&&record.value.ok===true);
 const refusals=resultRecords.filter(record=>record.value.ok===false);
 const inputEdits=records.filter(record=>record.label==='Edit screen · input');
 const resultEdits=records.filter(record=>record.label==='Edit screen · result');
 const pairs=inputEdits.map(record=>{const result=resultEdits.find(item=>item.index>record.index&&item.index<(inputEdits.find(next=>next.index>record.index)?.index??Infinity));return{input:record,result};});
 for(const [index,record]of acknowledgements.entries())assert.equal(record.value.applied,index+1,'Expected cumulative applied transaction count');
 const effects=pairs.map(({input,result})=>({inputIndex:input.index,resultIndex:result?.index,expectedRevision:input.value.expectedRevision,resultRevision:result?.value.revision,acknowledged:result?.value.ok===true,cumulativeApplied:result?.value.applied,refusalCode:result?.value.ok===false?result.value.code:undefined,operations:input.value.operations.map(operation=>({op:operation.op,nodeId:operation.nodeId,expectedGraphRevision:operation.expectedGraphRevision,occurrenceRoute:operation.occurrenceRoute,changes:operation.changes,targets:operation.targets,prop:operation.prop,attribute:operation.attribute,slot:operation.slot}))}));
 const last=resultRecords.toReversed().find(record=>record.value.turnProgress);
 const counts={};for(const record of records)counts[record.label]=(counts[record.label]??0)+1;
 const report={turn,status:'PASS: all inventoried original bytes/JSON/page continuity verified; actual effects classified without native claims',sourceFolder:bundle.sourceFolder,bundleSha256:hash(readFileSync(bundlePath)),originals:records.length,characters,pages,counts,acknowledgedTransactions:acknowledgements.length,editAttempts:inputEdits.length,pendingEditInputs:pairs.filter(pair=>!pair.result).length,effects,refusals:refusals.map(record=>({index:record.index,label:record.label,section:record.value.section,code:record.value.code,message:record.value.message,applied:record.value.applied,expectedRevision:record.value.expectedRevision,diagnostics:record.value.diagnostics})),lastReceipt:{index:last.index,expectedRevision:last.value.expectedRevision,applied:last.value.turnProgress.applied,metrics:last.value.turnProgress.metrics},observations:records.filter(record=>record.label==='Observe preview · result').map(record=>({index:record.index,characters:record.total,ok:record.value.ok,image:record.value.metadata?.image,viewport:record.value.metadata?.viewport,semanticClaimsVerified:record.value.semanticClaimsVerified,interactionVerified:record.value.interactionVerified,limitation:record.value.limitation})),manifest:bundle.files.map(({path,sha256,bytes})=>({path,sha256,bytes})),limits:['Server inventory completeness and transport reconstruction are verified; interpreted image/model claims remain unverified.','Receipt metrics are bounded observation-time totals, not independent provider latency/cost or hypothetical extra effects.','No browser/tool replay or active32 archive access occurred.']};
 writeFileSync(join(output,turn+'-audit.json'),JSON.stringify(report,null,2)+'\n');reports.push({turn,originals:records.length,characters,pages,acks:acknowledgements.length,editAttempts:inputEdits.length,refusals:refusals.length,pendingEditInputs:report.pendingEditInputs,lastConfirmedEdits:last.value.turnProgress.metrics.confirmedEdits});
}
console.log(JSON.stringify(reports));
