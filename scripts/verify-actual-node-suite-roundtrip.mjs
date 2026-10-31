/** Existing Studio importer + export attachment, using the actual saved app unchanged. */
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { build } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const [exportArg, canonicalArg, reportArg] = process.argv.slice(2);
if (!exportArg || !canonicalArg || !reportArg) throw Error('Usage: node scripts/verify-actual-node-suite-roundtrip.mjs <actual-export.json> <saved-source.json> <report.json>');
const root = process.cwd(), input = resolve(exportArg), canonicalPath = resolve(canonicalArg), reportPath = resolve(reportArg);
const temporary = mkdtempSync(join(tmpdir(), 'vict-actual-node-suite-roundtrip-'));
mkdirSync(dirname(reportPath), { recursive: true });
const entry = join(temporary, 'roundtrip.ts');
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
writeFileSync(entry, `
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prepareSourceImport} from ${JSON.stringify(resolve('apps/studio/src/lib/designer/source-import.ts').replaceAll('\\', '/'))};
import {screenApplication} from ${JSON.stringify(resolve('apps/studio/src/lib/designer/application.ts').replaceAll('\\', '/'))};
import {parseGraphV2} from '@victframework/ui-flow-svelte';
const input=${JSON.stringify(input)},canonicalPath=${JSON.stringify(canonicalPath)},reportPath=${JSON.stringify(reportPath)};
const hash=value=>createHash('sha256').update(value).digest('hex');
const originalBytes=readFileSync(input),canonicalBytes=readFileSync(canonicalPath);
const bundle=JSON.parse(originalBytes.toString('utf8')),canonical=JSON.parse(canonicalBytes.toString('utf8'));
assert.equal(bundle.uiDocuments?.length,1,'This actual-app proof expects one attached screen');
assert.deepStrictEqual(bundle.uiDocuments[0].document,canonical);
const checks=['Actual supported export deep-equals the exact saved canonical source'];
const first=await prepareSourceImport(originalBytes.toString('utf8'));
assert.equal(first.ok,true,JSON.stringify(first));if(!first.ok)throw Error(first.message);
assert.deepStrictEqual(first.document,canonical);assert.equal(first.assets.length,0,'Managed media needs a separate byte-preservation proof');
assert.deepStrictEqual(screenApplication(first.document),bundle.application);
checks.push('Existing Studio importer admits unchanged source and authoritative application attachment');
const exported={application:screenApplication(first.document),uiDocuments:[{document:first.document}],...(Object.hasOwn(bundle,'mediaArchive')?{mediaArchive:bundle.mediaArchive}:{})};
assert.deepStrictEqual(exported,bundle);
const reexport=JSON.stringify(exported,null,2),second=await prepareSourceImport(reexport);
assert.equal(second.ok,true,JSON.stringify(second));if(!second.ok)throw Error(second.message);
assert.deepStrictEqual(second.document,canonical);
checks.push('Normal export attachment and second existing-importer pass preserve the complete source/envelope');
function graphSnapshots(document){
 const snapshots=[],pending=[];
 for(const [key,declaration] of Object.entries(document.localState??{}))if(declaration.type==='string')pending.push({text:declaration.initial,path:'state:'+key,depth:0});
 while(pending.length){
  const {text,path,depth}=pending.pop();if(typeof text!=='string')continue;
  let raw;try{raw=JSON.parse(text);}catch{continue;}if(raw?.schema!=='vict.flow-graph@2')continue;
  const parsed=parseGraphV2(text);assert.equal(parsed.ok,true,JSON.stringify(parsed));if(!parsed.ok)throw Error('Invalid saved nested graph');
  const graph=parsed.graph;snapshots.push({path,depth,sourceStringSha256:hash(text),revision:graph.revision,nodeTypes:graph.nodeTypes,nodes:graph.nodes,edges:graph.edges});
  for(const node of graph.nodes){const family=graph.nodeTypes.find(type=>type.id===node.type);assert.ok(family);
   for(const [key,parameter] of Object.entries(family.parameters??{}))if(parameter.type==='string')pending.push({text:node.values[key]??parameter.default,path:path+'/node:'+node.id+'/parameter:'+key,depth:depth+1});
  }
 }
 return snapshots;
}
const graphs=graphSnapshots(canonical),outer=graphs.filter(graph=>graph.depth===0),nested=graphs.filter(graph=>graph.depth>0);
assert.ok(outer.length,'Actual node-suite source needs an outer graph');
assert.ok(nested.length>=2,'This chosen suite requires two independently owned nested graph occurrences');
assert.deepStrictEqual(graphSnapshots(first.document),graphs);assert.deepStrictEqual(graphSnapshots(second.document),graphs);
checks.push('Every resolved outer/nested graph source string, revision, family, port, parameter, value, position and edge survives both imports');
const report={schema:'vict.actual-node-suite-roundtrip@1',status:'PASS',sourceCommit:${JSON.stringify(sourceCommit)},input:{path:input,sha256:hash(originalBytes),bytes:originalBytes.length},canonicalSource:{path:canonicalPath,sha256:hash(canonicalBytes),id:canonical.id,revision:canonical.revision},reexport:{sha256:hash(reexport),byteIdentical:hash(reexport)===hash(originalBytes),semanticEnvelopeEqual:true},importedDocumentJsonSha256:hash(JSON.stringify(second.document)),checks,graphs,scope:'Actual saved/exported app through existing committed Studio import/export code. No application reconstruction or document rewrite.',limitations:['Offline importer/source proof; not native browser, device, provider, backend or owner acceptance.','Nested source data alone does not prove editable rendered nested flows; native checks remain separate.','Managed media is not claimed by this no-media suite proof. Public installed-consumer proof is separate.']};
writeFileSync(reportPath,JSON.stringify(report,null,2));
console.log(JSON.stringify({status:report.status,reportPath,id:canonical.id,revision:canonical.revision,outerGraphs:outer.length,nestedGraphs:nested.length}));
`);
const buildLog = [];
try {
  await build({ configFile: false, root, plugins: [svelte()], ssr: { noExternal: true }, build: { ssr: entry, target: 'node22', outDir: join(temporary, 'build'), emptyOutDir: true, minify: false }, customLogger: { hasWarned: false, info(message) { buildLog.push(message); }, warn(message) { buildLog.push(message); this.hasWarned = true; }, warnOnce(message) { this.warn(message); }, error(message) { buildLog.push(message); }, clearScreen() {}, hasErrorLogged() { return false; } } });
  const output = execFileSync(process.execPath, [join(temporary, 'build', 'roundtrip.js')], { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  writeFileSync(reportPath + '.log', output); console.log(output.trim());
} catch (error) {
  writeFileSync(reportPath + '.failure.log', String(error.stack ?? error) + '\n' + String(error.stdout ?? '') + String(error.stderr ?? '')); throw error;
} finally { writeFileSync(reportPath + '.build.log', buildLog.join('\n')); }
console.log(JSON.stringify({ temporary }));
