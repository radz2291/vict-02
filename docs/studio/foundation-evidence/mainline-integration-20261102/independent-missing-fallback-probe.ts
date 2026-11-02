import {compileUiDocument,defaultSemanticElementCatalog,UiEditSession} from '@victframework/ui';
const document=JSON.parse(JSON.stringify({schema:'vict.ui-document@1',id:'missing-fallback-audit',revision:'1',root:'field',nodes:{field:{kind:'element',id:'field',tag:'input',children:[],interactions:[{on:'change',action:'setState',key:'message'}]}},localState:{message:{key:'message',type:'string',initial:'initial'}},componentDefinitions:{},styleSources:{},tokens:{},conditions:{},assets:{}}));
const compiled=compileUiDocument(document,defaultSemanticElementCatalog());
let sessionOpened=false;
try{UiEditSession.open({document,storedRevision:'1'});sessionOpened=true;}catch{}
console.log(JSON.stringify({compiled:compiled.ok,sessionOpened,projection:'Not run here: plain TSX does not transform transitive Svelte modules. Use the Svelte-backed projection regression.'}));
