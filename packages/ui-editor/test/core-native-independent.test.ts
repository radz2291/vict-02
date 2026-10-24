import { expect, it } from 'vitest';
import { canonicalUiDocument, defaultSemanticElementCatalog, type UiDocument, type DocumentStorePort } from '@victframework/ui';
import { EditorBridge } from '../src/bridge.js';
import { wireNativeInput } from '../src/commands.js';

for (const tag of ['textarea', 'select']) it(`wires advertised native ${tag} through canonical history and saved source`, () => {
  const document: UiDocument = { schema:'vict.ui-document@1', id:`independent-${tag}`, revision:'1', root:'root',
    nodes:{root:{kind:'element',id:'root',tag:'main',children:['field']},field:{kind:'element',id:'field',tag,children:tag==='select'?['option']:[]},
      ...(tag==='select'?{option:{kind:'element' as const,id:'option',tag:'option',attributes:{value:'first'},children:[]}}:{})},
    componentDefinitions:{},localState:{},styleSources:{},conditions:{},tokens:{},assets:{} };
  let stored=document, revision='1';
  const store: DocumentStorePort={load:()=>({status:'loaded',document:stored,storedRevision:revision}),save:input=>{stored=input.document;revision=input.newStoredRevision;return{ok:true,storedRevision:revision};}};
  const bridge=new EditorBridge({initial:{document,storedRevision:revision},store,catalogs:{elements:defaultSemanticElementCatalog()}});
  const before=canonicalUiDocument(bridge.document).contentDigest;
  const result=bridge.apply(wireNativeInput({requestId:`wire-${tag}`,document:bridge.document,nodeId:'field',key:'value',initial:tag==='select'?'first':'Starting text'}));
  expect(result).toMatchObject({ok:true});
  expect(bridge.document.nodes.field).toMatchObject({attributes:{value:{type:'ref',path:'state.value'}},interactions:[{on:'change',action:'setState',key:'value'}]});
  expect(bridge.document.localState.value.type).toBe('string');
  expect(bridge.undo().ok).toBe(true); expect(canonicalUiDocument(bridge.document).contentDigest).toBe(before);
  expect(bridge.redo().ok).toBe(true); expect(bridge.save().ok).toBe(true);
  const saved=canonicalUiDocument(bridge.document).contentDigest;
  expect(bridge.reopen().ok).toBe(true); expect(canonicalUiDocument(bridge.document).contentDigest).toBe(saved);
});
