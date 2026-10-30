/** Bounded actual Stage 5 export proof through the existing Studio importer/export attachment. */
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {build} from 'vite';
import {svelte} from '@sveltejs/vite-plugin-svelte';

const root=process.cwd(),base=resolve('docs/studio/foundation-evidence/architecture-realignment-20261030/actual-agent-live-20261030');
const input=join(base,'stage-5-final-supported-export.json'),canonical=join(base,'stage-5-final-saved-source.json');
const temporary=mkdtempSync(join(tmpdir(),'vict-stage-5-portable-'));
const reportPath=join(base,'stage-5-portable-roundtrip-report.json');
const entry=join(temporary,'roundtrip.ts');
writeFileSync(entry,`import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {prepareSourceImport} from ${JSON.stringify(resolve('apps/studio/src/lib/designer/source-import.ts').replaceAll('\\','/'))};
import {screenApplication} from ${JSON.stringify(resolve('apps/studio/src/lib/designer/application.ts').replaceAll('\\','/'))};
import {parseGraphV2} from ${JSON.stringify(resolve('packages/ui-flow-svelte/src/editor/model-v2.ts').replaceAll('\\','/'))};
const input=${JSON.stringify(input)},canonicalPath=${JSON.stringify(canonical)},reportPath=${JSON.stringify(reportPath)};
const hash=value=>createHash('sha256').update(value).digest('hex');
const originalBytes=readFileSync(input),canonicalBytes=readFileSync(canonicalPath),bundle=JSON.parse(originalBytes),canonical=JSON.parse(canonicalBytes);
const checks=[];assert.deepStrictEqual(bundle.uiDocuments[0].document,canonical);checks.push('Exact exported document deep-equals canonical saved Stage 5 source');
const first=await prepareSourceImport(originalBytes.toString('utf8'));assert.equal(first.ok,true,JSON.stringify(first));if(!first.ok)throw Error(first.message);
assert.deepStrictEqual(first.document,canonical);assert.equal(first.assets.length,0);checks.push('Existing Studio importer admits original export without source changes or media');
assert.deepStrictEqual(screenApplication(first.document),bundle.application);checks.push('Authoritative screenApplication attachment matches original application definition');
const exported={application:screenApplication(first.document),uiDocuments:[{document:first.document}],...(Object.hasOwn(bundle,'mediaArchive')?{mediaArchive:bundle.mediaArchive}:{})};
assert.deepStrictEqual(exported,bundle);const reexport=JSON.stringify(exported,null,2);
const second=await prepareSourceImport(reexport);assert.equal(second.ok,true,JSON.stringify(second));if(!second.ok)throw Error(second.message);
assert.deepStrictEqual(second.document,canonical);checks.push('Authoritative export attachment and second existing-importer pass preserve complete source/envelope');
function graphSnapshots(document){
  const snapshots=[];
  function collect(text,path,depth){
    if(typeof text!=='string')return;let raw;try{raw=JSON.parse(text);}catch{return;}
    if(raw?.schema!=='vict.flow-graph@2')return;assert.ok(depth<=32,'Bounded nested graph depth');
    const parsed=parseGraphV2(text);assert.equal(parsed.ok,true,JSON.stringify(parsed));if(!parsed.ok)throw Error('Invalid saved nested graph');
    const graph=parsed.graph;snapshots.push({path,depth,sourceStringSha256:hash(text),revision:graph.revision,nodeTypes:graph.nodeTypes,nodes:graph.nodes,edges:graph.edges});
    for(const node of graph.nodes){const family=graph.nodeTypes.find(type=>type.id===node.type);assert.ok(family);for(const [key,parameter] of Object.entries(family.parameters??{}))if(parameter.type==='string')collect(node.values[key]??parameter.default,path+'/node:'+node.id+'/parameter:'+key,depth+1);}
  }
  for(const [key,declaration] of Object.entries(document.localState??{}))if(declaration.type==='string')collect(declaration.initial,'state:'+key,0);
  return snapshots;
}
const graphs=graphSnapshots(canonical);assert.ok(graphs.some(graph=>graph.depth===0));assert.ok(graphs.filter(graph=>graph.depth>0).length>=2,'Final App 2 must contain independently resolved nested graph occurrences');
assert.deepStrictEqual(graphSnapshots(first.document),graphs);assert.deepStrictEqual(graphSnapshots(second.document),graphs);
checks.push('Outer and independently resolved nested graph source strings, revisions, labels, typed parameters/ports, node values/positions and exact edge endpoints remain equal after both imports');
const report={status:'PASS',scope:'Actual saved Stage 5 supported application export through existing Studio importer/export attachment; offline only.',input:{path:input,sha256:hash(originalBytes),bytes:originalBytes.length},canonicalSource:{path:canonicalPath,sha256:hash(canonicalBytes),id:canonical.id,revision:canonical.revision},reexport:{sha256:hash(reexport),byteIdentical:hash(reexport)===hash(originalBytes),semanticEnvelopeEqual:true},importedDocumentJsonSha256:hash(JSON.stringify(second.document)),checks,graphs,limits:['No browser, physical device, server, backend, provider or owner acceptance proof.','Comparison baseline is exact final saved Stage 5 canonical source only; no earlier-runtime change attribution.','Studio importer uses current committed workspace code; separate static consumer uses recorded bYGiad public artifacts.']};
writeFileSync(reportPath,JSON.stringify(report,null,2)+'\\n');console.log(JSON.stringify({status:report.status,reportPath,checks:checks.length,id:canonical.id,revision:canonical.revision}));
`);
const buildLog=[];
try{
  await build({configFile:false,root,plugins:[svelte()],ssr:{noExternal:true},build:{ssr:entry,target:'node22',outDir:join(temporary,'build'),emptyOutDir:true,minify:false},customLogger:{hasWarned:false,info(message){buildLog.push(message);},warn(message){buildLog.push(message);this.hasWarned=true;},warnOnce(message){this.warn(message);},error(message){buildLog.push(message);},clearScreen(){},hasErrorLogged(){return false;}}});
  const output=execFileSync(process.execPath,[join(temporary,'build','roundtrip.js')],{cwd:root,encoding:'utf8',maxBuffer:4*1024*1024});
  writeFileSync(join(base,'stage-5-portable-roundtrip.log'),output);console.log(output.trim());
}catch(error){writeFileSync(join(base,'stage-5-portable-roundtrip-failure.log'),String(error.stack??error)+'\n'+String(error.stdout??'')+String(error.stderr??''));throw error;
}finally{writeFileSync(join(base,'stage-5-portable-roundtrip-build.log'),buildLog.join('\n')+'\n');}
// Keep disposable bundled entry/output for inspection, without changing source inputs.
console.log(JSON.stringify({temporary,entry:pathToFileURL(entry).href}));
