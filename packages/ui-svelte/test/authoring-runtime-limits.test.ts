import {expect,it} from 'vitest';
import {compileUiDocument,defaultSemanticElementCatalog,type UiDocument} from '@victframework/ui';
import {runtimeAuthoringIssues} from '../src/document/authoring-runtime.js';
import {catalogDescriptors,catalogImplementations} from '../src/catalog/components/catalog.js';

it('completely validates provider identities after5000 ordinary instructions and still rejects a late duplicate',()=>{
  const filler=Array.from({length:5001},(_,i)=>`text-${i}`);
  const source:UiDocument={schema:'vict.ui-document@1',id:'large-identity',revision:'1',root:'menu',nodes:{
    menu:{kind:'component',id:'menu',definitionId:'vict.catalog.menubar',slots:{menus:{name:'menus',children:['wrapper']}}},
    wrapper:{kind:'element',id:'wrapper',tag:'div',children:[...filler,'first','second']},
    ...Object.fromEntries(filler.map(id=>[id,{kind:'text',id,content:{type:'literal',value:''}}])),
    first:{kind:'component',id:'first',definitionId:'vict.catalog.menubar.menu',props:{label:{type:'literal',value:'First'},value:{type:'ref',path:'state.first'}},slots:{items:{name:'items',children:['one']}}},
    second:{kind:'component',id:'second',definitionId:'vict.catalog.menubar.menu',props:{label:{type:'literal',value:'Second'},value:{type:'ref',path:'state.second'}},slots:{items:{name:'items',children:['two']}}},
    one:{kind:'component',id:'one',definitionId:'vict.catalog.menubar.item',props:{label:{type:'literal',value:'One'}}},
    two:{kind:'component',id:'two',definitionId:'vict.catalog.menubar.item',props:{label:{type:'literal',value:'Two'}}},
  },localState:{first:{key:'first',type:'string',initial:'first'},second:{key:'second',type:'string',initial:'second'}},componentDefinitions:{},tokens:{},styleSources:{},assets:{},conditions:{}};
  const compiled=compileUiDocument(source,defaultSemanticElementCatalog(),catalogDescriptors);expect(compiled.ok).toBe(true);if(!compiled.ok)throw Error('compile');
  const owner=compiled.plan.structure[0]!;if(owner.kind!=='extension')throw Error('provider');
  expect(runtimeAuthoringIssues(owner,{state:{first:'first',second:'second'},tokens:{}},compiled.plan,catalogImplementations)).toEqual([]);
  expect(runtimeAuthoringIssues(owner,{state:{first:'same',second:'same'},tokens:{}},compiled.plan,catalogImplementations)).toEqual(expect.arrayContaining([expect.objectContaining({code:'UI_AUTHORING_RUNTIME_IDENTITY',message:'Rendered sibling component identities are ambiguous.'})]));
});
it('does not skip repeat rows beyond5001 when validating controlled provider identities',()=>{
  const source:UiDocument={schema:'vict.ui-document@1',id:'many-menu-rows',revision:'1',root:'menu',nodes:{
    menu:{kind:'component',id:'menu',definitionId:'vict.catalog.menubar',slots:{menus:{name:'menus',children:['rows']}}},
    rows:{kind:'repeat',id:'rows',collection:{type:'ref',path:'view.rows'},key:{type:'ref',path:'repeat.row.id'},itemName:'row',templateRoot:'entry'},
    entry:{kind:'component',id:'entry',definitionId:'vict.catalog.menubar.menu',props:{label:{type:'literal',value:'Menu'},value:{type:'ref',path:'repeat.row.id'}},slots:{items:{name:'items',children:['item']}}},
    item:{kind:'component',id:'item',definitionId:'vict.catalog.menubar.item',props:{label:{type:'literal',value:'Item'}}},
  },localState:{},componentDefinitions:{},tokens:{},styleSources:{},assets:{},conditions:{}};
  const compiled=compileUiDocument(source,defaultSemanticElementCatalog(),catalogDescriptors,{viewFields:{rows:'array','rows.id':'string'}});
  expect(compiled.ok,JSON.stringify(compiled)).toBe(true);if(!compiled.ok)throw Error('repeat compile');
  const owner=compiled.plan.structure[0]!;if(owner.kind!=='extension')throw Error('repeat provider');
  const rows=Array.from({length:5002},(_,i)=>({id:`row-${i}`}));
  const scope={state:{},tokens:{},view:{rows}};
  expect(runtimeAuthoringIssues(owner,scope,compiled.plan,catalogImplementations)).toEqual([]);
  rows[5001]!.id='row-0';
  expect(runtimeAuthoringIssues(owner,scope,compiled.plan,catalogImplementations)).toEqual(expect.arrayContaining([expect.objectContaining({message:'Rendered sibling component identities are ambiguous.'})]));
});
