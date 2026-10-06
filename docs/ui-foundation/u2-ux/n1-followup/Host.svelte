<script lang="ts">
import OriginalInspector from "./OriginalInspector.svelte";
const Panel = location.search.includes("original") ? OriginalInspector : Inspector;
import {Inspector,Layers,EditorCanvas,EditorBridge,createLocalStorageDocumentStore} from '../../../../packages/ui-editor/src/index.ts';
import {compileUiDocument,validateUiDocument} from '@victframework/ui';
import {reviewDocument,reviewCatalogs,reviewLabels} from '../../../../examples/ui-design-proof/src/routes/editor-review/review-document.ts';
let doc=structuredClone(reviewDocument);
if (location.search.includes('live')) {
 doc.nodes.title.localStyle = doc.nodes.title.localStyle.filter(d => d.property !== 'font-size');
 doc.nodes.title.attributes = {tabindex:'0'};
 doc.nodes.title.styleSources = ['liveNormal','liveHover','liveFocus','liveActive'];
 for (const [id,pseudo,size] of [['liveNormal',undefined,'17px'],['liveHover','hover','41px'],['liveFocus','focus','51px'],['liveActive','active','71px']]) {
  doc.styleSources[id] = {id,...(pseudo ? {pseudo} : {}),declarations:[{property:'font-size',value:{type:'text',value:size}}]};
 }
}
doc.nodes.hero.children.push('bound');doc.nodes.bound={kind:'element',id:'bound',tag:'div',children:[],localStyle:[{property:'padding-top',value:{type:'binding',expression:{op:'literal',value:'9px'}}}]};
doc.nodes.request.interactions=[{on:'click',action:'invokeAction',actionId:'review.request',input:{message:{op:'literal',value:'keep'}}}];
doc.nodes.title.interactions=[{on:'click',action:'navigate',routeId:'route.a',params:{id:{op:'literal',value:'keep'}}}];
const memory=new Map();const store=createLocalStorageDocumentStore({getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)},{key:'review',format:'vict.independent@1',seedStoredRevision:'1',validateDocument:d=>validateUiDocument(d,{...reviewCatalogs,actionIds:['review.request','review.other'],routeIds:['route.a','route.b']})});
const bridge=new EditorBridge({store,initial:{document:doc,storedRevision:'1'}});let v=$state(0);let container=$state<HTMLElement>();let issues=$state([]);
$effect(()=>bridge.subscribe(()=>v++));const working=$derived.by(()=>{v;return bridge.document;});const snapshot=$derived.by(()=>{v;return bridge.getSnapshot();});const plan=$derived(compileUiDocument(working,reviewCatalogs.elements,[],{actionIds:['review.request','review.other'],routeIds:['route.a','route.b']}));
function effective(occ,p){const e=Array.from(container?.querySelectorAll('[data-ui-occ]')??[]).find(e=>e.dataset.uiOcc===occ);return e?getComputedStyle(e).getPropertyValue(p):undefined;}
window.__test={doc:()=>bridge.document,snapshot:()=>bridge.getSnapshot(),select:id=>bridge.select('review|'+id),undo:()=>bridge.undo(),redo:()=>bridge.redo(),save:()=>bridge.save(),reopen:()=>bridge.reopen(),drafts:[]};
function apply(draft){window.__test.drafts.push(draft);const result=bridge.apply(draft);window.__test.last=result;issues=result.ok?[]:result.issues;}
</script>
<div class="host"><div>{#if plan.ok}<Layers document={working} plan={plan.plan} labels={reviewLabels} selectedOccurrence={snapshot.selectedOccurrence} onSelect={occ=>bridge.select(occ)} scope={{view:{},record:{},state:{},tokens:{}}} />{/if}</div><Panel document={working} selectedOccurrence={snapshot.selectedOccurrence} labels={reviewLabels} onApply={apply} lastIssues={issues} readEffective={effective} knownActionIds={['review.request','review.other']} knownRouteIds={['route.a','route.b']} styleConditions={[{id:'compact',label:'Compact canvas'},{id:'narrow',label:'Narrow window'}]} /><div bind:this={container}><EditorCanvas document={working} catalogs={reviewCatalogs} selectedOccurrence={snapshot.selectedOccurrence} onSelect={occ=>bridge.select(occ)} /></div></div>
<style>.host{display:grid;grid-template-columns:220px minmax(0,1fr) 320px;height:850px} .host>div{min-width:0;overflow:auto}@media(max-width:700px){.host{display:flex;flex-direction:column;width:100%;height:auto}.host>:first-child{display:none}.host :global(.uv-inspector){height:780px;flex:none;width:100%;box-sizing:border-box}.host>div:last-child{width:100%}} </style>


