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

function scopedNativeDocument():UiDocument {
  return {schema:'vict.ui-document@1',id:'scoped-native',revision:'1',root:'workspace',
    nodes:{workspace:{kind:'component',id:'workspace',definitionId:'example.scoped',revision:'1',slots:{body:{name:'body',scope:{schema:'vict.ui-slot-scope@1',props:[],state:{value:{key:'value',type:'string',initial:'node value',controlled:true}}},children:['wrapper']}}},wrapper:{kind:'conditional',id:'wrapper',branches:[{children:['field']}]},field:{kind:'element',id:'field',tag:'textarea',children:[]}},
    localState:{value:{key:'value',type:'string',initial:'root value'}},componentDefinitions:{},styleSources:{},conditions:{},tokens:{},assets:{}};
}
it('wires native fields to their nearest declared slot state without adding or changing root state',()=>{
  const document=scopedNativeDocument(),before=canonicalUiDocument(document).contentDigest;
  const draft=wireNativeInput({requestId:'scope-native',document,nodeId:'field',key:'value'});
  expect(draft.commands.map(command=>command.op)).toEqual(['setAttribute','connectInteraction']);
  expect(draft.commands).toMatchObject([{name:'value',value:{type:'ref',path:'state.value'}},{interaction:{on:'change',action:'setState',key:'value'}}]);
  expect(document.localState.value.initial).toBe('root value');
  expect(canonicalUiDocument(document).contentDigest).toBe(before);
});
it('refuses undeclared or mismatched scoped native state even when a matching root key exists',()=>{
  const document=scopedNativeDocument(),workspace=document.nodes.workspace;
  if(workspace.kind!=='component')throw Error('fixture');
  const missing={...document,nodes:{...document.nodes,workspace:{...workspace,slots:{body:{...workspace.slots!.body,scope:{schema:'vict.ui-slot-scope@1' as const,props:[],state:{}}}}}}};
  expect(()=>wireNativeInput({requestId:'missing-scope',document:missing,nodeId:'field',key:'value'})).toThrow('Declare this scoped state key');
  const number={...document,nodes:{...document.nodes,workspace:{...workspace,slots:{body:{...workspace.slots!.body,scope:{schema:'vict.ui-slot-scope@1' as const,props:[],state:{value:{key:'value',type:'number' as const,initial:1}}}}}}}};
  expect(()=>wireNativeInput({requestId:'wrong-scope',document:number,nodeId:'field',key:'value'})).toThrow('different type');
});
