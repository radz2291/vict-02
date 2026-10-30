/** Prepare an isolated static consumer of an unchanged supported export. Never starts a server. */
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync,realpathSync,copyFileSync} from 'node:fs';
import {resolve,join,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';

const [inputArg,destinationArg,artifactsArg,inventoryArg]=process.argv.slice(2);
if(!inputArg||!destinationArg||!artifactsArg)throw Error('Usage: node scripts/prepare-export-device-preview.mjs <export.json> <new-output-directory> <packed-artifact-directory> [consumer-inventory.json]');
const root=process.cwd(),input=resolve(inputArg),destination=resolve(destinationArg),artifacts=resolve(artifactsArg);
const inventoryPath=resolve(inventoryArg??'docs/studio/foundation-evidence/architecture-realignment-20261030/vict-realignment-consumer-F0YKQr.json');
const hash=value=>createHash('sha256').update(value).digest('hex');
const bytes=readFileSync(input),bundle=JSON.parse(bytes.toString('utf8'));
if(bytes.length>96*1024*1024)throw Error('Export exceeds supported JSON byte budget.');
if(!bundle||Object.keys(bundle).some(key=>!['application','uiDocuments','mediaArchive'].includes(key))||bundle.application?.schema!=='vict.application@3'||bundle.uiDocuments?.length!==1||bundle.uiDocuments[0]?.document?.schema!=='vict.ui-document@1')throw Error('Expected supported one-screen application export, not bare source or an arbitrary bundle.');
const source=bundle.uiDocuments[0].document;
if(bundle.mediaArchive&&(bundle.mediaArchive.schema!=='vict.media-archive@1'||!Array.isArray(bundle.mediaArchive.assets)||bundle.mediaArchive.assets.length))throw Error('This preview supports only absent or empty media archives; managed media validation is not bypassed.');
if(Object.keys(source.assets??{}).length)throw Error('This preview does not support source asset inventories.');
const application=bundle.application;
if(application.routes?.length!==1||application.routes[0]?.path!=='/'||application.screens?.length!==1||application.screens[0]?.uiDocument?.documentId!==source.id||application.screens[0]?.uiDocument?.revision!==source.revision||application.routes[0]?.screenId!==application.screens[0]?.id)throw Error('Only an attached single-screen root export is supported.');
const inventory=JSON.parse(readFileSync(inventoryPath,'utf8'));
if(inventory.schema!=='vict.architecture-realignment-consumer@1'||!inventory.status?.startsWith('PASS:'))throw Error('Expected successful public-artifact inventory.');
const names=['contracts','ui','sdk','application','ui-svelte','ui-media-svelte','ui-flow-svelte'];
const packs=names.map(name=>{const pack=inventory.packs.find(pack=>pack.name===`@victframework/${name}`);if(!pack?.files?.length)throw Error(`Missing artifact inventory: ${name}`);const path=join(artifacts,basename(pack.path));if(hash(readFileSync(path))!==pack.sha256)throw Error(`Packed artifact identity mismatch: ${name}`);return {...pack,path};});
if(existsSync(destination))throw Error('Output destination must not already exist.');
mkdirSync(join(destination,'src'),{recursive:true});mkdirSync(join(destination,'public'));
const put=(path,text)=>writeFileSync(join(destination,path),text);
const report={schema:'vict.export-device-preview@1',status:'preparing',sourceExport:{path:input,sha256:hash(bytes),bytes:bytes.length,documentId:source.id},artifactInventory:{path:inventoryPath,sha256:hash(readFileSync(inventoryPath)),sourceCandidate:inventory.sourceCandidate},destination,packs:packs.map(({name,path,sha256})=>({name,path,sha256})),limitations:['No device or browser pass; no server started.','No backend or provider execution; unsupported actions fail explicitly.','Only one-screen exports without managed media/source assets are supported.','Only catalog, Flow and Media public registrations are installed; other definitions refuse compilation.','Local state is session-only; no Studio storage, account, cookies or saved applications are shared.','LAN reachability/firewall permission and secure-context-dependent controls remain unproven.']};
const save=()=>put('preview-report.json',JSON.stringify(report,null,2)+'\n');save();
const npm=process.platform==='win32'?'npm.cmd':'npm';
const run=(args,log)=>{const result=spawnSync(npm,args,{cwd:destination,encoding:'utf8',shell:process.platform==='win32',maxBuffer:32*1024*1024});put(log,String(result.stdout??'')+String(result.stderr??''));if(result.error||result.status!==0)throw result.error??Error(`npm ${args.join(' ')} failed (${result.status}); see ${log}`);return result.stdout;};
try{
  copyFileSync(input,join(destination,'public','application.json'));
  if(hash(readFileSync(join(destination,'public','application.json')))!==report.sourceExport.sha256)throw Error('Export copy differs.');
  const version=name=>JSON.parse(readFileSync(join(root,'node_modules',name,'package.json'),'utf8')).version;
  put('package.json',JSON.stringify({name:'vict-actual-export-device-preview',private:true,type:'module',scripts:{build:'vite build'},dependencies:{...Object.fromEntries(packs.map(pack=>[pack.name,`file:${pack.path.replaceAll('\\','/')}`])),svelte:version('svelte')},devDependencies:Object.fromEntries(['vite','@sveltejs/vite-plugin-svelte','typescript'].map(name=>[name,version(name)]))},null,2));
  put('vite.config.mjs',`import {defineConfig} from 'vite';import {svelte} from '@sveltejs/vite-plugin-svelte';export default defineConfig({base:'./',plugins:[svelte()],ssr:{noExternal:true},build:{sourcemap:false}});\n`);
  put('index.html','<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>VICT application preview</title></head><body><div id="app"></div><script type="module" src="/src/main.ts"></script></body></html>');
  put('src/runtime.ts',`import {compileUiDocument,defaultSemanticElementCatalog,createUiAuthoringRegistry} from '@victframework/ui';
import {catalogAuthoringPackage,catalogImplementations,validateSvelteComponentPlan} from '@victframework/ui-svelte';
import {flowAuthoringPackage,flowAuthoringImplementations} from '@victframework/ui-flow-svelte/authoring';
import {mediaAuthoringPackage,mediaAuthoringImplementations} from '@victframework/ui-media-svelte/authoring';
export const implementations=[...catalogImplementations,...flowAuthoringImplementations,...mediaAuthoringImplementations];
export const descriptors=createUiAuthoringRegistry([catalogAuthoringPackage,flowAuthoringPackage,mediaAuthoringPackage],implementations,{requireCompatibility:true}).descriptors;
export function prepare(bundle:any){const source=bundle.uiDocuments[0].document;const compiled=compileUiDocument(source,defaultSemanticElementCatalog(),descriptors);if(!compiled.ok)throw Error(JSON.stringify(compiled));const issues=validateSvelteComponentPlan(compiled.plan,descriptors,implementations);if(issues.length)throw Error(JSON.stringify(issues));return {source,plan:compiled.plan};}
`);
  put('src/validate.ts',`import bundle from '../public/application.json';import {prepare} from './runtime';const {source,plan}=prepare(bundle);console.log(JSON.stringify({status:'PASS',documentId:source.id,planSchema:plan.schema}));\n`);
  put('src/main.ts',`import {mount} from 'svelte';import App from './App.svelte';fetch('./application.json',{cache:'no-store'}).then(response=>{if(!response.ok)throw Error('Export could not be loaded.');return response.json();}).then(bundle=>mount(App,{target:document.getElementById('app')!,props:{bundle}})).catch(error=>{document.getElementById('app')!.textContent='Preview unavailable: '+error.message;});\n`);
  put('src/App.svelte',`<script lang="ts">
import {untrack} from 'svelte';import {DocumentHost,ControlScope} from '@victframework/ui-svelte';import {AssetProvider,memoryAssetStore} from '@victframework/ui-media-svelte';import {prepare,descriptors,implementations} from './runtime';
import '@victframework/ui-svelte/styles.css';import '@victframework/ui-svelte/catalog.css';import '@victframework/ui-svelte/rhea.css';import '@victframework/ui-flow-svelte/styles.css';
let {bundle}=$props();const {source,plan}=untrack(()=>prepare(bundle)),store=memoryAssetStore();let notice=$state('');
async function dispatch(){notice='This preview has no execution backend. The action was not run.';return {ok:false,code:'PREVIEW_BACKEND_UNAVAILABLE',message:notice};}
function navigate(){notice='Navigation beyond this exported screen is unavailable.';}
</script>
<ControlScope class="vict-rhea"><AssetProvider namespace="isolated-export-preview" {store}><main data-ui-application-viewport><DocumentHost {plan} localState={source.localState} extensionDescriptors={descriptors} extensionImplementations={implementations} {dispatch} {navigate} onRenderDiagnostic={issue=>notice=issue.code+': '+issue.message}/></main></AssetProvider>{#if notice}<p role="status">{notice}</p>{/if}</ControlScope>
<style>:global(body){margin:0}main{min-height:100dvh;position:relative}</style>\n`);
  run(['install','--ignore-scripts','--no-audit','--no-fund','--prefer-offline','--fetch-retries=0','--fetch-timeout=30000'],'install.log');
  report.installedIdentity=packs.map(pack=>{const installed=realpathSync(join(destination,'node_modules',pack.name));if(!installed.startsWith(realpathSync(destination)+'\\')&&!installed.startsWith(realpathSync(destination)+'/'))throw Error('Installed package escapes isolated destination.');for(const file of pack.files)if(file.path!=='package.json'&&hash(readFileSync(join(installed,file.path)))!==file.sha256)throw Error(`Installed artifact differs: ${pack.name}/${file.path}`);return {name:pack.name,filesMatched:pack.files.filter(file=>file.path!=='package.json').length};});save();
  run(['run','build','--','--ssr','src/validate.ts','--outDir','validation'],'validation-build.log');
  const validation=execFileSync(process.execPath,[join(destination,'validation','validate.js')],{cwd:destination,encoding:'utf8',maxBuffer:4*1024*1024});put('validation.log',validation);report.validation=validation.trim();
  run(['run','build'],'production-build.log');
  if(hash(readFileSync(join(destination,'dist','application.json')))!==report.sourceExport.sha256)throw Error('Production export differs from original.');
  report.outputFiles=[];const inventoryOutput=(directory,prefix='')=>{for(const entry of readdirSync(directory,{withFileTypes:true})){const relative=prefix+entry.name,path=join(directory,entry.name);if(entry.isDirectory())inventoryOutput(path,relative+'/');else report.outputFiles.push({path:relative,sha256:hash(readFileSync(path))});}};inventoryOutput(join(destination,'dist'));
  report.status='PASS: unchanged actual export, public-artifact identity, compilation/renderer validation and static production build';save();console.log(JSON.stringify({status:report.status,report:join(destination,'preview-report.json'),staticRoot:join(destination,'dist')}));
}catch(error){report.status='FAIL';report.failure=String(error);save();throw error;}
