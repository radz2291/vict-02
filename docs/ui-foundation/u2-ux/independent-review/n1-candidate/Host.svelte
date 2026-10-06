<script lang="ts">
import Original83 from './Original83.svelte';
import {Inspector,Layers,EditorCanvas,EditorBridge,createLocalStorageDocumentStore} from '../../../../../packages/ui-editor/src/index.ts';
import {compileUiDocument,validateUiDocument} from '@victframework/ui';
import {reviewDocument,reviewCatalogs,reviewLabels} from '../../../../../examples/ui-design-proof/src/routes/editor-review/review-document.ts';
const Panel=location.search.includes('original')?Original83:Inspector;
reviewCatalogs.viewFields={rows:'array','rows.id':'string','rows.name':'string'};
const seed=structuredClone(reviewDocument);seed.nodes.page.children.push('rows');
seed.nodes.rows={id:'rows',kind:'repeat',itemName:'row',collection:{type:'ref',path:'view.rows'},key:{type:'ref',path:'repeat.row.id'},templateRoot:'row'};
seed.nodes.row={id:'row',kind:'element',tag:'p',children:['rowText'],attributes:{'data-row':{type:'ref',path:'repeat.row.id'}}};seed.nodes.rowText={id:'rowText',kind:'text',content:{type:'expression',expression:{type:'ref',path:'repeat.row.name'}}};
seed.nodes.row.attributes.tabindex='0';seed.nodes.row.styleSources=['rowHover','rowFocus','rowActive'];
for(const [id,pseudo,size] of [['rowHover','hover','41px'],['rowFocus','focus','51px'],['rowActive','active','71px']])seed.styleSources[id]={id,pseudo,declarations:[{property:'font-size',value:{type:'text',value:size}}]};
seed.nodes.cardA.styleSources=['instanceSeed'];seed.styleSources.instanceSeed={id:'instanceSeed',declarations:[{property:'background-color',value:{type:'text',value:'#bbddcc'}}]};
const view={rows:[{id:'a',name:'First repeated row'},{id:'b',name:'Second repeated row'}]};
const store=createLocalStorageDocumentStore(localStorage,{key:'vict.independent.n1',format:'vict.independent.n1@1',seedStoredRevision:'1',validateDocument:d=>validateUiDocument(d,reviewCatalogs)});const loaded=store.load();
const bridge=new EditorBridge({store,initial:loaded.status==='loaded'?loaded:{document:seed,storedRevision:'1'}});let v=$state(0);let canvas=$state<HTMLElement>();let issues=$state([]);const reads=[];
$effect(()=>bridge.subscribe(()=>v++));const working=$derived.by(()=>{v;return bridge.document;});const snapshot=$derived.by(()=>{v;return bridge.getSnapshot();});const compiled=$derived(compileUiDocument(working,reviewCatalogs.elements,[],{actionIds:reviewCatalogs.actionIds,viewFields:reviewCatalogs.viewFields}));
function effective(occ,property){const el=Array.from(canvas?.querySelectorAll('[data-ui-occ]')??[]).find(e=>e.dataset.uiOcc===occ);const value=el?getComputedStyle(el).getPropertyValue(property):undefined;reads.push({occ,property,value});return value;}
let hook=$state(effective);
function apply(draft){window.__test.drafts.push(draft);const result=bridge.apply(draft);window.__test.last=result;issues=result.ok?[]:result.issues;}
window.__test={doc:()=>bridge.document,snapshot:()=>bridge.getSnapshot(),select:occ=>bridge.select(occ),undo:()=>bridge.undo(),redo:()=>bridge.redo(),save:()=>bridge.save(),reopen:()=>bridge.reopen(),reads,drafts:[],replaceHook:()=>hook=(occ,p)=>effective(occ,p)};
</script>
<div class="toolbar"><button onclick={()=>bridge.undo()}>Undo</button><button onclick={()=>bridge.redo()}>Redo</button><button onclick={()=>bridge.save()}>Save</button><button onclick={()=>bridge.reopen()}>Reopen</button></div>
<div class="host"><div class="layers">{#if compiled.ok}<Layers plan={compiled.plan} document={working} labels={reviewLabels} selectedOccurrence={snapshot.selectedOccurrence} onSelect={occ=>bridge.select(occ)} scope={{view,record:{},state:{},tokens:{}}} />{/if}</div><Panel document={working} selectedOccurrence={snapshot.selectedOccurrence} labels={reviewLabels} onApply={apply} lastIssues={issues} readEffective={hook} knownActionIds={reviewCatalogs.actionIds} styleConditions={[{id:'narrow',label:'Window ≤700px'},{id:'compact',label:'Canvas ≤480px'}]} /><div class="canvas" bind:this={canvas}><EditorCanvas document={working} catalogs={reviewCatalogs} view={view} selectedOccurrence={snapshot.selectedOccurrence} onSelect={occ=>bridge.select(occ)} dispatch={async()=>{}} navigate={()=>{}} /></div></div>
<style>.host{display:grid;grid-template-columns:220px 320px minmax(0,1fr);height:830px}.canvas{min-width:0;overflow:auto;container:review-canvas/inline-size}.toolbar{height:32px}.layers{min-width:0} :global([data-row=a]){font-size:17px;color:#aa2200}:global([data-row=b]){font-size:31px;color:#0022bb}@media(max-width:700px){.host{display:flex;flex-direction:column;height:auto}.layers{display:none}.host :global(.uv-inspector){height:760px;width:100%;flex:none}.canvas{width:100%}}</style>


