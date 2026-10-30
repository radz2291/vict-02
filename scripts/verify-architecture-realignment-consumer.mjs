/** Fresh public-artifact fixture proof. Never an actual Studio-agent demonstration. */
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, realpathSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = process.cwd();
const destination = mkdtempSync(join(tmpdir(), 'vict-realignment-consumer-'));
const consumer = join(destination, 'consumer'), artifacts = join(destination, 'artifacts');
mkdirSync(consumer); mkdirSync(artifacts); mkdirSync(join(consumer, 'src'));
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const run = (args, cwd) => execFileSync(npm, args, { cwd, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 32 * 1024 * 1024 });
const names = ['contracts', 'ui', 'sdk', 'application', 'ui-svelte', 'ui-media-svelte', 'ui-flow-svelte'];
const status = git(['status', '--porcelain']);
const report = {
  schema: 'vict.architecture-realignment-consumer@1', status: 'started', sourceCandidate: git(['rev-parse', 'HEAD']),
  workingTree: { dirty: !!status, statusSha256: hash(status), note: 'Exact packed source cleanliness checked separately; unrelated Studio/evidence changes are not packed.' },
  destination, consumer, packs: [],
  scope: 'Coding-authored independent-consumer fixture: installed public artifacts, DOM interaction and production build. No actual-agent, browser, device, service or provider proof.',
};
const reportDirectory = resolve(root, 'docs/studio/foundation-evidence/architecture-realignment-20261030');
mkdirSync(reportDirectory, { recursive: true });
const reportPath = join(reportDirectory, `${destination.split(/[/\\]/).at(-1)}.json`);
const save = () => writeFileSync(reportPath, JSON.stringify(report, null, 2));
const put = (path, value) => writeFileSync(join(consumer, path), value);
save();
try {
  // Compiled JS packages are built in dependency order; Svelte packages ship
  // their public .svelte/TS artifacts and undergo their published build check.
  for (const name of names) {
    const changes = git(['diff', '--name-only', 'HEAD', '--', `packages/${name}/src`, `packages/${name}/package.json`]);
    const untracked = git(['ls-files', '--others', '--exclude-standard', '--', `packages/${name}/src`]);
    if (changes || untracked) throw Error(`Commit packed source before proving exact candidate: ${name}`);
    writeFileSync(join(destination, `build-${name}.log`), run(['run', 'build', '-w', `@victframework/${name}`], root));
  }
  const dependencies = {};
  for (const name of names) {
    const manifest = JSON.parse(readFileSync(join(root, 'packages', name, 'package.json'), 'utf8'));
    const packed = JSON.parse(run(['pack', '--json', '--pack-destination', artifacts], join(root, 'packages', name)))[0];
    const path = join(artifacts, packed.filename);
    dependencies[manifest.name] = `file:${path.replaceAll('\\', '/')}`;
    report.packs.push({ name: manifest.name, path, sha256: hash(readFileSync(path)), files: packed.files.map(file => ({ path: file.path, sha256: hash(readFileSync(join(root, 'packages', name, file.path))) })) });
  }
  const installedVersion = name => JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8')).version;
  dependencies.svelte = installedVersion('svelte');
  const devDependencies = Object.fromEntries(['@sveltejs/vite-plugin-svelte', 'vite', 'vitest', 'happy-dom', 'typescript'].map(name => [name, installedVersion(name)]));
  put('package.json', JSON.stringify({ name: 'vict-realignment-public-consumer', private: true, type: 'module', scripts: { build: 'vite build', test: 'vitest run' }, dependencies, devDependencies }, null, 2));
  put('index.html', '<html><head><title>Public review-node consumer</title></head><body><div id="app"></div><script type="module" src="/src/main.ts"></script></body></html>');
  put('vite.config.mjs', `import {defineConfig} from 'vitest/config';import {svelte} from '@sveltejs/vite-plugin-svelte';export default defineConfig({base:'./',plugins:[svelte()],resolve:{conditions:['browser']},test:{environment:'happy-dom',include:['src/**/*.test.ts']}});`);
  put('src/main.ts', `import {mount} from 'svelte';import App from './App.svelte';mount(App,{target:document.getElementById('app')!});`);
  put('src/ReviewDecision.svelte', `<script lang="ts">
import {Select,type UiSvelteComponentProps} from '@victframework/ui-svelte';
let {props,io,presentation,occurrenceKey}:UiSvelteComponentProps=$props();
const choices=[{value:'pending',label:'Pending'},{value:'revise',label:'Request revision'},{value:'approved',label:'Approved'}];
</script>
<label {...presentation?.target('root')} class={['nodrag nopan nowheel',presentation?.target('root').class??''].join(' ')} data-consumer-control="decision">
  Decision
  <Select id={'decision-'+occurrenceKey} name="decision" value={String(props.value)} options={choices} onChange={value=>io?.emit('valueChange',value)}/>
</label>`);
  put('src/fixture.ts', `import {compileUiDocument,defaultSemanticElementCatalog,type UiDocument,type UiExtensionDescriptor} from '@victframework/ui';
import type {UiSvelteComponentImplementation} from '@victframework/ui-svelte';
import {graphAuthoringContract,parseGraphV2} from '@victframework/ui-flow-svelte';
import {flowAuthoringDescriptors,flowAuthoringImplementations} from '@victframework/ui-flow-svelte/authoring';
import ReviewDecision from './ReviewDecision.svelte';
const descriptor:UiExtensionDescriptor={id:'consumer.review-decision',revision:'1',abi:'vict.ui-component-abi@1',events:['vict.ui-component-abi@1'],rendererImplementationId:'consumer.controls',styleTargets:['root'],props:[{name:'value',type:'string'}],outputs:[{name:'valueChange',payload:'string'}],slots:[]};
const implementation:UiSvelteComponentImplementation={extensionId:descriptor.id,revision:'1',rendererImplementationId:'consumer.controls',abi:'vict.ui-component-abi@1',styleTargets:['root'],slots:[],component:ReviewDecision};
export const descriptors=[...flowAuthoringDescriptors,descriptor],implementations=[...flowAuthoringImplementations,implementation];
const literal=(value:unknown)=>({type:'literal' as const,value}),ref=(path:string)=>({type:'ref' as const,path});
export function createSource():UiDocument{
const graph={schema:'vict.flow-graph@2',revision:0,nodeTypes:[{id:'review',label:'Review',parameters:{decision:{type:'string',default:'pending'}},ports:[]}],nodes:[{id:'first',type:'review',label:'First review',position:{x:0,y:0},values:{}},{id:'second',type:'review',label:'Second review',position:{x:320,y:0},values:{decision:'revise'}}],edges:[]};
if(!parseGraphV2(JSON.stringify(graph)).ok)throw Error('Fixture graph invalid');
return {schema:'vict.ui-document@1',id:'independent-review',revision:'1',root:'workspace',nodes:{
workspace:{kind:'component',id:'workspace',definitionId:'vict.flow.workspace',revision:'2',props:{graph:ref('state.reviewGraph')},outputs:{graphChange:{setState:{key:'reviewGraph'}}},slots:{content:{name:'content',children:['viewport'],scope:{schema:'vict.ui-slot-scope@1',props:[]}},body:{name:'body',children:['decision'],scope:{schema:'vict.ui-slot-scope@1',props:[{name:'nodeId',type:'string'}],state:{decision:{key:'decision',type:'string',initial:'pending',controlled:true}}}}}},
viewport:{kind:'component',id:'viewport',definitionId:'vict.flow.viewport',revision:'2',props:{height:literal(360)}},
decision:{kind:'component',id:'decision',definitionId:'consumer.review-decision',revision:'1',props:{value:ref('state.decision')},outputs:{valueChange:{setState:{key:'decision'}}},localStyle:[{property:'background-color',value:{type:'token',tokenId:'review-surface'}}]},
},localState:{reviewGraph:{key:'reviewGraph',type:'string',initial:JSON.stringify(graph)}},componentDefinitions:{},assets:{},styleSources:{},tokens:{'review-surface':{id:'review-surface',type:'color',value:'#f4f7ed'}},conditions:{},theme:{schema:'vict.ui-theme@1',roles:{surface:'#f4f7ed',text:'#223028',accent:'#38714c'}}};}
export function compile(source:UiDocument){const result=compileUiDocument(source,defaultSemanticElementCatalog(),descriptors);if(!result.ok)throw Error(JSON.stringify(result));return result.plan;}
export function contract(){return graphAuthoringContract('vict.flow.workspace','2');}
`);
  put('src/App.svelte', `<script lang="ts">
import {DocumentHost,ControlScope} from '@victframework/ui-svelte';
import {createSource,compile,descriptors,implementations} from './fixture';
import '@victframework/ui-svelte/styles.css';import '@victframework/ui-svelte/catalog.css';import '@victframework/ui-flow-svelte/styles.css';
const source=createSource(),plan=compile(source);
</script><h1>Independent review-node fixture</h1><p>Public artifacts and normal registered controls; no execution backend.</p><ControlScope><DocumentHost {plan} localState={source.localState} extensionDescriptors={descriptors} extensionImplementations={implementations} dispatch={async()=>undefined} navigate={()=>{}}/></ControlScope>`);
  put('src/consumer.test.ts', `import {it,expect} from 'vitest';import {mount,unmount,flushSync} from 'svelte';import {DocumentHost} from '@victframework/ui-svelte';import {parseGraphV2} from '@victframework/ui-flow-svelte';import {createSource,compile,descriptors,implementations,contract} from './fixture';
const settle=async()=>{flushSync();await new Promise(resolve=>setTimeout(resolve,60));flushSync();};
it('uses the installed public host contract and a different ordinary registered control for isolated node parameter writes and portable reopen',async()=>{
expect(contract()).toMatchObject({schema:'vict.flow-authoring@1',modelVersion:2,persistence:'explicit-bidirectional-state',body:{slot:'body',controlledState:'node-parameters'}});
const source=createSource(),writes:[string,unknown][]=[],diagnostics:unknown[]=[];
const target=document.createElement('div');document.body.append(target);
let app=mount(DocumentHost,{target,props:{plan:compile(source),localState:source.localState,extensionDescriptors:descriptors,extensionImplementations:implementations,dispatch:async()=>undefined,navigate:()=>{},onStateChange:(key,value)=>writes.push([key,value]),onRenderDiagnostic:issue=>diagnostics.push(issue)}});
try{await settle();expect(target.querySelectorAll('[data-consumer-control="decision"]')).toHaveLength(2);
const first=target.querySelector<HTMLSelectElement>('[data-graph-node="first"] select')!,second=target.querySelector<HTMLSelectElement>('[data-graph-node="second"] select')!;
expect(first.value).toBe('pending');expect(second.value).toBe('revise');expect(first.closest('[data-ui-owner]')).not.toBeNull();
first.value='approved';first.dispatchEvent(new Event('change',{bubbles:true}));await settle();
expect(writes.filter(([key])=>key==='reviewGraph')).toHaveLength(1);const saved=String(writes.at(-1)![1]);const parsed=parseGraphV2(saved);expect(parsed.ok).toBe(true);if(!parsed.ok)throw Error(JSON.stringify(parsed));
expect(parsed.graph.nodes.find(node=>node.id==='first')!.values.decision).toBe('approved');expect(parsed.graph.nodes.find(node=>node.id==='second')!.values.decision).toBe('revise');expect(second.value).toBe('revise');expect(diagnostics).toEqual([]);
await unmount(app);target.replaceChildren();const reopened=JSON.parse(JSON.stringify({...source,localState:{reviewGraph:{...source.localState.reviewGraph,initial:saved}}}));
app=mount(DocumentHost,{target,props:{plan:compile(reopened),localState:reopened.localState,extensionDescriptors:descriptors,extensionImplementations:implementations,dispatch:async()=>undefined,navigate:()=>{},onRenderDiagnostic:issue=>diagnostics.push(issue)}});await settle();expect(target.querySelector<HTMLSelectElement>('[data-graph-node="first"] select')!.value).toBe('approved');expect(target.querySelector<HTMLSelectElement>('[data-graph-node="second"] select')!.value).toBe('revise');expect(diagnostics).toEqual([]);
}finally{await unmount(app);target.remove();}
});`);
  const fixtureFiles = ['package.json', 'vite.config.mjs', 'index.html', 'src/main.ts', 'src/App.svelte', 'src/ReviewDecision.svelte', 'src/fixture.ts', 'src/consumer.test.ts'];
  for (const file of fixtureFiles) if (readFileSync(join(consumer, file), 'utf8').includes('apps/studio') || readFileSync(join(consumer, file), 'utf8').includes('resolve.alias')) throw Error('Fixture crosses public artifact boundary');
  writeFileSync(join(destination, 'install.log'), run(['install', '--ignore-scripts', '--no-audit', '--no-fund', '--prefer-offline', '--fetch-retries=0', '--fetch-timeout=30000'], consumer));
  report.installedByteComparison = report.packs.map(pack => {
    const installed = realpathSync(join(consumer, 'node_modules', pack.name));
    if (!installed.startsWith(consumer + '\\') && !installed.startsWith(consumer + '/')) throw Error('Package escaped independent consumer');
    for (const file of pack.files) if (file.path !== 'package.json' && hash(readFileSync(join(installed, file.path))) !== file.sha256) throw Error(`Installed artifact bytes differ: ${pack.name}/${file.path}`);
    return { name: pack.name, installed, filesMatched: pack.files.filter(file => file.path !== 'package.json').length, manifestComparison: 'excluded: npm normalizes package.json' };
  });
  report.fixtureFiles = fixtureFiles.map(path => ({ path, sha256: hash(readFileSync(join(consumer, path))) })); save();
  writeFileSync(join(destination, 'dom-test.log'), run(['test'], consumer));
  report.domTest = { passed: true, log: join(destination, 'dom-test.log'), sha256: hash(readFileSync(join(destination, 'dom-test.log'))) }; save();
  writeFileSync(join(destination, 'production-build.log'), run(['run', 'build'], consumer));
  report.outputFiles = readdirSync(join(consumer, 'dist/assets')).map(name => ({ name, sha256: hash(readFileSync(join(consumer, 'dist/assets', name))) }));
  report.status = 'PASS: installed public-artifact DOM interaction, isolated state, source roundtrip/reopen and production build';
  report.limitations = ['DOM simulation does not prove painted graph geometry, pointer connections, browser focus or physical-device behavior.', 'Coding-authored fixture is not an actual Studio-agent app or owner acceptance.', 'Source/default persistence is explicit consumer handling; no durable application adapter or backend effect is demonstrated.'];
  save(); console.log(JSON.stringify({ reportPath, status: report.status, destination, sourceCandidate: report.sourceCandidate, packs: report.packs.map(({ name, sha256 }) => ({ name, sha256 })) }, null, 2));
} catch (error) {
  report.status = 'FAIL'; report.failure = String(error); save(); console.error(JSON.stringify({ reportPath, destination, error: String(error) }, null, 2)); process.exitCode = 1;
}
