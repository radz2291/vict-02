import {describe,it,expect} from 'vitest';
import {canonicalUiDocument,isUiClassList,UiEditSession,type UiDocument} from '@victframework/ui';
import {EditorBridge,type DocumentStorePort} from '../src/bridge.js';
import {setClasses} from '../src/commands.js';
const source=():UiDocument=>({schema:'vict.ui-document@1',id:'classes',revision:'1',root:'root',nodes:{root:{kind:'element',id:'root',tag:'main',classes:['legacy'],children:['field']},field:{kind:'element',id:'field',tag:'input',classes:['retained'],children:[]}},componentDefinitions:{},localState:{},styleSources:{},tokens:{},conditions:{},assets:{}});
describe('canonical authored class transactions',()=>{
 it('accepts normal punctuation/Unicode DOM tokens without a project allowlist and rejects malformed/bounded input',()=>{
  for(const value of [[],['😀'.repeat(256)],['brand:active','md:grid-cols-[1fr_2fr]','作品','vict-graph-drag-handle','nodrag']])expect(isUiClassList(value)).toBe(true);
  for(const value of [[''],['a b'],['a\tb'],['a\nb'],['a\0b'],['x'.repeat(257)],['😀'.repeat(257)],Array(101).fill('x'),['okay',1],undefined])expect(isUiClassList(value)).toBe(false);
 });
 it('uses one undoable replace/clear operation and preserves classes through save/reopen and JSON source roundtrip',()=>{
  let stored=source(),revision='1';const store:DocumentStorePort={load:()=>({status:'loaded',document:stored,storedRevision:revision}),save:input=>{stored=input.document;revision=input.newStoredRevision;return {ok:true,storedRevision:revision};}};
  const bridge=new EditorBridge({initial:{document:stored,storedRevision:revision},store});
  const classes=['project:heading','作品'];expect(bridge.apply(setClasses({requestId:'classes-set',nodeId:'root',classes})).ok).toBe(true);classes.push('mutated-caller');
  expect(bridge.document.nodes.root.classes).toEqual(['project:heading','作品']);expect(bridge.document.nodes.field.classes).toEqual(['retained']);
  expect(bridge.undo().ok).toBe(true);expect(bridge.document.nodes.root.classes).toEqual(['legacy']);expect(bridge.redo().ok).toBe(true);
  expect(bridge.apply(setClasses({requestId:'classes-clear',nodeId:'root',classes:[]})).ok).toBe(true);expect(bridge.document.nodes.root.classes).toEqual([]);
  expect(bridge.save().ok).toBe(true);const saved=canonicalUiDocument(bridge.document).contentDigest;expect(bridge.reopen().ok).toBe(true);expect(canonicalUiDocument(bridge.document).contentDigest).toBe(saved);
  const imported=UiEditSession.open({document:JSON.parse(JSON.stringify(bridge.document)),storedRevision:revision});expect(imported.document.nodes.root.classes).toEqual([]);expect(imported.document.nodes.field.classes).toEqual(['retained']);
 });
 it('rejects invalid tokens or missing targets atomically without accepting a valid earlier prefix',()=>{
  const session=UiEditSession.open({document:source(),storedRevision:'1'}),before=canonicalUiDocument(session.document).contentDigest;
  const result=session.applyTransaction({requestId:'classes-refuse',expectedDocumentRevision:session.workingRevision,commands:[{op:'setClasses',nodeId:'root',classes:['valid']},{op:'setClasses',nodeId:'field',classes:['two words']}]});
  expect(result.ok).toBe(false);expect(canonicalUiDocument(session.document).contentDigest).toBe(before);
  expect(session.applyTransaction({requestId:'missing',expectedDocumentRevision:session.workingRevision,commands:[{op:'setClasses',nodeId:'missing',classes:[]}]}).ok).toBe(false);
 });
 it('does not reinterpret historical imported class arrays during unrelated edits',()=>{
  const doc=source();const legacy={...doc,nodes:{...doc.nodes,root:{...doc.nodes.root,classes:['historical combined entry']}}};
  const session=UiEditSession.open({document:legacy,storedRevision:'1'});expect(session.applyTransaction({requestId:'unrelated',expectedDocumentRevision:session.workingRevision,commands:[{op:'setAttribute',nodeId:'field',name:'aria-label',value:'Field'}]}).ok).toBe(true);
  expect(session.document.nodes.root.classes).toEqual(['historical combined entry']);
 });
});
