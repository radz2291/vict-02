/** Installed public artifacts only; coding-authored fixtures, never actual-agent proof. */
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, realpathSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = process.cwd();
const destination = mkdtempSync(join(tmpdir(), 'vict-structure-consumer-'));
const consumer = join(destination, 'consumer'), artifacts = join(destination, 'artifacts');
for (const path of [consumer, artifacts, join(consumer, 'src')]) mkdirSync(path);
const hash = value => createHash('sha256').update(value).digest('hex');
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const run = (args, cwd) => execFileSync(npm, args, { cwd, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 32 * 1024 * 1024 });
const names = ['contracts', 'ui', 'sdk', 'application', 'ui-svelte', 'ui-media-svelte', 'ui-editor', 'ui-flow-svelte', 'ui-structure-svelte'];
const evidence = resolve(root, 'docs/studio/foundation-evidence/structure-shared-completion-20261101');
mkdirSync(evidence, { recursive: true });
const reportPath = join(evidence, destination.split(/[/\\]/).at(-1) + '.json');
const report = { schema: 'vict.structure-shared-public-consumer@1', sourceCandidate: git(['rev-parse', 'HEAD']), status: 'started', destination, consumer, packageBuilds: [], packs: [], scope: 'Installed public-artifact source projection, grouping/tracing, explorer DOM, authored columns/row version compatibility and ordinary control interaction. No private Studio imports, source aliases or actual-agent authorship.' };
const save = () => writeFileSync(reportPath, JSON.stringify(report, null, 2));
const put = (path, text) => writeFileSync(join(consumer, path), text);
save();
try {
  for (const name of names) {
    if (git(['diff', '--name-only', 'HEAD', '--', `packages/${name}`]) || git(['ls-files', '--others', '--exclude-standard', '--', `packages/${name}`])) throw Error(`Commit packed source first: ${name}`);
    writeFileSync(join(destination, `build-${name}.log`), run(['run', 'build', '-w', `@victframework/${name}`], root));
    report.packageBuilds.push({ name: `@victframework/${name}`, mode: 'fresh-build', sourceTree: git(['rev-parse', `${report.sourceCandidate}:packages/${name}`]) });
  }
  const dependencies = {};
  for (const name of names) {
    const manifest = JSON.parse(readFileSync(join(root, 'packages', name, 'package.json'), 'utf8'));
    const packed = JSON.parse(run(['pack', '--json', '--pack-destination', artifacts], join(root, 'packages', name)))[0];
    const path = join(artifacts, packed.filename);
    dependencies[manifest.name] = `file:${path.replaceAll('\\', '/')}`;
    report.packs.push({ name: manifest.name, path, sha256: hash(readFileSync(path)), files: packed.files.map(file => ({ path: file.path, sha256: hash(readFileSync(join(root, 'packages', name, file.path))) })) });
  }
  const version = name => JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8')).version;
  dependencies.svelte = version('svelte');
  put('package.json', JSON.stringify({ name: 'vict-independent-structure-consumer', private: true, type: 'module', scripts: { test: 'vitest run', build: 'vite build' }, dependencies, devDependencies: Object.fromEntries(['@sveltejs/vite-plugin-svelte', 'vite', 'vitest', 'happy-dom', 'typescript'].map(name => [name, version(name)])) }, null, 2));
  put('vite.config.mjs', `import {defineConfig} from 'vitest/config';import {svelte} from '@sveltejs/vite-plugin-svelte';export default defineConfig({base:'./',plugins:[svelte()],resolve:{conditions:['browser']},test:{environment:'happy-dom',include:['src/**/*.test.ts'],server:{deps:{inline:['@xyflow/svelte','@lucide/svelte','@shadcn-svelte/primitives','svelte-streamdown','svelte-toolbelt','bits-ui','runed','@internationalized/date']}}}});`);
  put('index.html', '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Public Structure consumer</title></head><body><div id="app"></div><script type="module" src="/src/main.ts"></script></body></html>');
  put('src/main.ts', `import {mount} from 'svelte';import App from './App.svelte';mount(App,{target:document.getElementById('app')!});`);
  put('src/OrdinaryField.svelte', `<script lang="ts">import type {UiSvelteComponentProps} from '@victframework/ui-svelte';let {props,io}:UiSvelteComponentProps=$props();</script><label>Review note<input aria-label="Review note" value={String(props.value)} oninput={event=>io?.emit('valueChange',event.currentTarget.value)}/></label>`);
  put('src/fixture.ts', `import {compileUiDocument,defaultSemanticElementCatalog,type UiDocument,type UiExtensionDescriptor} from '@victframework/ui';
import {flowAuthoringDescriptors,flowAuthoringImplementations} from '@victframework/ui-flow-svelte/authoring';
import OrdinaryField from './OrdinaryField.svelte';
const literal=(value:unknown)=>({type:'literal' as const,value}),ref=(path:string)=>({type:'ref' as const,path});
const field:UiExtensionDescriptor={id:'consumer.ordinary-field',revision:'1',abi:'vict.ui-component-abi@1',events:['vict.ui-component-abi@1'],rendererImplementationId:'consumer.controls',styleTargets:['root'],props:[{name:'value',type:'string'}],outputs:[{name:'valueChange',payload:'string'}],slots:[]};
export const descriptors=[...flowAuthoringDescriptors,field],implementations=[...flowAuthoringImplementations,{extensionId:field.id,revision:'1',rendererImplementationId:'consumer.controls',abi:'vict.ui-component-abi@1',styleTargets:['root'],slots:[],component:OrdinaryField}];
export function source():UiDocument{return {schema:'vict.ui-document@1',id:'public-structure',revision:'1',root:'screen',nodes:{
 screen:{kind:'element',id:'screen',tag:'main',children:['section','other']},section:{kind:'element',id:'section',tag:'section',children:['input']},
 input:{kind:'element',id:'input',tag:'input',children:[],attributes:{'aria-label':'Shared message',value:ref('state.message'),title:ref('state.message')}},
 other:{kind:'element',id:'other',tag:'input',children:[],attributes:{value:ref('state.message')}},
},localState:{message:{key:'message',type:'string',initial:'Independent source'}},componentDefinitions:{},assets:{},styleSources:{},tokens:{},conditions:{}};}
export function ports():UiDocument{
const graph={schema:'vict.flow-graph@2',revision:0,nodeTypes:[{id:'review',label:'Review',parameters:{note:{type:'string',default:'Pending'}},ports:[{id:'brief',label:'Brief',direction:'input',type:'brief'},{id:'prompt',label:'Prompt',direction:'input',type:'prompt'},{id:'draft',label:'Draft',direction:'output',type:'image'}]}],nodes:[{id:'a',type:'review',label:'First',position:{x:0,y:0},values:{}},{id:'b',type:'review',label:'Second',position:{x:400,y:0},values:{note:'Second note'}}],edges:[]};
const document=source();document.id='public-ports';document.root='workspace';document.localState={graph:{key:'graph',type:'string',initial:JSON.stringify(graph)}};
document.nodes={workspace:{kind:'component',id:'workspace',definitionId:'vict.flow.workspace',revision:'2',props:{graph:ref('state.graph')},outputs:{graphChange:{setState:{key:'graph'}}},slots:{content:{name:'content',children:['viewport'],scope:{schema:'vict.ui-slot-scope@1',props:[]}},body:{name:'body',children:['card'],scope:{schema:'vict.ui-slot-scope@1',props:[],state:{note:{key:'note',type:'string',initial:'',controlled:true}}}}}},
 viewport:{kind:'component',id:'viewport',definitionId:'vict.flow.viewport',revision:'2',props:{height:literal(330)}},
 card:{kind:'element',id:'card',tag:'article',children:['field','columns'],localStyle:[{property:'width',value:{type:'text',value:'300px'}}]},
 field:{kind:'component',id:'field',definitionId:'consumer.ordinary-field',revision:'1',props:{value:ref('state.note')},outputs:{valueChange:{setState:{key:'note'}}}},
 columns:{kind:'component',id:'columns',definitionId:'vict.flow.port-columns',revision:'1',slots:{inputs:{name:'inputs',children:['brief','prompt']},outputs:{name:'outputs',children:['draft']}}},
 brief:{kind:'component',id:'brief',definitionId:'vict.flow.port-row',revision:'2',props:{id:literal('brief')}},prompt:{kind:'component',id:'prompt',definitionId:'vict.flow.port-row',revision:'2',props:{id:literal('prompt')}},draft:{kind:'component',id:'draft',definitionId:'vict.flow.port-row',revision:'2',props:{id:literal('draft')}},
};return document;}
export function compile(document:UiDocument){const result=compileUiDocument(document,defaultSemanticElementCatalog(),descriptors);if(!result.ok)throw Error(JSON.stringify(result));return result.plan;}
`);
  put('src/App.svelte', `<script lang="ts">import {StructureExplorer} from '@victframework/ui-structure-svelte';import {DocumentHost,ControlScope} from '@victframework/ui-svelte';import {source,ports,compile,descriptors,implementations} from './fixture';import '@victframework/ui-svelte/styles.css';const document=source(),portSource=ports(),plan=compile(portSource);</script><h1>Independent public Structure consumer</h1><p>Source relationships and ordinary authored controls, using installed VICT packages.</p><section style="height:480px"><StructureExplorer {document} revision="1" onSelect={()=>{}} onMove={()=>false} onNotice={()=>{}}/></section><h2>Independent port columns</h2><ControlScope><DocumentHost {plan} localState={portSource.localState} extensionDescriptors={descriptors} extensionImplementations={implementations} dispatch={async()=>undefined} navigate={()=>{}}/></ControlScope>`);
  put('src/consumer.test.ts', `import {it,expect} from 'vitest';import {mount,unmount,flushSync} from 'svelte';import {DocumentHost} from '@victframework/ui-svelte';import {parseGraphV2} from '@victframework/ui-flow-svelte';import {StructureExplorer,projectStructure,filterStructure,structureId,structurePorts,structureConnectionEdges,connectionGroup,selectionHighlight,structureMove} from '@victframework/ui-structure-svelte';import {source,ports,compile,descriptors,implementations} from './fixture';
const settle=async()=>{flushSync();await new Promise(resolve=>setTimeout(resolve,120));flushSync();};
it('retains every source relation and grouped member through public projection/search/tracing and refuses stale moves',()=>{const document=source(),before=JSON.stringify(document),graph=projectStructure(document),input=structureId(document.id,'node','input');const port=structurePorts(graph,input).find(p=>p.side==='in'&&p.label==='Value');expect(port?.count).toBe(2);const edges=structureConnectionEdges(graph),reads=edges.filter(e=>e.target===input&&e.data?.role==='value');expect(reads).toHaveLength(2);expect(new Set(reads.map(e=>e.data?.path)).size).toBe(2);expect(connectionGroup(edges,reads[0].id)).toHaveLength(2);const trace=selectionHighlight(edges,[{kind:'edge',id:reads[0].id}]);expect(trace?.edges.size).toBe(1);expect(trace?.nodes.has(input)).toBe(true);expect(filterStructure(graph,{search:'Shared message'}).nodes.some(n=>n.id===input)).toBe(true);expect(structureMove(document,'1',{documentId:document.id,revision:'old',source:input,target:structureId(document.id,'node','screen')},false,[]).ok).toBe(false);expect(JSON.stringify(document)).toBe(before);});
it('renders shared explorer outside Studio and searches without changing canonical source',async()=>{const documentSource=source(),before=JSON.stringify(documentSource),target=document.createElement('div');document.body.append(target);const notices:string[]=[],moves:unknown[]=[];const app=mount(StructureExplorer,{target,props:{document:documentSource,revision:'1',onSelect:()=>{},onMove:request=>{moves.push(request);return false;},onNotice:message=>notices.push(message)}});try{await settle();expect(target.querySelector('[data-vict-structure]')).not.toBeNull();expect(target.querySelector('[aria-label="Fit all"]')).not.toBeNull();expect(target.querySelectorAll('.declared-connection-handle.connectable')).toHaveLength(0);const search=target.querySelector<HTMLInputElement>('[aria-label="Search structure"]')!;search.value='Shared message';search.dispatchEvent(new Event('input',{bubbles:true}));await settle();expect(target.querySelector('.structure-count')?.textContent).toContain('Search');expect(target.textContent).toContain('Shared message');search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));await settle();expect(moves).toEqual([]);expect(notices).toEqual([]);expect(JSON.stringify(documentSource)).toBe(before);}finally{await unmount(app);target.remove();}});
it('renders independent columns with names-only row@2 and changes an ordinary control in one occurrence',async()=>{const documentSource=ports(),target=document.createElement('div');document.body.append(target);const writes:[string,unknown][]=[],diagnostics:unknown[]=[];const app=mount(DocumentHost,{target,props:{plan:compile(documentSource),localState:documentSource.localState,extensionDescriptors:descriptors,extensionImplementations:implementations,dispatch:async()=>undefined,navigate:()=>{},onStateChange:(key,value)=>writes.push([key,value]),onRenderDiagnostic:issue=>diagnostics.push(issue)}});try{await settle();expect(target.querySelectorAll('.graph-port-columns')).toHaveLength(2);const columns=target.querySelector('.graph-port-columns')!;expect(columns.children[0].querySelectorAll('[data-direction="input"]')).toHaveLength(2);expect(columns.children[1].querySelectorAll('[data-direction="output"]')).toHaveLength(1);expect(target.querySelectorAll('.port-row-type')).toHaveLength(0);expect(target.querySelector('[data-node-port="a/draft"] [title]')?.getAttribute('title')).toContain('image');const fields=target.querySelectorAll<HTMLInputElement>('[aria-label="Review note"]');expect(fields[0].value).toBe('Pending');expect(fields[1].value).toBe('Second note');fields[0].value='Independent edit';fields[0].dispatchEvent(new Event('input',{bubbles:true}));await settle();const graph=parseGraphV2(String(writes.find(([key])=>key==='graph')?.[1]));expect(graph.ok).toBe(true);if(!graph.ok)throw Error('Invalid write');expect(graph.graph.nodes.find(n=>n.id==='a')?.values.note).toBe('Independent edit');expect(graph.graph.nodes.find(n=>n.id==='b')?.values.note).toBe('Second note');expect(diagnostics).toEqual([]);}finally{await unmount(app);target.remove();}});
it('keeps explicitly saved row@1 visible type behavior',async()=>{const documentSource=ports();for(const node of Object.values(documentSource.nodes))if(node.kind==='component'&&node.definitionId==='vict.flow.port-row')node.revision='1';const target=document.createElement('div');document.body.append(target);const app=mount(DocumentHost,{target,props:{plan:compile(documentSource),localState:documentSource.localState,extensionDescriptors:descriptors,extensionImplementations:implementations,dispatch:async()=>undefined,navigate:()=>{}}});try{await settle();expect(target.querySelectorAll('.port-row-type')).toHaveLength(6);}finally{await unmount(app);target.remove();}});
`);
  const fixtures = ['package.json', 'vite.config.mjs', 'index.html', 'src/main.ts', 'src/App.svelte', 'src/OrdinaryField.svelte', 'src/fixture.ts', 'src/consumer.test.ts'];
  for (const file of fixtures) {
    const content = readFileSync(join(consumer, file), 'utf8');
    if (content.includes('apps/studio') || content.includes('resolve.alias') || content.includes('packages/ui-')) throw Error(`Private source import in ${file}`);
  }
  writeFileSync(join(destination, 'install.log'), run(['install', '--ignore-scripts', '--no-audit', '--no-fund', '--prefer-offline', '--fetch-retries=0', '--fetch-timeout=30000'], consumer));
  report.installedByteComparison = report.packs.map(pack => {
    const installed = realpathSync(join(consumer, 'node_modules', pack.name));
    if (!installed.startsWith(consumer + '\\') && !installed.startsWith(consumer + '/')) throw Error('Package escaped consumer');
    for (const file of pack.files) if (file.path !== 'package.json' && hash(readFileSync(join(installed, file.path))) !== file.sha256) throw Error(`Installed byte mismatch: ${pack.name}/${file.path}`);
    return { name: pack.name, installed, filesMatched: pack.files.filter(file => file.path !== 'package.json').length, manifestComparison: 'npm-normalized manifest excluded from byte comparison' };
  });
  report.fixtureFiles = fixtures.map(path => ({ path, sha256: hash(readFileSync(join(consumer, path))) }));save();
  writeFileSync(join(destination, 'dom-test.log'), run(['test'], consumer));
  report.domTest = { passed: true, cases: 4, path: join(destination, 'dom-test.log'), sha256: hash(readFileSync(join(destination, 'dom-test.log'))) };save();
  writeFileSync(join(destination, 'production-build.log'), run(['run', 'build'], consumer));
  report.productionBuild = { passed: true, path: join(destination, 'production-build.log'), sha256: hash(readFileSync(join(destination, 'production-build.log'))) };
  report.outputFiles = ['index.html', ...readdirSync(join(consumer, 'dist/assets')).map(name => `assets/${name}`)].map(path => ({ path, sha256: hash(readFileSync(join(consumer, 'dist', path))) }));
  report.status = 'PASS';report.limitations = ['Coding-authored fixture is not actual-agent authorship.', 'DOM simulation proves renderer/event/source behavior, not painted routing, physical touch, pointer connection dragging or phone inset coverage.', 'No persistence/backend execution or new device proof claimed.'];save();
  console.log(JSON.stringify({ reportPath, status: report.status, destination, sourceCandidate: report.sourceCandidate }, null, 2));
} catch (error) {
  if (error?.stdout) writeFileSync(join(destination, 'failed-command-stdout.log'), error.stdout);
  if (error?.stderr) writeFileSync(join(destination, 'failed-command-stderr.log'), error.stderr);
  report.status = 'FAIL';report.failure = String(error);save();console.error(JSON.stringify({ reportPath, destination, error: String(error) }, null, 2));process.exitCode = 1;
}
