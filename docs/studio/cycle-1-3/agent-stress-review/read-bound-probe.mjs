// Read-only diagnostic of the exact built candidate. No provider, server or canvas mutations.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root=process.cwd();
const app=await import(pathToFileURL(resolve(root,'apps/studio/build/server/chunks/application-l9MwEml9.js')));
const {captureDeliverySafeSnapshot,DELIVERY_SNAPSHOT_BOUNDS}=await import(pathToFileURL(resolve(root,'packages/mastra/dist/delivery-snapshot.js')));
const source=readFileSync('apps/studio/build/server/chunks/designer-agent-http-LABKg_XW.js','utf8');
const fnSource=source.match(/function agentContext\([\s\S]*?\n\}/)?.[0];
if(!fnSource)throw Error('Exact compiled context function absent; do not guess a different build');
const context=new Function('resolveOccurrence','screenRecipes','catalogDescriptors','actionInputs','designerCatalogs','return ('+fnSource+')')(app.r,app.s,app.c,app.a,app.d);
const doc=app.B('Read-only diagnostic','diagnostic');
const value=context(doc,{documentId:doc.id,revision:'r1',digest:'diagnostic',epoch:'diagnostic'});
function count(v){return 1+(v&&typeof v==='object'?Object.values(v).reduce((n,x)=>n+count(x),0):0)}
const overhead=count(value)-count(doc);
// Same recursive-value count as the DOM-observed document, without copying owner content.
// This synthetic structure is a delivery-size probe, NOT a canonical screen or provider replay.
const syntheticDocument={a:Array.from({length:16},()=>Array(98).fill(null)),b:Array(23).fill(null)};
const large={...value,document:syntheticDocument};
const baseline=captureDeliverySafeSnapshot(value),largeResult=captureDeliverySafeSnapshot(large);
const result={product:'8eb96dd8bcf7cfadd973e1f4fae7d11706a32797',mode:'Exact compiled read-context overhead plus synthetic delivery-size reproduction; no owner source copied, no provider calls',bounds:DELIVERY_SNAPSHOT_BOUNDS,baseline:{documentValues:count(doc),contextValues:count(value),snapshotOk:baseline.ok},contextOverhead:overhead,domObservedOwnerDocument:{nodeCount:89,jsonLength:25616,recursiveValues:1610,maxDepth:8},ownerContextLowerBound:overhead+1610,synthetic:{documentValues:count(syntheticDocument),contextValues:count(large),snapshot:largeResult}};
writeFileSync('docs/studio/cycle-1-3/agent-stress-review/read-bound-probe.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
if(!baseline.ok||largeResult.ok||count(syntheticDocument)!==1610)process.exitCode=1;
