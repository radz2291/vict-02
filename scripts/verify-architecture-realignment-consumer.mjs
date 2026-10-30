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
// Explicit reuse requires a prior successful proof. Each package independently
// qualifies only when its exact tracked tree and every existing packed artifact
// byte still match that proof, and no internal dependency was freshly checked.
// All other packages receive a fresh build check, propagated to dependants.
// Default invocation always runs the full ladder.
const reuseIndex = process.argv.indexOf('--reuse-built-dependencies');
const reusePath = reuseIndex < 0 ? undefined : process.argv[reuseIndex + 1];
const status = git(['status', '--porcelain']);
const report = {
  schema: 'vict.architecture-realignment-consumer@1', status: 'started', sourceCandidate: git(['rev-parse', 'HEAD']),
  workingTree: { dirty: !!status, statusSha256: hash(status), note: 'Exact packed source cleanliness checked separately; unrelated Studio/evidence changes are not packed.' },
  destination, consumer, packs: [], packageBuilds: [],
  scope: 'Coding-authored independent-consumer fixture: installed public artifacts, DOM interaction and production build. No actual-agent, browser, device, service or provider proof.',
};
const reportDirectory = resolve(root, 'docs/studio/foundation-evidence/architecture-realignment-20261030');
mkdirSync(reportDirectory, { recursive: true });
const reportPath = join(reportDirectory, `${destination.split(/[/\\]/).at(-1)}.json`);
const save = () => writeFileSync(reportPath, JSON.stringify(report, null, 2));
const put = (path, value) => writeFileSync(join(consumer, path), value);
save();
try {
  if (reuseIndex >= 0 && (!reusePath || reusePath.startsWith('--'))) throw Error('--reuse-built-dependencies requires the path of a prior successful consumer report');
  const previous = reusePath ? JSON.parse(readFileSync(resolve(root, reusePath), 'utf8')) : undefined;
  if (previous && (previous.schema !== report.schema || !previous.status.startsWith('PASS:') || !previous.domTest?.passed || !previous.outputFiles?.length)) throw Error('Dependency reuse requires a successful DOM and production-build report');
  if (previous) {
    const sharedChanges = git(['diff', '--name-only', previous.sourceCandidate, report.sourceCandidate, '--', 'package.json', 'package-lock.json', 'tsconfig.base.json']);
    if (sharedChanges) throw Error('Shared build inputs changed since dependency proof; use the default full ladder');
    const dirtySharedInputs = git(['diff', '--name-only', 'HEAD', '--', 'package.json', 'package-lock.json', 'tsconfig.base.json']);
    if (dirtySharedInputs) throw Error('Commit shared build-input changes and use the default full ladder; uncommitted inputs cannot qualify for reuse');
    report.reusedDependencyEvidence = { reportPath: resolve(root, reusePath), reportSha256: hash(readFileSync(resolve(root, reusePath))), sourceCandidate: previous.sourceCandidate, note: 'Per-package reuse requires equal tracked package trees, all earlier packed-file hashes and no rebuilt internal dependencies. Fresh checks propagate through installed dependency/peer/optional relationships. Reused evidence is not a new build.' };
  }
  // The installed workspace manifests supply the actual internal dependency graph.
  // Reject a stale installed graph rather than making decisions against it.
  const dependencyKinds = ['dependencies', 'peerDependencies', 'optionalDependencies'];
  const packageNames = new Set(names.map(name => `@victframework/${name}`));
  const dependencyGraph = new Map(names.map(name => {
    const manifest = JSON.parse(readFileSync(join(root, 'packages', name, 'package.json'), 'utf8'));
    const installed = JSON.parse(readFileSync(join(root, 'node_modules', manifest.name, 'package.json'), 'utf8'));
    const sortedEntries = value => JSON.stringify(Object.entries(value ?? {}).sort(([a], [b]) => a.localeCompare(b)));
    if (installed.name !== manifest.name || dependencyKinds.some(kind => sortedEntries(installed[kind]) !== sortedEntries(manifest[kind]))) throw Error(`Installed dependency graph differs from workspace manifest: ${name}`);
    const dependencies = [...new Set(dependencyKinds.flatMap(kind => Object.keys(installed[kind] ?? {})))].filter(dependency => packageNames.has(dependency));
    return [manifest.name, dependencies.map(dependency => ({ name: dependency, kinds: dependencyKinds.filter(kind => Object.hasOwn(installed[kind] ?? {}, dependency)) }))];
  }));
  report.internalDependencyGraph = [...dependencyGraph].map(([name, dependencies]) => ({ name, dependencies }));
  const buildOrder = [], visiting = new Set(), visited = new Set();
  const visit = name => {
    if (visiting.has(name)) throw Error(`Cyclic internal build dependency graph: ${name}`);
    if (visited.has(name)) return;
    visiting.add(name);
    for (const dependency of dependencyGraph.get(name)) visit(dependency.name);
    visiting.delete(name); visited.add(name); buildOrder.push(name.slice('@victframework/'.length));
  };
  for (const name of packageNames) visit(name);
  // Compiled JS packages are built in dependency order; Svelte packages ship
  // their public .svelte/TS artifacts and undergo their published build check.
  for (const name of buildOrder) {
    const changes = git(['diff', '--name-only', 'HEAD', '--', `packages/${name}`]);
    const untracked = git(['ls-files', '--others', '--exclude-standard', '--', `packages/${name}`]);
    if (changes || untracked) throw Error(`Commit packed source before proving exact candidate: ${name}`);
    const tree = git(['rev-parse', `${report.sourceCandidate}:packages/${name}`]);
    const priorTree = previous ? git(['rev-parse', `${previous.sourceCandidate}:packages/${name}`]) : undefined;
    const priorPack = previous?.packs.find(pack => pack.name === `@victframework/${name}`);
    if (previous && !priorPack?.files?.length) throw Error(`Earlier report has no artifact inventory: ${name}`);
    const artifactMismatches = [];
    if (previous && tree === priorTree) for (const file of priorPack.files) {
      try {
        if (hash(readFileSync(join(root, 'packages', name, file.path))) !== file.sha256) artifactMismatches.push(file.path);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        artifactMismatches.push(file.path);
      }
    }
    const dependencyRebuilds = dependencyGraph.get(`@victframework/${name}`).filter(dependency => report.packageBuilds.some(build => build.name === dependency.name && build.mode === 'fresh-build-check')).map(dependency => dependency.name);
    if (previous && tree === priorTree && !artifactMismatches.length && !dependencyRebuilds.length) {
      report.packageBuilds.push({ name: `@victframework/${name}`, mode: 'reused-earlier-successful-build', sourceTree: tree, previousSourceTree: priorTree, artifactFilesMatched: priorPack.files.length });
      writeFileSync(join(destination, `build-${name}.log`), `REUSED earlier successful build.\nPrevious report: ${resolve(root, reusePath)}\nPrevious source: ${previous.sourceCandidate}\nCurrent and previous package source tree: ${tree}\nExisting artifact files matched: ${priorPack.files.length}\nNo new dependency build was run.\n`);
    } else {
      writeFileSync(join(destination, `build-${name}.log`), run(['run', 'build', '-w', `@victframework/${name}`], root));
      const reasons = !previous ? ['full-ladder-requested'] : [...(tree !== priorTree ? ['tracked-package-tree-changed'] : []), ...(artifactMismatches.length ? ['existing-artifact-hashes-changed'] : []), ...(dependencyRebuilds.length ? ['internal-dependency-rebuilt'] : [])];
      report.packageBuilds.push({ name: `@victframework/${name}`, mode: 'fresh-build-check', sourceTree: tree, ...(previous ? { previousSourceTree: priorTree } : {}), reason: reasons[0], reasons, ...(artifactMismatches.length ? { artifactMismatches } : {}), ...(dependencyRebuilds.length ? { dependencyRebuilds } : {}) });
    }
  }
  const dependencies = {};
  for (const name of names) {
    const manifest = JSON.parse(readFileSync(join(root, 'packages', name, 'package.json'), 'utf8'));
    const packed = JSON.parse(run(['pack', '--json', '--pack-destination', artifacts], join(root, 'packages', name)))[0];
    const path = join(artifacts, packed.filename);
    dependencies[manifest.name] = `file:${path.replaceAll('\\', '/')}`;
    const files = packed.files.map(file => ({ path: file.path, sha256: hash(readFileSync(join(root, 'packages', name, file.path))) }));
    if (report.packageBuilds.find(build => build.name === manifest.name)?.mode === 'reused-earlier-successful-build') {
      const oldFiles = previous.packs.find(pack => pack.name === manifest.name).files;
      if (files.length !== oldFiles.length || files.some(file => !oldFiles.some(old => old.path === file.path && old.sha256 === file.sha256))) throw Error(`Fresh packed dependency inventory differs from reused build: ${name}`);
    }
    report.packs.push({ name: manifest.name, path, sha256: hash(readFileSync(path)), files });
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
decision:{kind:'component',id:'decision',definitionId:'consumer.review-decision',revision:'1',props:{value:ref('state.decision')},outputs:{valueChange:{setState:{key:'decision'}}},localStyle:[{property:'background-color',value:{type:'token',id:'review-surface'}}]},
},localState:{reviewGraph:{key:'reviewGraph',type:'string',initial:JSON.stringify(graph)}},componentDefinitions:{},assets:{},styleSources:{},tokens:{'review-surface':{id:'review-surface',value:'#f4f7ed'}},conditions:{},theme:{schema:'vict.ui-theme@1',roles:{surface:'#f4f7ed',text:'#223028',accent:'#38714c'}}};}
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
  if (error?.stdout) writeFileSync(join(destination, 'failed-command-stdout.log'), error.stdout);
  if (error?.stderr) writeFileSync(join(destination, 'failed-command-stderr.log'), error.stderr);
  report.status = 'FAIL'; report.failure = String(error); save(); console.error(JSON.stringify({ reportPath, destination, error: String(error) }, null, 2)); process.exitCode = 1;
}
