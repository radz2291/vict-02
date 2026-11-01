/** Reads the ordinary UI's retained public exchange; no provider/browser calls. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {canonicalUiDocument} from '@victframework/ui';
const folder=join(process.cwd(),'docs/studio/foundation-evidence/structure-shared-completion-20261101'),chatPath=join(folder,'05-agent-chat-public.txt'),afterPath=join(folder,'06-agent-adopted-unsaved-source.json');
const text=readFileSync(chatPath,'utf8'),source=JSON.parse(readFileSync(afterPath,'utf8'));
const objects=[];
for(let start=0;start<text.length;start++){
 if(text[start]!=='{')continue;
 let depth=0,quoted=false,escaped=false,end=start;
 for(;end<text.length;end++){
  const ch=text[end];if(quoted){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')quoted=false;continue;}
  if(ch==='"')quoted=true;else if(ch==='{')depth++;else if(ch==='}'&&!--depth)break;
 }
 if(end>=text.length)continue;
 try{objects.push(JSON.parse(text.slice(start,end+1)));start=end;}catch{}
}
const progress=objects.filter(value=>value.turnProgress).map(value=>({cursor:value.cursor,expectedRevision:value.expectedRevision,applied:value.turnProgress.applied,metrics:value.turnProgress.metrics,keys:Object.keys(value)}));
const canonical=canonicalUiDocument(source),cursors=[];
function scan(value){if(!value||typeof value!=='object')return;if(value.cursor?.documentId===source.id)cursors.push(value.cursor);for(const child of Object.values(value))if(child&&typeof child==='object')scan(child);}
for(const object of objects)scan(object);
const latest=progress.slice().sort((a,b)=>(b.metrics?.toolCalls??0)-(a.metrics?.toolCalls??0))[0];
const finalDigestMatches=cursors.filter(cursor=>cursor.digest===canonical.contentDigest);
const report={schema:'vict.independent-actual-agent-receipt-association@1',scope:'Independent parsing of integrator-retained public Studio UI receipts, not an independent live provider or native interaction.',chatPath,chatSha256:createHash('sha256').update(readFileSync(chatPath)).digest('hex'),afterSourcePath:afterPath,afterSourceSha256:createHash('sha256').update(readFileSync(afterPath)).digest('hex'),afterCanonicalDigest:canonical.contentDigest,parsedJsonObjects:objects.length,publicProgressReceipts:progress.length,maximumAcknowledgedSnapshot:latest,acknowledgedEditSnapshots:progress.filter(value=>(value.metrics?.confirmedEdits??0)>0).map(value=>({cursor:value.cursor,applied:value.applied,confirmedEdits:value.metrics.confirmedEdits,toolCalls:value.metrics.toolCalls,refusedCalls:value.metrics.refusedCalls})),receiptCursorMatchesFinalSource:finalDigestMatches.length>0,matchingFinalSourceCursors:[...new Map(finalDigestMatches.map(cursor=>[JSON.stringify(cursor),cursor])).values()],limits:['Final cumulative snapshot is a retained tool acknowledgement, not independently measured provider latency or cost.','Captured model image interpretation remains unverified; native geometry and behavior require separate receipts.']};
writeFileSync(join(folder,'independent-agent-receipt-association.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,acknowledgedEditSnapshots:report.acknowledgedEditSnapshots.slice(-4)},null,2));
if(!latest||latest.metrics?.confirmedEdits!==3||!finalDigestMatches.length)process.exitCode=1;
