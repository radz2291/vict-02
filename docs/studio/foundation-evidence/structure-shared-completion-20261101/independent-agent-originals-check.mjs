/** Public UI archive integrity and acknowledged edit association, read-only. */
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {canonicalUiDocument} from '@victframework/ui';
const folder=join(process.cwd(),'docs/studio/foundation-evidence/structure-shared-completion-20261101'),archive=join(folder,'05-tool-originals');
const readJson=path=>JSON.parse(readFileSync(path,'utf8')),hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const inventory=readJson(join(archive,'inventory.json')),capture=readJson(join(archive,'capture.json')),errors=[],entries=[],parsed=[];
const check=(condition,message)=>{if(!condition)errors.push(message);};
check(inventory.length===84&&capture.length===84,'Expected all84 original input/result exchanges');
for(const [index,item] of inventory.entries()){
 check(item.index===index&&capture[index]?.index===index&&capture[index]?.id===item.id,`Inventory continuity ${index}`);
 const stem=`${String(index).padStart(3,'0')}-${item.id}`,pagesPath=join(archive,stem+'.pages.json'),textPath=join(archive,stem+'.txt');
 const pages=readJson(pagesPath);let offset=0,text='';
 for(const page of pages){check(page.offset===offset&&page.end===page.offset+page.text.length,`Page continuity ${index}/${offset}`);offset=page.end;text+=page.text;}
 check(pages.length>0&&offset===pages[0].total,`Incomplete original ${index}`);
 check(text===readFileSync(textPath,'utf8'),`Original reassembly mismatch ${index}`);
 check(capture[index]?.complete&&capture[index]?.capturedCharacters===text.length&&capture[index]?.totalCharacters===text.length,`Capture completeness mismatch ${index}`);
 try{parsed.push(JSON.parse(text));}catch{errors.push(`Original JSON parse ${index}`);parsed.push(undefined);}
 entries.push({index,id:item.id,label:item.label,pages:pages.length,characters:text.length,textSha256:hash(textPath),pagesSha256:hash(pagesPath)});
}
const edits=[];
check(inventory.filter(item=>/input/i.test(item.label)).length===42&&inventory.filter(item=>/result/i.test(item.label)).length===42,'Expected42 inputs and42 results');
for(let index=0;index<inventory.length;index++){
 if(!/^Edit screen.*input/.test(inventory[index].label))continue;
 check(/^Edit screen.*result/.test(inventory[index+1]?.label??''),`Sequential edit input/result pairing ${index}`);
 const input=parsed[index],result=parsed[index+1],arrays=Object.fromEntries(Object.entries(input??{}).filter(([,value])=>Array.isArray(value)).map(([key,value])=>[key,value.length]));
 const operations=input?.operations??input?.commands??input?.changes??[];
 const counts={};for(const op of operations){const name=op.op??op.type??'unknown';counts[name]=(counts[name]??0)+1;}
 check(result?.ok===true,`Edit not acknowledged ${index}`);
 edits.push({inputIndex:index,resultIndex:index+1,inputKeys:Object.keys(input??{}),expectedBeforeRevision:input?.expectedRevision,resultRevision:result?.revision,resultDigest:result?.digest,arrayLengths:arrays,operationKinds:counts,ok:result?.ok,cursor:result?.cursor??result?.result?.cursor,applied:result?.turnProgress?.applied,metrics:result?.turnProgress?.metrics});
}
check(edits.length===3,'Expected exactly3 acknowledged editing transactions');
for(const [index,edit] of edits.entries())check(edit.expectedBeforeRevision===`r1.r17#${index}`&&edit.resultRevision===`r1.r17#${index+1}`,`Exact revision admission chain ${index}`);
const sourcePath=join(folder,'06-agent-adopted-unsaved-source.json'),source=readJson(sourcePath),digest=canonicalUiDocument(source).contentDigest,last=parsed[83];
check(last?.metadata?.cursor?.digest===digest,'Final observation does not match final actual source');
check(edits.at(-1)?.resultDigest===digest,'Final editing acknowledgement does not match final actual source');
check(last?.turnProgress?.metrics?.toolCalls===42&&last.turnProgress.metrics.completedCalls===42&&last.turnProgress.metrics.refusedCalls===0&&last.turnProgress.metrics.confirmedEdits===3,'Final observation totals mismatch');
const detailPath=join(folder,'05-agent-details-dom.txt'),detail=readFileSync(detailPath,'utf8');
const detailLines=detail.split(/\r?\n/).filter(line=>/paragraph:.*(42 tool calls|authoring model requests|Reported authoring usage|Settled tool durations|Exact model steps)/.test(line)).map(line=>line.trim());
check(detailLines.some(line=>line.includes('756.7 s elapsed')),'Final UI elapsed receipt missing');
const report={schema:'vict.independent-agent-originals-association@1',status:errors.length?'FAIL':'PASS',sourceCandidate:'3dfdde4ecb5567bc03130426482076d5344e3530',inventorySha256:hash(join(archive,'inventory.json')),captureSha256:hash(join(archive,'capture.json')),entries,totalExchanges:entries.length,totalCharacters:entries.reduce((sum,entry)=>sum+entry.characters,0),edits,afterSourceSha256:hash(sourcePath),afterCanonicalDigest:digest,finalObservation:{ok:last?.ok,cursor:last?.metadata?.cursor,metrics:last?.turnProgress?.metrics,viewport:last?.metadata?.viewport,image:last?.metadata?.image,semanticClaimsVerified:last?.semanticClaimsVerified,interactionVerified:last?.interactionVerified},finalUiDetails:{path:detailPath,sha256:hash(detailPath),lines:detailLines},errors,retainedReviewerHarnessFailure:'First checker assumed every adjacent pair was input/result. Concurrent read inputs/results are interleaved; all84 entries were already complete, and all3 sequential edit pairs were valid. Corrected classification checks42inputs/42results and expliciteditpairing. Initial report retained separately.',scope:'Independent recomputation of integrator-captured public UI originals and final details. Not a fresh provider turn or independent native action. Final observation acknowledgement metrics and later final UI totals are distinct timestamps; cropped model interpretation is not a native behavior pass.'};
writeFileSync(join(folder,'independent-agent-originals-association.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,entries:undefined},null,2));if(errors.length)process.exitCode=1;
