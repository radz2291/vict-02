/** Bounded isolated consumer. Never replaces historical evidence or publishes. */
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,realpathSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,relative} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=process.cwd();
const destination=mkdtempSync(join(tmpdir(),'vict-foundation-consumer-'));
const consumer=join(destination,'consumer'),artifacts=join(destination,'artifacts');
mkdirSync(consumer);mkdirSync(artifacts);mkdirSync(join(consumer,'src'));
const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const sourceStatus=execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim();
const npm=process.platform==='win32'?'npm.cmd':'npm';
const run=(args,cwd)=>execFileSync(npm,args,{cwd,encoding:'utf8',shell:process.platform==='win32',maxBuffer:16*1024*1024});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={schema:'vict.foundation-packed-consumer@1',status:'started',sourceBase:sha,sourceWorkingTree:{dirty:sourceStatus.length>0,statusSha256:hash(sourceStatus),note:sourceStatus?'Packed file hashes identify the tested working bytes; sourceBase is their Git ancestor, not a claim that all changes are committed.':'Source checkout was clean before this run created its evidence report.'},destination,consumer,scope:'Supporting fresh packed-consumer compile/build proof; no browser, interaction, physical-device or actual-agent claim.',packs:[]};
const reportPath=resolve(root,'docs/studio/foundation-evidence',`packed-consumer-${destination.split(/[/\\]/).at(-1)}.json`);
const save=()=>writeFileSync(reportPath,JSON.stringify(report,null,2));
save();
try{
  // ui has a JS distribution export; rebuild it after source-level theme changes.
  writeFileSync(join(destination,'ui-build.log'),run(['run','build','-w','@victframework/ui'],root));
  const dependencies={svelte:'5.57.0'};
  for(const name of ['contracts','ui','sdk','application','ui-svelte','ui-media-svelte','ui-ai-svelte','ui-flow-svelte','ui-patterns-svelte']){
    const manifest=JSON.parse(readFileSync(join(root,'packages',name,'package.json'),'utf8'));
    const packed=JSON.parse(run(['pack','--json','--pack-destination',artifacts],join(root,'packages',name)))[0];
    const path=join(artifacts,packed.filename);
    dependencies[manifest.name]=`file:${path.replaceAll('\\','/')}`;
    report.packs.push({name:manifest.name,path,sha256:hash(readFileSync(path)),unpackedSize:packed.unpackedSize,files:packed.files.map(file=>({path:file.path,sha256:hash(readFileSync(join(root,'packages',name,file.path)))}))});
  }
  writeFileSync(join(consumer,'package.json'),JSON.stringify({name:'vict-foundation-isolated-consumer',private:true,type:'module',scripts:{build:'vite build'},dependencies,devDependencies:{'@sveltejs/vite-plugin-svelte':'5.1.1',vite:'6.4.3',typescript:'6.0.3'}},null,2));
  writeFileSync(join(consumer,'index.html'),'<html><head><title>Foundation packed consumer</title></head><body><div id="app"></div><script type="module" src="/src/main.ts"></script></body></html>');
  writeFileSync(join(consumer,'vite.config.mjs'),`import {defineConfig} from 'vite';import {svelte} from '@sveltejs/vite-plugin-svelte';export default defineConfig({base:'./',plugins:[svelte()]});`);
  const compositionJson=execFileSync(process.execPath,['--import','tsx','--input-type=module','-e',"import {typedCompositionDocument} from './packages/ui-flow-svelte/test/composition-fixtures.ts';process.stdout.write(JSON.stringify(['media','research'].map(kind=>typedCompositionDocument(kind))));"],{cwd:root,encoding:'utf8',maxBuffer:2*1024*1024});
  writeFileSync(join(consumer,'src/composition-sources.json'),compositionJson);
  writeFileSync(join(consumer,'src/main.ts'),`import {mount} from 'svelte';import App from './App.svelte';mount(App,{target:document.getElementById('app')!});`);
  writeFileSync(join(consumer,'src/App.svelte'),`<script lang="ts">
import {compileUiDocument,defaultSemanticElementCatalog} from '@victframework/ui';
import {DocumentHost,ControlScope,OwnedTooltip,catalogDescriptors,catalogImplementations} from '@victframework/ui-svelte';
import {Button} from '@victframework/ui-svelte/catalog/button';
import {aiAuthoringDescriptors,aiAuthoringImplementations} from '@victframework/ui-ai-svelte/authoring';
import compositionSources from './composition-sources.json';
import {GraphSurface,emptyGraph,serializeGraph} from '@victframework/ui-flow-svelte';
import {flowAuthoringDescriptors,flowAuthoringImplementations} from '@victframework/ui-flow-svelte/authoring';
import {patternAuthoringDescriptors,patternAuthoringImplementations} from '@victframework/ui-patterns-svelte/authoring';
import {mediaAuthoringDescriptors,mediaAuthoringImplementations,mediaVectorExample,AssetProvider} from '@victframework/ui-media-svelte';
import '@victframework/ui-svelte/styles.css';import '@victframework/ui-svelte/catalog.css';import '@victframework/ui-ai-svelte/styles.css';import '@victframework/ui-flow-svelte/styles.css';import '@victframework/ui-svelte/rhea.css';
const descriptors=[...catalogDescriptors,...aiAuthoringDescriptors,...flowAuthoringDescriptors,...patternAuthoringDescriptors,...mediaAuthoringDescriptors];
const implementations=[...catalogImplementations,...aiAuthoringImplementations,...flowAuthoringImplementations,...patternAuthoringImplementations,...mediaAuthoringImplementations];
const literal=(value:unknown)=>({type:'literal',value});
let graph=$state(serializeGraph({...emptyGraph(),nodeTypes:[{id:'processor',label:'Processor',fields:[{id:'prompt',label:'Prompt',kind:'textarea',default:'Packed consumer'},{id:'enabled',label:'Enabled',kind:'toggle',default:true},{id:'amount',label:'Amount',kind:'number',default:2},{id:'mode',label:'Mode',kind:'select',default:'Fast',options:['Fast','Careful']}],ports:[{id:'in',label:'Text in',direction:'input',type:'text'},{id:'out',label:'Text out',direction:'output',type:'text'}]}],nodes:[{id:'node1',type:'processor',label:'Editable processor',position:{x:60,y:50},values:{}}]}));
const source={schema:'vict.ui-document@1',id:'packed-foundation',revision:'1',root:'root',nodes:{root:{kind:'element',id:'root',tag:'main',children:['chat','drawer','gallery','icon','vector']},chat:{kind:'component',id:'chat',definitionId:'vict.ai.message',revision:'2',props:{role:literal('assistant'),text:literal('Packed public DocumentHost with explicit parts.')},partStyles:{bubble:{localStyle:[{property:'background-color',value:{type:'text',value:'#e0f2f1'}}]}}},drawer:{kind:'component',id:'drawer',definitionId:'vict.pattern.drawer',revision:'1',props:{title:literal('Packed drawer'),triggerLabel:literal('Open packed drawer')}},gallery:{kind:'component',id:'gallery',definitionId:'vict.pattern.carousel',revision:'1',props:{slides:literal(['One','Two','Three'])}},icon:{kind:'component',id:'icon',definitionId:'vict.media.icon',revision:'1',props:{name:literal('search'),decorative:literal(false),label:literal('Search icon')}},vector:{kind:'component',id:'vector',definitionId:'vict.media.vector',revision:'1',props:{data:literal(JSON.stringify(mediaVectorExample)),label:literal('Packed vector')}}},componentDefinitions:{},assets:{},styleSources:{},tokens:{},conditions:{},localState:{}};
Object.assign(source.localState,{drawerOpen:{key:'drawerOpen',type:'boolean',initial:false},slideIndex:{key:'slideIndex',type:'number',initial:0}});
Object.assign(source.nodes.drawer,{props:{...source.nodes.drawer.props,open:{type:'ref',path:'state.drawerOpen'}},outputs:{openChange:{setState:{key:'drawerOpen'}}}});
Object.assign(source.nodes.gallery,{props:{...source.nodes.gallery.props,index:{type:'ref',path:'state.slideIndex'}},outputs:{indexChange:{setState:{key:'slideIndex'}}}});
Object.assign(source.localState,{registeredGraph:{key:'registeredGraph',type:'string',initial:graph}});
Object.assign(source.nodes,{registeredGraph:{kind:'component',id:'registeredGraph',definitionId:'vict.flow.editor',revision:'2',props:{graph:{type:'ref',path:'state.registeredGraph'},label:literal('Registered packed graph'),height:literal(480)},outputs:{graphChange:{setState:{key:'registeredGraph'}}},partStyles:{toolbar:{localStyle:[{property:'background-color',value:{type:'text',value:'#edf0fa'}}]}}}});
source.nodes.root.children.push('registeredGraph');
Object.assign(source.localState,{packedModel:{key:'packedModel',type:'string',initial:'one'}});
Object.assign(source.nodes,{ownedModel:{kind:'component',id:'ownedModel',definitionId:'vict.ai.model-selector',revision:'1',props:{model:{type:'ref',path:'state.packedModel'},allowActions:literal(true),data:literal(JSON.stringify({version:1,models:[{id:'one',label:'One'},{id:'two',label:'Two'}],efforts:[]}))},outputs:{modelChange:{setState:{key:'packedModel'}}}}});
source.nodes.root.children.push('ownedModel');
const compiled=compileUiDocument(source as any,defaultSemanticElementCatalog(),descriptors);
if(!compiled.ok)throw Error(JSON.stringify(compiled));
const compositionPlans=compositionSources.map(source=>{const result=compileUiDocument(source as any,defaultSemanticElementCatalog(),descriptors);if(!result.ok)throw Error(JSON.stringify(result));return {source,plan:result.plan};});
</script>
<h1>Foundation packed consumer</h1><p>Supporting authored fixture. No provider or interaction verification is claimed by its build.</p>
{#snippet tooltipTrigger(attributes)}<Button.Root {...attributes} class="vict-btn vict-btn--secondary">Owned tooltip trigger</Button.Root>{/snippet}
<ControlScope class="vict-rhea"><AssetProvider namespace="foundation-packed-proof"><div style="position:relative;overflow:hidden" data-ui-application-viewport><DocumentHost plan={compiled.plan} localState={source.localState} extensionDescriptors={descriptors} extensionImplementations={implementations} dispatch={async()=>undefined} navigate={()=>{}} /><OwnedTooltip trigger={tooltipTrigger}>A supplied tooltip in this application.</OwnedTooltip></div><GraphSurface {graph} ongraphchange={value=>graph=value} label="Packed rich graph" height={480}/>{#each compositionPlans as entry}<h2>{entry.source.id}</h2><DocumentHost plan={entry.plan} localState={entry.source.localState} extensionDescriptors={descriptors} extensionImplementations={implementations} dispatch={async()=>undefined} navigate={()=>{}} />{/each}</AssetProvider></ControlScope>
<style>:global(body){font-family:system-ui;margin:24px}h1{font-size:24px}</style>`);
  writeFileSync(join(destination,'install.log'),run(['install','--ignore-scripts','--no-audit','--no-fund','--prefer-offline','--fetch-retries=0','--fetch-timeout=30000'],consumer));
  const comparisons=[];
  for(const pack of report.packs){
    const installed=realpathSync(join(consumer,'node_modules',pack.name));
    if(!installed.startsWith(consumer+'\\')&&!installed.startsWith(consumer+'/'))throw Error('Installed package escaped fresh consumer');
    for(const file of pack.files){if(file.path==='package.json')continue;const actual=hash(readFileSync(join(installed,file.path)));if(actual!==file.sha256)throw Error('Installed candidate bytes differ: '+pack.name+'/'+file.path);}
    comparisons.push({name:pack.name,installed,filesMatched:pack.files.filter(file=>file.path!=='package.json').length,manifestComparison:'excluded because npm normalizes package.json'});
  }
  report.installedByteComparison=comparisons;
  report.fixtureFiles=['package.json','vite.config.mjs','index.html','src/main.ts','src/App.svelte','src/composition-sources.json'].map(path=>({path,sha256:hash(readFileSync(join(consumer,path)))}));
  writeFileSync(join(destination,'build.log'),run(['run','build'],consumer));
  report.outputFiles=readdirSync(join(consumer,'dist/assets')).map(name=>({name,sha256:hash(readFileSync(join(consumer,'dist/assets',name)))}));
  report.status='PASS: fresh isolated packed consumer production build';
  report.limitations=['Build does not execute browser rendering or compileUiDocument at runtime. Root must exercise the served consumer through CUA before behavior claims.','No actual-agent output proof, device proof, service or provider call.'];
  save();console.log(JSON.stringify({reportPath,status:report.status,destination,consumer,packs:report.packs.map(({name,sha256})=>({name,sha256}))},null,2));
}catch(error){report.status='FAIL';report.failure=String(error);save();console.error(JSON.stringify({reportPath,destination,status:report.status,error:String(error)},null,2));process.exitCode=1;}
