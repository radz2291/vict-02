import {describe,it,expect} from 'vitest';
import {createUiAuthoringRegistry,authoringSemanticIssues,defaultSemanticElementCatalog,type UiDocument,type UiAuthoringRegistration} from '@victframework/ui';
import {EditorBridge} from '../src/bridge.js';
import {insertRegisteredComponent,insertRegisteredElement,authoringRecipe} from '../src/registered-authoring.js';
import {compositionTargets,canInsertRecipe} from '../src/composition.js';
const registration:UiAuthoringRegistration={descriptor:{id:'field',revision:'1',props:[{name:'value',type:'string',default:''}],slots:['items'],rendererImplementationId:'test'},label:'Field',family:'test',category:'input',purpose:'A field',eligibility:{kind:'standalone'},seed:{root:'seed',nodes:[{kind:'component',id:'seed',definitionId:'field',revision:'1'}]}};
const registry=createUiAuthoringRegistry([{schema:'vict.ui-authoring@1',packageName:'test',packageVersion:'1',registrations:[registration],exportDispositions:[]}],[{extensionId:'field',revision:'1',rendererImplementationId:'test',slots:['items']}]);
const doc:UiDocument={schema:'vict.ui-document@1',id:'test',revision:'1',root:'root',nodes:{root:{kind:'element',id:'root',tag:'main',children:[]}},componentDefinitions:{},localState:{},styleSources:{},tokens:{},assets:{},conditions:{}};
const store={load:()=>({status:'loaded' as const,document:doc,storedRevision:'s1'}),save:(input:{newStoredRevision:string})=>({ok:true as const,storedRevision:input.newStoredRevision})};
describe('registered canonical authoring',()=>{
  it('pins generic insertion and preserves Undo/Redo',()=>{
    const bridge=new EditorBridge({store,initial:{document:doc,storedRevision:'s1'},catalogs:{elements:defaultSemanticElementCatalog(),extensions:registry.descriptors},validateDocument:(current,previous)=>authoringSemanticIssues(current,registry,{previous})});
    expect(bridge.apply(insertRegisteredComponent({requestId:'insert',registry,nodeId:'a',definitionId:'field',target:{nodeId:'root'}})).ok).toBe(true);
    expect(bridge.document.nodes.a).toMatchObject({definitionId:'field',revision:'1'});expect(bridge.undo().ok).toBe(true);expect(bridge.document.nodes.a).toBeUndefined();expect(bridge.redo().ok).toBe(true);
    expect(authoringRecipe(registration)?.create('b')[0]?.id).toBe('b');
  });
  it('uses the active native catalog and refuses unregistered tags/leaf content',()=>{
    const catalog=defaultSemanticElementCatalog();
    expect(insertRegisteredElement({requestId:'native',catalog,nodeId:'title',tag:'h6',target:{nodeId:'root'},text:'Title'}).commands).toHaveLength(2);
    expect(()=>insertRegisteredElement({requestId:'x',catalog,nodeId:'x',tag:'made-up',target:{nodeId:'root'}})).toThrow('active semantic catalog');
    expect(()=>insertRegisteredElement({requestId:'x',catalog,nodeId:'x',tag:'img',target:{nodeId:'root'},text:'no'})).toThrow('cannot own text');
  });
  it('does not reject warning-only host validation and passes previous source on edit/save/reopen',()=>{
    const previous:UiDocument[]=[];const bridge=new EditorBridge({store,initial:{document:doc,storedRevision:'s1'},validateDocument:(_current,before)=>{if(before)previous.push(before);return [{code:'UI_DOC_UNSUPPORTED_FEATURE',message:'Retained warning',severity:'warning'}];}});
    expect(bridge.apply(insertRegisteredElement({requestId:'a',catalog:defaultSemanticElementCatalog(),nodeId:'a',tag:'div',target:{nodeId:'root'}})).ok).toBe(true);expect(bridge.save().ok).toBe(true);expect(bridge.reopen().ok).toBe(true);expect(previous.length).toBeGreaterThanOrEqual(4);
  });
  it('reads component slot choices from exact effective revision',()=>{
    const document={...doc,nodes:{...doc.nodes,field:{kind:'component' as const,id:'field',definitionId:'field'}}};
    const newer={...registration.descriptor,revision:'2',slots:['new']};
    expect(compositionTargets(document,[registration.descriptor,newer]).filter(target=>target.nodeId==='field').map(target=>target.slotName)).toEqual(['new']);
  });
  it('uses actual provider occurrence context for wrapper and local-definition slot insertion affordances',()=>{
    const recipe={id:'part',label:'Part',description:'Part',placements:[{definitionId:'field',slotName:'items'}],create:()=>[]};
    const wrapped:UiDocument={...doc,nodes:{root:{kind:'element',id:'root',tag:'main',children:['field']},field:{kind:'component',id:'field',definitionId:'field',slots:{items:{name:'items',children:['wrapper']}}},wrapper:{kind:'element',id:'wrapper',tag:'div',children:[]}}};
    expect(canInsertRecipe(recipe,wrapped,{nodeId:'wrapper'})).toBe(true);expect(canInsertRecipe(recipe,wrapped,{nodeId:'root'})).toBe(false);
    const local:UiDocument={...wrapped,nodes:{...wrapped.nodes,root:{kind:'element',id:'root',tag:'main',children:['local']},local:{kind:'component',id:'local',definitionId:'local.provider'},field:{kind:'component',id:'field',definitionId:'field',slots:{items:{name:'items',children:['slot']}}},slot:{kind:'slot',id:'slot',name:'children',fallback:[]}},componentDefinitions:{'local.provider':{id:'local.provider',revision:'1',root:'field',props:[],slots:{children:{}}}}};
    expect(canInsertRecipe(recipe,local,{nodeId:'local',slotName:'children'})).toBe(true);
  });
});
