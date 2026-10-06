<script lang="ts">
import { Inspector, EditorBridge, createLocalStorageDocumentStore } from '../../../../packages/ui-editor/src/index.ts';
import {validateUiDocument} from '@victframework/ui';
import {reviewDocument,reviewCatalogs} from '../../../../examples/ui-design-proof/src/routes/editor-review/review-document.ts';
const doc=structuredClone(reviewDocument);
doc.nodes.request.interactions=[{on:'click',action:'invokeAction',actionId:'review.request',input:{message:{op:'literal',value:'keep-input'}}}];
doc.nodes.title.interactions=[{on:'click',action:'navigate',routeId:'route.a',params:{id:{op:'literal',value:'keep-param'}}}];
const memory=new Map();
const store=createLocalStorageDocumentStore({getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)},{key:'independent',format:'vict.independent@1',seedStoredRevision:'1',validateDocument:d=>validateUiDocument(d,{...reviewCatalogs,actionIds:['review.request','review.other'],routeIds:['route.a','route.b']})});
const bridge=new EditorBridge({store,initial:{document:doc,storedRevision:'1'}});
let v=$state(0);let selected=$state('review|request');
$effect(()=>bridge.subscribe(()=>v++));
const working=$derived.by(()=>{v;return bridge.document;});
window.__review={getDocument:()=>bridge.document,select:(id)=>selected='review|'+id};
</script>
<Inspector document={working} selectedOccurrence={selected} labels={{nodes:{title:'A deliberately lengthy selected heading label to verify wrapping and readable controls in a narrow editing panel without hiding the reset buttons or fields'}}} knownActionIds={['review.request','review.other']} knownRouteIds={['route.a','route.b']} onApply={draft=>{const result=bridge.apply(draft);window.__last=result;}} />

